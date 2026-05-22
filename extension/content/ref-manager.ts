/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

class RefManager {
  private count = 0;
  private idToRef = new Map<string, WeakRef<Element>>();
  private refToId = new WeakMap<Element, string>();

  /**
   * Assigns a stable ref_N identifier to a DOM element.
   * If the element already has a ref, returns the existing one.
   */
  public assignRef(element: Element): string {
    let id = this.refToId.get(element);
    if (!id) {
      this.count++;
      id = `ref_${this.count}`;
      this.idToRef.set(id, new WeakRef(element));
      this.refToId.set(element, id);
    }
    return id;
  }

  /**
   * Resolves a ref_N identifier back to its DOM element.
   * Cleans up garbage-collected items from the map.
   */
  public resolveRef(id: string): Element | null {
    const weakRef = this.idToRef.get(id);
    if (!weakRef) return null;
    
    const el = weakRef.deref();
    if (!el) {
      this.idToRef.delete(id);
      return null;
    }
    return el;
  }

  /**
   * Clears the entire registry (useful on page reloads/resets).
   */
  public clear() {
    this.idToRef.clear();
    this.count = 0;
  }
}

// Global registry export on window context
const globalRef = window as any;
globalRef.__iraRefManager = globalRef.__iraRefManager || new RefManager();
export const refManager = globalRef.__iraRefManager;
