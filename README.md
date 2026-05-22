<div align="center">
  <h1>IRA Research MCP</h1>
  <p><strong>Next-Gen 3-Layer Browser Automation Agent</strong></p>
  <p>
    <a href="https://www.npmjs.com/package/ira-research-mcp"><img src="https://img.shields.io/npm/v/ira-research-mcp" alt="npm version"></a>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue" alt="License: MIT"></a>
    <a href="https://www.npmjs.com/package/ira-research-mcp"><img src="https://img.shields.io/npm/dm/ira-research-mcp" alt="npm downloads"></a>
  </p>
</div>

**IRA Research** is a powerful [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that gives AI agents full browser control — navigation, interaction, inspection, JavaScript execution, network manipulation, and even face detection — all through a Chrome extension bridge.

```
Agent (Claude, Cursor, etc.)  →  MCP Server  →  Chrome Extension  →  Browser
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      AI Agent (MCP Client)                       │
│           Claude Desktop / Cursor / Windsurf / Custom            │
└──────────────────────────┬──────────────────────────────────────┘
                           │ MCP Protocol (stdio)
┌──────────────────────────▼──────────────────────────────────────┐
│                    IRA MCP TCP Server (port 18765)                │
│              - Tool routing & schema validation                   │
│              - Session management                                 │
│              - Client/agent multiplexing                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ TCP
┌──────────────────────────▼──────────────────────────────────────┐
│                   Native Messaging Host                           │
│              - Bridges MCP TCP ↔ Chrome extension                 │
│              - Handles Chrome native messaging protocol           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ stdin/stdout (Native Messaging)
┌──────────────────────────▼──────────────────────────────────────┐
│                    Chrome Extension (Service Worker)               │
│              - chrome.debugger API for CDP commands              │
│              - chrome.scripting for DOM access                   │
│              - chrome.tabs for navigation & management           │
│              - Content scripts for accessibility tree, elements  │
│              - Ghost mouse / stealth automation                  │
│              - Face detection (tensorflow.js / mediapipe)        │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Chrome DevTools Protocol (CDP)
┌──────────────────────────▼──────────────────────────────────────┐
│                       Browser Tab (Target)                        │
│              Receives clicks, scrolls, JS injection, etc.        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Features

### Navigation (4 tools)
Open, close, list, and navigate browser tabs with full URL control.

### Interaction (11 tools)
Click, right-click, double-click, triple-click, hover, type text, press keys, scroll, drag-and-drop, select dropdowns, upload files, and smart form filling.

### Stealth / Anti-Detection (3 tools)
Ghost click, ghost move, and ghost drag with human-like mouse movement patterns to evade bot detection and CAPTCHA triggers.

### Page Inspection (10 tools)
Viewport screenshots, full-page screenshots, accessibility tree extraction, element finder, page text/HTML extraction, element info inspection, visual highlight, combined snapshot (tree + screenshot), and customizable wait conditions.

### JavaScript & Console (7 tools)
Evaluate arbitrary JS, inject JS files, read console logs, clear console buffer, read network request logs, and inspect API response bodies.

### Storage & Cookies (5 tools)
Read/write localStorage and sessionStorage, clear storage, get/set cookies with full control over domain, path, secure, httpOnly, sameSite, and expiry.

### Network Power Tools (3 tools)
Intercept and mock/abort outbound requests, simulate network throttling/latency/offline, and export full HAR 1.2 archives.

### Face Detection (4 tools)
Detect faces with bounding boxes, count visible faces, extract facial landmarks (eyes, nose, mouth), and verify alignment with UI targeting regions.

---

## 47 Tools Overview

### High-Level Macros
| Tool | Description |
|------|-------------|
| `research_topic` | Search the web and return extracted page text in one call |

### Navigation
| Tool | Description |
|------|-------------|
| `tabs_list` | List all open browser tabs with IDs, titles, URLs, and states |
| `tabs_create` | Open a new tab, optionally with a URL and group assignment |
| `navigate` | Load a URL in a specified tab and wait for completion |

### Mouse Interaction
| Tool | Description |
|------|-------------|
| `click` | Click at coordinates or on a referenced DOM element |
| `right_click` | Right-click to open context menus |
| `double_click` | Double-click for UI that requires it (e.g., editing cells) |
| `triple_click` | Triple-click to select all text in a field |
| `hover` | Hover over coordinates or an element to reveal tooltips/menus |
| `ghost_click` | Click with human-like stealth movement (evades bot detection) |
| `ghost_move` | Move mouse to coordinates with human-like trajectory |
| `ghost_drag` | Drag-and-drop with stealth movement patterns |

### Keyboard & Forms
| Tool | Description |
|------|-------------|
| `type_text` | Type text into the focused element or a referenced input |
| `press_key` | Dispatch keyboard events (Enter, Tab, Escape, arrows, etc.) |
| `scroll` | Scroll viewport or element by delta or to a reference |
| `drag` | Drag-and-drop between coordinates or element references |
| `select` | Choose an option in a `<select>` dropdown element |
| `upload_file` | Upload local files to a file input element |
| `form_fill_smart` | Batch-fill multiple form fields at once |

### Page Inspection
| Tool | Description |
|------|-------------|
| `screenshot` | Capture viewport screenshot as JPEG base64 |
| `screenshot_full` | Capture full-page scrollable screenshot |
| `read_page` | Extract accessibility tree JSON with element references |
| `find` | Search for interactive elements by natural language query |
| `get_page_text` | Return all visible `innerText` of the page |
| `get_page_html` | Return raw `outerHTML` of the document |
| `get_element_info` | Get detailed metadata for a referenced element |
| `highlight_element` | Draw a temporary visual border around an element |
| `take_snapshot` | Combined accessibility tree + screenshot in one call |
| `wait_for` | Wait for duration, CSS selector, or element reference |

### JavaScript & DevTools
| Tool | Description |
|------|-------------|
| `eval_js` | Execute JavaScript in page context and return the result |
| `eval_js_file` | Inject and run a local JS file in the page |
| `read_console` | Fetch captured console.log/warn/error entries |
| `clear_console` | Clear the console log buffer |
| `read_network` | Read outbound HTTP request logs |
| `get_response_body` | Get the raw body of a specific network request |

### Storage & Cookies
| Tool | Description |
|------|-------------|
| `get_storage` | Read localStorage or sessionStorage (all items or by key) |
| `set_storage` | Write a key-value string to localStorage or sessionStorage |
| `clear_storage` | Clear localStorage, sessionStorage, or both |
| `get_cookies` | Get cookies for the current tab domain or a specific URL |
| `set_cookie` | Set a cookie with full control (domain, path, secure, sameSite, expiry) |

### Network Power
| Tool | Description |
|------|-------------|
| `intercept_request` | Intercept, abort, or mock responses for matching URLs |
| `set_throttling` | Simulate network conditions (offline, latency, bandwidth limits) |
| `export_har` | Export all network traffic as a HAR 1.2 archive |

### Face Detection
| Tool | Description |
|------|-------------|
| `face_detect` | Detect faces and return bounding boxes |
| `face_count` | Count visible faces in the viewport |
| `face_landmarks` | Extract facial landmark coordinates |
| `face_verify_ui` | Verify face alignment with on-screen targeting UI |

---

## Installation

### 1. Install via npm

```bash
npm install -g ira-research-mcp
```

Or run directly with `npx` (no install needed):

```bash
npx ira-research-mcp
```

### 2. Install the Chrome Extension

1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle top-right)
3. Click **Load unpacked**
4. Select the `dist/extension/` folder from the npm package

   > **Installation location:**
   > - Global install: `$(npm root -g)/ira-research-mcp/dist/extension/`
   > - npx cache: `%LOCALAPPDATA%\npm-cache\_npx\*\node_modules\ira-research-mcp\dist\extension\`

5. Note the extension ID from the extension card (e.g., `abcdefghijklmnopqrstuvwxyzabcdef`)

### 3. Install the Native Messaging Host (Windows)

```powershell
npx ira-research-mcp install-host
```

This registers the native messaging host manifest with Chrome, enabling the bridge between the MCP server and the extension.

---

## MCP Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ira-research": {
      "command": "npx",
      "args": ["ira-research-mcp"],
      "env": {
        "IRA_EXTENSION_ID": "your-extension-id-here"
      }
    }
  }
}
```

### Cursor

Add in Cursor Settings → MCP Servers:

```json
{
  "mcpServers": {
    "ira-research": {
      "command": "npx",
      "args": ["ira-research-mcp"],
      "env": {
        "IRA_EXTENSION_ID": "your-extension-id-here"
      }
    }
  }
}
```

### Windsurf

Add in Windsurf MCP configuration:

```json
{
  "mcpServers": {
    "ira-research": {
      "command": "npx",
      "args": ["ira-research-mcp"],
      "env": {
        "IRA_EXTENSION_ID": "your-extension-id-here"
      }
    }
  }
}
```

---

## Quick Start

```bash
# Start the MCP server
npx ira-research-mcp

# In another terminal, send a tool request
# The MCP server listens on TCP port 18765
```

### Verify Everything Works

```bash
# Check that the Chrome extension is connected
# Open Chrome and ensure:
# 1. The IRA Research extension has a green indicator
# 2. The extension's service worker is active

# Use with Claude Desktop or any MCP client:
# Start with take_snapshot to see the current page
```

---

## Permissions

The Chrome extension requires these permissions:

| Permission | Purpose |
|------------|---------|
| `debugger` | Chrome DevTools Protocol for CDP commands (screenshot, click, network, etc.) |
| `tabs` | List, create, navigate, and manage browser tabs |
| `tabGroups` | Organize tabs into IRA-labeled groups |
| `scripting` | Inject scripts and extract page content (accessibility tree, text, HTML) |
| `nativeMessaging` | Communicate with the MCP server via native host bridge |
| `storage` | Persist extension settings and state |
| `offscreen` | Keepalive mechanism for service worker |
| `sidePanel` | Built-in debug console side panel |
| `alarms` | Service worker keepalive and maintenance tasks |
| `<all_urls>` | Host permissions for content scripts on all pages |

---

## Development

```bash
# Clone and build
git clone https://github.com/neuralnexustech/ira-research.git
cd ira-research
npm install
npm run build

# Watch mode for development
npm run dev
```

### Project Structure

```
ira-research/
├── server/                      # MCP Server
│   ├── mcp-server.ts            # Stdio MCP server entry
│   ├── tool-registry.ts         # 47 tool definitions with Zod schemas
│   ├── session-manager.ts       # Request/response tracking
│   ├── transport/
│   │   ├── tcp.ts               # TCP transport for agent multiplexing
│   │   └── stdio.ts             # Stdio transport for MCP protocol
├── host/                        # Native Messaging Host
│   ├── native-host.ts           # Chrome native messaging bridge
│   └── install.ps1              # Windows native host registration
├── extension/                    # Chrome Extension
│   ├── manifest.json
│   ├── background/
│   │   ├── index.ts             # Service worker entry
│   │   ├── cdp-engine.ts        # CDP communication layer
│   │   ├── tool-dispatcher.ts   # Tool routing & queue
│   │   ├── tab-manager.ts       # Tab queue & group management
│   │   ├── native-messaging.ts  # Extension-side bridge
│   │   ├── ghost-mouse.ts       # Stealth mouse automation
│   │   └── tools/               # Tool implementations
│   │       ├── navigation.ts
│   │       ├── inspection.ts
│   │       ├── interaction.ts
│   │       ├── console-network.ts
│   │       ├── storage.ts
│   │       ├── network.ts
│   │       └── face.ts
│   ├── content/                 # Content scripts
│   │   ├── accessibility.ts     # Accessibility tree generator
│   │   ├── element-finder.ts    # Element search engine
│   │   ├── overlay.ts           # Visual highlight overlays
│   │   └── ref-manager.ts       # DOM reference manager
│   └── shared/                  # Shared types & protocols
├── shared/
│   ├── types.ts                 # Core TypeScript interfaces
│   ├── tools.ts                 # Tool name enum
│   └── protocol.ts              # Protocol message types
└── package.json
```

---

## Troubleshooting

### Extension not connecting
- Verify the extension is loaded at `chrome://extensions/`
- Check that `IRA_EXTENSION_ID` environment variable matches the extension ID
- Reload the extension after code updates

### Debugger tools timeout
- If tools like `screenshot`, `click`, or `eval_js` timeout, reload the extension at `chrome://extensions/`
- This clears stale debugger sessions from service worker restarts

### Native host not found
- Run `npx ira-research-mcp install-host` as Administrator
- Verify `com.ira.research.json` is registered in Chrome's native messaging host directory

---

## License

MIT © 2026 IRA Research
