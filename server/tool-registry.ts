/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import { z } from "zod";

export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodObject<any>;
}

// --- CORE TOOL SCHEMAS ---

export const RESEARCH_TOPIC_SCHEMA = z.object({
  topic: z.string().describe("The research topic or search query to look up on the internet."),
  searchEngine: z.enum(["google", "duckduckgo", "bing"]).optional().default("google").describe("The search engine to use for research. Default is google.")
});


export const TABS_LIST_SCHEMA = z.object({});

export const TABS_CREATE_SCHEMA = z.object({
  url: z.string().optional().describe("URL to navigate the newly created tab to. Default is about:blank"),
  groupTabId: z.number().optional().describe("Optionally attach the tab to an existing group via its main tab ID")
});

export const NAVIGATE_SCHEMA = z.object({
  tabId: z.number().describe("Target browser tab ID to navigate"),
  url: z.string().describe("Target destination URL to load")
});

export const CLICK_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  refId: z.string().optional().describe("DOM element reference (e.g. ref_3) to click"),
  x: z.number().optional().describe("Horizontal coordinate"),
  y: z.number().optional().describe("Vertical coordinate"),
  button: z.enum(["left", "right", "middle"]).optional().describe("Mouse button. Default is left"),
  clickCount: z.number().optional().describe("Number of consecutive clicks. Default is 1")
});

export const TYPE_TEXT_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  text: z.string().describe("The text string to type into the page context"),
  refId: z.string().optional().describe("Optional DOM reference. If provided, focuses the element by clicking first")
});

export const PRESS_KEY_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  key: z.string().describe("Key name to press (e.g., Enter, Tab, Escape, Backspace, ArrowDown, ArrowUp)")
});

export const SCROLL_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  refId: z.string().optional().describe("Optional DOM element reference to scroll from"),
  x: z.number().optional().describe("Optional horizontal start coordinate"),
  y: z.number().optional().describe("Optional vertical start coordinate"),
  dx: z.number().optional().describe("Horizontal scroll delta (default 0)"),
  dy: z.number().optional().describe("Vertical scroll delta (default 150)")
});

export const DRAG_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  fromRefId: z.string().optional().describe("Starting element reference"),
  toRefId: z.string().optional().describe("Ending element reference"),
  fromX: z.number().optional().describe("Starting x coordinate"),
  fromY: z.number().optional().describe("Starting y coordinate"),
  toX: z.number().optional().describe("Ending x coordinate"),
  toY: z.number().optional().describe("Ending y coordinate")
});

export const HOVER_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  refId: z.string().optional().describe("Optional element reference to hover"),
  x: z.number().optional().describe("Optional x coordinate"),
  y: z.number().optional().describe("Optional y coordinate")
});

export const SELECT_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  refId: z.string().describe("Select dropdown element reference"),
  value: z.string().describe("Target option value to select")
});

export const UPLOAD_FILE_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  refId: z.string().describe("File input element reference"),
  filePaths: z.array(z.string()).describe("List of absolute local paths to files to upload")
});

export const FORM_FILL_SMART_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  fields: z.record(z.string()).describe("A key-value mapping of element references to their target text values")
});

export const SCREENSHOT_SCHEMA = z.object({
  tabId: z.number().describe("Target browser tab ID to screenshot")
});

export const SCREENSHOT_FULL_SCHEMA = z.object({
  tabId: z.number().describe("Target browser tab ID to screenshot in full page scroll height")
});

export const READ_PAGE_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  filter: z.enum(["viewport", "all"]).optional().describe("Viewport filter method. Default is viewport"),
  depth: z.number().optional().describe("Maximum traversal depth. Default is 10"),
  maxChars: z.number().optional().describe("Maximum name character limits. Default is 60"),
  refId: z.string().optional().describe("Starting element subtree reference")
});

export const FIND_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  query: z.string().describe("Natural language query to search for visible matching elements"),
  maxResults: z.number().optional().describe("Maximum search hits. Default is 20")
});

export const GET_PAGE_TEXT_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID")
});

export const GET_PAGE_HTML_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID")
});

export const GET_ELEMENT_INFO_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  refId: z.string().describe("Element reference identifier")
});

export const HIGHLIGHT_ELEMENT_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  refId: z.string().describe("Element reference identifier to draw high-visibility overlay on"),
  text: z.string().optional().describe("Visual label description text")
});

