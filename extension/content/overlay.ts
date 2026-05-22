/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

/// <reference types="chrome"/>

let glowElement: HTMLDivElement | null = null;
let stopButtonElement: HTMLButtonElement | null = null;

/**
 * Waits for document.body to be available, then calls the callback.
 * This is needed because content script runs at document_start.
 */
function whenBodyReady(callback: () => void): void {
  if (document.body) {
    callback();
  } else {
    // If body is not ready, wait for DOMContentLoaded
    document.addEventListener("DOMContentLoaded", callback, { once: true });
  }
}

function injectOverlayStyles() {
  const styleId = "ira-overlay-styles";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    @keyframes ira-pulse {
      0% { box-shadow: inset 0 0 10px rgba(147, 51, 234, 0.4); }
      50% { box-shadow: inset 0 0 25px rgba(147, 51, 234, 0.8); }
      100% { box-shadow: inset 0 0 10px rgba(147, 51, 234, 0.4); }
    }
    .ira-glow-border {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 2147483646;
      border: 3px solid rgba(147, 51, 234, 0.6);
      box-sizing: border-box;
      animation: ira-pulse 2s infinite ease-in-out;
      transition: opacity 0.15s ease-out;
    }
    .ira-stop-button {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #1e1b4b;
      color: #f3e8ff;
      border: 1px solid #7c3aed;
      padding: 10px 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      border-radius: 9999px;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(147, 51, 234, 0.4);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .ira-stop-button:hover {
      background: #7c3aed;
      color: #ffffff;
      transform: translateX(-50%) translateY(-2px);
      box-shadow: 0 6px 24px rgba(147, 51, 234, 0.6);
    }
    .ira-stop-button:active {
      transform: translateX(-50%) translateY(0);
    }
  `;
  document.head?.appendChild(style);
}

export function showIndicator() {
  whenBodyReady(() => {
    // Ensure styles are injected
    injectOverlayStyles();

    try {
      if (!glowElement) {
        glowElement = document.createElement("div");
        glowElement.className = "ira-glow-border";
        document.body.appendChild(glowElement);
      } else {
        glowElement.style.opacity = "1";
      }
    } catch (e) {
      console.error("IRA: Failed to create glow indicator:", e);
    }

    try {
      if (!stopButtonElement) {
        stopButtonElement = document.createElement("button");
        stopButtonElement.className = "ira-stop-button";
        stopButtonElement.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block">
            <rect x="4" y="4" width="16" height="16" rx="2" />
          </svg>
          Stop IRA Agent
        `;
        stopButtonElement.addEventListener("click", () => {
          chrome.runtime.sendMessage({ type: "STOP_AGENT" }).catch(() => {});
          hideIndicator();
        });
        document.body.appendChild(stopButtonElement);
      } else {
        stopButtonElement.style.display = "flex";
        stopButtonElement.style.opacity = "1";
      }
    } catch (e) {
      console.error("IRA: Failed to create stop button:", e);
    }
  });
}

export function hideIndicator() {
  if (glowElement) {
    glowElement.style.opacity = "0";
  }
  if (stopButtonElement) {
    stopButtonElement.style.opacity = "0";
    setTimeout(() => {
      if (stopButtonElement && stopButtonElement.style.opacity === "0") {
        stopButtonElement.style.display = "none";
      }
    }, 150);
  }
}

// Auto-inject styles early, but only if body is available
if (window === window.top) {
  if (document.head) {
    injectOverlayStyles();
  } else {
    document.addEventListener("DOMContentLoaded", injectOverlayStyles, { once: true });
  }
}