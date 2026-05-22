/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import { hideIndicator, showIndicator } from "./overlay";
import "./ref-manager";
import "./accessibility";
import "./element-finder";

console.log("IRA Research Content Engine loaded.");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "HIDE_FOR_TOOL_USE") {
    hideIndicator();
    sendResponse({ success: true });
  } else if (message.type === "SHOW_AFTER_TOOL_USE") {
    showIndicator();
    sendResponse({ success: true });
  } else if (message.type === "AGENT_CONNECTED") {
    showIndicator();
    sendResponse({ success: true });
  } else if (message.type === "AGENT_DISCONNECTED") {
    hideIndicator();
    sendResponse({ success: true });
  }
});

// Check initial connection state on load
// Use setTimeout(0) to ensure the DOM is ready before attempting indicator DOM operations
setTimeout(() => {
  try {
    chrome.runtime.sendMessage({ type: "TEST_TCP_CONNECTION" }, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        console.log("IRA: Connection check skipped (background may not be ready):", err.message);
        return;
      }
      if (response && response.success) {
        showIndicator();
      } else {
        hideIndicator();
      }
    });
  } catch (e) {
    console.log("IRA: Connection check failed gracefully:", e);
  }
}, 0);
