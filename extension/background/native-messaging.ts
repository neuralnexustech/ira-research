/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import { toolDispatcher } from "./tool-dispatcher";
import { ProtocolMessage } from "../../shared/protocol";

class NativeMessaging {
  private static instance: NativeMessaging;
  private port: chrome.runtime.Port | null = null;
  private reconnectTimeout: any = null;
  private isConnecting = false;
  public isTcpConnected = false;

  private constructor() {
    this.connect();
  }

  public static getInstance(): NativeMessaging {
    if (!NativeMessaging.instance) {
      NativeMessaging.instance = new NativeMessaging();
    }
    return NativeMessaging.instance;
  }

  /**
   * Connect to the com.ira.research native messaging host
   */
  public connect() {
    if (this.port || this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.port = chrome.runtime.connectNative("com.ira.research");
      
      this.port.onMessage.addListener((message: any) => {
        this.handleMessage(message);
      });

      this.port.onDisconnect.addListener(() => {
        const err = chrome.runtime.lastError;
        console.warn(`Native Host disconnected: ${err?.message || "Clean exit"}`);
        this.port = null;
        this.isConnecting = false;
        
        // Broadcast disconnection to hide UI overlay
        chrome.tabs.query({}, (tabs) => {
          for (const tab of tabs) {
            if (tab.id) chrome.tabs.sendMessage(tab.id, { type: "AGENT_DISCONNECTED" }).catch(() => {});
          }
        });

        // Trigger automatic reconnect with backoff
        this.scheduleReconnect();
      });

      // Send initial probe
      this.sendMessage({ type: "ping" });
      this.isConnecting = false;
    } catch (e) {
      console.error("Failed to establish native host connection", e);
      this.port = null;
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      console.log("Attempting to reconnect to native host...");
      this.connect();
    }, 5000); // 5s backoff
  }

  public hasActivePort(): boolean {
    return this.port !== null;
  }

  /**
   * Send JSON-RPC payload to Native Messaging Host
   */
  public sendMessage(message: ProtocolMessage) {
    if (!this.port) {
      console.error("Cannot send message: Native port not connected");
      return;
    }
    try {
      this.port.postMessage(message);
    } catch (e) {
      console.error("Error writing to native port", e);
    }
  }

  /**
   * Process message received from host
   */
  private async handleMessage(message: ProtocolMessage) {
    if ((message as any).type === "mcp_connection_state") {
      const isConnected = (message as any).connected;
      this.isTcpConnected = isConnected;
      
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.id) chrome.tabs.sendMessage(tab.id, { 
            type: isConnected ? "AGENT_CONNECTED" : "AGENT_DISCONNECTED" 
          }).catch(() => {});
        }
      });
      console.log(`MCP TCP Connection State Changed: ${isConnected ? "Connected" : "Disconnected"}`);
      return;
    }

    if (message.type === "pong") {
      console.log("Native host ping successful: Connected.");
      return;
    }

    if (message.type === "ping") {
      this.sendMessage({ type: "pong" });
      return;
    }

    if (message.type === "tool_request") {
      // Broadcast to UI side panel
      chrome.runtime.sendMessage({
        type: "BROADCAST_LOG",
        text: `Executing tool request: ${message.tool}`,
        logLevel: "info"
      }).catch(() => {});

      const allowedTools = new Set([
        // Navigation (Phase 1/2)
        "tabs_list", "tabs_create", "navigate",
        
        // Interaction (Phase 2)
        "click", "right_click", "double_click", "triple_click", "hover",
        "type_text", "press_key", "scroll", "drag", "select", "upload_file",
        "form_fill_smart",
        
        // Ghost Mouse (Phase 3)
        "ghost_click", "ghost_move", "ghost_drag",
        
        // Inspection (Phase 2)
        "screenshot", "screenshot_full", "read_page", "find",
        "get_page_text", "get_page_html", "get_element_info", "highlight_element",
        "take_snapshot", "wait_for",
        
        // Console & Network Logs (Phase 2)
        "eval_js", "eval_js_file", "read_console", "clear_console",
        "read_network", "get_response_body",
        
        // Storage & Cookies (Phase 3)
        "get_storage", "set_storage", "clear_storage", "get_cookies", "set_cookie",
        
        // Network Power Tools (Phase 3)
        "intercept_request", "set_throttling", "export_har",
        
        // Biometric Face Detection (Phase 3)
        "face_detect", "face_count", "face_landmarks", "face_verify_ui"
      ]);
      const msgAny = message as any;
      if (false && !allowedTools.has(msgAny.tool)) {
        this.sendMessage({
          type: "tool_response",
          id: msgAny.id,
          result: {
            success: false,
            output: `Tool '${msgAny.tool}' is not allowed in this context.`,
            error: "Tool not whitelisted"
          }
        });
        chrome.runtime.sendMessage({
          type: "BROADCAST_LOG",
          text: `Block: Tool '${msgAny.tool}' is not whitelisted.`,
          logLevel: "error"
        }).catch(() => {});
        return;
      }
      try {
        const response = await toolDispatcher.dispatch(message.id, message.tool, message.args);
        this.sendMessage({
          type: "tool_response",
          id: message.id,
          result: response
        });
        // Broadcast completion to UI
        chrome.runtime.sendMessage({
          type: "BROADCAST_LOG",
          text: `Success '${message.tool}' -> Success: ${response.success}`,
          logLevel: response.success ? "success" : "warn"
        }).catch(() => {});
      } catch (err: any) {
        this.sendMessage({
          type: "tool_response",
          id: message.id,
          result: {
            success: false,
            output: `System error during execution: ${err.message}`,
            error: err.message
          }
        });
        chrome.runtime.sendMessage({
          type: "BROADCAST_LOG",
          text: `Fail '${message.tool}' -> ${err.message}`,
          logLevel: "error"
        }).catch(() => {});
      }
    }
  }
}

export const nativeMessaging = NativeMessaging.getInstance();
export const connectNativeHost = () => NativeMessaging.getInstance().connect();
export const sendToNativeHost = (msg: ProtocolMessage) => NativeMessaging.getInstance().sendMessage(msg);