export const TAKE_SNAPSHOT_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  filter: z.enum(["viewport", "all"]).optional().describe("Accessibility tree visibility filter")
});

export const WAIT_FOR_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  mode: z.enum(["duration", "selector", "refId"]).describe("Delay conditions: duration (sleep), selector (DOM query), refId (assigned reference)"),
  value: z.string().describe("The argument matched to the mode (e.g. milliseconds, CSS selector, ref_N identifier)"),
  timeout: z.number().optional().describe("Safety abort timeout limit in milliseconds. Default is 10000")
});

export const EVAL_JS_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  code: z.string().describe("Raw JavaScript code statement or block to execute")
});

export const EVAL_JS_FILE_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  filePath: z.string().describe("Local host filesystem absolute or relative path to a JS file to load and execute")
});

export const READ_CONSOLE_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  limit: z.number().optional().describe("Max log entries to fetch. Default is 100"),
  level: z.string().optional().describe("Filter logs by type (e.g. error, warning, log)")
});

export const CLEAR_CONSOLE_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID")
});

export const READ_NETWORK_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  limit: z.number().optional().describe("Max network log entries to fetch. Default is 100"),
  urlFilter: z.string().optional().describe("Substring filter to match against outbound request URLs"),
  methodFilter: z.string().optional().describe("HTTP method filter (GET, POST, etc.)"),
  statusFilter: z.number().optional().describe("Numerical HTTP response code filter")
});

export const GET_RESPONSE_BODY_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  requestId: z.string().describe("Target request identifier recorded by the network collector")
});

// --- PHASE 3 ADVANCED STATE & NETWORK POWER SCHEMAS ---

export const GET_STORAGE_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  type: z.enum(["local", "session"]).optional().describe("Storage type (local or session). Default is local"),
  key: z.string().optional().describe("Optional key to fetch a specific storage item. If omitted, returns all items")
});

export const SET_STORAGE_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  type: z.enum(["local", "session"]).optional().describe("Storage type (local or session). Default is local"),
  key: z.string().describe("Target storage key to set"),
  value: z.string().describe("Target value string to store")
});

export const CLEAR_STORAGE_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  type: z.enum(["local", "session", "all"]).optional().describe("Storage context to clear. Default is all")
});

export const GET_COOKIES_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  url: z.string().optional().describe("Optional URL filter to match cookies against. If omitted, returns cookies for current tab domain")
});

export const SET_COOKIE_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  name: z.string().describe("Cookie name"),
  value: z.string().describe("Cookie value"),
  url: z.string().optional().describe("Cookie destination domain URL. Default is current tab domain"),
  domain: z.string().optional().describe("Cookie domain"),
  path: z.string().optional().describe("Cookie path"),
  secure: z.boolean().optional().describe("Secure cookie flag"),
  httpOnly: z.boolean().optional().describe("HttpOnly cookie flag"),
  sameSite: z.enum(["Lax", "Strict", "None"]).optional().describe("SameSite cookie constraint"),
  expires: z.number().optional().describe("Expiration timestamp in seconds")
});

export const INTERCEPT_REQUEST_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  urlPattern: z.string().describe("Wildcard or glob pattern to match outbound request URLs (e.g. *api/v1/users*)"),
  action: z.enum(["allow", "abort", "mock"]).describe("Interception behavior (allow, abort request, or mock JSON response)"),
  mockStatus: z.number().optional().describe("Numerical HTTP status code for mocked response (e.g. 200)"),
  mockResponse: z.string().optional().describe("Stringified JSON body for the mocked response")
});

export const SET_THROTTLING_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID"),
  offline: z.boolean().optional().describe("Simulate complete network disconnect"),
  latency: z.number().optional().describe("Added round-trip latency overhead in milliseconds (e.g. 150)"),
  downloadThroughput: z.number().optional().describe("Maximum download bandwidth in bytes per second (e.g. 500000 for ~500kbps)"),
  uploadThroughput: z.number().optional().describe("Maximum upload bandwidth in bytes per second")
});

export const EXPORT_HAR_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID")
});

// --- PHASE 3 BIOMETRIC FACE DETECTION SCHEMAS ---

export const FACE_DETECT_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID")
});

export const FACE_COUNT_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID")
});

export const FACE_LANDMARKS_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID")
});

export const FACE_VERIFY_UI_SCHEMA = z.object({
  tabId: z.number().describe("Target tab ID")
});

// --- SERVER CATALOG REGISTRY ---

