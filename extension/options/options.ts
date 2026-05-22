/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

interface IraSettings {
  tcpPort: number;
  keepaliveEnabled: boolean;
  mouseSpeed: number;
  mouseJitter: number;
  overshootChance: number;
  verifyRadius: number;
  faceConfidence: number;
  networkLimit: number;
  consoleLimit: number;
  defaultSearchEngine: string;
}

const DEFAULTS: IraSettings = {
  tcpPort: 18765,
  keepaliveEnabled: true,
  mouseSpeed: 1.0,
  mouseJitter: 2,
  overshootChance: 30,
  verifyRadius: 95,
  faceConfidence: 0.70,
  networkLimit: 1000,
  consoleLimit: 10000,
  defaultSearchEngine: "google"
};

// UI Elements
const tcpPortEl = document.getElementById("tcpPort") as HTMLInputElement;
const keepaliveEnabledEl = document.getElementById("keepaliveEnabled") as HTMLInputElement;

const mouseSpeedEl = document.getElementById("mouseSpeed") as HTMLInputElement;
const mouseSpeedValEl = document.getElementById("mouseSpeedVal") as HTMLSpanElement;

const mouseJitterEl = document.getElementById("mouseJitter") as HTMLInputElement;
const mouseJitterValEl = document.getElementById("mouseJitterVal") as HTMLSpanElement;

const overshootChanceEl = document.getElementById("overshootChance") as HTMLInputElement;
const overshootChanceValEl = document.getElementById("overshootChanceVal") as HTMLSpanElement;

const verifyRadiusEl = document.getElementById("verifyRadius") as HTMLInputElement;
const verifyRadiusValEl = document.getElementById("verifyRadiusVal") as HTMLSpanElement;

const faceConfidenceEl = document.getElementById("faceConfidence") as HTMLInputElement;
const faceConfidenceValEl = document.getElementById("faceConfidenceVal") as HTMLSpanElement;

const networkLimitEl = document.getElementById("networkLimit") as HTMLInputElement;
const consoleLimitEl = document.getElementById("consoleLimit") as HTMLInputElement;
const defaultSearchEngineEl = document.getElementById("defaultSearchEngine") as HTMLSelectElement;

const saveBtn = document.getElementById("saveBtn") as HTMLButtonElement;
const resetBtn = document.getElementById("resetBtn") as HTMLButtonElement;
const testBtn = document.getElementById("testBtn") as HTMLButtonElement;

const toastEl = document.getElementById("toast") as HTMLDivElement;
const toastMsgEl = document.getElementById("toastMsg") as HTMLSpanElement;

// Sync sliders with displays
function setupSliderSync(slider: HTMLInputElement, display: HTMLSpanElement, suffix: string = "") {
  slider.addEventListener("input", () => {
    display.textContent = `${slider.value}${suffix}`;
  });
}

setupSliderSync(mouseSpeedEl, mouseSpeedValEl, "x");
setupSliderSync(mouseJitterEl, mouseJitterValEl, "px");
setupSliderSync(overshootChanceEl, overshootChanceValEl, "%");
setupSliderSync(verifyRadiusEl, verifyRadiusValEl, "px");
setupSliderSync(faceConfidenceEl, faceConfidenceValEl);

// Load Settings
function loadSettings() {
  chrome.storage.local.get("settings", (data) => {
    const settings = { ...DEFAULTS, ...data.settings };
    
    tcpPortEl.value = String(settings.tcpPort);
    keepaliveEnabledEl.checked = settings.keepaliveEnabled;
    
    mouseSpeedEl.value = String(settings.mouseSpeed);
    mouseSpeedValEl.textContent = `${settings.mouseSpeed}x`;
    
    mouseJitterEl.value = String(settings.mouseJitter);
    mouseJitterValEl.textContent = `${settings.mouseJitter}px`;
    
    overshootChanceEl.value = String(settings.overshootChance);
    overshootChanceValEl.textContent = `${settings.overshootChance}%`;
    
    verifyRadiusEl.value = String(settings.verifyRadius);
    verifyRadiusValEl.textContent = `${settings.verifyRadius}px`;
    
    faceConfidenceEl.value = String(settings.faceConfidence);
    faceConfidenceValEl.textContent = Number(settings.faceConfidence).toFixed(2);
    
    networkLimitEl.value = String(settings.networkLimit);
    consoleLimitEl.value = String(settings.consoleLimit);
    defaultSearchEngineEl.value = settings.defaultSearchEngine;
  });
}

// Show Toast
let toastTimeout: any = null;
function showToast(msg: string, isError: boolean = false) {
  toastMsgEl.textContent = msg;
  toastEl.style.borderColor = isError ? "rgba(239, 68, 68, 0.4)" : "rgba(34, 197, 94, 0.4)";
  toastEl.style.color = isError ? "#ef4444" : "#4ade80";
  toastEl.classList.add("show");

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.remove("show");
  }, 3000);
}

// Save Settings
saveBtn.addEventListener("click", () => {
  const settings: IraSettings = {
    tcpPort: Number(tcpPortEl.value),
    keepaliveEnabled: keepaliveEnabledEl.checked,
    mouseSpeed: Number(mouseSpeedEl.value),
    mouseJitter: Number(mouseJitterEl.value),
    overshootChance: Number(overshootChanceEl.value),
    verifyRadius: Number(verifyRadiusEl.value),
    faceConfidence: Number(faceConfidenceEl.value),
    networkLimit: Number(networkLimitEl.value),
    consoleLimit: Number(consoleLimitEl.value),
    defaultSearchEngine: defaultSearchEngineEl.value
  };

  chrome.storage.local.set({ settings }, () => {
    showToast("Configuration Saved Successfully!");
  });
});

// Reset Settings
resetBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to restore all defaults?")) {
    chrome.storage.local.set({ settings: DEFAULTS }, () => {
      loadSettings();
      showToast("Settings Reset to Defaults.");
    });
  }
});

// Test Connection
testBtn.addEventListener("click", () => {
  testBtn.disabled = true;
  testBtn.textContent = "Testing...";
  
  chrome.runtime.sendMessage({ type: "TEST_TCP_CONNECTION" }, (response) => {
    testBtn.disabled = false;
    testBtn.textContent = "Test TCP Bridge";
    
    if (chrome.runtime.lastError) {
      showToast("Service worker connection failed.", true);
      return;
    }

    if (response && response.success) {
      showToast("TCP Bridge Connected Successfully!");
    } else {
      showToast(`Bridge Status: ${response?.reason || "Bridge Disconnected"}`, true);
    }
  });
});

// Init
document.addEventListener("DOMContentLoaded", loadSettings);
