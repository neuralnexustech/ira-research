/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import { ProtocolToolRequest, ProtocolToolResponse } from "../shared/protocol";

export class SessionManager {
  private static instance: SessionManager;
  private pendingRequests: Map<string, {
    resolve: (res: any) => void;
    reject: (err: any) => void;
    timestamp: number;
  }> = new Map();

  private constructor() {
    // Periodically clean stale requests (older than 30s)
    setInterval(() => {
      const now = Date.now();
      for (const [id, req] of this.pendingRequests.entries()) {
        if (now - req.timestamp > 30000) {
          req.reject(new Error("Request timed out after 30 seconds."));
          this.pendingRequests.delete(id);
        }
      }
    }, 5000);
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Register a pending tool request to await response
   */
  public registerRequest(msgId: string, resolve: (res: any) => void, reject: (err: any) => void) {
    this.pendingRequests.set(msgId, {
      resolve,
      reject,
      timestamp: Date.now()
    });
  }

  /**
   * Handle incoming tool response from the native messaging bridge
   */
  public handleResponse(response: ProtocolToolResponse) {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      pending.resolve(response.result);
      this.pendingRequests.delete(response.id);
    }
  }

  /**
   * Reject a specific pending request
   */
  public rejectRequest(msgId: string, error: Error) {
    const pending = this.pendingRequests.get(msgId);
    if (pending) {
      pending.reject(error);
      this.pendingRequests.delete(msgId);
    }
  }

  /**
   * Reject all pending requests (e.g. on connection disconnect)
   */
  public rejectAll(error: Error) {
    for (const [id, pending] of this.pendingRequests.entries()) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }
}

export const sessionManager = SessionManager.getInstance();
