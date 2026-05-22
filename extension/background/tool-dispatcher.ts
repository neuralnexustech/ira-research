/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import { tabManager } from "./tab-manager";
import { cdpEngine } from "./cdp-engine";
import { navigationTools } from "./tools/navigation";
import { inspectionTools } from "./tools/inspection";
import { interactionTools } from "./tools/interaction";
import { consoleNetworkTools } from "./tools/console-network";
import { storageTools } from "./tools/storage";
import { networkTools } from "./tools/network";
import { faceTools } from "./tools/face";
import { ghostMouse } from "./ghost-mouse";
import { ToolResult } from "../../shared/types";

class ToolDispatcher {
  private static instance: ToolDispatcher;

  private constructor() {}

  public static getInstance(): ToolDispatcher {
    if (!ToolDispatcher.instance) {
      ToolDispatcher.instance = new ToolDispatcher();
    }
    return ToolDispatcher.instance;
  }

  /**
   * Dispatch tool call to correct handler, queued on target tab's TabQueue
   */
  public async dispatch(msgId: string, toolName: string, args: any): Promise<ToolResult> {
    // 1. Handle Global Tools (no tabId required)
    if (toolName === "tabs_list" || toolName === "tabs_context_mcp") {
      return await navigationTools.tabsList(args);
    }
    if (toolName === "tabs_create" || toolName === "tabs_create_mcp") {
      return await navigationTools.tabsCreate(args);
    }
    if (toolName === "switch_browser") {
      return {
        success: true,
        output: "Browser switching is not yet supported. The extension connects to whichever browser has it loaded."
      };
    }
    if (toolName === "update_plan") {
      return {
        success: true,
        output: `Plan updated:\nDomains: ${(args.domains || []).join(", ")}\nApproach: ${(args.approach || []).join("\n- ")}`
      };
    }

    // 2. Handle Tab-Specific Tools
    const tabId = Number(args.tabId || args.targetTabId);
    if (!tabId || isNaN(tabId)) {
      return {
        success: false,
        output: "Error: A valid numeric 'tabId' must be provided in tool arguments."
      };
    }

    // Acquire or create TabQueue for serialized execution (prevents race conditions)
    const queue = tabManager.getOrCreateQueue(tabId);

    // Tools that require CDP debugger attachment
    const cdpTools = new Set([
      "screenshot", "screenshot_full", "take_snapshot",
      "click", "right_click", "double_click", "triple_click", "hover",
      "type_text", "press_key", "scroll", "drag", "select", "upload_file",
      "ghost_click", "ghost_move", "ghost_drag",
      "highlight_element", "form_fill_smart",
      "read_console", "clear_console", "read_network", "get_response_body",
      "intercept_request", "set_throttling", "export_har",
      "face_detect", "face_count", "face_landmarks", "face_verify_ui",
      "get_storage", "set_storage", "clear_storage", "get_cookies", "set_cookie"
    ]);

    return queue.enqueue(async () => {
      try {
        // Ensure debugger is attached only for tools that need CDP
        if (cdpTools.has(toolName)) {
          await cdpEngine.attachDebugger(tabId);
        }

        // Routing
        switch (toolName) {
          // open-claude-in-chrome Compatibility Routing
          case "tabs_context_mcp":
            return await navigationTools.tabsList(args);
          case "tabs_create_mcp":
            return await navigationTools.tabsCreate(args);
          case "javascript_tool":
            return await consoleNetworkTools.evalJs(tabId, { code: args.text });
          case "read_console_messages":
            return await consoleNetworkTools.readConsole(tabId, args);
          case "read_network_requests":
            return await consoleNetworkTools.readNetwork(tabId, args);
          case "form_input":
            return await interactionTools.formFillSmart(tabId, { fields: { [args.ref]: args.value } });
          case "resize_window": {
            try {
              const tab = await chrome.tabs.get(tabId);
              await chrome.windows.update(tab.windowId, { width: args.width, height: args.height });
              return {
                success: true,
                output: `Resized window to ${args.width}x${args.height}`
              };
            } catch (err: any) {
              return {
                success: false,
                output: `Failed to resize window: ${err.message}`
              };
            }
          }
          case "computer": {
            const action = args.action;
            if (action === "screenshot") {
              return await inspectionTools.screenshot(tabId, args);
            } else if (action === "left_click" || action === "click") {
              return await interactionTools.click(tabId, { x: args.coordinate[0], y: args.coordinate[1] });
            } else if (action === "right_click") {
              return await interactionTools.rightClick(tabId, { x: args.coordinate[0], y: args.coordinate[1] });
            } else if (action === "double_click") {
              return await interactionTools.doubleClick(tabId, { x: args.coordinate[0], y: args.coordinate[1] });
            } else if (action === "triple_click") {
              return await interactionTools.tripleClick(tabId, { x: args.coordinate[0], y: args.coordinate[1] });
            } else if (action === "hover") {
              return await interactionTools.hover(tabId, { x: args.coordinate[0], y: args.coordinate[1] });
            } else if (action === "type") {
              return await interactionTools.typeText(tabId, { text: args.text });
            } else if (action === "key") {
              return await interactionTools.pressKey(tabId, { key: args.text });
            } else if (action === "scroll") {
              return await interactionTools.scroll(tabId, { direction: args.scroll_direction, amount: args.scroll_amount });
            } else if (action === "scroll_to") {
              const scrollExpr = args.coordinate ? `window.scrollTo(${args.coordinate[0]}, ${args.coordinate[1]})` : `const el = document.querySelector('[ref="${args.ref}"]'); if (el) el.scrollIntoView();`;
              return await consoleNetworkTools.evalJs(tabId, { code: scrollExpr });
            } else if (action === "wait") {
              await new Promise(r => setTimeout(r, (args.duration || 1) * 1000));
              return { success: true, output: `Waited ${args.duration || 1} seconds` };
            } else if (action === "left_click_drag") {
              return await interactionTools.drag(tabId, { fromX: args.start_coordinate[0], fromY: args.start_coordinate[1], toX: args.coordinate[0], toY: args.coordinate[1] });
            } else if (action === "zoom") {
              return await inspectionTools.screenshot(tabId, args);
            }
            return { success: false, output: `Unknown computer action: ${action}` };
          }
          case "gif_creator":
            return { success: true, output: "GIF recording is not yet implemented in this extension." };
          case "shortcuts_list":
            return { success: true, output: "No shortcuts available. Shortcuts are not supported in this extension." };
          case "shortcuts_execute":
            return { success: true, output: "Shortcuts are not supported in this extension." };
          case "upload_image":
            return { success: true, output: `Image upload for ref=${args.ref}, coordinate=${args.coordinate}` };

          // Navigation
          case "navigate":
            return await navigationTools.navigate(tabId, args);

          // Interaction
          case "click":
            return await interactionTools.click(tabId, args);
          case "right_click":
            return await interactionTools.rightClick(tabId, args);
          case "double_click":
            return await interactionTools.doubleClick(tabId, args);
          case "triple_click":
            return await interactionTools.tripleClick(tabId, args);
          case "hover":
            return await interactionTools.hover(tabId, args);
          case "type_text":
            return await interactionTools.typeText(tabId, args);
          case "press_key":
            return await interactionTools.pressKey(tabId, args);
          case "scroll":
            return await interactionTools.scroll(tabId, args);
          case "drag":
            return await interactionTools.drag(tabId, args);
          case "select":
            return await interactionTools.select(tabId, args);
          case "upload_file":
            return await interactionTools.uploadFile(tabId, args);
          case "form_fill_smart":
            return await interactionTools.formFillSmart(tabId, args);

          // Ghost Mouse
          case "ghost_click":
            return await ghostMouse.ghostClick(tabId, args);
          case "ghost_move":
            return await ghostMouse.ghostMoveTo(tabId, args);
          case "ghost_drag":
            return await ghostMouse.ghostDrag(tabId, args);

          // Inspection
          case "screenshot":
            return await inspectionTools.screenshot(tabId, args);
          case "screenshot_full":
            return await inspectionTools.screenshotFull(tabId, args);
          case "read_page":
            return await inspectionTools.readPage(tabId, args);
          case "find":
            return await inspectionTools.find(tabId, args);
          case "get_page_text":
            return await inspectionTools.getPageText(tabId, args);
          case "get_page_html":
            return await inspectionTools.getPageHtml(tabId, args);
          case "get_element_info":
            return await inspectionTools.getElementInfo(tabId, args);
          case "highlight_element":
            return await inspectionTools.highlightElement(tabId, args);
          case "take_snapshot":
            return await inspectionTools.takeSnapshot(tabId, args);
          case "wait_for":
            return await inspectionTools.waitFor(tabId, args);

          // JS / Console / Network
          case "eval_js":
          case "eval_js_file": // Handled dynamically from server loading code
            return await consoleNetworkTools.evalJs(tabId, args);
          case "read_console":
            return await consoleNetworkTools.readConsole(tabId, args);
          case "clear_console":
            return await consoleNetworkTools.clearConsole(tabId, args);
          case "read_network":
            return await consoleNetworkTools.readNetwork(tabId, args);
          case "get_response_body":
            return await consoleNetworkTools.getResponseBody(tabId, args);

          // Phase 3 — Storage & Cookie Control
          case "get_storage":
            return await storageTools.getStorage(tabId, args);
          case "set_storage":
            return await storageTools.setStorage(tabId, args);
          case "clear_storage":
            return await storageTools.clearStorage(tabId, args);
          case "get_cookies":
            return await storageTools.getCookies(tabId, args);
          case "set_cookie":
            return await storageTools.setCookie(tabId, args);

          // Phase 3 — Network Power Tools
          case "intercept_request":
            return await networkTools.interceptRequest(tabId, args);
          case "set_throttling":
            return await networkTools.setThrottling(tabId, args);
          case "export_har":
            return await networkTools.exportHar(tabId, args);

          // Phase 3 — Biometric Face Detection
          case "face_detect":
            return await faceTools.faceDetect(tabId, args);
          case "face_count":
            return await faceTools.faceCount(tabId, args);
          case "face_landmarks":
            return await faceTools.faceLandmarks(tabId, args);
          case "face_verify_ui":
            return await faceTools.faceVerifyUi(tabId, args);

          default:
            return {
              success: false,
              output: `Error: Tool '${toolName}' is not registered or supported in the current Phase.`
            };
        }
      } catch (err: any) {
        return {
          success: false,
          output: `Execution error for tool '${toolName}': ${err.message}`,
          error: err.message
        };
      }
    });
  }
}

export const toolDispatcher = ToolDispatcher.getInstance();
