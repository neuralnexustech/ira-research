# IRA Research MCP - Complete Setup Guide

## Overview
IRA Research is a next-generation 3-layer browser automation system:
- **Layer 1**: CLI Agent (Claude/Claude Code/Copilot)
- **Layer 2**: MCP Server (stdio/TCP bridge)
- **Layer 3**: Chrome Extension (Native Messaging Host)
- **Layer 4**: Browser Automation (Chrome DevTools Protocol)

## Installation Steps

### 1. Install from npm
```bash
npm install -g ira-research-mcp
```

### 2. Install Chrome Extension

1. **Get Extension ID**:
   - Extract the extension files from the package
   - Load in Chrome developer mode
   - Copy the extension ID (32-character string)

2. **Load Extension**:
   ```bash
   # Navigate to extension directory
   cd node_modules/ira-research-mcp/extension
   
   # Load in Chrome (Manual Steps):
   # 1. Open Chrome
   # 2. Go to chrome://extensions/
   # 3. Enable "Developer mode"
   # 4. Click "Load unpacked"
   # 5. Select the extension folder
   # 6. Copy the Extension ID shown
   ```

### 3. Configure Native Host

#### For Windows:
```powershell
# Run the install script (automated)
npm run install-host

# Or manually:
# Copy to Chrome's native messaging directory
copy "node_modules\ira-research-mcp\host\" "%APPDATA%\Google\Chrome\NativeMessagingHosts\"
```

#### For macOS:
```bash
# Copy to macOS native messaging directory
mkdir -p ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/
cp node_modules/ira-research-mcp/host/com.ira.research.json ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/
```

### 4. MCP Server Configuration

Add to your MCP settings (Claude Desktop, Claude Code, etc.):

```json
{
  "mcpServers": {
    "browser": {
      "command": "npx",
      "args": ["ira-research-mcp"],
      "env": {
        "IRA_EXTENSION_ID": "<your-extension-id>"
      }
    }
  }
}
```

### 5. Start the System

1. **Start Chrome Extension**:
   - Open Chrome with the extension loaded
   - Extension should show "Connected" status
   - Check TCP connection on port 18765

2. **Start MCP Server**:
   ```bash
   # The server auto-detects mode
   npx ira-research-mcp
   ```
   
   The server will automatically read IRA_EXTENSION_ID from environment and configure the native manifest.

## Keywords and Usage

### Core Navigation Keywords
- `research_topic` - Web search automation
- `tabs_create` - Open new tab
- `navigate` - Load URL
- `tabs_list` - List all tabs

### Interaction Keywords
- `click` - Click elements
- `type_text` - Enter text
- `press_key` - Press keys
- `scroll` - Scroll page
- `hover` - Hover over elements

### Ghost Mouse (Stealth Mode) Keywords
- `ghost_click` - Stealth clicking
- `ghost_move` - Human-like movement
- `ghost_drag` - Stealth dragging

### Inspection Keywords
- `screenshot` - Capture viewport
- `screenshot_full` - Full page capture
- `read_page` - Get accessibility tree
- `find` - Find elements
- `get_page_text` - Extract text

### Advanced Features Keywords
- `face_detect` - Detect faces
- `intercept_request` - Mock network requests
- `set_storage` - Modify localStorage
- `export_har` - Export network logs

## Example Usage with Claude

### Basic Web Automation:
```
Create a new tab and navigate to Google.com
```

### Research Task:
```
Research the latest AI developments using research_topic
```

### Form Filling:
```
Fill the login form using form_fill_smart with credentials
```

### Screenshot:
```
Take a screenshot of the current page
```

### Network Analysis:
```
Intercept all API calls and read_network logs
```

## Connection Keywords

### Status Check:
- `tabs_list` - Verify connection
- "List all open browser tabs"

### Connection Issue Resolution:
1. Check extension is loaded in Chrome
2. Verify Native Host is installed
3. Ensure TCP port 18765 is free
4. Restart MCP server
5. Check extension status shows "Connected"

## Common Commands

### Initialize System:
```bash
# Quick setup (Windows)
npm install -g ira-research-mcp && npm run install-host

# Load extension manually in Chrome_DEV mode
# Copy extension ID and add to MCP config
```

### Debug Commands:
```bash
# Check TCP status
netstat -an | findstr 18765

# Test MCP server
npx ira-research-mcp
```

### Usage Examples:
```
# Basic navigation
"Create a tab and navigate to example.com"
"Take a screenshot of the page"
"Click the login button"

# Advanced automation
"Research machine learning trends"
"Extract all product data from the page"
"Fill the form with user data"

# Stealth mode
"Use ghost click to bypass bot detection"
"Move mouse naturally to target element"
```

## Troubleshooting

### Extension Not Connected:
1. Reload Chrome extension
2. Check native host installation
3. Verify firewall allows port 18765

### MCP Server Errors:
1. Check extension ID in config
2. Ensure Chrome is running
3. Verify TCP connection

### Ghost Mouse Not Working:
1. Use ghost_* keywords instead of regular tools
2. Enable Bezier curve movement
3. Adjust timing parameters

## Best Practices

1. **Always check connection first** with `tabs_list`
2. **Use ghost mode** for bot-protected sites
3. **Utilize research_topic** for complex searches
4. **Take screenshots** to verify actions
5. **Use wait_for** for dynamic content
6. **Check network logs** for debugging APIs

## Extension ID Configuration

### Find Extension ID:
1. Go to `chrome://extensions/`
2. Find "IRA Research"
3. Copy the ID (e.g., `khennnjjddpimmhdccpncgjacofneaoc`)

### Multiple Extension Support:
```json
{
  "mcpServers": {
    "browser-primary": {
      "command": "npx",
      "args": ["ira-research-mcp"],
      "env": {
        "IRA_EXTENSION_ID": "PRIMARY_EXTENSION_ID"
      }
    },
    "browser-secondary": {
      "command": "npx", 
      "args": ["ira-research-mcp"],
      "env": {
        "IRA_EXTENSION_ID": "SECONDARY_EXTENSION_ID"
      }
    }
  }
}
```

## Quick Start Commands

```
# 1. Install globally
npm install -g ira-research-mcp

# 2. Install native host
npm run install-host

# 3. Load Chrome extension manually
# Get your 32-character extension ID

# 4. Configure MCP with extension ID (NEW!)
# Add to your MCP config:
# "env": { "IRA_EXTENSION_ID": "<your-id>" }

# 5. Test with:
"List all browser tabs"
```

That's it! Your IRA Research MCP system is ready for advanced browser automation.

## Environment Variable Support

The MCP server automatically detects and uses the `IRA_EXTENSION_ID` environment variable:
- No command-line arguments needed
- Auto-updates native messaging manifest
- Works with any MCP client that supports environment variables

Example with multiple environments:
```bash
Linux/macOS:
export IRA_EXTENSION_ID="khennnjjddpimmhdccpncgjacofneaoc"

Windows:
set IRA_EXTENSION_ID=khennnjjddpimmhdccpncgjacofneaoc
```

Then run:
```bash
npx ira-research-mcp
```