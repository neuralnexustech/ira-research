/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

export interface ProtocolPing {
  type: "ping";
}

export interface ProtocolPong {
  type: "pong";
}

export interface ProtocolClientHello {
  type: "client_hello";
  clientId: string;
}

export interface ProtocolToolRequest {
  type: "tool_request";
  id: string; // Message ID (e.g., c{clientId}_{reqId})
  tool: string;
  args: any;
}

export interface ProtocolToolResponse {
  type: "tool_response";
  id: string; // Matches request ID
  result: {
    success: boolean;
    output: string;
    content?: Array<{
      type: "text" | "image";
      text?: string;
      data?: string;
      mimeType?: string;
    }>;
    error?: string;
  };
}

export interface ProtocolError {
  type: "error";
  id?: string;
  message: string;
}

export type ProtocolMessage =
  | ProtocolPing
  | ProtocolPong
  | ProtocolClientHello
  | ProtocolToolRequest
  | ProtocolToolResponse
  | ProtocolError;
