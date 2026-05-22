# 🧠 IRA Research MCP — Master Build Plan
## *CLI Agent → MCP Server → Chrome Extension → Browser*

> [!IMPORTANT]
> **License: MIT ONLY** — All code in `ira-research/` is original, written from scratch under the MIT License. We study other projects for *ideas* only. No code is copied. No Apache-2.0, no GPL, no other licenses.

```
MIT License
Copyright (c) 2026 IRA Research
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software...(standard MIT text)
```

---

> [!IMPORTANT]
> **Goal**: Build `ira-research/` as a 3-layer autonomous system — a CLI Agent that thinks, an MCP Server that routes, and a Chrome Extension that acts. Each layer is independent and replaceable. The agent doesn't know about Chrome. Chrome doesn't know about the agent. The MCP is the only bridge.

---

## 📊 Forensic Analysis: What Each Project Gives Us

### 1. `chrome-devtools-mcp` — The Power Engine
**Stack**: TypeScript → Puppeteer/CDP → 40+ tools via `ToolDefinition` pattern  
**Strengths we steal:**
- `McpContext` class: full page lifecycle management, isolated browser contexts, emulation settings
- `McpPage`: per-page state (screenshot, accessibility tree, emulation, devtools)
- `PageCollector`: real-time console + network event streaming (not polling)
- `WaitForHelper`: smart `waitForEventsAfterAction` — waits for DOM settle, not just timeouts
- `ToolDefinition`: schema-validated tools with categories, annotations, `blockedByDialog` flag
- Performance: Lighthouse, CrUX field data, trace processing, memory heap snapshots
- Extension automation: `install_extension`, `trigger_extension_action`, `list_extensions`
- `TextSnapshot`: full accessibility tree with stable UIDs for element re-referencing

**Weakness**: Requires Puppeteer launch (no "attach to running Chrome" without extra flags). No multi-session sharing. No native messaging to extension.

---

### 2. `open-claude-in-chrome` — The Smart Bridge
**Stack**: Native Host (Node.js) + TCP Server + Chrome Extension (background.js via CDP)  
**Architecture genius we steal:**
- **Primary/Client mode**: first session owns TCP port 18765; subsequent sessions auto-join as clients — zero config multi-session sharing
- **Client classification**: 500ms window detects `client_hello` vs native host on same port
- **Request routing**: prefixed IDs (`c{clientId}_{reqId}`) for forwarding across sessions
- **Re-sent logic**: if native host drops and reconnects within 5s, pending requests are replayed
- **18 battle-tested tools**: `tabs_context_mcp`, `computer` (full mouse/kbd), `find`, `form_input`, `gif_creator`, `read_page` (accessibility tree with refs), `javascript_tool`, `read_console_messages`, `read_network_requests`, `shortcuts_execute`, `upload_image`, `update_plan`
- **Arg coercion middleware**: pre-validation normalizes `coordinate {x,y}` to `[x,y]`, string to number tabId, etc.

**Weakness**: Tools are JS (no TypeScript, no Zod schemas inline). Extension has no DevTools panel. No Puppeteer = no real `waitForNavigation`. No performance tools.

---

### 3. `claude code` — The Agent Brain
**What it teaches us:**
- Tool definitions with rich descriptions: Claude Code's system prompt + tool descriptions are the key to model performance. Tools need examples, context, critical warnings.
- Agent loop: tool_use → result → next_tool chain is the core — the MCP server is just the gateway
- Multi-model routing: supports Anthropic, Bedrock, Vertex, OpenRouter
- Compact summaries: the "compact" command that summarizes conversation to save context — critical for long browser sessions

---

### 4. `mcp` (simple MCP) — The Clean Baseline
**Stack**: TypeScript, simple `server.ts` + `tools/` + `resources/` pattern  
**What it gives**: Clean minimal structure for our TypeScript MCP server skeleton.

---

## Architecture: CLI Agent → MCP → Chrome

