/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TabInfo {
  tabId: number;
  windowId: number;
  url: string;
  title: string;
  active: boolean;
  status?: string;
  groupId?: number;
}

export interface FaceResult {
  boundingBox: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  };
  landmarks: Array<{
    x: number;
    y: number;
    name?: string;
  }>;
  confidence: number;
}

export interface ScreenshotResult {
  base64Image: string;
  imageFormat: "jpeg" | "png";
  viewportWidth: number;
  viewportHeight: number;
  width: number;
  height: number;
  screenshotId: string;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  content?: Array<{
    type: "text" | "image";
    text?: string;
    data?: string; // base64 representation if image
    mimeType?: string;
  }>;
}
