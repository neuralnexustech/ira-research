/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import { attachedTabs, screenshotStore } from "./state";
import { ScreenshotResult } from "../../shared/types";

export class CdpEngine {
  private static instance: CdpEngine;

  private constructor() {
    this.setupGlobalDebuggerListener();
  }

  public static getInstance(): CdpEngine {
    if (!CdpEngine.instance) {
      CdpEngine.instance = new CdpEngine();
    }
    return CdpEngine.instance;
  }

  /**
   * Set up global debugger event listener to capture console and network logs.
   */
  private setupGlobalDebuggerListener() {
    chrome.debugger.onEvent.addListener((source, method, params: any) => {
      const tabId = source.tabId;
      if (!tabId) return;

      // --- CONSOLE ENGINE COLLECTOR ---
      if (method === "Runtime.consoleAPICalled" && params) {
        const logs = globalThis.__iraConsoleLogs.get(tabId) || [];
        logs.push({
          type: "console",
          timestamp: Date.now(),
          level: params.type,
          text: params.args?.map((a: any) => a.value || a.description || "").join(" ") || ""
        });
        if (logs.length > 10000) logs.shift();
        globalThis.__iraConsoleLogs.set(tabId, logs);
      }

      if (method === "Runtime.exceptionThrown" && params) {
        const logs = globalThis.__iraConsoleLogs.get(tabId) || [];
        const details = params.exceptionDetails;
        logs.push({
          type: "exception",
          timestamp: Date.now(),
          level: "error",
          text: details.exception?.description || details.text,
          stack: details.stackTrace
        });
        if (logs.length > 10000) logs.shift();
        globalThis.__iraConsoleLogs.set(tabId, logs);
      }

      // --- NETWORK ENGINE COLLECTOR ---
      if (method === "Network.requestWillBeSent" && params) {
        const logs = globalThis.__iraNetworkLogs.get(tabId) || [];
        logs.push({
          type: "request",
          requestId: params.requestId,
          timestamp: Date.now(),
          url: params.request.url,
          method: params.request.method,
          headers: params.request.headers
        });
        if (logs.length > 1000) logs.shift();
        globalThis.__iraNetworkLogs.set(tabId, logs);
      }

      if (method === "Network.responseReceived" && params) {
        const logs = globalThis.__iraNetworkLogs.get(tabId) || [];
        const existing = logs.find((l: any) => l.requestId === params.requestId && l.type === "request");
        if (existing) {
          // Attach response details
          existing.status = params.response.status;
          existing.mimeType = params.response.mimeType;
          existing.responseTime = Date.now();
        } else {
          logs.push({
            type: "response",
            requestId: params.requestId,
            timestamp: Date.now(),
            url: params.response.url,
            status: params.response.status,
            mimeType: params.response.mimeType
          });
        }
        if (logs.length > 1000) logs.shift();
        globalThis.__iraNetworkLogs.set(tabId, logs);
      }

      if (method === "Network.loadingFailed" && params) {
        const logs = globalThis.__iraNetworkLogs.get(tabId) || [];
        logs.push({
          type: "failed",
          requestId: params.requestId,
          timestamp: Date.now(),
          errorText: params.errorText,
          canceled: params.canceled
        });
        if (logs.length > 1000) logs.shift();
        globalThis.__iraNetworkLogs.set(tabId, logs);
      }

      // --- REQUEST INTERCEPTION HANDLER ---
      if (method === "Fetch.requestPaused" && params) {
        const requestId = params.requestId;
        const url = params.request.url;
        
        const rules = globalThis.__iraActiveInterceptions.get(tabId) || [];
        const matchedRule = rules.find((r: any) => {
          const escapedPattern = r.urlPattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&").replace(/\\\*/g, ".*");
          const regex = new RegExp(`^${escapedPattern}$`, "i");
          return regex.test(url) || url.includes(r.urlPattern);
        });

        if (matchedRule) {
          if (matchedRule.action === "abort") {
            chrome.debugger.sendCommand({ tabId }, "Fetch.failRequest", {
              requestId,
              errorReason: "Aborted"
            }, () => { if (chrome.runtime.lastError) {} });
          } else if (matchedRule.action === "mock") {
            try {
              const base64 = btoa(unescape(encodeURIComponent(matchedRule.mockResponse || "{}")));
              chrome.debugger.sendCommand({ tabId }, "Fetch.fulfillRequest", {
                requestId,
                responseCode: matchedRule.mockStatus || 200,
                responseHeaders: [
                  { name: "Content-Type", value: "application/json" },
                  { name: "Access-Control-Allow-Origin", value: "*" }
                ],
                body: base64
              }, () => { if (chrome.runtime.lastError) {} });
            } catch (e) {
              chrome.debugger.sendCommand({ tabId }, "Fetch.continueRequest", { requestId }, () => { if (chrome.runtime.lastError) {} });
            }
          } else {
            chrome.debugger.sendCommand({ tabId }, "Fetch.continueRequest", { requestId }, () => { if (chrome.runtime.lastError) {} });
          }
        } else {
          chrome.debugger.sendCommand({ tabId }, "Fetch.continueRequest", { requestId }, () => { if (chrome.runtime.lastError) {} });
        }
      }
    });
  }