```
╔══════════════════════════════════════════════════════════════╗
║  LAYER 1 — CLI AGENT                                        ║
║  Claude Code / IRA CLI / Cursor / Any MCP-compatible AI     ║
║                                                              ║
║  - Reasons about tasks, plans, decides which tools to call  ║
║  - Speaks JSON-RPC over stdio (MCP protocol)                ║
║  - Has NO direct knowledge of Chrome or browser state       ║
╚══════════════════════╤═══════════════════════════════════════╝
                       │  stdio (JSON-RPC 2.0 / MCP)
                       │  Tool calls + Tool results
╔══════════════════════▼═══════════════════════════════════════╗
║  LAYER 2 — MCP SERVER  (mcp-server.ts)                      ║
║                                                              ║
║  - Primary mode: owns TCP port 18765                        ║
║  - Client mode: joins existing session (multi-agent share)  ║
║  - Validates tool args with Zod schemas                     ║
║  - Routes tool_request → native host → extension            ║
║  - Returns tool_response back to CLI agent                  ║
║                                                              ║
║  mcp-server.ts ←→ session-manager.ts ←→ tool-registry.ts   ║
╚══════════════════════╤═══════════════════════════════════════╝
                       │  TCP (port 18765)
                       │  { type: "tool_request", tool, args }
╔══════════════════════▼═══════════════════════════════════════╗
║  LAYER 2.5 — NATIVE HOST  (native-host.ts)                  ║
║                                                              ║
║  - Thin stdio ↔ TCP bridge (Node.js process)               ║
║  - Registered in Windows Registry as:                       ║
║    com.ira.research                                         ║
║  - Launched automatically by Chrome when extension loads    ║
║  - Ping/pong reconnect on drop                             ║
╚══════════════════════╤═══════════════════════════════════════╝
                       │  Native Messaging (chrome.runtime.connectNative)
                       │  JSON messages with 4-byte length prefix
╔══════════════════════▼═══════════════════════════════════════╗
║  LAYER 3 — CHROME EXTENSION  (background.ts service worker) ║
║                                                              ║
║  - Receives tool_request, dispatches to tool handler        ║
║  - CDPEngine: wraps chrome.debugger API                     ║
║  - TabManager: tracks tab groups, indicator states          ║
║  - Content scripts: accessibility tree, element refs        ║
║  - Offscreen doc: GIF export + MediaPipe face detection     ║
║  - Sends tool_response back up the chain                    ║
╚══════════════════════╤═══════════════════════════════════════╝
                       │  chrome.debugger (CDP)
                       │  Page.captureScreenshot, Input.dispatchMouseEvent
                       │  Runtime.evaluate, Network.enable, etc.
╔══════════════════════▼═══════════════════════════════════════╗
║  CHROME BROWSER                                             ║
║                                                              ║
║  - Real user Chrome (existing profile, cookies, sessions)   ║
║  - Tab Groups: Orange = normal, Yellow = MCP session        ║
║  - Side Panel: IRA chat UI                                  ║
║  - DevTools Panel: live tool stream + network monitor       ║
╚══════════════════════════════════════════════════════════════╝
```

### Multi-Session Sharing (Key Feature)
```
Claude Code Instance A ──┐
Claude Code Instance B ──┼──► MCP Server (PRIMARY, port 18765)
Cursor / Copilot     ──┘          │
IRA CLI              ──────► MCP Client (joins existing session)
                                  │
                         Native Host → Chrome Extension
                                  │
                            ONE Chrome Browser
                         (all agents share same tabs)
```

### Request/Response Cycle
```
Agent: { tool: "screenshot", args: { tabId: 123 } }
  ↓ stdio JSON-RPC
MCP Server: validate (Zod) → route → forward
  ↓ TCP
Native Host: buffer → forward
  ↓ Native Messaging
Extension: hide overlay → CDP captureScreenshot → restore overlay
  ↓ Native Messaging  
Native Host: forward response
  ↑ TCP
MCP Server: return tool result
  ↑ stdio JSON-RPC
Agent: sees screenshot image, decides next action
```

---

## Project Structure

