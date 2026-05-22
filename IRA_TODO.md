# ✅ IRA Research MCP — TODO List
**Architecture: CLI Agent → MCP Server → Chrome Extension → Browser**
**License: MIT Only | All code original | Copyright 2026 IRA Research**

---

## Architecture Reminder

```
[CLI Agent]  →stdio→  [MCP Server]  →TCP→  [Native Host]  →NativeMsg→  [Chrome Extension]  →CDP→  [Chrome]
  Layer 1               Layer 2              Layer 2.5             Layer 3                         Browser
```

> Build order: **bottom-up** → Layer 3 first, then 2.5, then 2, then 1

---

## 📦 Phase 1 — Foundation (COMPLETED ✅)
*Milestone: CLI Agent can open a tab and take a screenshot end-to-end*

### Step 0 — Project Scaffold
- [x] Create `ira-research/` at `C:\Users\bidre\Downloads\work\AI AGENT\ira-research\`
- [x] `LICENSE` (MIT, Copyright 2026 IRA Research)
- [x] `package.json` — name: `ira-research-mcp`, version: `0.1.0`, license: `MIT`
- [x] `tsconfig.json` — target: ES2022, module: NodeNext, strict: true
- [x] `.gitignore` — node_modules, dist, *.js.map
- [x] `npm install` — deps: `@modelcontextprotocol/sdk`, `zod`, `typescript`, `esbuild`

### Step 1 — Shared Types (used by all layers)
- [x] `shared/types.ts` — `ToolRequest`, `ToolResponse`, `TabInfo`, `Point`, `Rect`, `FaceResult`
- [x] `shared/tools.ts` — All 60 tool name constants as `const enum ToolName`
- [x] `shared/protocol.ts` — Wire protocol: `ping`, `pong`, `client_hello`, `tool_request`, `tool_response`, `error`

---

### LAYER 3 — Chrome Extension (build first)

#### Manifest
- [x] `extension/manifest.json` — Manifest V3
- [x] Permissions: `debugger`, `tabs`, `tabGroups`, `activeTab`, `storage`, `alarms`
- [x] Permissions: `nativeMessaging`, `offscreen`, `sidePanel`, `scripting`, `management`
- [x] Optional permissions: `tabCapture`, `downloads`
- [x] Background: `"service_worker": "background/index.js"`
- [x] Content scripts, devtools page, side panel, options page declared

#### Background Core (Service Worker)
- [x] `extension/background/index.ts` — Entry point: register all listeners, keepalive alarm every 20s
- [x] `extension/background/state.ts` — `globalThis.__ira*` maps (survive SW restarts): tabs, sessions, screenshots
- [x] `extension/background/cdp-engine.ts` — `chrome.debugger` wrapper class
  - [x] `attachDebugger(tabId)` — attach + enable Page, Runtime, Network, Input domains
  - [x] `detachDebugger(tabId)` — detach + cleanup
  - [x] `sendCommand(tabId, method, params)` — auto-reattach on "debugger is not attached"
  - [x] `sendCommand` timeout (race against configurable ms)
  - [x] `screenshot(tabId)` — hide overlay → get viewport → resize → CDP captureScreenshot → restore
  - [x] `click(tabId, x, y, button, count)` — mouseMoved → mousePressed → mouseReleased
  - [x] `type(tabId, text)` — char-by-char `Input.insertText` + key events
  - [x] `scroll(tabId, x, y, dx, dy)` — CDP mouseWheel with content-script fallback
  - [x] Global CDP event listener on `globalThis` for console + network + beforeunload events
- [x] `extension/background/tab-manager.ts` — Tab group tracking
  - [x] `createGroup(mainTabId)` — Orange Chrome tab group titled "IRA"
  - [x] `addTabToGroup(mainTabId, tabId)` — secondary tabs
  - [x] `findGroupByTab(tabId)` — which group?
  - [x] `getMcpGroup()` — Yellow group titled "IRA (MCP)"
  - [x] `hideIndicatorForToolUse(tabId)` → send `HIDE_FOR_TOOL_USE` to content script
  - [x] `restoreIndicatorAfterToolUse(tabId)` → send `SHOW_AFTER_TOOL_USE`
  - [x] `TabQueue` class — serial promise chain per tab (prevents race conditions)
- [x] `extension/background/native-messaging.ts` — Connection to native host
  - [x] `connectToHost()` — `chrome.runtime.connectNative("com.ira.research")`
  - [x] Ping/pong probe on connect: `{type:"ping"}` → expect `{type:"pong"}`
  - [x] Auto-reconnect on port disconnect
  - [x] Route incoming `tool_request` → `tool-dispatcher.ts`
  - [x] Send `tool_response` back to native host
- [x] `extension/background/tool-dispatcher.ts` — Route `tool_request.tool` → handler function

#### First 4 Tools
- [x] `extension/background/tools/navigation.ts` — `tabs_list`, `tabs_create`, `navigate`
  - [x] `navigate`: `chrome.tabs.update({url})` + wait for `Page.loadEventFired` via CDP
- [x] `extension/background/tools/inspection.ts` — `screenshot` (JPEG, adaptive quality, 1568 token budget)

#### Content Script (basic)
- [x] `extension/content/index.ts` — Message listener: `HIDE_FOR_TOOL_USE`, `SHOW_AFTER_TOOL_USE`
- [x] `extension/content/overlay.ts` — Glow border animation (IRA purple `rgba(147, 51, 234, 0.5)`)
- [x] "Stop IRA" button (slide-up, bottom-center) → sends `{type:"STOP_AGENT"}` to background

#### Offscreen Document (keepalive)
- [x] `extension/offscreen/offscreen.html` — Minimal HTML
- [x] `extension/offscreen/keepalive.ts` — Ping SW every 20s: `chrome.runtime.sendMessage({type:"SW_KEEPALIVE"})`

---

### LAYER 2.5 — Native Host (stdio ↔ TCP bridge)
- [x] `host/native-host.ts`
  - [x] Read stdin: 4-byte little-endian length prefix + JSON message body
  - [x] Write stdout: 4-byte length prefix + JSON response
  - [x] Connect to TCP port 18765 (MCP server)
  - [x] **Primary mode**: if port free → own it, accept extension connections
  - [x] **Client mode**: if port taken → join existing session (500ms `client_hello` window)
  - [x] Request ID prefixing: `c{clientId}_{reqId}` for multi-session routing
  - [x] Replay pending requests if MCP server reconnects within 5s
- [x] `host/com.ira.research.json` — Native messaging host manifest
- [x] `host/ira-research.bat` — Windows wrapper: `@node "%~dp0native-host.js" %*`
- [x] `host/install.ps1` — Register `com.ira.research` in Windows registry + compile TS

---

### LAYER 2 — MCP Server
- [x] `server/mcp-server.ts`
  - [x] `@modelcontextprotocol/sdk` stdio transport
  - [x] Primary/Client TCP mode on port 18765
  - [x] On tool call: validate with Zod → forward to native host → return response
- [x] `server/session-manager.ts` — Track sessions, route `tool_response` by prefixed ID
- [x] `server/tool-registry.ts` — Register 4 Phase 1 tools with Zod schemas + rich descriptions
- [x] `server/transport/stdio.ts` — Stdio MCP transport wrapper
- [x] `server/transport/tcp.ts` — TCP server/client connection manager

---

### Build System
- [x] `scripts/build.ts` — esbuild bundles:
  - [x] `server/` → `dist/server.js` (Node.js CJS)
  - [x] `host/` → `dist/host/native-host.js` (Node.js CJS)
  - [x] `extension/background/` → `dist/extension/background.js`
  - [x] `extension/content/` → `dist/extension/content.js`
  - [x] `extension/offscreen/` → `dist/extension/offscreen.js`
- [x] `package.json` scripts: `build`, `dev` (watch), `install-host`

**✅ Phase 1 Done When:** Claude Code MCP config → `node dist/host/native-host.js` → Chrome opens tab → screenshot returned to Claude (COMPLETED 🎯)

---

## 🛠️ Phase 2 — Core Tools (All Layers) (COMPLETED ✅)
*Milestone: Full browser automation + inspection working*

### LAYER 3 — Content Script (full)
- [x] `extension/content/ref-manager.ts`
  - [x] `window.__iraElementMap` WeakRef store
  - [x] `assignRef(el)` → `"ref_N"` stable ID
  - [x] `resolveRef(refId)` → element or null (with GC cleanup)
  - [x] Error: `"Element ref_N not found. Use read_page to get current refs."`
- [x] `extension/content/accessibility.ts`
  - [x] `window.__generateIraAccessibilityTree(filter, depth, maxChars, refId)`
  - [x] Role detection: ARIA role > tag-to-role map (button, link, textbox, combobox, etc.)
  - [x] Accessible name: aria-label > placeholder > title > alt > label[for] > text content
  - [x] Viewport filter (skip off-screen unless filter="all")
  - [x] Output format: `role "name" [ref_N] href="..." type="..." placeholder="..."`
  - [x] `<select>` children inline as `option "label" (selected) value="x"`
- [x] `extension/content/element-finder.ts`
  - [x] ARIA + text match for NL queries
  - [x] Return up to 20 refs ordered by relevance

### LAYER 3 — Remaining Tools

#### Interaction (12 tools)
- [x] `click` — coordinate or ref, button type, click count
- [x] `right_click` — context menu automation
- [x] `double_click` — with post-action DOM settle wait
- [x] `triple_click` — select-all pattern
- [x] `type_text` — char-by-char with random 30-80ms delays
- [x] `press_key` — full combo: `Ctrl+A`, `Enter`, `Escape`, `F5`, numpad
- [x] `scroll` — CDP mouseWheel with JS content-script fallback for background tabs
- [x] `drag` — mousedown hold → step interpolation → mouseup
- [x] `hover` — mouseMoved only, optional tooltip capture after 500ms
- [x] `select` — set `<select>` value by label or value string
- [x] `upload_file` — CDP `DOM.setFileInputFiles` via ref
- [x] `form_fill_smart` — fill multiple fields from `{ fieldName: value }` object

#### Inspection (9 tools)
- [x] `read_page` — full a11y tree, configurable depth/filter/refId, 50KB limit
- [x] `find` — NL query → refs (calls `__generateIraAccessibilityTree` then match)
- [x] `get_page_text` — article/main extraction, 50KB limit
- [x] `get_page_html` — cleaned HTML snapshot (strip scripts/styles)
- [x] `get_element_info` — computed styles, bounding box, ARIA for a ref
- [x] `take_snapshot` — CDP `DOM.getDocument` full snapshot
- [x] `highlight_element` — draw labelled overlay box on ref'd element
- [x] `screenshot_full` — scroll-stitch full-page screenshot
- [x] `wait_for` — wait for: text appears, ref visible, URL match, network idle, JS truthy

#### JS / Console / Network (7 tools)
- [x] `eval_js` — `Runtime.evaluate` with awaitPromise, sanitize output (block JWT/cookies)
- [x] `eval_js_file` — load .js file, execute in page context
- [x] `read_console` — ring buffer, filter by level/pattern/domain
- [x] `clear_console` — reset ring buffer for tab
- [x] `inject_script` — `Page.addScriptToEvaluateOnNewDocument` (persists across navigations)
- [x] `read_network` — ring buffer, filter by URL/type/status
- [x] `get_response_body` — `Network.getResponseBody` by requestId

### LAYER 3 — Collectors
- [x] `extension/background/collectors/console-collector.ts`
  - [x] Subscribe to `Runtime.consoleAPICalled` + `Runtime.exceptionThrown`
  - [x] Ring buffer: 10,000 entries per tab
  - [x] Auto-reset on `Page.frameNavigated` to different domain
- [x] `extension/background/collectors/network-collector.ts`
  - [x] Subscribe to `Network.requestWillBeSent` + `Network.responseReceived` + `Network.loadingFailed`
  - [x] Ring buffer: 1,000 entries per tab
  - [x] Auto-reset on domain change

### LAYER 2 — MCP Server additions
- [x] `server/tool-registry.ts` — Register all Phase 2 tools (Zod schemas + descriptions)
- [x] `server/middleware/arg-coerce.ts` — Normalize: `{x,y}` → `[x,y]`, `"3"` → `3` tabId, etc.
- [x] `server/middleware/rate-limit.ts` — Per-tool rate limiting (configurable per tool)

**✅ Phase 2 Done When:** Full automation cycle working: navigate → read_page → click ref → type → screenshot → eval_js (COMPLETED 🎯)

---

## 👻🎭 Phase 3 — Ghost Mouse + Test Face + Power Tools (COMPLETED ✅)
*Milestone: Human-like mouse, face detection, network power, storage tools*

### Ghost Mouse (LAYER 3)
- [x] `extension/background/ghost-mouse.ts`
  - [x] `generateBezierPath(start, end, numPoints=50)` — cubic Bezier with random control points
  - [x] `fittsDelay(distance, targetSize)` → ms — `a + b * log2(D/W + 1)`
  - [x] `ghostMove(tabId, from, to, opts)` — dispatch ~20 `mouseMoved` CDP events along curve
  - [x] Per-step random delay: `stepDelay * (0.8 + rand * 0.4)`
  - [x] Per-step jitter: `±opts.jitter` px on x,y (default 2px)
  - [x] Overshoot + correction (configurable probability, default 30%)
  - [x] Pre-click hesitation: 80–200ms random pause before mousedown
  - [x] Post-click micro-movement: tiny jitter after release
  - [x] Patch `navigator.webdriver = false` via `Runtime.evaluate` on CDP attach
- [x] `ghost_click` tool — Bezier move → click (replaces basic `click` for stealth mode)
- [x] `ghost_move` tool — Move without clicking
- [x] `ghost_drag` tool — Bezier move with mousedown held → mouseup at destination
- [x] `set_mouse_personality` tool — `{ moveSpeed, jitter, overshootChance }` per session

### Test Face — MediaPipe (LAYER 3 + Offscreen)
- [x] Add `@mediapipe/tasks-vision` to package.json
- [x] Bundle locally: `blaze_face_short.tflite` (models dir)
- [x] Bundle locally: MediaPipe WASM (`vision_wasm_internal.js` + `.wasm`)
- [x] `extension/manifest.json` — Add offscreen permission + declare offscreen document
- [x] `extension/offscreen/offscreen.html` — expand with MediaPipe script
- [x] `extension/offscreen/face-detector.ts`
  - [x] `initDetector()` — `FaceDetector.createFromOptions` with local WASM + model paths
  - [x] `detectFaces(imageData)` → `FaceResult[]`
- [x] `extension/offscreen/stream-capture.ts` — `captureFrame(streamId)` via getUserMedia
- [x] `extension/background/tools/face.ts`
  - [x] `face_detect` tool — source: screenshot (from screenshotStore)
  - [x] `face_detect` tool — source: webcam (via `chrome.tabCapture`)
  - [x] `face_detect_video` tool — fake video injection via Chrome flags
  - [x] `face_count` tool — integer count of detected faces
  - [x] `face_landmarks` tool — 6 keypoints per face
  - [x] `face_verify_ui` tool — check page for face detection canvas/UI elements
- [x] `extension/options/options.ts` — `fakeMedia` config: useFakeDevice, fakeVideoFile

### Performance Tools (LAYER 3)
- [x] `extension/background/collectors/perf-collector.ts` — Web Vitals via injected PerformanceObserver
- [x] `measure_vitals` tool — LCP, CLS, FCP, TTFB
- [x] `start_trace` tool — `Tracing.start` via CDP
- [x] `stop_trace` tool — `Tracing.end` + collect + summarize top slow functions
- [x] `measure_fps` tool — FPS counter injection during interaction sequence
- [x] `lighthouse_audit` tool — Run Lighthouse, return score + opportunities
- [x] `get_crux_data` tool — Chrome UX Report API → real-user field data

### Storage Tools (LAYER 3)
- [x] `get_storage` tool — localStorage, sessionStorage, IndexedDB via `Runtime.evaluate`
- [x] `set_storage` tool — Modify storage values
- [x] `get_cookies` tool — `Network.getCookies` for current domain
- [x] `set_cookie` tool — `Network.setCookie`
- [x] `clear_storage` tool — `Storage.clearDataForOrigin` (selective or full)

### Network Power Tools (LAYER 3)
- [x] `intercept_request` tool — `Fetch.enable` + fulfill/continue/fail patterns
- [x] `mock_response` tool — stub any API response for testing
- [x] `set_throttling` tool — `Network.emulateNetworkConditions` (slow-3G, offline, etc.)
- [x] `export_har` tool — build HAR 1.2 file from network collector buffer
- [x] `list_websockets` tool — track WS frames via `Network.webSocketFrameReceived`

### Extension Management Tools (LAYER 3)
- [x] `list_extensions` tool — `chrome.management.getAll()`
- [x] `install_extension` tool — load unpacked from path
- [x] `toggle_extension` tool — `chrome.management.setEnabled(id, enabled)`
- [x] `reload_extension` tool — `chrome.runtime.reload()` for target extension

### Recording Tools (LAYER 3 + Offscreen)
- [x] GIF: add `gifenc` to package.json
- [x] `extension/offscreen/gif-generator.ts` — frame capture + gifenc encode + action overlays
- [x] `gif_start` tool — start frame capture at configurable rate
- [x] `gif_stop` tool — stop + return frame count
- [x] `gif_export` tool — encode GIF, return base64 or download
- [x] `video_record` tool — WebM recording via `chrome.tabCapture`

### Session / Meta Tools (LAYER 2 + 3)
- [x] `update_plan` tool — store approved domains in `chrome.storage`
- [x] `resize_window` tool — `chrome.windows.update({width, height})`
- [x] `emulate_device` tool — CDP `Emulation.setDeviceMetricsOverride` (mobile/tablet presets)
- [x] `navigate_back` / `navigate_forward` / `navigate_reload` tools
- [x] `tabs_close` tool — with before-unload `Page.handleJavaScriptDialog` handling
- [x] `switch_browser` tool — broadcast to all connected browser profiles

### LAYER 2 — MCP Server additions
- [x] `server/tool-registry.ts` — Register all Phase 3 tools with Zod schemas

**✅ Phase 3 Done When:** `ghost_click` undetected on anti-bot sites + `face_detect` returning bounding boxes from screenshots (COMPLETED 🎯)

---

## ✨ Phase 4 — Sidepanel Console, Options & Polish (COMPLETED ✅)
*Milestone: Production-ready release*

### Sleek Options Configuration Console (LAYER 3)
- [x] `extension/options/options.html` + `options.ts` — Outfit font, HSL-tailored dark purple/cyan gradients, glassmorphism dashboard (Completed 🎯)
- [x] Dynamic slider text outputs, local storage state saving/loading, and defaults reset system (Completed 🎯)
- [x] Direct TCP Bridge connection testing button that queries active service worker native ports (Completed 🎯)

### Sidepanel Telemetry HUD Controller (LAYER 3)
- [x] `extension/sidepanel/sidepanel.html` + `sidepanel.ts` — Pulsing connection status badges, active tab metrics counters, stats loops (Completed 🎯)
- [x] Scrolling live log terminal — real-time logging of tool requests, parameters, durations, and successes with custom color-coded styles (Completed 🎯)
- [x] Interactive mouse profile toggles (Stealth vs. Standard vs. Precise), quick viewport snapshots, full accessibility tree traversals (Completed 🎯)
- [x] Global emergency agent stop-button with debugger detach handling (Completed 🎯)

### Windows Setup & Installer (LAYER 2.5)
- [x] `host/install.ps1` — full automated setup: (Completed 🎯)
  - [x] Build output directory creations and native BAT copying (Completed 🎯)
  - [x] Allowed Chrome Extension ID dynamic patching and allowed_origins JSON generation (Completed 🎯)
  - [x] Unnamed Default registry key assignment via high-reliability PowerShell `Set-Item` commands (Completed 🎯)
- [x] Project `LICENSE` and decoupled multi-layer design diagrams (Completed 🎯)

### Final Checks
- [x] All `package.json` deps are MIT-compatible (verify each) (Completed 🎯)
- [x] Zero lines copied from `chrome-devtools-mcp` (Apache-2.0) (Completed 🎯)
- [x] Zero lines copied from Anthropic's extension source (Completed 🎯)
- [x] MIT license header on every `.ts` source file (Completed 🎯)
- [x] Test Phase 1: screenshot working via MCP connection (Completed 🎯)
- [x] Test Phase 2: click + type + read_page full cycle (Completed 🎯)
- [x] Test Phase 3: ghost_click passes anti-bot challenges / face_detect returns results (Completed 🎯)
- [x] Test Phase 4: Side Panel console shows live tool call stream (Completed 🎯)
- [x] End-to-end test: Client Agent → `screenshot` → `read_page` → `ghost_click` → `screenshot` (Completed 🎯)

---

## 📊 Progress Tracker

| Phase | Layer Focus | Status | Tools | Files |
|-------|-------------|--------|-------|-------|
| Phase 1 — Foundation | Layer 3 core + 2.5 + 2 skeleton | 🟢 Done | 4/4 | 28/28 |
| Phase 2 — Core Tools | All layers, 28 tools | 🟢 Done | 28/28 | 18/18 |
| Phase 3 — Ghost + Face + Power | Layer 3 advanced | 🟢 Done | 12/12 | 6/6 |
| Phase 4 — Polish | All layers | 🟢 Done | 0/0 | 4/4 |
| **TOTAL** | | 🟢 **Complete** | **44/44** | **56/56** |

---

## 🔑 Key Build Rule

> Always build **bottom-up**: Chrome Extension (Layer 3) → Native Host (Layer 2.5) → MCP Server (Layer 2) → Test with CLI Agent (Layer 1)
>
> Never build the MCP Server first — it has nothing to talk to until the Extension + Native Host exist.

---

> Update status: 🔴 Not Started → 🟡 In Progress → 🟢 Done
