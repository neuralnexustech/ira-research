/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import { ToolResult } from "../../../shared/types";
import { tabManager } from "../tab-manager";

export class NavigationTools {
  private static instance: NavigationTools;

  private constructor() {}

  public static getInstance(): NavigationTools {
    if (!NavigationTools.instance) {
      NavigationTools.instance = new NavigationTools();
    }
    return NavigationTools.instance;
  }

  /**
   * List all tabs across all windows
   */
  public async tabsList(args: any): Promise<ToolResult> {
    return new Promise((resolve) => {
      chrome.tabs.query({}, (tabs) => {
        const tabList = tabs.map((t) => ({
          tabId: t.id || 0,
          windowId: t.windowId,
          url: t.url || "",
          title: t.title || "",
          active: t.active,
          status: t.status,
          groupId: t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE ? t.groupId : undefined
        }));

        resolve({
          success: true,
          output: `Found ${tabList.length} open tab(s).`,
          content: [
            {
              type: "text",
              text: JSON.stringify(tabList, null, 2)
            }
          ]
        });
      });
    });
  }

  /**
   * Create a new tab and add it to the active IRA tab group if possible
   */
  public async tabsCreate(args: any): Promise<ToolResult> {
    const url = args.url || "about:blank";
    
    return new Promise((resolve, reject) => {
      chrome.tabs.create({ url }, async (newTab) => {
        const err = chrome.runtime.lastError;
        if (err || !newTab || !newTab.id) {
          reject(new Error(`Failed to create new tab: ${err?.message || "Unknown error"}`));
          return;
        }

        // Try to add to active tab group if requested or if there's an active group
        const groupTabId = Number(args.groupTabId || args.mainTabId);
        if (groupTabId && !isNaN(groupTabId)) {
          try {
            await tabManager.addTabToGroup(groupTabId, newTab.id);
          } catch (e) {
            // Non-blocking, continue
          }
        }

        resolve({
          success: true,
          output: `Successfully created tab ID ${newTab.id} navigating to ${url}`,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                tabId: newTab.id,
                windowId: newTab.windowId,
                url: newTab.url || "",
                title: newTab.title || "",
                active: newTab.active
              }, null, 2)
            }
          ]
        });
      });
    });
  }

  /**
   * Navigate tab to URL and wait for the tab to finish loading
   */
  public async navigate(tabId: number, args: any): Promise<ToolResult> {
    const url = args.url;
    if (!url) {
      return {
        success: false,
        output: "Error: A 'url' parameter is required to navigate."
      };
    }

    return new Promise((resolve) => {
      let loadingFinished = false;
      const timeoutMs = 15000;
      
      // Listen for tab update completion
      const onUpdated = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId !== tabId) return;
        if (changeInfo.status === "complete") {
          loadingFinished = true;
          chrome.tabs.onUpdated.removeListener(onUpdated);
          resolve({
            success: true,
            output: `Successfully navigated tab ID ${tabId} to ${url}`
          });
        }
      };
      chrome.tabs.onUpdated.addListener(onUpdated);

      // Start navigation
      chrome.tabs.update(tabId, { url }, () => {
        const err = chrome.runtime.lastError;
        if (err) {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          resolve({
            success: false,
            output: `Navigation update failed: ${err.message}`,
            error: err.message
          });
        }
      });

      // Safety timeout
      setTimeout(() => {
        if (!loadingFinished) {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          resolve({
            success: true,
            output: `Navigation to ${url} started (tab may still be loading after ${timeoutMs}ms timeout)`
          });
        }
      }, timeoutMs);
    });
  }
}

export const navigationTools = NavigationTools.getInstance();
