/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { toolsCatalog } from "../tool-registry";
import { tcpManager } from "./tcp";

function zodTypeToJson(zodType: any): any {
  if (!zodType) return { type: "string" };

  // Unwrap optional
  if (zodType._def?.typeName === "ZodOptional") {
    return {
      ...zodTypeToJson(zodType._def.innerType),
      description: zodType.description || zodType._def.innerType.description
    };
  }

  const json: any = {};
  if (zodType.description) {
    json.description = zodType.description;
  }

  const typeName = zodType._def?.typeName;

  switch (typeName) {
    case "ZodString":
      json.type = "string";
      break;
    case "ZodNumber":
      json.type = "number";
      break;
    case "ZodBoolean":
      json.type = "boolean";
      break;
    case "ZodEnum":
      json.type = "string";
      json.enum = zodType._def.values;
      break;
    case "ZodArray":
      json.type = "array";
      json.items = zodTypeToJson(zodType._def.type);
      break;
    case "ZodRecord":
      json.type = "object";
      json.additionalProperties = zodTypeToJson(zodType._def.valueType);
      break;
    case "ZodObject":
      json.type = "object";
      json.properties = {};
      const shape = zodType.shape;
      for (const key of Object.keys(shape)) {
        json.properties[key] = zodTypeToJson(shape[key]);
      }
      json.required = Object.keys(shape).filter(
        (key) => !shape[key].isOptional()
      );
      break;
    default:
      json.type = "string";
  }

  return json;
}

export class StdioMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "ira-research-mcp",
        version: "0.1.0"
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List tools schema
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      async () => {
        return {
          tools: toolsCatalog.map((tool) => {
            const schemaJson = zodTypeToJson(tool.schema);
            return {
              name: tool.name,
              description: tool.description,
              inputSchema: schemaJson
            };
          })
        };
      }
    );

    // Call tool execution handler
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        let { name, arguments: args } = request.params;
        try {
          // Intercept and load scripts from host filesystem dynamically
          if (name === "eval_js_file" && args) {
            const fs = await import("fs");
            const path = await import("path");
            const absolutePath = path.resolve(String(args.filePath));

            if (!fs.existsSync(absolutePath)) {
              return {
                content: [
                  {
                    type: "text",
                    text: `Error: Local script file not found at path: ${absolutePath}`
                  }
                ],
                isError: true
              };
            }

            const code = fs.readFileSync(absolutePath, "utf8");
            name = "eval_js";
            args = {
              tabId: args.tabId,
              code
            };
          }

          // Intercept research macro to keep agent flow clean
          if (name === "research_topic" && args) {
            console.error(`[Macro] Executing research_topic for: ${args.topic}`);
            
            // 1. Create a new tab
            const tabRes = await tcpManager.sendToolRequest("tabs_create", { url: "about:blank" });
            if (!tabRes.success) throw new Error("Failed to create tab for research.");
             // Parse tab ID robustly from JSON content or output string
             let tabId = 1;
             if (tabRes.content && tabRes.content[0] && tabRes.content[0].text) {
               try {
                 const parsed = JSON.parse(tabRes.content[0].text);
                 if (parsed && typeof parsed.tabId === "number") {
                   tabId = parsed.tabId;
                 }
               } catch (e) {}
             }
             if (tabId === 1) {
               const tabMatch = tabRes.output?.match(/ID\s+(\d+)/i) || tabRes.output?.match(/ID:\s*(\d+)/i);
               if (tabMatch) {
                 tabId = parseInt(tabMatch[1], 10);
               }
             }

            // 2. Navigate to search engine
            const topicStr = String(args.topic);
            const engine = args.searchEngine || "google";
            let searchUrl = `https://www.google.com/search?q=${encodeURIComponent(topicStr)}`;
            
            if (engine === "duckduckgo") {
              searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(topicStr)}&ia=web`;
            } else if (engine === "bing") {
              searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(topicStr)}`;
            }

            await tcpManager.sendToolRequest("navigate", { tabId, url: searchUrl });
            
            // 3. Wait a moment for dynamic content to render (Wait for Idle logic)
            await tcpManager.sendToolRequest("wait_for", { tabId, mode: "duration", value: "3000" });

            // 4. Extract page text
            const textRes = await tcpManager.sendToolRequest("get_page_text", { tabId });

            return {
              content: [
                {
                  type: "text",
                  text: `Research results for "${topicStr}" via ${engine} on Tab ${tabId}:\n\n${textRes.output?.substring(0, 5000)}...`
                }
              ],
              isError: false
            };
          }

          // Forward request over TCP manager (routes to Native Host -> Extension -> Chrome)
          const result = await tcpManager.sendToolRequest(name, args);
          return {
            content: result.content || [
              {
                type: "text",
                text: result.output || "Success"
              }
            ],
            isError: !result.success
          };
        } catch (e: any) {
          return {
            content: [
              {
                type: "text",
                text: `Execution failed: ${e.message}`
              }
            ],
            isError: true
          };
        }
      }
    );
  }

  public async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("IRA Research Stdio MCP Server running.");
  }
}
