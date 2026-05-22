/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import { refManager } from "./ref-manager";

function getElementRole(el: HTMLElement): string {
  const role = el.getAttribute("role");
  if (role) return role.toLowerCase();

  const tagName = el.tagName.toLowerCase();
  if (tagName === "button") return "button";
  if (tagName === "a") return "link";
  if (tagName === "select") return "combobox";
  if (tagName === "textarea") return "textbox";
  if (tagName === "option") return "option";
  if (tagName === "h1" || tagName === "h2" || tagName === "h3" || tagName === "h4" || tagName === "h5" || tagName === "h6") return "heading";
  if (tagName === "form") return "form";
  if (tagName === "img") return "image";
  if (tagName === "input") {
    const type = el.getAttribute("type") || "text";
    if (type === "button" || type === "submit" || type === "reset") return "button";
    if (type === "checkbox") return "checkbox";
    if (type === "radio") return "radio";
    if (type === "file") return "file";
    return "textbox";
  }
  return "";
}

function getAccessibleName(el: HTMLElement, maxChars: number): string {
  let name = "";

  // 1. aria-label
  name = el.getAttribute("aria-label")?.trim() || "";
  
  // 2. aria-labelledby
  if (!name) {
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl) {
        name = labelEl.textContent?.trim() || "";
      }
    }
  }

  // 3. For inputs, associated label element
  if (!name && el.id) {
    try {
      const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelEl) {
        name = labelEl.textContent?.trim() || "";
      }
    } catch (e) {
      // Non-blocking fallback
    }
  }

  // Parent label check
  if (!name) {
    let parent = el.parentElement;
    while (parent) {
      if (parent.tagName.toLowerCase() === "label") {
        name = parent.textContent?.trim() || "";
        break;
      }
      parent = parent.parentElement;
    }
  }

  // 4. placeholder
  if (!name) {
    name = el.getAttribute("placeholder")?.trim() || "";
  }

  // 5. title
  if (!name) {
    name = el.getAttribute("title")?.trim() || "";
  }

  // 6. alt for images
  if (!name && el.tagName.toLowerCase() === "img") {
    name = el.getAttribute("alt")?.trim() || "";
  }

  // 7. Text content heuristics
  if (!name) {
    const tagName = el.tagName.toLowerCase();
    if (tagName === "button" || tagName === "a" || tagName === "option" || /^h[1-6]$/.test(tagName)) {
      name = el.textContent?.trim() || "";
    } else if (el.childNodes.length > 0) {
      // Pick first non-empty direct text node child
      for (let i = 0; i < el.childNodes.length; i++) {
        const node = el.childNodes[i];
        if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
          name = node.textContent.trim();
          break;
        }
      }
    }
  }

  // Clean up whitespace and restrict length
  name = name.replace(/\s+/g, " ");
  if (name.length > maxChars) {
    name = name.substring(0, maxChars - 3) + "...";
  }
  return name;
}

function isElementVisible(el: HTMLElement, filter: "viewport" | "all"): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }

  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return false;
  }

  if (filter === "viewport") {
    return !(
      rect.right < 0 ||
      rect.bottom < 0 ||
      rect.left > window.innerWidth ||
      rect.top > window.innerHeight
    );
  }

  return true;
}

/**
 * Checks if the node is considered interactive or of structural interest
 */
function isInterestingNode(el: HTMLElement, role: string): boolean {
  const tagName = el.tagName.toLowerCase();
  
  // Explicitly interactive tags
  if (["button", "a", "input", "select", "textarea", "summary", "option"].includes(tagName)) {
    return true;
  }
  
  // Custom cursors or explicit tab index
  const tabIndex = el.getAttribute("tabindex");
  if (tabIndex && parseInt(tabIndex, 10) >= 0) {
    return true;
  }

  // Interactive ARIA roles
  const interactiveRoles = [
    "button", "link", "checkbox", "radio", "combobox", "listbox", "textbox", 
    "menuitem", "tab", "treeitem", "slider", "searchbox", "dialog", "form"
  ];
  if (interactiveRoles.includes(role)) {
    return true;
  }

  // Landmarks & Content structures
  if (["form", "main", "nav", "section", "article", "header", "footer"].includes(tagName)) {
    return true;
  }
  if (/^h[1-6]$/.test(tagName) || role === "heading") {
    return true;
  }
  if (tagName === "img" || role === "image") {
    return true;
  }

  // Check if it has hover/click listener hints (pointer cursor is the strongest signal)
  const style = window.getComputedStyle(el);
  if (style.cursor === "pointer") {
    return true;
  }

  return false;
}

