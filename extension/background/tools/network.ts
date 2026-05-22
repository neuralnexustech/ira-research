/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import { ToolResult } from "../../../shared/types";
import { cdpEngine } from "../cdp-engine";

export class NetworkTools {
  private static instance: NetworkTools;

  private constructor() {}

  public static getInstance(): NetworkTools {
    if (!NetworkTools.instance) {
      NetworkTools.instance = new NetworkTools();
    }
    return NetworkTools.instance;
  }

  /**
   * Intercepts matching outbound API requests and enables mocking responses or aborting requests
   */
  public async interceptRequest(tabId: number, args: any): Promise<ToolResult> {
    try {
      const { urlPattern, action, mockStatus, mockResponse } = args;

      if (!urlPattern || !action) {
        return {
          success: false,
          output: "Error: Both 'urlPattern' and 'action' parameters are required."
        };
      }

      // 1. Get or initialize tab rules
      let rules = globalThis.__iraActiveInterceptions.get(tabId);
      if (!rules) {
        rules = [];
        globalThis.__iraActiveInterceptions.set(tabId, rules);
      }

      // 2. Manage the rule
      if (action === "allow") {
        // Remove matching pattern rule
        rules = rules.filter((r: any) => r.urlPattern !== urlPattern);
        globalThis.__iraActiveInterceptions.set(tabId, rules);

        // If no rules remain, disable Fetch domain
        if (rules.length === 0) {
          try {
            await cdpEngine.sendCommand(tabId, "Fetch.disable", {});
          } catch (e) {}
        }

        return {
          success: true,
          output: `Successfully disabled request interception for pattern "${urlPattern}".`
        };
      }

      // 3. Add or update rule (abort or mock)
      const existing = rules.find((r: any) => r.urlPattern === urlPattern);
      if (existing) {
        existing.action = action;
        existing.mockStatus = mockStatus;
        existing.mockResponse = mockResponse;
      } else {
        rules.push({ urlPattern, action, mockStatus, mockResponse });
      }

      // 4. Enable Fetch domain with wildcard request matching
      await cdpEngine.sendCommand(tabId, "Fetch.enable", {
        patterns: [{ urlPattern: "*", requestStage: "Request" }]
      });

      return {
        success: true,
        output: `Successfully configured request interception: pattern "${urlPattern}" will perform action "${action}".`
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Failed to configure request interception: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Simulates network environments by throttling download, upload speed, or adding latency
   */
  public async setThrottling(tabId: number, args: any): Promise<ToolResult> {
    try {
      const offline = args.offline ?? false;
      const latency = Number(args.latency ?? 0);
      const downloadThroughput = Number(args.downloadThroughput ?? -1);
      const uploadThroughput = Number(args.uploadThroughput ?? -1);

      await cdpEngine.sendCommand(tabId, "Network.emulateNetworkConditions", {
        offline,
        latency,
        downloadThroughput,
        uploadThroughput
      });

      const detail = offline
        ? "Offline mode enabled."
        : `Throttling set to: latency=${latency}ms, download=${downloadThroughput === -1 ? "unlimited" : downloadThroughput + " B/s"}, upload=${uploadThroughput === -1 ? "unlimited" : uploadThroughput + " B/s"}.`;

      return {
        success: true,
        output: `Successfully updated network emulation conditions. ${detail}`
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Failed to configure network throttling: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Generates and exports the accumulated session network traces conforming to HAR 1.2 log specification
   */
  public async exportHar(tabId: number, args: any): Promise<ToolResult> {
    try {
      const logs = globalThis.__iraNetworkLogs.get(tabId) || [];

      // Structure compliant HAR log
      const harEntries = logs.map((log: any) => {
        const isRequest = log.type === "request";
        const date = new Date(log.timestamp);

        // Map HTTP headers
        const reqHeaders = log.headers
          ? Object.keys(log.headers).map((k) => ({ name: k, value: String(log.headers[k]) }))
          : [];

        const respHeaders: any[] = [];
        const mimeType = log.mimeType || "application/octet-stream";
        const status = Number(log.status || 0);

        return {
          startedDateTime: date.toISOString(),
          time: log.responseTime ? log.responseTime - log.timestamp : 0,
          request: {
            method: log.method || "GET",
            url: log.url || "",
            httpVersion: "HTTP/1.1",
            headers: reqHeaders,
            queryString: [],
            cookies: [],
            headersSize: -1,
            bodySize: -1
          },
          response: {
            status,
            statusText: status === 200 ? "OK" : status === 404 ? "Not Found" : "Status " + status,
            httpVersion: "HTTP/1.1",
            headers: respHeaders,
            cookies: [],
            content: {
              size: 0,
              mimeType
            },
            redirectURL: "",
            headersSize: -1,
            bodySize: -1
          },
          cache: {},
          timings: {
            send: 0,
            wait: log.responseTime ? log.responseTime - log.timestamp : 0,
            receive: 0
          }
        };
      });

      const harLog = {
        log: {
          version: "1.2",
          creator: {
            name: "IRA Browser Agent",
            version: "0.1.0"
          },
          entries: harEntries
        }
      };

      return {
        success: true,
        output: `Successfully compiled HAR network trace for tab ID ${tabId} (${harEntries.length} entries).`,
        content: [
          {
            type: "text",
            text: JSON.stringify(harLog, null, 2)
          }
        ]
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Failed to compile HAR logs: ${err.message}`,
        error: err.message
      };
    }
  }
}

export const networkTools = NetworkTools.getInstance();
