// Prioritize environment variable (MCP config)
if (process.env.IRA_EXTENSION_ID) {
  extensionId = process.env.IRA_EXTENSION_ID;
  console.error(`Using Extension ID from environment:.${process.env.IRA_EXTENSION_ID}`);
  updateNativeManifest(extensionId);
}