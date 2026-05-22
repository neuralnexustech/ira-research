/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import { connectNativeHost, nativeMessaging } from "./native-messaging";
import { cdpEngine } from "./cdp-engine";
import { attachedTabs, consoleLogs, networkLogs, activeInterceptions, activeQueues } from "./state";
import { navigationTools } from "./tools/navigation";
import { inspectionTools } from "./tools/inspection";

// Global profile
declare global {
  var __iraMouseProfile: string;
}
globalThis.__iraMouseProfile = globalThis.__iraMouseProfile || "stealth";

// Synchronize in-memory settings cache with chrome.storage.local
function loadAndSyncSettings() {
  chrome.storage.local.get("settings", (data) => {
    if (data.settings) {
      globalThis.__iraSettings = { ...globalThis.__iraSettings, ...data.settings };
    }
  });
}
loadAndSyncSettings();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.settings) {
    globalThis.__iraSettings = { ...globalThis.__iraSettings, ...changes.settings.newValue };
    console.log("IRA Settings synchronized from storage:", globalThis.__iraSettings);
  }
});

console.log("IRA Research Background Worker Initializing...");

// CRITICAL: On SW restart, detach ALL debuggers for clean state.
// Chrome keeps debuggers attached across SW restarts but our in-memory
// attachedTabs Set is cleared, causing sendCommand to hang.
async function resetDebuggerState() {
  try {
    const allTabs = await chrome.tabs.query({});
    const detachPromises = allTabs
      .filter(tab => tab.id !== undefined)
      .map(tab => new Promise<void>(resolve => {
        chrome.debugger.detach({ tabId: tab.id! }, () => {
          if (chrome.runtime.lastError) {}
          resolve();
        });
      }));
    await Promise.all(detachPromises);
    attachedTabs.clear();
    console.log("Reset debugger state: detached from", allTabs.length, "tabs.");
  } catch (e) {
    console.error("Failed to reset debugger state:", e);
  }
}
resetDebuggerState();

// 1. Establish connection to the native host bridge
connectNativeHost();

// Clean up tab states on tab removal or debugger detachment
function cleanupTabResources(tabId: number) {
  attachedTabs.delete(tabId);
  consoleLogs.delete(tabId);
  networkLogs.delete(tabId);
  activeInterceptions.delete(tabId);
  activeQueues.delete(tabId);
  console.log(`Successfully cleaned up resources for tab ID: ${tabId}`);
}

chrome.tabs.onRemoved.addListener((tabId) => {
  cleanupTabResources(tabId);
});

chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId) {
    cleanupTabResources(source.tabId);
  }
});

// 2. Initialize offscreen document to maintain service worker persistence
async function setupOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) return;
  
  try {
    await chrome.offscreen.createDocument({
      url: "offscreen/offscreen.html",
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK, chrome.offscreen.Reason.DOM_PARSER],
      justification: "Maintain service worker keep-alive heartbeat and run ML tasks"
    });
    console.log("Offscreen keep-alive context initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize offscreen context:", err);
  }
}

// Handle Extension startup/installation
chrome.runtime.onInstalled.addListener(async () => {
  console.log("IRA Research Extension Installed.");
  await setupOffscreenDocument();
  
  // Set up keepalive alarm (redundancy check every 20s)
  chrome.alarms.create("ira-keepalive", { periodInMinutes: 0.3 });
});

chrome.runtime.onStartup.addListener(async () => {
  console.log("IRA Research Extension Started.");
  await setupOffscreenDocument();
});

// Alarm heartbeat checks
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "ira-keepalive") {
    // Perform soft touch to keep SW active
    await setupOffscreenDocument();
  }
});

// Message Listeners
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SW_KEEPALIVE") {
    // Reset service worker timeout by returning an immediate ACK
    sendResponse({ ack: true });
    return true;
  }

  if (message.type === "TEST_TCP_CONNECTION") {
    sendResponse({ success: nativeMessaging.isTcpConnected });
    return true;
  }

  if (message.type === "GET_HUD_STATS") {
    const activeTabId = Array.from(attachedTabs)[0] || null;
    const consoleCount = activeTabId ? (consoleLogs.get(activeTabId)?.length || 0) : 0;
    const networkCount = activeTabId ? (networkLogs.get(activeTabId)?.length || 0) : 0;
    sendResponse({ activeTabId, consoleCount, networkCount });
    return true;
  }

  if (message.type === "SET_MOUSE_PROFILE") {
    globalThis.__iraMouseProfile = message.mode;
    sendResponse({ success: true });
    return true;
  }

  if (message.type === "MANUAL_NAVIGATE") {
    const activeTabId = Array.from(attachedTabs)[0];
    if (!activeTabId) {
      sendResponse({ success: false, error: "No active debugger attached tab found." });
      return true;
    }
    navigationTools.navigate(activeTabId, { url: message.url })
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "MANUAL_SCREENSHOT") {
    const activeTabId = Array.from(attachedTabs)[0];
    if (!activeTabId) {
      sendResponse({ success: false, error: "No active debugger attached tab found." });
      return true;
    }
    inspectionTools.screenshot(activeTabId, {})
      .then(res => sendResponse({ success: true, width: 1280, height: 800 }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "MANUAL_A11Y_TREE") {
    const activeTabId = Array.from(attachedTabs)[0];
    if (!activeTabId) {
      sendResponse({ success: false, error: "No active debugger attached tab found." });
      return true;
    }
    inspectionTools.readPage(activeTabId, {})
      .then(res => {
        const treeText = res.content?.[0]?.text || "";
        const nodeCount = treeText.split("\n").length;
        sendResponse({ success: true, tree: treeText, nodeCount });
      })
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "STOP_AGENT") {
    for (const tabId of Array.from(attachedTabs)) {
      chrome.debugger.detach({ tabId }, () => {
        if (chrome.runtime.lastError) {}
      });
      chrome.tabs.sendMessage(tabId, { type: "HIDE_FOR_TOOL_USE" }).catch(() => {});
      cleanupTabResources(tabId);
    }
    sendResponse({ success: true });
    return true;
  }
});
