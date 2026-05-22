/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import { ToolResult } from "../../shared/types";
import { cdpEngine } from "./cdp-engine";

export interface Point {
  x: number;
  y: number;
}

export interface GhostMouseOptions {
  moveSpeed?: number;
  overshootChance?: number;
  jitter?: number;
  humanDelay?: boolean;
}

function distance(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

function randomControlPoint(start: Point, end: Point, t: number): Point {
  const mid = { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
  const perpDist = distance(start, end) * 0.3 * (Math.random() - 0.5);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    x: mid.x + (-dy / len) * perpDist,
    y: mid.y + (dx / len) * perpDist
  };
}

function cubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y
  };
}

function generateBezierPath(start: Point, end: Point, numPoints: number = 50): Point[] {
  const cp1 = randomControlPoint(start, end, 0.25);
  const cp2 = randomControlPoint(start, end, 0.75);
  return Array.from({ length: numPoints }, (_, i) => {
    const t = i / (numPoints - 1);
    return cubicBezier(start, cp1, cp2, end, t);
  });
}

function fittsDelay(dist: number, targetSize: number): number {
  return 50 + 150 * Math.log2(dist / targetSize + 1);
}

async function ghostMove(
  tabId: number,
  from: Point,
  to: Point,
  opts: GhostMouseOptions = {}
): Promise<void> {
  const dist = distance(from, to);
  const numPoints = Math.max(5, Math.min(50, Math.round(dist / 10)));
  const path = generateBezierPath(from, to, numPoints);
  const totalTime = fittsDelay(dist, 20) * (opts.moveSpeed ?? 1);
  const stepDelay = totalTime / path.length;

  for (const point of path) {
    const jx = (Math.random() - 0.5) * (opts.jitter ?? 2);
    const jy = (Math.random() - 0.5) * (opts.jitter ?? 2);
    await cdpEngine.sendCommand(tabId, "Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: Math.round(point.x + jx),
      y: Math.round(point.y + jy),
      button: "none"
    });
    const actualDelay = stepDelay * (0.8 + Math.random() * 0.4);
    await new Promise(r => setTimeout(r, actualDelay));
  }

  if (Math.random() < (opts.overshootChance ?? 0.3)) {
    const overshootX = to.x + (Math.random() - 0.5) * 10;
    const overshootY = to.y + (Math.random() - 0.5) * 10;
    await cdpEngine.sendCommand(tabId, "Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: Math.round(overshootX),
      y: Math.round(overshootY),
      button: "none"
    });
    await new Promise(r => setTimeout(r, 30 + Math.random() * 50));
    await cdpEngine.sendCommand(tabId, "Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: Math.round(to.x),
      y: Math.round(to.y),
      button: "none"
    });
  }
}

export class GhostMouse {
  private static instance: GhostMouse;
  private constructor() {}
  public static getInstance(): GhostMouse {
    if (!GhostMouse.instance) GhostMouse.instance = new GhostMouse();
    return GhostMouse.instance;
  }

  public async ghostClick(tabId: number, args: any): Promise<ToolResult> {
    try {
      const x = args.x ?? 0;
      const y = args.y ?? 0;
      const button = args.button ?? "left";

      try { await cdpEngine.sendCommand(tabId, "Runtime.evaluate", {
        expression: `Object.defineProperty(navigator,'webdriver',{get:()=>undefined})`
      }); } catch { /* best effort */ }

      if (args.humanDelay !== false) await new Promise(r => setTimeout(r, 80 + Math.random() * 120));

      await ghostMove(tabId, { x: Math.round(x * 0.9), y: Math.round(y * 0.9) }, { x, y }, args);

      await cdpEngine.sendCommand(tabId, "Input.dispatchMouseEvent", {
        type: "mousePressed", x: Math.round(x), y: Math.round(y), button, clickCount: args.clickCount ?? 1
      });
      await new Promise(r => setTimeout(r, 30 + Math.random() * 40));
      await cdpEngine.sendCommand(tabId, "Input.dispatchMouseEvent", {
        type: "mouseReleased", x: Math.round(x), y: Math.round(y), button, clickCount: args.clickCount ?? 1
      });

      await cdpEngine.sendCommand(tabId, "Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: Math.round(x + (Math.random() - 0.5) * 4),
        y: Math.round(y + (Math.random() - 0.5) * 4),
        button: "none"
      });

      return { success: true, output: `Ghost click at (${x}, ${y}) completed.` };
    } catch (err: any) {
      return { success: false, output: `Ghost click failed: ${err.message}`, error: err.message };
    }
  }

  public async ghostMoveTo(tabId: number, args: any): Promise<ToolResult> {
    try {
      const { x = 0, y = 0 } = args;
      await ghostMove(tabId, { x: 0, y: 0 }, { x, y }, args);
      return { success: true, output: `Ghost move to (${x}, ${y}) completed.` };
    } catch (err: any) {
      return { success: false, output: `Ghost move failed: ${err.message}`, error: err.message };
    }
  }

  public async ghostDrag(tabId: number, args: any): Promise<ToolResult> {
    try {
      const { fromX = 0, fromY = 0, toX = 0, toY = 0 } = args;
      await cdpEngine.sendCommand(tabId, "Input.dispatchMouseEvent", {
        type: "mousePressed", x: Math.round(fromX), y: Math.round(fromY), button: "left"
      });
      await ghostMove(tabId, { x: fromX, y: fromY }, { x: toX, y: toY }, args);
      await cdpEngine.sendCommand(tabId, "Input.dispatchMouseEvent", {
        type: "mouseReleased", x: Math.round(toX), y: Math.round(toY), button: "left"
      });
      return { success: true, output: `Ghost drag from (${fromX},${fromY}) to (${toX},${toY}).` };
    } catch (err: any) {
      return { success: false, output: `Ghost drag failed: ${err.message}`, error: err.message };
    }
  }
}

export const ghostMouse = GhostMouse.getInstance();