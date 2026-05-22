/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import { refManager } from "./ref-manager";

interface MatchResult {
  refId: string;
  tagName: string;
  name: string;
  role: string;
  score: number;
}

export function findElements(query: string, maxResults = 20): MatchResult[] {
  if (!query || !query.trim()) return [];
  const normalizedQuery = query.toLowerCase().trim();
  
  const results: MatchResult[] = [];
  const elements = document.querySelectorAll("*");

  const getElementRole = (el: Element): string => {
    const role = el.getAttribute("role");
    if (role) return role.toLowerCase();
    return el.tagName.toLowerCase();
  };

  const getAccessibleName = (el: Element): string => {
    let name = el.getAttribute("aria-label")?.trim() || "";
    if (!name) {
      const labelledBy = el.getAttribute("aria-labelledby");
      if (labelledBy) {
        const labelEl = document.getElementById(labelledBy);
        if (labelEl) name = labelEl.textContent?.trim() || "";
      }
    }
    if (!name && el.id) {
      try {
        const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (labelEl) name = labelEl.textContent?.trim() || "";
      } catch (e) {
        // Non-blocking fallback
      }
    }
    if (!name) name = el.getAttribute("placeholder")?.trim() || "";
    if (!name) name = el.getAttribute("title")?.trim() || "";
    if (!name) name = el.getAttribute("alt")?.trim() || "";
    if (!name) {
      // Pick first non-empty text child node
      for (let i = 0; i < el.childNodes.length; i++) {
        const node = el.childNodes[i];
        if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
          name = node.textContent.trim();
          break;
        }
      }
    }
    return name.toLowerCase().replace(/\s+/g, " ");
  };

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (!(el instanceof HTMLElement)) continue;

    let score = 0;
    const elementId = el.id ? el.id.toLowerCase() : "";
    const elementClass = el.className && typeof el.className === "string" ? el.className.toLowerCase() : "";
    const accName = getAccessibleName(el);
    const textContent = el.textContent ? el.textContent.toLowerCase().trim() : "";
    const tagName = el.tagName.toLowerCase();

    // 1. Check ID (Highest weight)
    if (elementId === normalizedQuery) {
      score += 100;
    } else if (elementId.includes(normalizedQuery)) {
      score += 50;
    }

    // 2. Check Accessible Name
    if (accName === normalizedQuery) {
      score += 90;
    } else if (accName.includes(normalizedQuery)) {
      score += 60;
    }

    // 3. Check class name matches
    if (elementClass.includes(normalizedQuery)) {
      score += 30;
    }

    // 4. Check text content
    if (textContent === normalizedQuery) {
      score += 40;
    } else if (textContent.includes(normalizedQuery)) {
      // Scale score based on text length to penalize huge wrapper div matches
      const ratio = normalizedQuery.length / (textContent.length || 1);
      score += Math.round(30 * ratio);
    }

    // 5. Special tag name matches
    if (tagName === normalizedQuery) {
      score += 20;
    }

    if (score > 0) {
      // Skip hidden elements (lazy-evaluated for massive performance gains)
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        continue;
      }

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        continue;
      }

      const refId = refManager.assignRef(el);
      results.push({
        refId,
        tagName: el.tagName,
        name: accName || textContent.substring(0, 30),
        role: getElementRole(el),
        score
      });
    }
  }

  // Sort descending by score
  return results.sort((a, b) => b.score - a.score).slice(0, maxResults);
}

// Bind to window for extraction
(window as any).__iraFindElements = findElements;
