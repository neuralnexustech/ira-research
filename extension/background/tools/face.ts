/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import { ToolResult } from "../../../shared/types";
import { cdpEngine } from "../cdp-engine";

export class FaceTools {
  private static instance: FaceTools;

  private constructor() {}

  public static getInstance(): FaceTools {
    if (!FaceTools.instance) {
      FaceTools.instance = new FaceTools();
    }
    return FaceTools.instance;
  }

  /**
   * Routes a visual request to the offscreen document context for canvas ML/heuristics processing
   */
  private async runOffscreenTask(type: string, tabId: number): Promise<any> {
    // 1. Capture high-fidelity screenshot
    const shot = await cdpEngine.screenshot(tabId);

    // 2. Transmit to offscreen helper via messaging
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type,
          base64Image: shot.base64Image,
          viewportWidth: shot.viewportWidth,
          viewportHeight: shot.viewportHeight
        },
        (response) => {
          const err = chrome.runtime.lastError;
          if (err) {
            reject(new Error(`Offscreen communication failed: ${err.message}`));
          } else if (response && response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response?.result);
          }
        }
      );
    });
  }

  /**
   * Performs facial detection on the current tab's viewport returning bounding box coordinates
   */
  public async faceDetect(tabId: number, args: any): Promise<ToolResult> {
    try {
      const faces = await this.runOffscreenTask("FACE_DETECT", tabId);
      return {
        success: true,
        output: `Successfully completed face detection. Found ${faces.length} face(s).`,
        content: [
          {
            type: "text",
            text: JSON.stringify(faces, null, 2)
          }
        ]
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Face detection failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Analyzes the viewport and returns the integer count of distinct faces present
   */
  public async faceCount(tabId: number, args: any): Promise<ToolResult> {
    try {
      const faces = await this.runOffscreenTask("FACE_DETECT", tabId);
      return {
        success: true,
        output: `Face count analysis completed. Found ${faces.length} face(s).`,
        content: [
          {
            type: "text",
            text: JSON.stringify({ count: faces.length }, null, 2)
          }
        ]
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Face count failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Identifies and returns key facial biometric landmarks (eyes, ears, nose, mouth)
   */
  public async faceLandmarks(tabId: number, args: any): Promise<ToolResult> {
    try {
      const faces = await this.runOffscreenTask("FACE_LANDMARKS", tabId);
      return {
        success: true,
        output: `Biometric face landmarks extraction completed. Found ${faces.length} face(s).`,
        content: [
          {
            type: "text",
            text: JSON.stringify(faces, null, 2)
          }
        ]
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Face landmarks failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Verifies visual alignment of key face landmarks against targeting UI boxes
   */
  public async faceVerifyUi(tabId: number, args: any): Promise<ToolResult> {
    try {
      const result = await this.runOffscreenTask("FACE_VERIFY_UI", tabId);
      return {
        success: true,
        output: `Face alignment verification completed. Alignment Status: ${result.aligned ? "ALIGNED" : "MISALIGNED"}.`,
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (err: any) {
      return {
        success: false,
        output: `Face verification failed: ${err.message}`,
        error: err.message
      };
    }
  }
}

export const faceTools = FaceTools.getInstance();
