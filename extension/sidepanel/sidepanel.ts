/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

// DOM Handles
const statusBadgeEl = document.getElementById("statusBadge") as HTMLDivElement;
const statusTxtEl = document.getElementById("statusTxt") as HTMLSpanElement;

const activeTabIdEl = document.getElementById("activeTabId") as HTMLSpanElement;
const bufferCountEl = document.getElementById("bufferCount") as HTMLSpanElement;

const stealthModeBtn = document.getElementById("stealthModeBtn") as HTMLButtonElement;
const preciseModeBtn = document.getElementById("preciseModeBtn") as HTMLButtonElement;
const standardModeBtn = document.getElementById("standardModeBtn") as HTMLButtonElement;

const navUrlEl = document.getElementById("navUrl") as HTMLInputElement;
const navBtn = document.getElementById("navBtn") as HTMLButtonElement;

const snapBtn = document.getElementById("snapBtn") as HTMLButtonElement;
const treeBtn = document.getElementById("treeBtn") as HTMLButtonElement;
const abortBtn = document.getElementById("abortBtn") as HTMLButtonElement;

const termConsoleEl = document.getElementById("termConsole") as HTMLDivElement;

// Helper to write to scrolling terminal console
function logToTerminal(msg: string, type: "info" | "success" | "warn" | "error" = "info") {
  const timestamp = new Date().toTimeString().split(' ')[0];
  const container = document.createElement("div");
  container.className = `log-line ${type}`;

  const tsSpan = document.createElement("span");
  tsSpan.className = "log-line timestamp";
  tsSpan.textContent = `[${timestamp}]`;

  const msgText = document.createTextNode(` ${msg}`);
  
  container.appendChild(tsSpan);
  container.appendChild(msgText);
  
  termConsoleEl.appendChild(container);
  termConsoleEl.scrollTop = termConsoleEl.scrollHeight;
}

// Check Connection & Stats periodically
function checkStatus() {
  // Test TCP Bridge
  chrome.runtime.sendMessage({ type: "TEST_TCP_CONNECTION" }, (response) => {
    if (chrome.runtime.lastError) return;
    
    if (response && response.success) {
      statusBadgeEl.classList.add("connected");
      statusTxtEl.textContent = "Active";
    } else {
      statusBadgeEl.classList.remove("connected");
      statusTxtEl.textContent = "Inactive";
    }
  });

  // Fetch Telemetry HUD stats
  chrome.runtime.sendMessage({ type: "GET_HUD_STATS" }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response) {
      activeTabIdEl.textContent = response.activeTabId ? String(response.activeTabId) : "None";
      bufferCountEl.textContent = String((response.consoleCount || 0) + (response.networkCount || 0));
    }
  });
}

// Mode Selection handlers
function setMouseMode(mode: string, activeBtn: HTMLButtonElement) {
  [stealthModeBtn, preciseModeBtn, standardModeBtn].forEach(b => b.classList.remove("active"));
  activeBtn.classList.add("active");

  chrome.runtime.sendMessage({ type: "SET_MOUSE_PROFILE", mode }, () => {
    logToTerminal(`Mouse Profile switched to: ${mode.toUpperCase()}`, "info");
  });
}

stealthModeBtn.addEventListener("click", () => setMouseMode("stealth", stealthModeBtn));
preciseModeBtn.addEventListener("click", () => setMouseMode("precise", preciseModeBtn));
standardModeBtn.addEventListener("click", () => setMouseMode("standard", standardModeBtn));

// Quick Navigation
navBtn.addEventListener("click", () => {
  const url = navUrlEl.value.trim();
  if (!url) return;

  logToTerminal(`Manual override: Navigating to ${url}...`, "info");
  navBtn.disabled = true;

  chrome.runtime.sendMessage({ type: "MANUAL_NAVIGATE", url }, (response) => {
    navBtn.disabled = false;
    if (chrome.runtime.lastError) {
      logToTerminal("Service worker navigation call failed.", "error");
      return;
    }
    if (response && response.success) {
      logToTerminal("Navigation completed successfully.", "success");
    } else {
      logToTerminal(`Navigation failed: ${response?.error || "Unknown error"}`, "error");
    }
  });
});

// Viewport Capture
snapBtn.addEventListener("click", () => {
  logToTerminal("Capturing screenshot...", "info");
  snapBtn.disabled = true;

  chrome.runtime.sendMessage({ type: "MANUAL_SCREENSHOT" }, (response) => {
    snapBtn.disabled = false;
    if (chrome.runtime.lastError) {
      logToTerminal("Screenshot dispatch failed.", "error");
      return;
    }
    if (response && response.success) {
      logToTerminal(`Screenshot captured. Size: ${response.width}x${response.height}.`, "success");
    } else {
      logToTerminal(`Screenshot failed: ${response?.error || "Unknown error"}`, "error");
    }
  });
});

// Accessibility Tree Parser
treeBtn.addEventListener("click", () => {
  logToTerminal("Parsing DOM accessibility tree...", "info");
  treeBtn.disabled = true;

  chrome.runtime.sendMessage({ type: "MANUAL_A11Y_TREE" }, (response) => {
    treeBtn.disabled = false;
    if (chrome.runtime.lastError) {
      logToTerminal("Accessibility tree request failed.", "error");
      return;
    }
    if (response && response.success) {
      logToTerminal(`Tree generated. Nodes parsed: ${response.nodeCount}.`, "success");
      console.log(response.tree);
    } else {
      logToTerminal(`Tree extraction failed: ${response?.error || "Unknown error"}`, "error");
    }
  });
});

// Emergency Abort Agent
abortBtn.addEventListener("click", () => {
  logToTerminal("EMERGENCY AGENT STOP REQUESTED!", "error");
  chrome.runtime.sendMessage({ type: "STOP_AGENT" }, () => {
    logToTerminal("All automated execution queues terminated instantly.", "warn");
  });
});

// Listen to dynamic logs broadcasted from Background SW
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "BROADCAST_LOG") {
    logToTerminal(message.text, message.logLevel || "info");
  }
});

// Initialize connection loops
checkStatus();
setInterval(checkStatus, 3000);
logToTerminal("Active telemetry loop initialized.", "success");