export const toolsCatalog: ToolDefinition[] = [
  // High-Level Macros
  {
    name: "research_topic",
    description: "Search the web for a topic and return extracted page text. Use instead of manually calling tabs_create + navigate + get_page_text.",
    schema: RESEARCH_TOPIC_SCHEMA
  },

  // Navigation
  {
    name: "tabs_list",
    description: "Returns all open browser tabs with titles and IDs. Use to locate existing active research tabs.",
    schema: TABS_LIST_SCHEMA
  },
  {
    name: "tabs_create",
    description: "Open a new browser tab. Optionally load a URL and attach to an existing tab group.",
    schema: TABS_CREATE_SCHEMA
  },
  {
    name: "navigate",
    description: "Load a URL in the specified tab. Blocks until page load completes.",
    schema: NAVIGATE_SCHEMA
  },

  // Interaction
  {
    name: "click",
    description: "Click an element or coordinates. Default tool for interactions. Prefer over ghost_click unless bot detection is suspected.",
    schema: CLICK_SCHEMA
  },
  {
    name: "right_click",
    description: "Right-click an element or coordinates. Use to open context menus.",
    schema: CLICK_SCHEMA
  },
  {
    name: "double_click",
    description: "Double-click an element or coordinates. Use when UI requires it to activate, like editing cells.",
    schema: CLICK_SCHEMA
  },
  {
    name: "triple_click",
    description: "Triple-click an element or coordinates. Use to select all text in an input field.",
    schema: CLICK_SCHEMA
  },
  {
    name: "hover",
    description: "Hover over an element or coordinates. Use to reveal tooltips or hover menus.",
    schema: HOVER_SCHEMA
  },
  {
    name: "type_text",
    description: "Type text into a focused input or element. Use to enter text values.",
    schema: TYPE_TEXT_SCHEMA
  },
  {
    name: "press_key",
    description: "Press a keyboard key (e.g., Enter, Tab, Escape). Use for form submission or keyboard navigation.",
    schema: PRESS_KEY_SCHEMA
  },
  {
    name: "scroll",
    description: "Scroll the page viewport or elements. Use to bring hidden content into view.",
    schema: SCROLL_SCHEMA
  },
  {
    name: "drag",
    description: "Drag and drop from start to end coordinates. Use to move slider handles or reorder elements.",
    schema: DRAG_SCHEMA
  },
  {
    name: "select",
    description: "Select an option in a dropdown element. Use to choose from select menus.",
    schema: SELECT_SCHEMA
  },
  {
    name: "upload_file",
    description: "Upload files to an input element. Use to attach files from local paths.",
    schema: UPLOAD_FILE_SCHEMA
  },
  {
    name: "form_fill_smart",
    description: "Fill multiple form fields at once. Use to enter structured batch data efficiently.",
    schema: FORM_FILL_SMART_SCHEMA
  },

  // Ghost Mouse
  {
    name: "ghost_click",
    description: "Click an element. Prefer over click when the site has bot detection, CAPTCHA, or rate limits.",
    schema: CLICK_SCHEMA
  },
  {
    name: "ghost_move",
    description: "Move the mouse to coordinates. Use to mimic human movement and evade bot detection.",
    schema: CLICK_SCHEMA
  },
  {
    name: "ghost_drag",
    description: "Drag and drop to coordinates. Use to mimic human dragging and evade bot detection.",
    schema: DRAG_SCHEMA
  },

  // Inspection
  {
    name: "screenshot",
    description: "Capture a JPEG base64 screenshot of the visible viewport. Use when you have the tree but need visual state.",
    schema: SCREENSHOT_SCHEMA
  },
  {
    name: "screenshot_full",
    description: "Capture a full-height JPEG base64 screenshot. Use when you need to inspect the entire scrollable page visually.",
    schema: SCREENSHOT_FULL_SCHEMA
  },
  {
    name: "read_page",
    description: "Return the accessibility tree JSON. First step when you do not know what element references exist on a page.",
    schema: READ_PAGE_SCHEMA
  },
  {
    name: "find",
    description: "Find interactive elements matching a query. Use when you know what you want but not its reference ID.",
    schema: FIND_SCHEMA
  },
  {
    name: "get_page_text",
    description: "Return all visible plain text of the tab. Use for content extraction when interaction is not needed.",
    schema: GET_PAGE_TEXT_SCHEMA
  },
  {
    name: "get_page_html",
    description: "Return the webpage's raw outer HTML. Use when you need attributes, hidden elements, or raw structure.",
    schema: GET_PAGE_HTML_SCHEMA
  },
  {
    name: "get_element_info",
    description: "Return detailed element properties JSON. Use when you have a reference ID and need value or visibility.",
    schema: GET_ELEMENT_INFO_SCHEMA
  },
  {
    name: "highlight_element",
    description: "Draw a visual focus outline around a reference element. Use for debugging or user guidance.",
    schema: HIGHLIGHT_ELEMENT_SCHEMA
  },
  {
    name: "take_snapshot",
    description: "Return both accessibility tree and viewport screenshot in one call. Use as the first call on new pages.",
    schema: TAKE_SNAPSHOT_SCHEMA
  },
  {
    name: "wait_for",
    description: "Pause execution until a selector appears, reference resolves, or duration passes. Use to wait for dynamic content.",
    schema: WAIT_FOR_SCHEMA
  },

  // JS / Console / Network
  {
    name: "eval_js",
    description: "Evaluate JavaScript in the page context and return the result. Use for custom scripting or verification.",
    schema: EVAL_JS_SCHEMA
  },
  {
    name: "eval_js_file",
    description: "Inject and execute a local JS file in the page. Use to run complex scripts.",
    schema: EVAL_JS_FILE_SCHEMA
  },
  {
    name: "read_console",
    description: "Return console logs and errors array. Use to debug client-side page errors.",
    schema: READ_CONSOLE_SCHEMA
  },
  {
    name: "clear_console",
    description: "Clear the console log buffer.",
    schema: CLEAR_CONSOLE_SCHEMA
  },
  {
    name: "read_network",
    description: "Return recent outbound HTTP request logs array. Use to audit network traffic or API calls.",
    schema: READ_NETWORK_SCHEMA
  },
  {
    name: "get_response_body",
    description: "Return the raw body payload for a request ID. Use to inspect API responses.",
    schema: GET_RESPONSE_BODY_SCHEMA
  },
  
  // Phase 3 — Storage & Cookie Control
  {
    name: "get_storage",
    description: "Return items from localStorage or sessionStorage (e.g. auth tokens, cached user data, feature flags). Omit key to return all items.",
    schema: GET_STORAGE_SCHEMA
  },
  {
    name: "set_storage",
    description: "Write a key-value string to localStorage or sessionStorage. Use to inject or override client-side values before page logic runs.",
    schema: SET_STORAGE_SCHEMA
  },
  {
    name: "clear_storage",
    description: "Clear localStorage or sessionStorage. Use to reset client-side storage.",
    schema: CLEAR_STORAGE_SCHEMA
  },
  {
    name: "get_cookies",
    description: "Return cookies for the active domain. Use to check authentication session state.",
    schema: GET_COOKIES_SCHEMA
  },
  {
    name: "set_cookie",
    description: "Set a custom cookie for the browser session. Use to mock authentication.",
    schema: SET_COOKIE_SCHEMA
  },

  // Phase 3 — Network Power Tools
  {
    name: "intercept_request",
    description: "Intercept outbound requests to mock responses or abort calls. Use for testing network failure cases.",
    schema: INTERCEPT_REQUEST_SCHEMA
  },
  {
    name: "set_throttling",
    description: "Throttle network speed or inject latency. Use to simulate slow connections.",
    schema: SET_THROTTLING_SCHEMA
  },
  {
    name: "export_har",
    description: "Export all network traffic for this session as a HAR 1.2 file. Use to hand off a full request history for external analysis.",
    schema: EXPORT_HAR_SCHEMA
  },

  // Phase 3 — Biometric Face Detection
  {
    name: "face_detect",
    description: "Return bounding box coordinates for each face visible in the current viewport.",
    schema: FACE_DETECT_SCHEMA
  },
  {
    name: "face_count",
    description: "Return the integer count of faces visible in the current viewport.",
    schema: FACE_COUNT_SCHEMA
  },
  {
    name: "face_landmarks",
    description: "Return facial landmarks coordinates (eyes, nose, mouth). Use to inspect face orientation.",
    schema: FACE_LANDMARKS_SCHEMA
  },
  {
    name: "face_verify_ui",
    description: "Verify if facial landmarks align with on-screen UI targeting boxes (e.g., matching a camera frame guide).",
    schema: FACE_VERIFY_UI_SCHEMA
  }
];
