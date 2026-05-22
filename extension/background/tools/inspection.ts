/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import { ToolResult } from "../../../shared/types";
import { cdpEngine } from "../cdp-engine";

export class InspectionTools {
  private static instance: InspectionTools;

  private constructor() {}

  public static getInstance(): InspectionTools {
    if (!InspectionTools.instance) {
      InspectionTools.instance = new InspectionTools();
    }
    return InspectionTools.instance;
  }

  /**
   * Capture standard scaled screenshot of target tab
   */
  public async screenshot(tabId: number, args: any): Promise<ToolResult> {
    try {
      const screenshot = await cdpEngine.screenshot(tabId);
      
      return {
        success: true,
        output: `Captured screenshot of tab ID ${tabId}. Dimensions: ${screenshot.width}x${screenshot.height}px. ID: ${screenshot.screenshotId}`,
        content: [
          {
            type: "image",
            data: screenshot.base64Image,
            mimeType: "image/jpeg"
          }
        ]
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Screenshot capture failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Captures full page scrolling screenshot by dynamically overriding viewport size
   */
  public async screenshotFull(tabId: number, args: any): Promise<ToolResult> {
    try {
      // 1. Query full scroll height and viewport widths
      const dimResults = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return {
            width: document.documentElement.scrollWidth || window.innerWidth,
            height: document.documentElement.scrollHeight || window.innerHeight,
            devicePixelRatio: window.devicePixelRatio
          };
        }
      });
      const dims = dimResults[0]?.result || { width: 1280, height: 2000, devicePixelRatio: 1 };

      // 2. Hide indicators before snapshot
      try {
        await chrome.tabs.sendMessage(tabId, { type: "HIDE_FOR_TOOL_USE" });
      } catch (e) {}

      // 3. Override viewport metrics in CDP to accommodate full page
      await cdpEngine.sendCommand(tabId, "Emulation.setDeviceMetricsOverride", {
        width: dims.width,
        height: dims.height,
        deviceScaleFactor: 1, // keep scale simple to avoid token bloat
        mobile: false
      });

      // Brief delay for rendering updates
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 4. Capture screenshot
      const shotResult: any = await cdpEngine.sendCommand(tabId, "Page.captureScreenshot", {
        format: "jpeg",
        quality: 70
      });

      // 5. Restore metrics and overlays
      await cdpEngine.sendCommand(tabId, "Emulation.clearDeviceMetricsOverride", {});
      try {
        await chrome.tabs.sendMessage(tabId, { type: "SHOW_AFTER_TOOL_USE" });
      } catch (e) {}

      const screenshotId = `ss_full_${Date.now()}`;
      return {
        success: true,
        output: `Captured full-page screenshot of tab ID ${tabId}. Dimensions: ${dims.width}x${dims.height}px. ID: ${screenshotId}`,
        content: [
          {
            type: "image",
            data: shotResult.data,
            mimeType: "image/jpeg"
          }
        ]
      };
    } catch (err: any) {
      // Ensure reset in case of crash
      try {
        await cdpEngine.sendCommand(tabId, "Emulation.clearDeviceMetricsOverride", {});
      } catch (e) {}
      return {
        success: false,
        output: `Full page screenshot failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Generates the optimized accessibility tree from the page content context
   */
  public async readPage(tabId: number, args: any): Promise<ToolResult> {
    try {
      const filter = args.filter || "viewport"; // viewport or all
      const depth = Number(args.depth || 10);
      const maxChars = Number(args.maxChars || 60);
      const refId = args.refId;

      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (f, d, c, r) => {
          return (window as any).__generateIraAccessibilityTree(f, d, c, r);
        },
        args: [filter, depth, maxChars, refId || null]
      });

      const tree = results[0]?.result || "Error: Accessibility Tree generation failed to return content.";

      return {
        success: true,
        output: `Extracted accessibility tree (filter: ${filter}, maxDepth: ${depth}).`,
        content: [
          {
            type: "text",
            text: tree
          }
        ]
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Accessibility tree extraction failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Searches for interactive elements using natural language heuristics
   */
  public async find(tabId: number, args: any): Promise<ToolResult> {
    try {
      const query = args.query;
      const maxResults = Number(args.maxResults || 20);
      if (!query) {
        return {
          success: false,
          output: "Error: A 'query' search parameter is required."
        };
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (q, m) => {
          return (window as any).__iraFindElements(q, m);
        },
        args: [query, maxResults]
      });

      const list = results[0]?.result || [];

      return {
        success: true,
        output: `Found ${list.length} potential matching element(s) for query "${query}".`,
        content: [
          {
            type: "text",
            text: JSON.stringify(list, null, 2)
          }
        ]
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Find operation failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Retrieves clean inner text of the page
   */
  public async getPageText(tabId: number, args: any): Promise<ToolResult> {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => document.body.innerText || document.documentElement.innerText
      });
      const text = results[0]?.result || "";

      return {
        success: true,
        output: "Successfully extracted page inner text.",
        content: [
          {
            type: "text",
            text
          }
        ]
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Text extraction failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Retrieves full page outer HTML structure
   */
  public async getPageHtml(tabId: number, args: any): Promise<ToolResult> {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => document.documentElement.outerHTML
      });
      const html = results[0]?.result || "";

      return {
        success: true,
        output: "Successfully extracted page HTML structure.",
        content: [
          {
            type: "text",
            text: html.substring(0, 100000) // Caps size to prevent MCP packet overflows
          }
        ]
      };
    } catch (err: any) {
      return {
        success: false,
        output: `HTML extraction failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Retrieves rich metadata and structural HTML for a specific element reference
   */
  public async getElementInfo(tabId: number, args: any): Promise<ToolResult> {
    try {
      const refId = args.refId;
      if (!refId) {
        return {
          success: false,
          output: "Error: An element 'refId' parameter is required."
        };
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (ref) => {
          const el = (window as any).__iraRefManager.resolveRef(ref) as HTMLElement;
          if (!el) return null;
          
          const attrs: { [k: string]: string } = {};
          for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i];
            attrs[attr.name] = attr.value;
          }

          return {
            tagName: el.tagName,
            outerHTML: el.outerHTML.substring(0, 3000), // safe truncation
            innerText: el.innerText,
            attributes: attrs,
            isVisible: el.getBoundingClientRect().width > 0
          };
        },
        args: [refId]
      });

      const info = results[0]?.result;
      if (!info) {
        return {
          success: false,
          output: `Error: Reference '${refId}' could not be resolved in target page.`
        };
      }

      return {
        success: true,
        output: `Retrieved metadata for element [${refId}].`,
        content: [
          {
            type: "text",
            text: JSON.stringify(info, null, 2)
          }
        ]
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Element inspection failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * High-quality premium visual element border highlight
   */
  public async highlightElement(tabId: number, args: any): Promise<ToolResult> {
    try {
      const refId = args.refId;
      const text = args.text;
      if (!refId) {
        return {
          success: false,
          output: "Error: An element 'refId' parameter is required."
        };
      }

      await cdpEngine.highlightElement(tabId, refId, text);

      return {
        success: true,
        output: `Highlighted element reference [${refId}] successfully.`
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Highlight failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * ATOMIC COMBINED SNAPSHOT
   * Captures accessibility tree + viewport screenshot + metadata in a single round trip.
   * Extremely token-efficient and rich context builder!
   */
  public async takeSnapshot(tabId: number, args: any): Promise<ToolResult> {
    try {
      // 1. Get tab title/url metadata
      const tab = await new Promise<chrome.tabs.Tab>((resolve) => {
        chrome.tabs.get(tabId, resolve);
      });

      // 2. Generate tree
      const filter = args.filter || "viewport";
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (f) => (window as any).__generateIraAccessibilityTree(f, 10, 60),
        args: [filter]
      });
      const tree = results[0]?.result || "";

      // 3. Take screenshot
      const shot = await cdpEngine.screenshot(tabId);

      return {
        success: true,
        output: `Snapshot completed for tab ID ${tabId}. Title: "${tab.title}".`,
        content: [
          {
            type: "text",
            text: `URL: ${tab.url}\nTITLE: ${tab.title}\nSCREENSHOT_ID: ${shot.screenshotId}\n\n=== ACCESSIBILITY TREE ===\n${tree}`
          },
          {
            type: "image",
            data: shot.base64Image,
            mimeType: "image/jpeg"
          }
        ]
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Atomic Snapshot failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Waits for conditions (duration, selector matching, element loading, or network quiet)
   */
  public async waitFor(tabId: number, args: any): Promise<ToolResult> {
    try {
      const mode = args.mode || "duration"; // duration, selector, refId
      const value = args.value;
      const timeout = Number(args.timeout || 10000);

      if (mode === "duration") {
        const ms = Number(value || 1000);
        await new Promise((resolve) => setTimeout(resolve, ms));
        return {
          success: true,
          output: `Finished waiting for duration of ${ms}ms.`
        };
      }

      if (mode === "selector") {
        if (!value) {
          return { success: false, output: "Error: A 'value' selector string is required for selector mode." };
        }

        const start = Date.now();
        while (Date.now() - start < timeout) {
          const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: (sel) => document.querySelector(sel) !== null,
            args: [value]
          });
          if (results[0]?.result) {
            return {
              success: true,
              output: `Finished waiting: selector "${value}" detected in DOM.`
            };
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        return {
          success: false,
          output: `Timeout: Selector "${value}" failed to appear in ${timeout}ms.`
        };
      }

      if (mode === "refId") {
        if (!value) {
          return { success: false, output: "Error: A 'value' refId string is required for refId mode." };
        }

        const start = Date.now();
        while (Date.now() - start < timeout) {
          const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: (ref) => {
              const el = (window as any).__iraRefManager.resolveRef(ref);
              return el !== null && el !== undefined;
            },
            args: [value]
          });
          if (results[0]?.result) {
            return {
              success: true,
              output: `Finished waiting: Element reference [${value}] resolved in DOM.`
            };
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        return {
          success: false,
          output: `Timeout: Element reference [${value}] failed to resolve in ${timeout}ms.`
        };
      }

      return {
        success: false,
        output: `Error: Wait mode '${mode}' is not supported.`
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Wait operation failed: ${err.message}`,
        error: err.message
      };
    }
  }
}

export const inspectionTools = InspectionTools.getInstance();
