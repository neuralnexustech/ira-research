/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import * as net from "net";
import * as fs from "fs";

// Native Messaging Host protocol requires reading 4-byte length prefix
// followed by JSON message, and writing the same back.

const PORT = 18765;
let tcpClient: net.Socket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;

// Log to file for troubleshooting native messaging
const logStream = fs.createWriteStream(__dirname + "/native-host.log", { flags: "a" });
logStream.on("error", (err) => {
  // Silent fallback to avoid infinite recursion crashes
});

function log(msg: string) {
  try {
    logStream.write(`[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {}
}

log("Native Messaging Host starting...");

// Set up connection to MCP Server TCP port
function connectToMcpServer() {
  if (tcpClient) return;

  log(`Attempting to connect to MCP Server on TCP port ${PORT}...`);
  tcpClient = new net.Socket();

  tcpClient.connect(PORT, "127.0.0.1", () => {
    log("Connected to MCP Server successfully.");
    tcpClient?.write(JSON.stringify({ type: "ping" }) + "\n");
    sendToChrome(JSON.stringify({ type: "mcp_connection_state", connected: true }));
  });

  let tcpBuffer = "";
  // Handle data coming from MCP Server -> write to Chrome stdout
  tcpClient.on("data", (data) => {
    tcpBuffer += data.toString("utf8");
    const lines = tcpBuffer.split("\n");
    tcpBuffer = lines.pop() || "";
    
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        log(`Forwarding complete JSON message of ${line.length} bytes to Chrome.`);
        sendToChrome(line);
      } catch (e: any) {
        log(`Error forwarding to Chrome: ${e.message}`);
      }
    }
  });

  tcpClient.on("close", () => {
    log("MCP Server TCP connection closed.");
    tcpClient = null;
    sendToChrome(JSON.stringify({ type: "mcp_connection_state", connected: false }));
    scheduleReconnect();
  });

  tcpClient.on("error", (err) => {
    log(`MCP Server TCP error: ${err.message}`);
    tcpClient = null;
    sendToChrome(JSON.stringify({ type: "mcp_connection_state", connected: false }));
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  reconnectTimeout = setTimeout(() => {
    connectToMcpServer();
  }, 3000);
}

// Start connection loop
connectToMcpServer();

// --- Native Messaging Stdio Parser ---
let inputBuffer = Buffer.alloc(0);

process.stdin.on("data", (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);
  parseBuffer();
});

function parseBuffer() {
  while (inputBuffer.length >= 4) {
    // Read 4-byte little endian length prefix
    const msgLen = inputBuffer.readInt32LE(0);
    if (inputBuffer.length >= 4 + msgLen) {
      const msgData = inputBuffer.subarray(4, 4 + msgLen);
      inputBuffer = inputBuffer.subarray(4 + msgLen);
      
      try {
        const msgStr = msgData.toString("utf8");
        log(`Received message from Chrome: ${msgStr}`);
        
        // Forward message payload to MCP Server
        if (tcpClient && !tcpClient.destroyed) {
          tcpClient.write(msgStr + "\n");
        } else {
          log("Warning: MCP Server TCP not connected. Discarding message.");
          // Send failure reply back to Chrome
          const parsed = JSON.parse(msgStr);
          if (parsed.id) {
            sendToChrome(JSON.stringify({
              type: "tool_response",
              id: parsed.id,
              result: {
                success: false,
                output: "Error: Extension is unable to communicate with IRA MCP Server (TCP not connected)."
              }
            }));
          }
        }
      } catch (e: any) {
        log(`Error parsing Chrome message: ${e.message}`);
      }
    } else {
      break;
    }
  }
}

function sendToChrome(msgStr: string) {
  const msgBuf = Buffer.from(msgStr, "utf8");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeInt32LE(msgBuf.length, 0);

  // Atomic write to stdout
  process.stdout.write(Buffer.concat([lenBuf, msgBuf]));
}

process.stdin.on("end", () => {
  log("Chrome closed stdin channel. Exiting.");
  if (tcpClient) tcpClient.destroy();
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  log(`Uncaught Exception: ${err.message}\n${err.stack}`);
});