```
ira-research/
├── extension/                      # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── background/
│   │   ├── index.ts                # Service worker entry
│   │   ├── native-messaging.ts     # Native host connection
│   │   ├── cdp-engine.ts           # CDP wrapper
│   │   ├── tab-manager.ts          # Tab group + MCP group logic
│   │   ├── tool-dispatcher.ts      # Route tool_request to handler
│   │   ├── tools/                  # All tool implementations
│   │   │   ├── navigation.ts       # navigate, tabs, history
│   │   │   ├── interaction.ts      # click, type, scroll, drag, hover
│   │   │   ├── inspection.ts       # screenshot, read_page, find
│   │   │   ├── console.ts          # console messages
│   │   │   ├── network.ts          # network requests, response bodies
│   │   │   ├── javascript.ts       # execute JS
│   │   │   ├── performance.ts      # LCP, CLS, FCP metrics
│   │   │   ├── storage.ts          # localStorage, cookies
│   │   │   ├── recording.ts        # GIF/video recording
│   │   │   ├── extensions.ts       # Install/manage extensions
│   │   │   └── workflow.ts         # Shortcuts, workflows
│   │   ├── collectors/
│   │   │   ├── console-collector.ts
│   │   │   ├── network-collector.ts
│   │   │   └── perf-collector.ts
│   │   └── state.ts
│   ├── content/
│   │   ├── index.ts
│   │   ├── accessibility.ts        # A11y tree builder
│   │   ├── element-finder.ts       # NL query to element refs
│   │   ├── ref-manager.ts          # Stable ref <-> DOM mapping
│   │   └── overlay.ts              # Visual feedback overlays
│   ├── devtools-panel/             # NEW: DevTools Panel
│   │   ├── panel.html
│   │   └── panel.ts
│   ├── sidepanel/
│   │   ├── sidepanel.html
│   │   └── sidepanel.ts
│   ├── options/
│   │   ├── options.html
│   │   └── options.ts
│   └── icons/
│
├── host/                           # Native Messaging Host
│   ├── native-host.ts              # stdio <-> TCP bridge
│   ├── com.ira.research.json       # Native host manifest
│   └── install.ps1                 # Windows installer
│
├── server/                         # MCP Server
│   ├── mcp-server.ts               # Primary/Client TCP mode
│   ├── session-manager.ts          # Multi-session routing
│   ├── tool-registry.ts            # All 60+ tool definitions (Zod)
│   ├── middleware/
│   │   ├── arg-coerce.ts           # Normalize args before dispatch
│   │   └── rate-limit.ts
│   └── transport/
│       ├── stdio.ts
│       └── tcp.ts
│
├── shared/                         # Shared types
│   ├── types.ts
│   ├── tools.ts                    # Tool name constants
│   └── protocol.ts                 # Wire protocol definitions
│
├── scripts/
│   ├── build.ts                    # esbuild bundles for all targets
│   └── install-windows.ps1
│
├── package.json
├── tsconfig.json
└── README.md
```

---

## Tool Catalog (60 Tools)

### Browser Navigation (8 tools)
| Tool | Source | Enhancement |
|------|--------|-------------|
| `tabs_list` | open-claude | Richer metadata: loading state |
| `tabs_create` | open-claude | With URL, isolated context support |
| `tabs_close` | chrome-devtools | With before-unload handling |
| `navigate` | both | + allowlist, initScript, waitFor condition |
| `navigate_back` | open-claude | Auto-screenshot on arrival |
| `navigate_forward` | open-claude | Auto-screenshot on arrival |
| `navigate_reload` | chrome-devtools | + ignoreCache flag |
| `switch_browser` | open-claude | Broadcast to all browser profiles |

### Interaction / Computer Use (12 tools)
| Tool | Source | Enhancement |
|------|--------|-------------|
| `click` | both | + ref support, retry on DOM mutation |
| `right_click` | open-claude | Context menu automation |
| `double_click` | open-claude | + smart wait after |
| `triple_click` | open-claude | select-all pattern |
| `type_text` | both | + clear before, human-speed option |
| `press_key` | both | Full key combo support |
| `scroll` | both | + scroll_to_element by ref |
| `drag` | chrome-devtools | Smooth step interpolation |
| `hover` | both | + tooltip capture |
| `select` | chrome-devtools | Dropdown/select element |
| `upload_file` | open-claude | + drag-drop + hidden input |
| `form_fill_smart` | NEW | AI fills entire form from description |

