# AI agent guide — manga-downloader

CLI for downloading light-novel PDFs with a plugin-based architecture. Read this file first when working in this repository.

## Stack

- **Node.js 18+**, ESM (`"type": "module"`), **no build step**
- **pnpm** for package management (`pnpm install`, `pnpm test`)
- Tests: `node --test` via `pnpm test`

## Directory map

| Path | Purpose |
|------|---------|
| `bin/manga-downloader.js` | CLI entry — command routing |
| `bin/mcp-server.js` | MCP server entry (stdio / HTTP) |
| `plugins/types.js` | `SourcePlugin` contract (JSDoc) |
| `plugins/<id>/index.js` | Plugin entry (auto-discovered) |
| `plugins/centralnovel/` | **Reference plugin** — copy this pattern |
| `plugins/_template/` | Scaffold (not loaded; copy to create plugins) |
| `lib/` | Core — config, download, output, HTTP, commands |
| `tests/` | Unit tests + `tests/fixtures/` HTML samples |
| `docs/` | Developer documentation (English) |
| `.cursor/skills/` | Project skills for specialized workflows |
| `.cursor/rules/` | Cursor rules (auto-applied by file scope) |

## When to read what

| Task | Start here |
|------|------------|
| Add a new source/site | [docs/PLUGIN_AUTHORING.md](docs/PLUGIN_AUTHORING.md) + `.cursor/skills/create-plugin/` |
| Use or debug CLI | [docs/COMMANDS.md](docs/COMMANDS.md) + `.cursor/skills/use-cli/` |
| MCP server setup | [docs/MCP.md](docs/MCP.md) |
| Change core (not plugins) | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) + `.cursor/skills/extend-core/` |
| Config schema | [docs/CONFIG.md](docs/CONFIG.md) |
| End-user usage (Portuguese) | [README.md](README.md) |

## Non-negotiables

1. **`plugin.id` must equal the folder name** under `plugins/` (validated by loader).
2. **Run `pnpm test`** after any code change.
3. **Never commit `config.json`** — it contains local paths; use `config.example.json` as reference.
4. **Source-specific acquisition belongs in plugins** — HTML, API, or hybrid; not in `lib/`.
5. **Use the injected HTTP client** in plugins (`ctx.http`) — not raw `fetch`.
6. **User-facing CLI messages stay in Portuguese** — AI docs and skills are in English.
7. **Keep changes minimal** — match existing patterns in `plugins/centralnovel/` and surrounding `lib/` code.

## Plugin contract (summary)

Required on every plugin (`plugins/types.js`):

- `id`, `name`, `setupFields`
- `parseSeriesPage(body)` → catalog (`Map<volumeKey, chapters[]>`). Body may be HTML or JSON.
- `resolvePdfUrl(chapterRef, { http, logger })` → direct download URL for chapter asset

`Chapter.pdfPageUrl` is an opaque **chapter reference** (URL, API path, ID) — not necessarily a PDF.

Optional: `enrichSetup`, `outputFormats`, `getChapterFilePatterns`, `chapterContentType` (`pdf`|`image`), `description`.

**PDF plugins**: fully supported. **Image plugins**: partial — core writes `.pdf` paths today; full support needs `extend-core`.

Discovery: `lib/plugins/loader.js` — folders with `index.js`, skipping `_` prefixes.

## Quick verification

```bash
pnpm test
node bin/manga-downloader.js init    # lists all plugins
node bin/manga-downloader.js --help
pnpm mcp                             # MCP stdio server
```

## Known limitation

`lib/config/edit.js` hardcodes `serieUrl`, `volumes`, `outputFormat`. Custom plugin field keys work in `init` but may need core changes for `config` edit.
