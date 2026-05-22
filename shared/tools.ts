/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

export const enum ToolName {
  // Navigation
  TABS_LIST = "tabs_list",
  TABS_CREATE = "tabs_create",
  TABS_CLOSE = "tabs_close",
  NAVIGATE = "navigate",
  NAVIGATE_BACK = "navigate_back",
  NAVIGATE_FORWARD = "navigate_forward",
  NAVIGATE_RELOAD = "navigate_reload",
  SWITCH_BROWSER = "switch_browser",

  // Interaction
  CLICK = "click",
  RIGHT_CLICK = "right_click",
  DOUBLE_CLICK = "double_click",
  TRIPLE_CLICK = "triple_click",
  TYPE_TEXT = "type_text",
  PRESS_KEY = "press_key",
  SCROLL = "scroll",
  DRAG = "drag",
  HOVER = "hover",
  SELECT = "select",
  UPLOAD_FILE = "upload_file",
  FORM_FILL_SMART = "form_fill_smart",

  // Inspection
  SCREENSHOT = "screenshot",
  SCREENSHOT_FULL = "screenshot_full",
  READ_PAGE = "read_page",
  FIND = "find",
  GET_PAGE_TEXT = "get_page_text",
  GET_PAGE_HTML = "get_page_html",
  GET_ELEMENT_INFO = "get_element_info",
  TAKE_SNAPSHOT = "take_snapshot",
  HIGHLIGHT_ELEMENT = "highlight_element",
  WAIT_FOR = "wait_for",

  // JavaScript / DevTools
  EVAL_JS = "eval_js",
  EVAL_JS_FILE = "eval_js_file",
  READ_CONSOLE = "read_console",
  CLEAR_CONSOLE = "clear_console",
  SET_BREAKPOINT = "set_breakpoint",
  PAUSE_EXECUTION = "pause_execution",
  GET_JS_HEAP = "get_js_heap",
  INJECT_SCRIPT = "inject_script",

  // Network
  READ_NETWORK = "read_network",
  GET_RESPONSE_BODY = "get_response_body",
  INTERCEPT_REQUEST = "intercept_request",
  MOCK_RESPONSE = "mock_response",
  SET_THROTTLING = "set_throttling",
  EXPORT_HAR = "export_har",
  LIST_WEBSOCKETS = "list_websockets",

  // Performance
  MEASURE_VITALS = "measure_vitals",
  START_TRACE = "start_trace",
  STOP_TRACE = "stop_trace",
  LIGHTHOUSE_AUDIT = "lighthouse_audit",
  MEASURE_FPS = "measure_fps",
  GET_CRUX_DATA = "get_crux_data",

  // Storage
  GET_STORAGE = "get_storage",
  SET_STORAGE = "set_storage",
  GET_COOKIES = "get_cookies",
  SET_COOKIE = "set_cookie",
  CLEAR_STORAGE = "clear_storage",

  // Extensions
  LIST_EXTENSIONS = "list_extensions",
  INSTALL_EXTENSION = "install_extension",
  TOGGLE_EXTENSION = "toggle_extension",
  RELOAD_EXTENSION = "reload_extension",

  // Recording
  GIF_START = "gif_start",
  GIF_STOP = "gif_stop",
  GIF_EXPORT = "gif_export",
  VIDEO_RECORD = "video_record",

  // Ghost Mouse (Advanced Stealth)
  GHOST_CLICK = "ghost_click",
  GHOST_MOVE = "ghost_move",
  GHOST_DRAG = "ghost_drag",
  SET_MOUSE_PERSONALITY = "set_mouse_personality",

  // Face Detection (Test Face)
  FACE_DETECT = "face_detect",
  FACE_DETECT_VIDEO = "face_detect_video",
  FACE_COUNT = "face_count",
  FACE_LANDMARKS = "face_landmarks",
  FACE_VERIFY_UI = "face_verify_ui",

  // Session / Meta
  UPDATE_PLAN = "update_plan",
  RESIZE_WINDOW = "resize_window",
  EMULATE_DEVICE = "emulate_device"
}