### Page Reading / Inspection (10 tools)
| Tool | Source | Enhancement |
|------|--------|-------------|
| `screenshot` | both | JPEG + region zoom + annotated |
| `screenshot_full` | NEW | Full page scroll-stitch screenshot |
| `read_page` | both | Accessibility tree, depth, filter |
| `find` | open-claude | NL query -> element refs, coordinates |
| `get_page_text` | open-claude | + article extraction |
| `get_page_html` | NEW | Cleaned HTML snapshot |
| `get_element_info` | NEW | Computed styles, bounding box, ARIA |
| `take_snapshot` | chrome-devtools | DOM snapshot for offline analysis |
| `highlight_element` | NEW | Visual overlay with label |
| `wait_for` | chrome-devtools | Wait for text, element, URL, idle |

### JavaScript / DevTools (8 tools)
| Tool | Source | Enhancement |
|------|--------|-------------|
| `eval_js` | both | + awaitPromise, sandbox option |
| `eval_js_file` | NEW | Execute a .js file in page context |
| `read_console` | both | Filter by level, pattern, domain |
| `clear_console` | NEW | Reset console log buffer |
| `set_breakpoint` | NEW | CDP Debugger.setBreakpoint |
| `pause_execution` | NEW | CDP Debugger.pause |
| `get_js_heap` | chrome-devtools | Memory snapshot + class breakdown |
| `inject_script` | NEW | Persistent page script injection |

### Network (7 tools)
| Tool | Source | Enhancement |
|------|--------|-------------|
| `read_network` | both | Filter by URL, type, status |
| `get_response_body` | chrome-devtools | Full response body via CDP |
| `intercept_request` | NEW | Modify/block requests via CDP |
| `mock_response` | NEW | Stub API response |
| `set_throttling` | chrome-devtools | Emulate slow networks |
| `export_har` | NEW | Export full HAR file |
| `list_websockets` | NEW | WS frame capture |

### Performance (6 tools)
| Tool | Source | Enhancement |
|------|--------|-------------|
| `measure_vitals` | NEW | LCP, CLS, FCP, TTFB via CDP |
| `start_trace` | chrome-devtools | Performance timeline recording |
| `stop_trace` | chrome-devtools | + AI-powered insight extraction |
| `lighthouse_audit` | chrome-devtools | Full Lighthouse run |
| `measure_fps` | NEW | FPS counter during interaction |
| `get_crux_data` | chrome-devtools | Real user field data |

### Storage / State (5 tools)
| Tool | Source | Enhancement |
|------|--------|-------------|
| `get_storage` | NEW | localStorage, sessionStorage, IndexedDB |
| `set_storage` | NEW | Modify storage values |
| `get_cookies` | NEW | All cookies for domain |
| `set_cookie` | NEW | Create/modify cookie |
| `clear_storage` | NEW | Selective or full cache clear |

### Extensions (4 tools)
| Tool | Source | Enhancement |
|------|--------|-------------|
| `list_extensions` | chrome-devtools | ID, version, enabled state |
| `install_extension` | chrome-devtools | From .crx or unpacked path |
| `toggle_extension` | NEW | Enable/disable without uninstall |
| `reload_extension` | chrome-devtools | Force service worker restart |

### Recording / Export (4 tools)
| Tool | Source | Enhancement |
|------|--------|-------------|
| `gif_start` | open-claude | + frame rate control |
| `gif_stop` | open-claude | + auto-annotate clicks |
| `gif_export` | open-claude | + download or drag-drop |
| `video_record` | NEW | WebM recording via `chrome.tabCapture` |

### Session / Meta (4 tools)
| Tool | Source | Enhancement |
|------|--------|-------------|
| `update_plan` | open-claude | Pre-approve domains + approach |
| `resize_window` | both | px dimensions |
| `emulate_device` | chrome-devtools | Mobile, tablet presets |
| `switch_browser` | open-claude | Multi-profile switching |

---

## 👻 Ghost Mouse — Human-Like Mouse Movement

> **Researched**: Anti-bot systems detect robotic straight-line mouse movements. Ghost Mouse uses **Bezier curves + Fitts's Law + stochastic jitter** to make every mouse movement indistinguishable from a human.

### How It Works
```
Start(x0,y0) --> [Bezier Curve with random control points] --> Target(x1,y1)
        |                                                            |
   Acceleration                                              Deceleration
   (Fitts Law)          + micro-jitter + overshoot           (Fitts Law)
                          + correction
```

