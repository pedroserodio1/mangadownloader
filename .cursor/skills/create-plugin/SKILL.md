---
name: create-plugin
description: >-
  Create or modify manga-downloader source plugins. Use when adding a new site,
  API source, image/PDF chapters, working under plugins/, or implementing
  parseSeriesPage or resolvePdfUrl.
---

# Create plugin

Add a download source to manga-downloader. Plugins are **source adapters** — not limited to HTML scrapers or PDFs.

## Before coding

1. Read [docs/PLUGIN_AUTHORING.md](../../docs/PLUGIN_AUTHORING.md) — patterns (HTML, API, hybrid) and content types (PDF, image)
2. Study [plugins/centralnovel/](../../plugins/centralnovel/) for HTML+PDF reference
3. Copy [plugins/_template/](../../plugins/_template/) to `plugins/<id>/`

## Choose a pattern

| Pattern | Modules | `parseSeriesPage` input |
|---------|---------|-------------------------|
| HTML scraper | `scraper.js`, `resolver.js` | HTML from series page |
| REST API | `catalog.js`, `resolver.js` | JSON string from API endpoint |
| Hybrid | both | Mixed |

| Content | `resolvePdfUrl` returns | Core support |
|---------|-------------------------|--------------|
| PDF | Direct PDF URL | Full |
| Image | Direct image URL | Partial — needs core extension for correct extensions/merge |

## Workflow

### 1. Scaffold

```text
plugins/<id>/
  index.js
  scraper.js | catalog.js   # pick by pattern
  resolver.js
```

**`id` must equal folder name.**

### 2. Implement contract

From [plugins/types.js](../../plugins/types.js):

| Required | Semantics |
|----------|-----------|
| `setupFields` | Maps to `config.pluginConfig` |
| `parseSeriesPage(body)` | Parse catalog from HTML or JSON body |
| `resolvePdfUrl(chapterRef, ctx)` | Resolve direct asset download URL |

`Chapter.pdfPageUrl` = opaque chapter reference (not necessarily PDF or a URL).

| Optional | When |
|----------|------|
| `enrichSetup` | Dynamic multiselect; API auth probe |
| `outputFormats` | PDF merge formats (copy from centralnovel) |
| `getChapterFilePatterns` | Legacy filename detection |
| `chapterContentType: 'image'` | Document intent; core ignores until extended |

### 3. HTTP and errors

- Use `ctx.http.fetchText`, `fetchJson`, `fetchBuffer` — not raw `fetch`
- Throw `AppError`; `{ retriable: false }` for permanent failures

### 4. Tests

```text
tests/plugins/<id>.test.js
tests/fixtures/<id>-series.html   # or .json for API
```

No live network in unit tests.

### 5. Verify

```bash
pnpm test
node bin/manga-downloader.js init
```

## Checklist

- [ ] `id` === folder name
- [ ] Catalog keys match `pluginConfig.volumes` values
- [ ] `resolvePdfUrl` returns direct download URL for asset type
- [ ] If image plugin: plan core changes (`extend-core` skill) or accept PDF-path limitation
- [ ] `pnpm test` passes

## Limitations

- `lib/config/edit.js` hardcodes `serieUrl`, `volumes`, `outputFormat`
- Image galleries (multi-file chapters) need core extension
- Merge/convert/review assume PDF today

## Reference

See [reference.md](reference.md) for HTML, API, and resolver snippets.
