/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import { ToolResult } from "../../../shared/types";
import { cdpEngine } from "../cdp-engine";

export class InteractionTools {
  private static instance: InteractionTools;

  private constructor() {}

  public static getInstance(): InteractionTools {
    if (!InteractionTools.instance) {
      InteractionTools.instance = new InteractionTools();
    }
    return InteractionTools.instance;
  }

  private async resolveCoordinates(
    tabId: number,
    args: any,
    prefix: "from" | "to" | "" = ""
  ): Promise<{ x: number; y: number }> {
    const refKey = prefix ? `${prefix}RefId` : "refId";
    const xKey = prefix ? `${prefix}X` : "x";
    const yKey = prefix ? `${prefix}Y` : "y";

    const refId = args[refKey];
    if (refId) {
      const coords = await cdpEngine.getElementCenter(tabId, refId);
      if (!coords) {
        throw new Error(`Failed to resolve coordinates for element reference '${refId}'.`);
      }
      return coords;
    }

    const x = Number(args[xKey]);
    const y = Number(args[yKey]);
    if (isNaN(x) || isNaN(y)) {
      throw new Error(`Invalid or missing coordinates. Must provide '${refKey}' or numerical '${xKey}' and '${yKey}'.`);
    }

    return { x, y };
  }

  /**
   * Click an element (by refId or coordinates)
   */
  public async click(tabId: number, args: any): Promise<ToolResult> {
    try {
      const { x, y } = await this.resolveCoordinates(tabId, args);
      const button = args.button || "left";
      const clickCount = Number(args.clickCount || 1);

      await cdpEngine.click(tabId, x, y, button, clickCount);

      return {
        success: true,
        output: `Successfully dispatched ${clickCount}-click (${button} button) at (${x}, ${y})`
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Click operation failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Right click convenience wrapper
   */
  public async rightClick(tabId: number, args: any): Promise<ToolResult> {
    return this.click(tabId, { ...args, button: "right" });
  }

  /**
   * Double click convenience wrapper
   */
  public async doubleClick(tabId: number, args: any): Promise<ToolResult> {
    return this.click(tabId, { ...args, clickCount: 2 });
  }

  /**
   * Triple click convenience wrapper
   */
  public async tripleClick(tabId: number, args: any): Promise<ToolResult> {
    return this.click(tabId, { ...args, clickCount: 3 });
  }

  /**
   * Hover over an element or coordinates without clicking
   */
  public async hover(tabId: number, args: any): Promise<ToolResult> {
    try {
      const { x, y } = await this.resolveCoordinates(tabId, args);

      await cdpEngine.sendCommand(tabId, "Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x,
        y
      });

      return {
        success: true,
        output: `Successfully hovered mouse cursor at (${x}, ${y})`
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Hover operation failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Type text. If refId is specified, clicks the element first to focus.
   */
  public async typeText(tabId: number, args: any): Promise<ToolResult> {
    try {
      const text = args.text;
      if (text === undefined) {
        return {
          success: false,
          output: "Error: A 'text' parameter is required to type."
        };
      }

      const refId = args.refId;
      if (refId) {
        const coords = await cdpEngine.getElementCenter(tabId, refId);
        if (!coords) {
          return {
            success: false,
            output: `Error: Element reference '${refId}' could not be resolved to focus.`
          };
        }
        // Focus element by clicking it first
        await cdpEngine.click(tabId, coords.x, coords.y);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      await cdpEngine.typeTextSimulated(tabId, text);

      return {
        success: true,
        output: `Successfully typed text into target: "${text}"`
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Type operation failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Press key or keyboard shortcuts
   */
  public async pressKey(tabId: number, args: any): Promise<ToolResult> {
    try {
      const key = args.key;
      if (!key) {
        return {
          success: false,
          output: "Error: A 'key' parameter is required."
        };
      }

      await cdpEngine.pressKey(tabId, key);

      return {
        success: true,
        output: `Successfully pressed key: "${key}"`
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Key press operation failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Scroll element or page viewport
   */
  public async scroll(tabId: number, args: any): Promise<ToolResult> {
    try {
      const dx = Number(args.dx ?? args.deltaX ?? 0);
      const dy = Number(args.dy ?? args.deltaY ?? 150);
      
      let x = 300;
      let y = 300;

      // Try resolving coordinates if a target is provided
      try {
        const coords = await this.resolveCoordinates(tabId, args);
        x = coords.x;
        y = coords.y;
      } catch (e) {
        // Fallback: use central viewport coordinates
      }

      await cdpEngine.scroll(tabId, x, y, dx, dy);

      return {
        success: true,
        output: `Successfully scrolled viewport at (${x}, ${y}) by dx: ${dx}, dy: ${dy}`
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Scroll operation failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Drag mouse from start to target
   */
  public async drag(tabId: number, args: any): Promise<ToolResult> {
    try {
      const from = await this.resolveCoordinates(tabId, args, "from");
      const to = await this.resolveCoordinates(tabId, args, "to");

      await cdpEngine.drag(tabId, from.x, from.y, to.x, to.y);

      return {
        success: true,
        output: `Successfully dragged element from (${from.x}, ${from.y}) to (${to.x}, ${to.y})`
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Drag operation failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Select an option in a select element dropdown
   */
  public async select(tabId: number, args: any): Promise<ToolResult> {
    try {
      const refId = args.refId;
      const value = args.value;
      if (!refId || value === undefined) {
        return {
          success: false,
          output: "Error: Both 'refId' and 'value' parameters are required."
        };
      }

      await cdpEngine.selectOption(tabId, refId, value);

      return {
        success: true,
        output: `Successfully selected dropdown option value "${value}" on element [${refId}]`
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Dropdown selection failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Upload file utilizing DOM setFileInputFiles
   */
  public async uploadFile(tabId: number, args: any): Promise<ToolResult> {
    try {
      const refId = args.refId;
      let files = args.filePaths || args.files;
      if (!refId || !files) {
        return {
          success: false,
          output: "Error: Both 'refId' and 'filePaths' (array) are required."
        };
      }

      if (!Array.isArray(files)) {
        files = [files];
      }

      await cdpEngine.uploadFile(tabId, refId, files);

      return {
        success: true,
        output: `Successfully uploaded ${files.length} file(s) into element [${refId}]`
      };
    } catch (err: any) {
      return {
        success: false,
        output: `File upload failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * SEQUENTIAL MULTI-FIELD SMART FORM FILL
   */
  public async formFillSmart(tabId: number, args: any): Promise<ToolResult> {
    try {
      const fields = args.fields; // Object of key-value e.g., { "ref_1": "Username", "ref_2": "Password" }
      if (!fields || typeof fields !== "object") {
        return {
          success: false,
          output: "Error: A valid 'fields' key-value mapping object must be provided."
        };
      }

      const refIds = Object.keys(fields);
      let fillCount = 0;

      for (const refId of refIds) {
        const text = String(fields[refId]);
        const coords = await cdpEngine.getElementCenter(tabId, refId);
        if (!coords) continue;

        // Sequence: click field -> focus delay -> simulated type
        await cdpEngine.click(tabId, coords.x, coords.y);
        await new Promise((resolve) => setTimeout(resolve, 80));
        await cdpEngine.typeTextSimulated(tabId, text);
        
        // Tab key press between sequential elements for native validation focus trigger
        await cdpEngine.pressKey(tabId, "Tab");
        await new Promise((resolve) => setTimeout(resolve, 100));
        fillCount++;
      }

      return {
        success: true,
        output: `Smart Form Fill: Sequentially completed typing into ${fillCount} form element(s).`
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Smart Form Fill failed: ${err.message}`,
        error: err.message
      };
    }
  }
}

export const interactionTools = InteractionTools.getInstance();