### Implementation Plan (100% original MIT code)
```typescript
// extension/background/ghost-mouse.ts
export interface GhostMouseOptions {
  moveSpeed?: number;       // base speed multiplier (default: 1.0)
  overshootChance?: number; // probability of overshooting (default: 0.3)
  jitter?: number;          // max random offset px (default: 2)
  humanDelay?: boolean;     // add pre-click hesitation (default: true)
}

// Cubic Bezier path generator
function generateBezierPath(
  start: Point, end: Point, 
  numPoints: number = 50
): Point[] {
  // Random control points perpendicular to direct path
  const cp1 = randomControlPoint(start, end, 0.25);
  const cp2 = randomControlPoint(start, end, 0.75);
  return Array.from({ length: numPoints }, (_, i) => {
    const t = i / (numPoints - 1);
    return cubicBezier(start, cp1, cp2, end, t);
  });
}

// Apply Fitts's Law: speed varies with distance and target size
function fittsDelay(distance: number, targetSize: number): number {
  const a = 50, b = 150; // empirical constants
  return a + b * Math.log2(distance / targetSize + 1);
}

// Dispatch via CDP Input.dispatchMouseEvent with timing
async function ghostMove(tabId: number, from: Point, to: Point, opts: GhostMouseOptions) {
  const path = generateBezierPath(from, to);
  const totalTime = fittsDelay(distance(from, to), 20) * (opts.moveSpeed ?? 1);
  const stepDelay = totalTime / path.length;
  
  for (const point of path) {
    const jx = (Math.random() - 0.5) * (opts.jitter ?? 2);
    const jy = (Math.random() - 0.5) * (opts.jitter ?? 2);
    await cdp(tabId, 'Input.dispatchMouseEvent', {
      type: 'mouseMoved', x: point.x + jx, y: point.y + jy
    });
    await sleep(stepDelay * (0.8 + Math.random() * 0.4)); // randomize per-step
  }
  
  // Optional overshoot + correction
  if (Math.random() < (opts.overshootChance ?? 0.3)) {
    const overshoot = overshootPoint(to);
    await ghostMove(tabId, to, overshoot, { ...opts, overshootChance: 0 });
    await sleep(50 + Math.random() * 100);
    await ghostMove(tabId, overshoot, to, { ...opts, overshootChance: 0 });
  }
}
```

### New MCP Tools Added (Ghost Mouse)
| Tool | Description |
|------|-------------|
| `ghost_click` | Human-like Bezier curve mouse move then click |
| `ghost_move` | Move mouse along natural path without clicking |
| `ghost_drag` | Smooth curved drag from A to B |
| `set_mouse_personality` | Configure speed, jitter, overshoot per session |

### Anti-Detection Extras
- Random click offset within element bounding box (not always center)
- Pre-click hesitation: 80-200ms random pause before mousedown
- Post-click micro-movement: tiny jitter after release
- `navigator.webdriver` patch via `Runtime.evaluate` on attach

---

## 🎭 Test Face — Browser Face Detection Tool

> **Researched**: Using **MediaPipe Tasks Vision** (`@mediapipe/tasks-vision`) in an offscreen document to run real-time face detection from the browser tab's camera stream or a test video file.

### Architecture
```
MCP Tool: test_face_detect
         |
   background.ts (chrome.tabCapture or getUserMedia)
         |
   offscreen.html (MediaPipe inference — DOM access needed)
         |
   FaceDetector (@mediapipe/tasks-vision)
         |
   Result: { faces: [{boundingBox, landmarks, confidence}], frameTime }
```

### Implementation Plan (original MIT code)
```typescript
// extension/offscreen/face-detector.ts
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

let detector: FaceDetector | null = null;

async function initDetector() {
  const vision = await FilesetResolver.forVisionTasks(
    // Bundle WASM locally to avoid CSP issues
    chrome.runtime.getURL('wasm/vision_wasm_internal.js')
  );
  detector = await FaceDetector.createFromOptions(vision, {
    baseOptions: { modelAssetPath: chrome.runtime.getURL('models/blaze_face_short.tflite') },
    runningMode: 'IMAGE',
    minDetectionConfidence: 0.5,
  });
}

export async function detectFaces(imageData: ImageData): Promise<FaceResult[]> {
  if (!detector) await initDetector();
  const result = detector!.detect(imageData);
  return result.detections.map(d => ({
    boundingBox: d.boundingBox,
    landmarks: d.keypoints,
    confidence: d.categories[0]?.score ?? 0,
  }));
}
```

