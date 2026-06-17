# MCP server reference

The manga-downloader MCP server exposes the same operations as the CLI as [Model Context Protocol](https://modelcontextprotocol.io) tools. The CLI (`bin/manga-downloader.js`) remains unchanged.

## Quick start

```bash
pnpm install
pnpm mcp          # stdio (Cursor, Claude Desktop)
pnpm mcp:http     # HTTP on http://127.0.0.1:3847/mcp
```

## Cursor configuration

Add to `.cursor/mcp.json` or user MCP settings:

```json
{
  "mcpServers": {
    "manga-downloader": {
      "command": "node",
      "args": ["D:\\Programacao\\baixar-centralnovel\\bin\\mcp-server.js"]
    }
  }
}
```

Use the absolute path to `bin/mcp-server.js` on your machine.

Optional environment:

| Variable | Description |
|----------|-------------|
| `MANGA_DOWNLOADER_CONFIG` | Override path to `config.json` (default: project root) |
| `MCP_HTTP_HOST` | HTTP bind host (default `127.0.0.1`) |
| `MCP_HTTP_PORT` | HTTP port (default `3847`) |

## Claude Desktop

Same stdio pattern in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "manga-downloader": {
      "command": "node",
      "args": ["D:\\Programacao\\baixar-centralnovel\\bin\\mcp-server.js"]
    }
  }
}
```

### Claude Desktop + local HTTP

Claude Desktop only spawns stdio processes. To use the HTTP server locally:

```json
{
  "mcpServers": {
    "manga-downloader": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://127.0.0.1:3847/mcp",
        "--transport",
        "http-only"
      ]
    }
  }
}
```

Start `pnpm mcp:http` in a separate terminal first.

## ChatGPT (advanced)

ChatGPT Connectors require a **public HTTPS** endpoint. Run `pnpm mcp:http` on your machine and expose it via a tunnel (ngrok, Cloudflare Tunnel, etc.). Downloads still happen on the machine where the server runs.

Production connectors may require OAuth 2.1 (not implemented in this repo).

## Tools

| Tool | CLI equivalent | Description |
|------|----------------|-------------|
| `plugins_list` | — | List discovered source plugins |
| `config_get` | — | Read validated `config.json` |
| `config_create` | `init` | Create config (non-interactive) |
| `config_update` | `config` | Patch config fields |
| `catalog_get` | init/config wizard | Load volume catalog for a plugin |
| `manga_search` | init search field | Search manga (e.g. MangaDex) |
| `download` | `download` | Download configured volumes |
| `review` | `review` | Compare site catalog vs local files |
| `rename` | `rename` | Rename PDFs to Kindle-friendly names |
| `convert` | `convert` | Convert local files to another output format |

### Shared options (download, review, rename, convert)

| Field | Type | Description |
|-------|------|-------------|
| `volume` | string? | Limit to one volume |
| `dryRun` | boolean? | Simulate without writing files |
| `verbose` | boolean? | Detailed per-chapter logs |
| `quiet` | boolean? | Errors and summary only (default `true` in MCP) |

`download` and `convert` also accept `format`. `convert` accepts `force`.

### config_create

```json
{
  "source": "centralnovel",
  "pastaBase": "D:\\Biblioteca\\Novels",
  "pluginConfig": {
    "serieUrl": "https://centralnovel.com/series/example/",
    "volumes": ["1", "2"],
    "outputFormat": "chapters"
  },
  "seriesName": "My Series",
  "overwrite": false
}
```

### config_update

Partial patch — any combination of:

- `outputFormat`, `volumes`, `pastaBase`, `serieUrl`, `seriesName`
- `concurrency`, `retryDelayMs`, `requestTimeoutMs`, `maxRetries`
- `pluginConfig` (extra plugin-specific keys)
- `reloadVolumes: true` — refresh volumes after `serieUrl` change

## Resources

| URI | Description |
|-----|-------------|
| `config://current` | Validated config snapshot (JSON) |
| `plugin://{pluginId}` | Plugin metadata, `setupFields`, `outputFormats` |

## Architecture

```text
bin/mcp-server.js       Entry (stdio default, --http for HTTP)
lib/mcp/
  server.js             Tool/resource registration, transports
  handlers.js           Tool implementations
  execute.js            Bridge to lib/commands/*
  schemas.js            Zod input schemas
  responses.js          CallToolResult formatting
lib/config/programmatic.js   Non-interactive config API
```

MCP calls use `createCollectingLogger` so stdout stays clean for stdio transport. UI spinners are disabled (`quiet` mode).

## Related

- [COMMANDS.md](COMMANDS.md) — CLI reference
- [CONFIG.md](CONFIG.md) — config schema
