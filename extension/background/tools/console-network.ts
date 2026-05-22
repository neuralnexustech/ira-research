/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import { ToolResult } from "../../../shared/types";
import { cdpEngine } from "../cdp-engine";

export class ConsoleNetworkTools {
  private static instance: ConsoleNetworkTools;

  private constructor() {}

  public static getInstance(): ConsoleNetworkTools {
    if (!ConsoleNetworkTools.instance) {
      ConsoleNetworkTools.instance = new ConsoleNetworkTools();
    }
    return ConsoleNetworkTools.instance;
  }

  /**
   * Evaluates raw JavaScript expression in the page context via CDP Runtime
   */
  public async evalJs(tabId: number, args: any): Promise<ToolResult> {
    try {
      const expression = args.code || args.expression;
      if (!expression) {
        return {
          success: false,
          output: "Error: A 'code' or 'expression' script parameter is required."
        };
      }

      const response = await cdpEngine.sendCommand(tabId, "Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true
      });

      if (response.exceptionDetails) {
        return {
          success: false,
          output: `JavaScript Execution Exception: ${response.exceptionDetails.exception?.description || response.exceptionDetails.text}`,
          error: response.exceptionDetails.exception?.description
        };
      }

      const val = response.result?.value;
      return {
        success: true,
        output: "JavaScript evaluated successfully.",
        content: [
          {
            type: "text",
            text: typeof val === "object" ? JSON.stringify(val, null, 2) : String(val)
          }
        ]
      };
    } catch (err: any) {
      return {
        success: false,
        output: `JavaScript evaluation failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Reads the accumulated console log ring buffer for a tab
   */
  public async readConsole(tabId: number, args: any): Promise<ToolResult> {
    try {
      const limit = Number(args.limit || 100);
      const level = args.level; // filter e.g., 'error', 'warning'
      
      let logs = globalThis.__iraConsoleLogs.get(tabId) || [];
      
      if (level) {
        logs = logs.filter((l: any) => l.level === level || l.type === level);
      }
      
      const slice = logs.slice(-limit);

      return {
        success: true,
        output: `Successfully retrieved ${slice.length} console log entries.`,
        content: [
          {
            type: "text",
            text: JSON.stringify(slice, null, 2)
          }
        ]
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Failed to read console logs: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Clears accumulated console logs ring buffer
   */
  public async clearConsole(tabId: number, args: any): Promise<ToolResult> {
    globalThis.__iraConsoleLogs.set(tabId, []);
    return {
      success: true,
      output: `Cleared console log buffer for tab ID ${tabId}.`
    };
  }

  /**
   * Reads network logging activity matching optional filters
   */
  public async readNetwork(tabId: number, args: any): Promise<ToolResult> {
    try {
      const limit = Number(args.limit || 100);
      const method = args.methodFilter || args.method;
      const status = args.statusFilter || args.status;
      const urlPart = args.urlFilter || args.url;

      let logs = globalThis.__iraNetworkLogs.get(tabId) || [];

      if (method) {
        logs = logs.filter((l: any) => l.method?.toLowerCase() === method.toLowerCase());
      }
      if (status) {
        logs = logs.filter((l: any) => l.status === Number(status));
      }
      if (urlPart) {
        logs = logs.filter((l: any) => l.url?.toLowerCase().includes(urlPart.toLowerCase()));
      }

      const slice = logs.slice(-limit);

      return {
        success: true,
        output: `Successfully retrieved ${slice.length} network entry/entries.`,
        content: [
          {
            type: "text",
            text: JSON.stringify(slice, null, 2)
          }
        ]
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Failed to retrieve network activities: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Extracts response body for a specific request ID via CDP Network
   */
  public async getResponseBody(tabId: number, args: any): Promise<ToolResult> {
    try {
      const requestId = args.requestId;
      if (!requestId) {
        return {
          success: false,
          output: "Error: A valid 'requestId' parameter is required."
        };
      }

      const response = await cdpEngine.sendCommand(tabId, "Network.getResponseBody", { requestId });
      
      return {
        success: true,
        output: `Successfully fetched body payload for request ID ${requestId}.`,
        content: [
          {
            type: "text",
            text: response.body
          }
        ]
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Failed to extract response body for ID ${args.requestId}: ${err.message}`,
        error: err.message
      };
    }
  }
}

export const consoleNetworkTools = ConsoleNetworkTools.getInstance();