```typescript
// extension/background/tools/face.ts  
export async function testFaceDetect(args: FaceDetectArgs): Promise<ToolResult> {
  const { tabId, source, screenshotId, fakeVideoPath } = args;
  
  if (source === 'screenshot') {
    // Run detection on existing screenshot
    const base64 = screenshotStore.get(screenshotId);
    const result = await sendOffscreenMessage({ type: 'detectFaces', base64 });
    return formatFaceResult(result);
  }
  
  if (source === 'webcam') {
    // Capture single frame from tab camera via tabCapture
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    const frame = await captureFrame(streamId);
    return formatFaceResult(await sendOffscreenMessage({ type: 'detectFaces', frame }));
  }
  
  if (source === 'fake_video') {
    // Inject fake video stream using Chrome flags simulation
    await cdp(tabId, 'Runtime.evaluate', {
      expression: `navigator.__fakeVideoPath = '${fakeVideoPath}'`
    });
    // ... getUserMedia override injection
  }
}
```

### New MCP Tools Added (Test Face)
| Tool | Description |
|------|-------------|
| `face_detect` | Detect faces in current screenshot or live webcam frame |
| `face_detect_video` | Run face detection on injected fake video stream |
| `face_count` | Return count of faces detected on current page camera |
| `face_landmarks` | Get 6 keypoints per face (eyes, ears, nose, mouth) |
| `face_verify_ui` | Check if face detection UI elements appear (bounding box canvas) |

### Chrome Flags for Fake Webcam (Testing)
```json
// options.ts — expose these as MCP config
{
  "fakeMedia": {
    "useFakeDevice": true,     // --use-fake-device-for-media-stream
    "fakeVideoFile": "",       // --use-file-for-fake-video-capture=path.y4m  
    "autoGrantPermission": true // --use-fake-ui-for-media-stream
  }
}
```

### Files Added to Project Structure
```
extension/
├── background/tools/
│   ├── ghost-mouse.ts      # NEW: Bezier curve mouse engine
│   └── face.ts             # NEW: Face detection tool handler
├── offscreen/
│   ├── offscreen.html      # NEW: MediaPipe inference context
│   ├── face-detector.ts    # NEW: MediaPipe FaceDetector wrapper
│   └── stream-capture.ts   # NEW: tabCapture frame grabber
└── models/                 # NEW: Bundled WASM + TFLite models
    ├── blaze_face_short.tflite
    └── wasm/
        └── vision_wasm_internal.js
```

---

## Key Innovations vs Source Projects

### Innovation 1: Unified Architecture (No Compromise)
- **Primary/Client TCP mode**: multi-session sharing
- **Puppeteer-free**: works with any Chrome, no WebDriver detection
- **CDP via `chrome.debugger`**: full power inside extension

### Innovation 2: Ghost Mouse (UNIQUE — no other MCP has this)
- Bezier curve paths, Fitts's Law timing, overshoot correction
- All via `Input.dispatchMouseEvent` — no external library needed
- Configurable per-session personality

### Innovation 3: Test Face (UNIQUE — no other MCP has this)
- MediaPipe face detection inside Chrome extension offscreen document
- Works on screenshots, live webcam, and injected fake video
- Enables testing face-recognition web apps automatically

### Innovation 4: Smart Element Resolution Chain
```
NL Query -> ARIA search -> ref ID -> coordinate -> CDP NodeId
```

### Innovation 5: Real-Time Ring Buffer
- Console, network, perf events pushed (not polled)
- 2000 entries per tab, auto-reset on domain change

### Innovation 6: Per-Tab Task Queue
```typescript
class TabQueue {
  private queue: Promise<any> = Promise.resolve();
  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return (this.queue = this.queue.then(fn, fn));
  }
}
```