  /**
   * Attach debugger to target tab. Always detaches first to handle stale connections.
   */
  public async attachDebugger(tabId: number): Promise<void> {
    if (attachedTabs.has(tabId)) {
      return;
    }

    // Always force-detach first to clear any stale Chrome debugger session
    await new Promise<void>((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          resolve();
        }
      }, 3000);
      chrome.debugger.detach({ tabId }, () => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve();
        }
      });
    });

    await new Promise(r => setTimeout(r, 200));

    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          reject(new Error(`Debugger attach timed out for tab ${tabId}`));
        }
      }, 8000);

      chrome.debugger.attach({ tabId }, "1.3", () => {
        if (done) return;
        done = true;
        clearTimeout(timer);

        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(`Failed to attach debugger: ${err.message}`));
        } else {
          attachedTabs.add(tabId);
          this.enableDomains(tabId).then(resolve).catch(reject);
        }
      });
    });
  }

  private async enableDomains(tabId: number): Promise<void> {
    await Promise.all([
      this.sendCommandOnce(tabId, "Page.enable", {}),
      this.sendCommandOnce(tabId, "Runtime.enable", {}),
      this.sendCommandOnce(tabId, "Network.enable", {})
    ]);
  }

  /**
   * Detach debugger from tab
   */
  public async detachDebugger(tabId: number): Promise<void> {
    if (!attachedTabs.has(tabId)) return;

    return new Promise((resolve) => {
      chrome.debugger.detach({ tabId }, () => {
        attachedTabs.delete(tabId);
        resolve();
      });
    });
  }

  private sendCommandOnce(tabId: number, method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      let completed = false;
      const timer = setTimeout(() => {
        if (!completed) {
          completed = true;
          reject(new Error(`CDP Command ${method} timed out after 5 seconds`));
        }
      }, 5000);

      chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
        if (completed) return;
        completed = true;
        clearTimeout(timer);

        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(`CDP Error (${method}): ${err.message}`));
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Send a CDP command to a tab with auto-reattach if debugger disconnected
   */
  public async sendCommand(tabId: number, method: string, params: any): Promise<any> {
    try {
      return await this.sendCommandOnce(tabId, method, params);
    } catch (err: any) {
      if (err.message && (err.message.includes("not attached") || err.message.includes("detached") || err.message.includes("timed out"))) {
        // Re-attach and retry once
        attachedTabs.delete(tabId);
        await this.attachDebugger(tabId);
        return await this.sendCommandOnce(tabId, method, params);
      }
      throw err;
    }
  }

  /**
   * Capture screenshot of tab with adaptive resizing fitting token budget (1568 tokens)
   */
  public async screenshot(tabId: number): Promise<ScreenshotResult> {
    // 1. Send signal to content script to hide indicators (clean screenshot)
    try {
      await chrome.tabs.sendMessage(tabId, { type: "HIDE_FOR_TOOL_USE" });
    } catch (e) {
      // Content script might not be loaded yet, proceed anyway
    }

    // Give the DOM a tiny moment to hide indicators
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 2. Query viewport size using scripting API
    const executionResults = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio
        };
      }
    });

    const viewport = executionResults[0]?.result || { width: 1280, height: 720, devicePixelRatio: 1 };

    // 3. Token budget calculation (standard Anthropic screenshot constraints)
    // Fit into 1568 token budget (roughly max 1024x768 or similar aspect ratio scaled)
    const MAX_WIDTH = 1024;
    const MAX_HEIGHT = 768;
    let scale = 1;

    if (viewport.width > MAX_WIDTH || viewport.height > MAX_HEIGHT) {
      const scaleX = MAX_WIDTH / viewport.width;
      const scaleY = MAX_HEIGHT / viewport.height;
      scale = Math.min(scaleX, scaleY);
    }

    const targetW = Math.round(viewport.width * scale);
    const targetH = Math.round(viewport.height * scale);

    // 4. Capture screenshot via CDP
    const screenshotData: any = await this.sendCommand(tabId, "Page.captureScreenshot", {
      format: "jpeg",
      quality: 75,
      captureBeyondViewport: false,
      fromSurface: true,
      clip: {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
        scale: scale
      }
    });

    const base64 = screenshotData.data;

    // 5. Restore overlays
    try {
      await chrome.tabs.sendMessage(tabId, { type: "SHOW_AFTER_TOOL_USE" });
    } catch (e) {
      // Ignore
    }

    const screenshotId = `ss_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const result: ScreenshotResult = {
      base64Image: base64,
      imageFormat: "jpeg",
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      width: targetW,
      height: targetH,
      screenshotId
    };

    // Store in global memory cache
    screenshotStore.set(screenshotId, result);

    return result;
  }

  /**
   * Simulate a click via CDP Input events
   */
  public async click(tabId: number, x: number, y: number, button: "left" | "right" | "middle" = "left", clickCount = 1): Promise<void> {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "HIDE_FOR_TOOL_USE" });
    } catch (e) {}

    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      // 1. Move to coordinates
      await this.sendCommand(tabId, "Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x,
        y
      });
      await new Promise((resolve) => setTimeout(resolve, 30));

      // 2. Press and release (per click count)
      for (let i = 1; i <= clickCount; i++) {
        await this.sendCommand(tabId, "Input.dispatchMouseEvent", {
          type: "mousePressed",
          x,
          y,
          button,
          clickCount: i
        });
        await new Promise((resolve) => setTimeout(resolve, 20));
        await this.sendCommand(tabId, "Input.dispatchMouseEvent", {
          type: "mouseReleased",
          x,
          y,
          button,
          clickCount: i
        });
        if (i < clickCount) await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } finally {
      try {
        await chrome.tabs.sendMessage(tabId, { type: "SHOW_AFTER_TOOL_USE" });
      } catch (e) {}
    }
  }

  /**
   * Simulate scrolling
   */
  public async scroll(tabId: number, x: number, y: number, deltaX: number, deltaY: number): Promise<void> {
    try {
      // Try CDP mouseWheel event first
      await this.sendCommand(tabId, "Input.dispatchMouseEvent", {
        type: "mouseWheel",
        x,
        y,
        deltaX,
        deltaY
      });
    } catch (e) {
      // Fallback: run window.scrollBy script in page context
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (dx, dy) => {
          window.scrollBy({ left: dx, top: dy, behavior: "instant" });
        },
        args: [deltaX, deltaY]
      });
    }
  }

  /**
   * Type text in page context
   */
  public async type(tabId: number, text: string): Promise<void> {
    // We can focus the focused element and insert text
    await this.sendCommand(tabId, "Input.insertText", { text });
  }

  /**
   * Resolves a DOM refId to element center coordinates
   */
  public async getElementCenter(tabId: number, refId: string): Promise<{ x: number; y: number } | null> {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (ref) => {
        const el = (window as any).__iraRefManager.resolveRef(ref);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2)
        };
      },
      args: [refId]
    });
    return results[0]?.result || null;
  }

  /**
   * Type text character-by-character with random stealth human delays (30ms - 80ms)
   */
  public async typeTextSimulated(tabId: number, text: string): Promise<void> {
    for (const char of text) {
      await this.sendCommand(tabId, "Input.dispatchKeyEvent", {
        type: "keyDown",
        text: char,
        unmodifiedText: char
      });
      await this.sendCommand(tabId, "Input.dispatchKeyEvent", {
        type: "char",
        text: char,
        unmodifiedText: char
      });
      await this.sendCommand(tabId, "Input.dispatchKeyEvent", {
        type: "keyUp",
        text: char,
        unmodifiedText: char
      });
      // Random delay between 30ms and 80ms
      const delay = Math.floor(Math.random() * 50 + 30);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  /**
   * Dispatches standard keyboard key combinations or specific keys
   */
  public async pressKey(tabId: number, key: string): Promise<void> {
    // Map standard keys to virtual key codes and names
    const keyCodes: { [k: string]: { key: string; code: string; vkey: number } } = {
      "Enter": { key: "Enter", code: "Enter", vkey: 13 },
      "Tab": { key: "Tab", code: "Tab", vkey: 9 },
      "Escape": { key: "Escape", code: "Escape", vkey: 27 },
      "Space": { key: " ", code: "Space", vkey: 32 },
      "Backspace": { key: "Backspace", code: "Backspace", vkey: 8 },
      "ArrowUp": { key: "ArrowUp", code: "ArrowUp", vkey: 38 },
      "ArrowDown": { key: "ArrowDown", code: "ArrowDown", vkey: 40 },
      "ArrowLeft": { key: "ArrowLeft", code: "ArrowLeft", vkey: 37 },
      "ArrowRight": { key: "ArrowRight", code: "ArrowRight", vkey: 39 }
    };
    const config = keyCodes[key] || { key, code: key, vkey: 0 };

    await this.sendCommand(tabId, "Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: config.key,
      code: config.code,
      windowsVirtualKeyCode: config.vkey
    });
    await this.sendCommand(tabId, "Input.dispatchKeyEvent", {
      type: "keyUp",
      key: config.key,
      code: config.code,
      windowsVirtualKeyCode: config.vkey
    });
  }

  /**
   * Performs an interpolated drag and drop operation
   */
  public async drag(tabId: number, fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    // 1. Mouse move to start
    await this.sendCommand(tabId, "Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: fromX,
      y: fromY
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 2. Mouse Press
    await this.sendCommand(tabId, "Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: fromX,
      y: fromY,
      button: "left",
      clickCount: 1
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 3. Interpolated drag movements (10 steps)
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const x = Math.round(fromX + (toX - fromX) * (i / steps));
      const y = Math.round(fromY + (toY - fromY) * (i / steps));
      await this.sendCommand(tabId, "Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x,
        y,
        button: "left"
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    // 4. Mouse Release
    await this.sendCommand(tabId, "Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: toX,
      y: toY,
      button: "left",
      clickCount: 1
    });
  }

  /**
   * Uploads files to a specific file input element reference using CDP
   */
  public async uploadFile(tabId: number, refId: string, filePaths: string[]): Promise<void> {
    // Enable DOM domain for this action
    await this.sendCommand(tabId, "DOM.enable", {});

    // 1. Get DOM document
    const doc = await this.sendCommand(tabId, "DOM.getDocument", {});
    
    // 2. Resolve target element objectId
    const evalResult = await this.sendCommand(tabId, "Runtime.evaluate", {
      expression: `window.__iraRefManager.resolveRef("${refId}")`
    });
    if (!evalResult || !evalResult.result || !evalResult.result.objectId) {
      throw new Error(`Failed to resolve element reference '${refId}' to valid runtime object.`);
    }

    // 3. Resolve element to Node ID
    const nodeResult = await this.sendCommand(tabId, "DOM.requestNode", {
      objectId: evalResult.result.objectId
    });
    if (!nodeResult || !nodeResult.nodeId) {
      throw new Error("Failed to map DOM element object to Node identifier.");
    }

    // 4. Inject paths
    await this.sendCommand(tabId, "DOM.setFileInputFiles", {
      nodeId: nodeResult.nodeId,
      files: filePaths
    });

    await this.sendCommand(tabId, "DOM.disable", {});
  }

  /**
   * Selects dropdown values in select elements
   */
  public async selectOption(tabId: number, refId: string, value: string): Promise<void> {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (ref, val) => {
        const el = (window as any).__iraRefManager.resolveRef(ref) as HTMLSelectElement;
        if (!el || el.tagName.toLowerCase() !== "select") {
          throw new Error("Target element is not a select dropdown.");
        }
        
        let matched = false;
        // 1. Try matching by option value property
        for (const opt of Array.from(el.options)) {
          if (opt.value === val) {
            el.value = val;
            matched = true;
            break;
          }
        }

        // 2. Try matching by option text label
        if (!matched) {
          for (const opt of Array.from(el.options)) {
            if (opt.text.trim().toLowerCase() === val.trim().toLowerCase()) {
              el.value = opt.value;
              matched = true;
              break;
            }
          }
        }

        if (!matched) {
          throw new Error(`Option with value or label matching "${val}" was not found in the dropdown.`);
        }

        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("input", { bubbles: true }));
      },
      args: [refId, value]
    });
  }

  /**
   * High-quality premium visual element border highlight
   */
  public async highlightElement(tabId: number, refId: string, text?: string): Promise<void> {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (ref, label) => {
        const el = (window as any).__iraRefManager.resolveRef(ref) as HTMLElement;
        if (!el) return;

        const existing = document.getElementById("ira-highlight-box");
        if (existing) existing.remove();

        const rect = el.getBoundingClientRect();
        const box = document.createElement("div");
        box.id = "ira-highlight-box";
        box.style.position = "fixed";
        box.style.left = `${rect.left}px`;
        box.style.top = `${rect.top}px`;
        box.style.width = `${rect.width}px`;
        box.style.height = `${rect.height}px`;
        box.style.border = "3px dashed #9333ea";
        box.style.backgroundColor = "rgba(147, 51, 234, 0.18)";
        box.style.pointerEvents = "none";
        box.style.zIndex = "2147483645";
        box.style.borderRadius = "4px";
        box.style.boxShadow = "0 0 15px rgba(147, 51, 234, 0.4)";
        box.style.transition = "all 0.2s ease";

        if (label) {
          const tag = document.createElement("div");
          tag.textContent = label;
          tag.style.position = "absolute";
          tag.style.top = "-24px";
          tag.style.left = "0";
          tag.style.background = "#9333ea";
          tag.style.color = "#ffffff";
          tag.style.padding = "2px 8px";
          tag.style.fontSize = "11px";
          tag.style.fontWeight = "bold";
          tag.style.borderRadius = "3px";
          tag.style.fontFamily = "sans-serif";
          box.appendChild(tag);
        }

        document.body.appendChild(box);
        setTimeout(() => box.remove(), 2500);
      },
      args: [refId, text || refId]
    });
  }
}
export const cdpEngine = CdpEngine.getInstance();
