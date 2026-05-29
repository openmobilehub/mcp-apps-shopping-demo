# Product Picker MCP App

An MCP App for Claude Desktop that shows an interactive multi-product picker in
the chat. Browse a grid of products, select several, confirm, and the selection
is sent back into the conversation.

## Build

```bash
npm install
npm run build
```

This bundles the React UI into a single `dist/mcp-app.html` and compiles the
server to `dist/`.

## Use in Claude Desktop

Add to `claude_desktop_config.json`
(`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS),
replacing the path with the absolute path to this project:

```json
{
  "mcpServers": {
    "product-picker": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-apps/dist/main.js", "--stdio"]
    }
  }
}
```

Restart Claude Desktop. Then ask: "Show me the product picker." Claude calls
`browse-products`, the grid renders inline, and confirming a selection adds the
chosen products to the conversation.

## Preview in the browser

The UI normally talks to the MCP host over a `postMessage` bridge. When opened
directly in a browser it detects there is no host and runs in **standalone
mode**: it loads the sample catalog locally and shows the selection in an alert
instead of sending it to a chat. This is the fast way to iterate on the UI
without Claude Desktop.

```bash
npm run dev   # opens http://localhost:5173/mcp-app.html
```

Standalone mode triggers automatically outside an iframe; append `?standalone`
to force it.

## Develop / inspect

```bash
npm test                                                        # unit tests
npx @modelcontextprotocol/inspector node dist/main.js --stdio   # inspect tools/resources
```

## Project layout

- `server.ts` — MCP server: UI resource + `browse-products` / `confirm-selection`
- `main.ts` — stdio (Claude Desktop) and HTTP entrypoints
- `catalog.ts` — sample products + pricing helper
- `src/app.tsx` — React multi-select UI
- `mcp-app.html` / `vite.config.ts` — single-file UI bundle