### Innovation 7: DevTools Panel
- Live tool call stream view, network waterfall, session replay

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] `ira-research/` folder init, `LICENSE` (MIT), package.json, tsconfig.json
- [ ] `shared/` types, protocol, tool constants
- [ ] `host/native-host.ts` — stdio <-> TCP bridge
- [ ] `extension/manifest.json` — all required permissions
- [ ] `extension/background/native-messaging.ts`, `cdp-engine.ts`, `tab-manager.ts`
- [ ] Basic tools: `tabs_list`, `tabs_create`, `navigate`, `screenshot`
- [ ] `server/mcp-server.ts` — Primary/Client TCP + 4 tools end-to-end

**Milestone**: Claude Code can open a tab and take a screenshot.

### Phase 2: Core Tools (Week 2)
- [ ] `extension/content/accessibility.ts`, `element-finder.ts`, `ref-manager.ts`
- [ ] All interaction tools: click, type, key, scroll, drag, hover, form_input
- [ ] Console + Network collectors with ring buffer
- [ ] `eval_js`, `read_console`, `read_network`, `find`, `read_page`, `wait_for`
- [ ] Arg coercion middleware

**Milestone**: Full browser automation + inspection working.

### Phase 3: Ghost Mouse + Test Face (Week 3) ← NEW
- [ ] `extension/background/ghost-mouse.ts` — Bezier + Fitts's Law engine
- [ ] Ghost Mouse tools: `ghost_click`, `ghost_move`, `ghost_drag`, `set_mouse_personality`
- [ ] `extension/offscreen/` — offscreen document for MediaPipe
- [ ] Bundle MediaPipe WASM + blaze_face_short.tflite locally
- [ ] Face tools: `face_detect`, `face_count`, `face_landmarks`, `face_verify_ui`
- [ ] Performance tools: `measure_vitals`, `start_trace`, `stop_trace`
- [ ] Storage tools: `get_storage`, `set_storage`, `get_cookies`, `set_cookie`
- [ ] Network intercept/mock, GIF/video recording

**Milestone**: Ghost Mouse + Face Detection + Power suite working.

### Phase 4: DevTools Panel + Polish (Week 4)
- [ ] `extension/devtools-panel/` — live tool call stream, network waterfall
- [ ] Options page (port, AI settings, mouse personality, face model config)
- [ ] Windows installer (`install.ps1`), side panel improvements
- [ ] Full README with MIT license badge

**Milestone**: Production-ready release.

---

## Critical Technical Decisions

| Decision | Rationale |
|----------|-----------|
| No Puppeteer | `chrome.debugger` is undetectable; works with user's existing Chrome profile and cookies |
| TypeScript throughout | Zod schemas → better LLM compliance; shared types between server + extension |
| Keep Primary/Client TCP | Multiple Claude Code sessions share one browser — open-claude's greatest innovation |
| esbuild for bundling | Fast; works for both extension (no ESM) and Node.js server |
| Content script for A11y tree | Runs in page context; faster than CDP `Accessibility.getFullAXTree` |

---

## Known Challenges & Mitigations

| Challenge | Mitigation |
|-----------|-----------|
| Service worker idle kill (30s) | Keep-alive alarm every 20s + state in `chrome.storage` |
| `chrome.debugger` yellow bar | Expected for dev tools; document it |
| Tab group APIs (Chrome 88+) | Fallback to plain tab Set if groups unavailable |
| CDP race on navigation | Listen to `Page.loadEventFired` via CDP |
| Content script injection timing | Retry with exponential backoff |
| Large screenshots | Adaptive JPEG quality (55% then 30% if >500KB) |
| Windows native host PATH | Wrapper `.bat` file that calls node explicitly |

---

## Getting Started Config (Post-Build)

```json
{
  "mcpServers": {
    "ira-browser": {
      "command": "node",
      "args": ["C:/Users/bidre/Downloads/work/AI AGENT/ira-research/host/native-host.js"],
      "env": { "IRA_PORT": "18765" }
    }
  }
}
```

---

## License

```
MIT License

Copyright (c) 2026 IRA Research

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

> [!CAUTION]
> This project is **100% original MIT code**. We study other projects for architecture ideas only. No source code from `chrome-devtools-mcp` (Apache-2.0) or `open-claude-in-chrome` (MIT by Anthropic) is copied — all implementations are written from scratch. The `ira-research/` package.json will list only MIT-compatible dependencies.
