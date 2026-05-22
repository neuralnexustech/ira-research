/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import { TabInfo, ScreenshotResult } from "../../shared/types";

// Ensure global namespace handles our properties
declare global {
  var __iraActiveSessions: Map<string, any>;
  var __iraAttachedTabs: Set<number>;
  var __iraTabGroups: Map<number, any>; // mainTabId -> group meta
  var __iraScreenshots: Map<string, ScreenshotResult>;
  var __iraConsoleLogs: Map<number, any[]>; // tabId -> console entries
  var __iraNetworkLogs: Map<number, any[]>; // tabId -> network entries
  var __iraActiveQueues: Map<number, any>; // tabId -> TabQueue instance
  var __iraActiveInterceptions: Map<number, any[]>; // tabId -> interception rules
  var __iraSettings: any;
  var __iraSwInstanceId: string;
}

// Initialize globals if not already present
globalThis.__iraActiveSessions = globalThis.__iraActiveSessions || new Map();
globalThis.__iraAttachedTabs = globalThis.__iraAttachedTabs || new Set();
globalThis.__iraTabGroups = globalThis.__iraTabGroups || new Map();
globalThis.__iraScreenshots = globalThis.__iraScreenshots || new Map();
globalThis.__iraConsoleLogs = globalThis.__iraConsoleLogs || new Map();
globalThis.__iraNetworkLogs = globalThis.__iraNetworkLogs || new Map();
globalThis.__iraActiveQueues = globalThis.__iraActiveQueues || new Map();
globalThis.__iraActiveInterceptions = globalThis.__iraActiveInterceptions || new Map();
globalThis.__iraSettings = globalThis.__iraSettings || {
  tcpPort: 18765,
  keepaliveEnabled: true,
  mouseSpeed: 1.0,
  mouseJitter: 2,
  overshootChance: 30,
  verifyRadius: 95,
  faceConfidence: 0.70,
  networkLimit: 1000,
  consoleLimit: 10000
};

// Track SW instance to detect restarts
globalThis.__iraSwInstanceId = globalThis.__iraSwInstanceId || Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

export const activeSessions = globalThis.__iraActiveSessions;
export const attachedTabs = globalThis.__iraAttachedTabs;
export const tabGroups = globalThis.__iraTabGroups;
export const screenshotStore = globalThis.__iraScreenshots;
export const consoleLogs = globalThis.__iraConsoleLogs;
export const networkLogs = globalThis.__iraNetworkLogs;
export const activeQueues = globalThis.__iraActiveQueues;
export const activeInterceptions = globalThis.__iraActiveInterceptions;
export const settings = globalThis.__iraSettings;
