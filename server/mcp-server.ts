#!/usr/bin/env node
/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

import { tcpManager } from "./transport/tcp";
import { StdioMcpServer } from "./transport/stdio";
import * as fs from "fs";
import * as path from "path";

// Parse command line arguments (for backward compatibility)
function parseArgs(): { extensionId?: string } {
  const args = process.argv.slice(2);
  const result: { extensionId?: string } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--extension-id" && i + 1 < args.length) {
      result.extensionId = args[++i].trim();
    } else if (arg.startsWith("--extension-id=")) {
      result.extensionId = arg.split("=")[1]?.trim();
    } else if (arg === "+IRA_EXTENSION_ID" && i + 1 < args.length) {
      result.extensionId = args[++i].trim();
    }
  }

  return result;
}

// Update native messaging manifest with extension ID
function updateNativeManifest(extensionId: string): void {
  try {
    // Find the native manifest file
    const manifestPaths = [
      path.join(process.env.APPDATA || "", "Google", "Chrome", "NativeMessagingHosts", "com.ira.research.json"),
      path.join(process.cwd(), "host", "com.ira.research.json"),
      path.join(__dirname, "..", "host", "com.ira.research.json"),
      path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "User Data", "NativeMessagingHosts", "com.ira.research.json"),
      path.join(process.env.HOME || "", "Library/Application Support/Google/Chrome/NativeMessagingHosts/com.ira.research.json")
    ];

    let manifestPath: string | undefined;
    for (const p of manifestPaths) {
      if (fs.existsSync(p)) {
        manifestPath = p;
        break;
      }
    }

    if (!manifestPath) {
      console.error("Native manifest file not found. Extension ID not updated.");
      console.error("Please run: npm run install-host");
      return;
    }

    // Read and update manifest
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    // Add/replace the placeholder with actual extension ID
    const extensionOrigin = `chrome-extension://${extensionId}/`;

    // Check if extension already exists
    if (!manifest.allowed_origins.includes(extensionOrigin)) {
      // Replace placeholder if exists, otherwise add the new ID
      const placeholderIndex = manifest.allowed_origins.indexOf("chrome-extension://IRA_EXTENSION_PLACEHOLDER/");
      if (placeholderIndex >= 0) {
        manifest.allowed_origins[placeholderIndex] = extensionOrigin;
      } else {
        manifest.allowed_origins.push(extensionOrigin);
      }

      // Write back
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.error(`✓ Updated native manifest with extension ID: ${extensionId}`);
      console.error(`  File: ${manifestPath}`);
    } else {
      console.error(`✓ Extension ID ${extensionId} already configured in manifest`);
    }

  } catch (error: any) {
    console.error("Failed to update native manifest:", error.message);
  }
}

async function main() {
  // Check for environment variable first (MCP config style)
  const envExtensionId = process.env.IRA_EXTENSION_ID;
  let extensionId: string | undefined;

  if (envExtensionId) {
    console.error(`Using Extension ID from environment: ${envExtensionId}`);
    extensionId = envExtensionId;
  }

  // Parse command line arguments (for CLI usage)
  if (!extensionId) {
    const args = parseArgs();
    if (args.extensionId) {
      console.error(`Setting up IRA Research with Extension ID: ${args.extensionId}`);
      extensionId = args.extensionId;
    }
  }

  // Update manifest if we have extension ID
  if (extensionId) {
    updateNativeManifest(extensionId);
  }

  // Give Chrome a moment to connect if it just started
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 1. Initialize TCP Transport (Server / Client mode detection)
  const mode = await tcpManager.initialize();

  if (mode.isServer) {
    console.error("Initialized in IRA Primary Server Mode (port 18765).");
  } else {
    console.error("Initialized in IRA Agent Client Session Mode.");
  }

  // 2. Start stdio MCP Protocol Server
  const stdioServer = new StdioMcpServer();
  await stdioServer.start();
}

main().catch((err) => {
  console.error("Critical failure during IRA MCP Server startup:", err);
  process.exit(1);
});
