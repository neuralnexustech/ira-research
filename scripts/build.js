/**
 * @license MIT
 * Copyright (c) 2026 IRA Research
 * All rights reserved.
 */

const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const isWatch = process.argv.includes("--watch");

// Helper to copy static files to build target
function copyFileSync(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
  console.log(`Copied static file: ${path.relative(process.cwd(), src)} -> ${path.relative(process.cwd(), dest)}`);
}

// Ensure base directories exist
const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");

function performStaticCopies() {
  // Copy Extension Manifest
  copyFileSync(
    path.join(projectRoot, "extension", "manifest.json"),
    path.join(distDir, "extension", "manifest.json")
  );

  // Copy Offscreen HTML
  copyFileSync(
    path.join(projectRoot, "extension", "offscreen", "offscreen.html"),
    path.join(distDir, "extension", "offscreen", "offscreen.html")
  );

  // Copy Options HTML
  copyFileSync(
    path.join(projectRoot, "extension", "options", "options.html"),
    path.join(distDir, "extension", "options", "options.html")
  );

  // Copy Sidepanel HTML
  copyFileSync(
    path.join(projectRoot, "extension", "sidepanel", "sidepanel.html"),
    path.join(distDir, "extension", "sidepanel", "sidepanel.html")
  );

  // Copy Native Host Manifest
  copyFileSync(
    path.join(projectRoot, "host", "com.ira.research.json"),
    path.join(distDir, "host", "com.ira.research.json")
  );
}

// Define our esbuild build contexts
const buildConfigs = [
  // 1. Chrome Extension Background Worker
  {
    entryPoints: [path.join(projectRoot, "extension", "background", "index.ts")],
    outfile: path.join(distDir, "extension", "background.js"),
    bundle: true,
    platform: "browser",
    format: "esm",
    target: ["chrome88"],
    sourcemap: true,
    minify: false
  },
  // 2. Chrome Extension Content Script
  {
    entryPoints: [path.join(projectRoot, "extension", "content", "index.ts")],
    outfile: path.join(distDir, "extension", "content.js"),
    bundle: true,
    platform: "browser",
    format: "iife", // IIFE format is safest for direct content script injection
    target: ["chrome88"],
    sourcemap: true,
    minify: false
  },
  // 3. Chrome Extension Offscreen Context
  {
    entryPoints: [path.join(projectRoot, "extension", "offscreen", "keepalive.ts")],
    outfile: path.join(distDir, "extension", "offscreen", "keepalive.js"),
    bundle: true,
    platform: "browser",
    format: "esm",
    target: ["chrome88"],
    sourcemap: true,
    minify: false
  },
  // 4. Chrome Extension Options Page
  {
    entryPoints: [path.join(projectRoot, "extension", "options", "options.ts")],
    outfile: path.join(distDir, "extension", "options", "options.js"),
    bundle: true,
    platform: "browser",
    format: "esm",
    target: ["chrome88"],
    sourcemap: true,
    minify: false
  },
  // 5. Chrome Extension Sidepanel HUD
  {
    entryPoints: [path.join(projectRoot, "extension", "sidepanel", "sidepanel.ts")],
    outfile: path.join(distDir, "extension", "sidepanel", "sidepanel.js"),
    bundle: true,
    platform: "browser",
    format: "esm",
    target: ["chrome88"],
    sourcemap: true,
    minify: false
  },
  // 6. Native Messaging Host Process (Node)
  {
    entryPoints: [path.join(projectRoot, "host", "native-host.ts")],
    outfile: path.join(distDir, "host", "native-host.js"),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: ["node18"],
    sourcemap: true,
    minify: false
  },
  // 7. MCP Server Process (Node)
  {
    entryPoints: [path.join(projectRoot, "server", "mcp-server.ts")],
    outfile: path.join(distDir, "server.js"),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: ["node18"],
    sourcemap: true,
    minify: false,
    external: ["@modelcontextprotocol/sdk"] // Node imports resolution
  }
];

async function run() {
  console.log("Starting build pipeline...");
  performStaticCopies();

  try {
    for (const config of buildConfigs) {
      if (isWatch) {
        const ctx = await esbuild.context(config);
        await ctx.watch();
        console.log(`Watching build target: ${path.relative(distDir, config.outfile)}`);
      } else {
        await esbuild.build(config);
        console.log(`Successfully built target: ${path.relative(distDir, config.outfile)}`);
      }
    }
    console.log("Build pipeline finished successfully!");
  } catch (e) {
    console.error("Build process failed:", e);
    process.exit(1);
  }
}

run();
