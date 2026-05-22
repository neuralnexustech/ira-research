/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import { ToolResult } from "../../../shared/types";
import { cdpEngine } from "../cdp-engine";

export class StorageTools {
  private static instance: StorageTools;

  private constructor() {}

  public static getInstance(): StorageTools {
    if (!StorageTools.instance) {
      StorageTools.instance = new StorageTools();
    }
    return StorageTools.instance;
  }

  /**
   * Fetches items from localStorage or sessionStorage inside the target tab context
   */
  public async getStorage(tabId: number, args: any): Promise<ToolResult> {
    try {
      const type = args.type || "local"; // local or session
      const key = args.key;

      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (t, k) => {
          const store = t === "session" ? sessionStorage : localStorage;
          if (k) {
            return store.getItem(k);
          }
          // Return all storage keys
          const obj: { [k: string]: string | null } = {};
          for (let i = 0; i < store.length; i++) {
            const keyName = store.key(i);
            if (keyName) obj[keyName] = store.getItem(keyName);
          }
          return obj;
        },
        args: [type, key]
      });

      const data = results[0]?.result;
      return {
        success: true,
        output: `Successfully read ${type}Storage context.`,
        content: [
          {
            type: "text",
            text: typeof data === "object" ? JSON.stringify(data, null, 2) : String(data)
          }
        ]
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Failed to read storage: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Sets specific key-value string items inside localStorage or sessionStorage
   */
  public async setStorage(tabId: number, args: any): Promise<ToolResult> {
    try {
      const type = args.type || "local";
      const key = args.key;
      const value = args.value;

      if (!key || value === undefined) {
        return {
          success: false,
          output: "Error: Both 'key' and 'value' parameters are required."
        };
      }

      await chrome.scripting.executeScript({
        target: { tabId },
        func: (t, k, v) => {
          const store = t === "session" ? sessionStorage : localStorage;
          store.setItem(k, v);
        },
        args: [type, key, value]
      });

      return {
        success: true,
        output: `Successfully set ${type}Storage item: ${key} = "${value}"`
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Failed to set storage item: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Clears selected storage scopes (local, session, or both) inside the tab
   */
  public async clearStorage(tabId: number, args: any): Promise<ToolResult> {
    try {
      const type = args.type || "all";

      await chrome.scripting.executeScript({
        target: { tabId },
        func: (t) => {
          if (t === "local" || t === "all") localStorage.clear();
          if (t === "session" || t === "all") sessionStorage.clear();
        },
        args: [type]
      });

      return {
        success: true,
        output: `Successfully cleared ${type} storage scope(s).`
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Failed to clear storage: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Retrieves active domain-specific session and storage cookies for the current tab
   */
  public async getCookies(tabId: number, args: any): Promise<ToolResult> {
    try {
      const url = args.url;
      const params: any = {};
      if (url) {
        params.urls = [url];
      }

      // Execute via CDP Network domain
      const response = await cdpEngine.sendCommand(tabId, "Network.getCookies", params);
      const cookies = response.cookies || [];

      return {
        success: true,
        output: `Successfully retrieved ${cookies.length} cookie(s).`,
        content: [
          {
            type: "text",
            text: JSON.stringify(cookies, null, 2)
          }
        ]
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Failed to retrieve cookies: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Sets and configures custom session or persistent cookies
   */
  public async setCookie(tabId: number, args: any): Promise<ToolResult> {
    try {
      const { name, value, url, domain, path, secure, httpOnly, sameSite, expires } = args;

      if (!name || value === undefined) {
        return {
          success: false,
          output: "Error: Both 'name' and 'value' parameters are required."
        };
      }

      // If URL is not supplied, resolve target domain url from Chrome tabs API
      let targetUrl = url;
      if (!targetUrl) {
        const tab = await new Promise<chrome.tabs.Tab>((resolve) => {
          chrome.tabs.get(tabId, resolve);
        });
        targetUrl = tab.url;
      }

      if (!targetUrl) {
        return {
          success: false,
          output: "Error: Could not resolve target URL for cookie placement. Provide a valid 'url' parameter."
        };
      }

      const params: any = {
        name,
        value,
        url: targetUrl,
        domain,
        path,
        secure,
        httpOnly,
        sameSite,
        expires
      };

      await cdpEngine.sendCommand(tabId, "Network.setCookie", params);

      return {
        success: true,
        output: `Successfully set cookie "${name}" on domain scope.`
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Failed to set cookie: ${err.message}`,
        error: err.message
      };
    }
  }
}

export const storageTools = StorageTools.getInstance();
