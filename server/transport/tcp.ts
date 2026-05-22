/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import * as net from "net";
import { sessionManager } from "../session-manager";
import { ProtocolMessage, ProtocolToolResponse } from "../../shared/protocol";

const PORT = 18765;

export class TcpManager {
  private server: net.Server | null = null;
  private clientSocket: net.Socket | null = null;
  private isServer = false;

  // Primary server tracking of connected sockets
  private nativeHostSocket: net.Socket | null = null;
  private clientSockets: Map<string, net.Socket> = new Map();
  private clientId: string | null = null;

  constructor() {}

  /**
   * Attempt to start as a TCP Server. If port is in use, falls back to Client mode.
   */
  public async initialize(): Promise<{ isServer: boolean }> {
    return new Promise((resolve) => {
      this.server = net.createServer((socket) => {
        this.handleServerConnection(socket);
      });

      this.server.on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          // Port already in use -> Fallback to Client mode
          console.error(`Port ${PORT} in use. Starting in MCP Client mode.`);
          this.isServer = false;
          this.server = null;
          this.connectAsClient().then(() => {
            resolve({ isServer: false });
          });
        } else {
          console.error("TCP Server error:", err);
          resolve({ isServer: false });
        }
      });

      this.server.listen(PORT, "127.0.0.1", () => {
        console.error(`TCP Server listening on port ${PORT} (IRA Primary Mode).`);
        this.isServer = true;
        resolve({ isServer: true });
      });
    });
  }

  /**
   * Server Connection Handler
   */
  private handleServerConnection(socket: net.Socket) {
    let buffer = "";

    socket.on("data", (data) => {
      buffer += data.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const message = JSON.parse(line) as ProtocolMessage;
          this.handleServerMessage(socket, message);
        } catch (e: any) {
          console.error("Server TCP parsing error:", e.message);
        }
      }
    });

    socket.on("close", () => {
      if (socket === this.nativeHostSocket) {
        console.error("Native host messaging socket disconnected.");
        this.nativeHostSocket = null;
      } else {
        // Find and remove client socket
        for (const [clientId, sock] of this.clientSockets.entries()) {
          if (sock === socket) {
            console.error(`Client MCP session ${clientId} disconnected.`);
            this.clientSockets.delete(clientId);
            break;
          }
        }
      }
    });

    socket.on("error", (err) => {
      console.warn("Server socket error:", err.message);
    });
  }

  private handleServerMessage(socket: net.Socket, message: ProtocolMessage) {
    if (message.type === "ping") {
      // If this socket is not a client agent, it is the native host bridge
      if (!this.nativeHostSocket && !Array.from(this.clientSockets.values()).includes(socket)) {
        this.nativeHostSocket = socket;
        console.error("IRA Chrome Extension native bridge connected and registered.");
      }
      socket.write(JSON.stringify({ type: "pong" }) + "\n");
      return;
    }

    if (message.type === "client_hello") {
      // Register this socket as a Client Agent Session
      this.clientSockets.set(message.clientId, socket);
      console.error(`Registered client session: ${message.clientId}`);
      return;
    }

    if (message.type === "tool_request") {
      // Primary server forwards client's tool request to Chrome via the Native Host
      if (this.nativeHostSocket && !this.nativeHostSocket.destroyed) {
        this.nativeHostSocket.write(JSON.stringify(message) + "\n");
      } else {
        // Native messaging host is not loaded yet (Extension has not connected)
        socket.write(JSON.stringify({
          type: "tool_response",
          id: message.id,
          result: {
            success: false,
            output: "Error: No active browser connection found. Make sure the IRA Chrome Extension is loaded and active."
          }
        }) + "\n");
      }
      return;
    }

    if (message.type === "tool_response") {
      // Response received from Native Host (Browser)
      // Resolve locally if it is a local request, otherwise route back to the requesting client socket
      const msgId = message.id;
      
      // Request IDs look like "c{clientId}_{reqId}"
      // Use lastIndexOf to handle clientIds that contain underscores
      if (msgId.startsWith("c")) {
        const lastUnderscoreIdx = msgId.lastIndexOf("_");
        if (lastUnderscoreIdx > 1) {
          const clientId = msgId.substring(1, lastUnderscoreIdx);
          const clientSock = this.clientSockets.get(clientId);
          if (clientSock && !clientSock.destroyed) {
            clientSock.write(JSON.stringify(message) + "\n");
            return;
          }
        }
      }

      // Default: local request from primary server
      sessionManager.handleResponse(message);
    }
  }

  /**
   * Client connection to the Primary TCP Server
   */
  private connectAsClient(): Promise<void> {
    return new Promise((resolve) => {
      this.clientSocket = new net.Socket();
      this.clientSocket.connect(PORT, "127.0.0.1", () => {
        console.error("Connected to primary IRA Server.");
        // Identify ourselves
        this.clientId = `cli_${Math.random().toString(36).substring(2, 7)}`;
        this.clientSocket?.write(JSON.stringify({
          type: "client_hello",
          clientId: this.clientId
        }) + "\n");
        resolve();
      });

      let buffer = "";
      this.clientSocket.on("data", (data) => {
        buffer += data.toString("utf8");
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const message = JSON.parse(line) as ProtocolMessage;
            if (message.type === "tool_response") {
              sessionManager.handleResponse(message);
            }
          } catch (e: any) {
            console.error("Client TCP parsing error:", e.message);
          }
        }
      });

      this.clientSocket.on("close", () => {
        console.warn("Primary IRA Server disconnected.");
        this.clientSocket = null;
      });

      this.clientSocket.on("error", (err) => {
        console.error("Client TCP error:", err.message);
        resolve();
      });
    });
  }

  /**
   * Send a tool request from this MCP Server to the bridge
   */
  public async sendToolRequest(tool: string, args: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const reqIdPrefix = this.isServer ? "" : this.clientId;
      const reqId = `c${reqIdPrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const payload: ProtocolMessage = {
        type: "tool_request",
        id: reqId,
        tool,
        args
      };

      // Register wait callback in session manager
      sessionManager.registerRequest(reqId, resolve, reject);

      if (this.isServer) {
        // In Server mode, write directly to Native Messaging Host socket
        if (this.nativeHostSocket && !this.nativeHostSocket.destroyed) {
          this.nativeHostSocket.write(JSON.stringify(payload) + "\n");
        } else {
          // If native host hasn't connected yet, check if this is a connection message
          // Native Host automatically pings on startup which hooks up the socket
          // Let's check for any active connection
          const serverSockets = Array.from(this.clientSockets.values());
          // Native host registers as first connection without client_hello
          // So let's look for a socket that isn't in clientSockets maps!
          let foundSocket: net.Socket | null = null;
          // Look for native host socket
          // Native host registers on connection. If not yet assigned, let's treat the incoming socket as nativeHostSocket.
          // Wait! In handleServerConnection, when a socket connects, if it hasn't sent a client_hello,
          // it is the nativeHostSocket. Let's make sure it is assigned!
          if (this.nativeHostSocket) {
            this.nativeHostSocket.write(JSON.stringify(payload) + "\n");
          } else {
            sessionManager.rejectRequest(reqId, new Error("No active browser connection. Please make sure the IRA Extension is loaded in Chrome."));
          }
        }
      } else {
        // In Client mode, write to the Primary TCP Server
        if (this.clientSocket && !this.clientSocket.destroyed) {
          this.clientSocket.write(JSON.stringify(payload) + "\n");
        } else {
          sessionManager.rejectRequest(reqId, new Error("Failed to communicate with Primary IRA MCP Server (TCP disconnected)."));
        }
      }
    });
  }

  /**
   * Hook up incoming native messaging host connection
   */
  public registerNativeHostSocket(socket: net.Socket) {
    this.nativeHostSocket = socket;
    console.error("IRA Chrome Extension successfully bridged to Primary TCP Server.");
  }
}

export const tcpManager = new TcpManager();
