/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import { tabGroups, activeQueues } from "./state";

export interface TabGroupMetadata {
  mainTabId: number;
  chromeGroupId: number;
  domain: string;
  memberTabIds: Set<number>;
  color: "orange" | "yellow";
}

export class TabQueue {
  private queue: Promise<any> = Promise.resolve();

  public enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(() => fn());
    this.queue = result.catch(() => {}); // continue queue on failure
    return result;
  }
}

export class TabManager {
  private static instance: TabManager;

  private constructor() {}

  public static getInstance(): TabManager {
    if (!TabManager.instance) {
      TabManager.instance = new TabManager();
    }
    return TabManager.instance;
  }

  /**
   * Get or create TabQueue for a tab
   */
  public getOrCreateQueue(tabId: number): TabQueue {
    let queue = activeQueues.get(tabId);
    if (!queue) {
      queue = new TabQueue();
      activeQueues.set(tabId, queue);
    }
    return queue;
  }

  /**
   * Create a new orange "IRA" tab group or yellow "IRA (MCP)" group
   */
  public async createTabGroup(mainTabId: number, isMcp = false): Promise<TabGroupMetadata> {
    return new Promise((resolve, reject) => {
      chrome.tabs.get(mainTabId, async (tab) => {
        const err = chrome.runtime.lastError;
        if (err || !tab) {
          reject(new Error(`Failed to retrieve main tab: ${err?.message || "Not found"}`));
          return;
        }

        const domain = tab.url ? new URL(tab.url).hostname : "unknown";
        const groupColor = isMcp ? "yellow" : "orange";
        const groupTitle = isMcp ? "IRA (MCP)" : "IRA";

        try {
          const groupId = await chrome.tabs.group({ tabIds: mainTabId });
          await chrome.tabGroups.update(groupId, {
            title: groupTitle,
            color: groupColor
          });

          const meta: TabGroupMetadata = {
            mainTabId,
            chromeGroupId: groupId,
            domain,
            memberTabIds: new Set([mainTabId]),
            color: groupColor
          };

          tabGroups.set(mainTabId, meta);
          resolve(meta);
        } catch (e: any) {
          reject(new Error(`Failed to create tab group: ${e.message}`));
        }
      });
    });
  }

  /**
   * Add a tab to an existing group
   */
  public async addTabToGroup(mainTabId: number, tabId: number): Promise<void> {
    const meta = tabGroups.get(mainTabId);
    if (!meta) return;

    await chrome.tabs.group({
      tabIds: tabId,
      groupId: meta.chromeGroupId
    });
    meta.memberTabIds.add(tabId);
  }

  /**
   * Find group metadata managing the given tab
   */
  public findGroupByTab(tabId: number): TabGroupMetadata | null {
    for (const meta of tabGroups.values()) {
      if (meta.memberTabIds.has(tabId) || meta.mainTabId === tabId) {
        return meta;
      }
    }
    return null;
  }

  /**
   * Check indicator hiding for tools
   */
  public async hideIndicatorForToolUse(tabId: number): Promise<void> {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "HIDE_FOR_TOOL_USE" });
    } catch (e) {}
  }

  /**
   * Restore indicators after tools
   */
  public async restoreIndicatorAfterToolUse(tabId: number): Promise<void> {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "SHOW_AFTER_TOOL_USE" });
    } catch (e) {}
  }
}

export const tabManager = TabManager.getInstance();