interface AccNode {
  element: HTMLElement;
  role: string;
  name: string;
  ref: string;
  depth: number;
  children: AccNode[];
}

export function generateAccessibilityTree(
  filter: "viewport" | "all" = "viewport",
  maxDepth = 10,
  maxChars = 60,
  startRefId?: string
): string {
  let rootElement: HTMLElement = document.body;

  if (startRefId) {
    const resolved = refManager.resolveRef(startRefId);
    if (resolved instanceof HTMLElement) {
      rootElement = resolved;
    } else {
      return `Error: Reference identifier '${startRefId}' was not found or is not a valid HTML element.`;
    }
  }

  const buildSubtree = (el: HTMLElement, currentDepth: number): AccNode | null => {
    if (currentDepth > maxDepth) return null;
    if (!isElementVisible(el, filter)) return null;

    const role = getElementRole(el);
    const isInteresting = isInterestingNode(el, role);

    const childNodes: AccNode[] = [];
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i];
      if (child instanceof HTMLElement || child instanceof SVGElement) {
        const sub = buildSubtree(child as any, currentDepth + 1);
        if (sub) childNodes.push(sub);
      }
    }

    // Node is interesting if it's explicitly interactive OR it contains interesting subtrees
    if (isInteresting || childNodes.length > 0) {
      const name = getAccessibleName(el, maxChars);
      const ref = refManager.assignRef(el);

      return {
        element: el,
        role: role || (isInteresting ? "element" : "group"),
        name,
        ref,
        depth: currentDepth,
        children: childNodes
      };
    }

    return null;
  };

  const rootNode = buildSubtree(rootElement, 0);
  if (!rootNode) return "No elements detected in current viewport.";

  // Flatten / Format the tree structure to string
  const formatNode = (node: AccNode, indent: number): string => {
    let result = "";
    const prefix = "  ".repeat(indent);
    
    const tagName = node.element.tagName.toLowerCase();
    
    // Attributes
    let extraAttrs = "";
    
    const href = node.element.getAttribute("href");
    if (href) extraAttrs += ` href="${href}"`;
    
    const type = node.element.getAttribute("type");
    if (type) extraAttrs += ` type="${type}"`;
    
    const placeholder = node.element.getAttribute("placeholder");
    if (placeholder) extraAttrs += ` placeholder="${placeholder}"`;

    // States
    if (node.element.hasAttribute("disabled")) extraAttrs += " [disabled]";
    if (node.element.getAttribute("aria-disabled") === "true") extraAttrs += " [disabled]";
    
    if (node.element.getAttribute("aria-checked") === "true") extraAttrs += " [checked]";
    if (node.element instanceof HTMLInputElement && node.element.checked) extraAttrs += " [checked]";
    
    if (node.element.getAttribute("aria-expanded") === "true") extraAttrs += " [expanded]";
    if (node.element.getAttribute("aria-expanded") === "false") extraAttrs += " [collapsed]";

    if (node.element.getAttribute("aria-selected") === "true") extraAttrs += " [selected]";
    if (node.element instanceof HTMLOptionElement && node.element.selected) extraAttrs += " [selected]";

    // Handle select combobox children inline for clean readability
    if (tagName === "select" && node.element instanceof HTMLSelectElement) {
      result += `${prefix}${node.role} "${node.name}" [${node.ref}]${extraAttrs}\n`;
      for (const option of Array.from(node.element.options)) {
        const optRef = refManager.assignRef(option);
        const selectedStr = option.selected ? " [selected]" : "";
        const disabledStr = option.disabled ? " [disabled]" : "";
        result += `${prefix}  option "${option.text.trim()}" [${optRef}] value="${option.value}"${selectedStr}${disabledStr}\n`;
      }
      return result;
    }

    // Default formatting: role "name" [ref_N] extraAttributes
    const roleStr = node.role;
    const nameStr = node.name ? ` "${node.name}"` : "";
    result += `${prefix}${roleStr}${nameStr} [${node.ref}]${extraAttrs}\n`;

    for (const child of node.children) {
      result += formatNode(child, indent + 1);
    }

    return result;
  };

  return formatNode(rootNode, 0).trim();
}

// Bind to window for executeScript extraction
(window as any).__generateIraAccessibilityTree = generateAccessibilityTree;
