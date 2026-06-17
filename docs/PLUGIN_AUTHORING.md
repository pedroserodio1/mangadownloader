# Plugin authoring guide

This guide explains how to add a new download source to manga-downloader.

Plugins are **source adapters**, not necessarily HTML scrapers. A plugin fetches a **catalog** (list of chapters per volume) and resolves each chapter to a **downloadable asset**. The reference implementation ([`plugins/centralnovel/`](../plugins/centralnovel/)) is an HTML scraper that outputs PDFs — other patterns are supported within the same contract (see below).

## Plugin acquisition patterns

| Pattern | Catalog source | Typical modules | Example `serieUrl` |
|---------|----------------|-----------------|-------------------|
| **HTML scraper** | Parse page HTML with cheerio | `scraper.js`, `resolver.js` | Series page URL |
| **REST API** | Parse JSON from `fetchText` / `fetchJson` in `enrichSetup` | `catalog.js`, `resolver.js` | API series endpoint |
| **Hybrid** | API for catalog, HTML for asset resolution | both | API base URL + chapter pages |

Method names (`parseSeriesPage`, `resolvePdfUrl`) are **historical**. Treat them as:

- `parseSeriesPage(body)` → **parse catalog** from any text body (HTML or JSON string)
- `resolvePdfUrl(chapterRef, ctx)` → **resolve direct asset URL** (PDF, image, etc.)

`pdfPageUrl` on `Chapter` is an opaque **chapter reference** — not required to be a PDF link.

### API plugin sketch

```javascript
// catalog.js — parseSeriesPage receives JSON string from loadCatalog
export function parseSeriesPage(body) {
  const data = JSON.parse(body);
  const catalog = new Map();
  for (const vol of data.volumes) {
    catalog.set(String(vol.id), vol.chapters.map((ch) => ({
      capId: String(ch.id),
      pdfPageUrl: ch.apiPath, // e.g. "/chapters/42" or full URL
    })));
  }
  return catalog;
}

// resolver.js
export async function resolvePdfUrl(chapterRef, { http }) {
  const url = chapterRef.startsWith("http") ? chapterRef : `${API_BASE}${chapterRef}`;
  const { downloadUrl } = await http.fetchJson(url);
  return downloadUrl;
}
```

Use `http.fetchJson` in `enrichSetup` when the wizard needs live API data before `serieUrl` is saved.

## Chapter content types

| Type | Plugin returns | Core support today |
|------|----------------|------------------|
| **PDF** | Direct PDF URL from `resolvePdfUrl` | Full — download, merge, convert, review |
| **Image** (single file per chapter) | Direct image URL | **Partial** — downloader saves bytes but always uses `.pdf` extension and PDF-centric review/merge |
| **Image gallery** (many images → one chapter) | Not supported in one `resolvePdfUrl` call | Requires **core extension** (multi-fetch + assemble) |

Optional plugin field `chapterContentType: 'pdf' | 'image'` (see `plugins/types.js`) documents intent; core does not read it yet.

**To add full image support**, extend core (see `extend-core` skill): custom extensions in naming, `listChapterFiles`, downloader write path, and optional image→PDF or CBZ output. Do not hack image bytes into `.pdf` filenames.

## Quick checklist

1. Copy `plugins/_template/` to `plugins/<your-id>/` (or create from scratch)
2. Set `id` to match the folder name exactly
3. Implement `setupFields`, `parseSeriesPage`, `resolvePdfUrl`
4. Add `enrichSetup` if using dynamic `multiselect`/`select` fields
5. Add tests in `tests/plugins/<your-id>.test.js` with fixtures (HTML, JSON, etc.)
6. Run `pnpm test`
7. Run `node bin/manga-downloader.js init` — your source should appear in the list

## Contract (`SourcePlugin`)

Defined in [`plugins/types.js`](../plugins/types.js).

### Types

```javascript
// Chapter in catalog
{ capId: string, pdfPageUrl: string }  // pdfPageUrl = opaque chapterRef

// Catalog: volume key → chapters
Map<string, Chapter[]>

// Setup field types
'text' | 'url' | 'tags' | 'multiselect' | 'select' | 'confirm'
```

### Required properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Must equal folder name under `plugins/` |
| `name` | string | Display name in init wizard |
| `setupFields` | `SetupField[]` | Config fields stored in `pluginConfig` |
| `parseSeriesPage` | `(body: string) => Catalog` | Parse catalog from response body (HTML or JSON) |
| `resolvePdfUrl` | `(chapterRef, ctx) => Promise<string>` | Resolve direct download URL for chapter asset |

### Optional properties

| Property | Type | Description |
|----------|------|-------------|
| `description` | string | Hint in source picker |
| `outputFormats` | `OutputFormatDef[]` | Custom output formats (default: chapters only) |
| `defaultOutputFormat` | string | Default format ID |
| `enrichSetup` | `(ctx) => Promise<Record<string, SetupOption[]>>` | Dynamic options for select fields |
| `getChapterFilePatterns` | `(capId) => RegExp[]` | Legacy filename patterns for skip/review/rename |
| `chapterContentType` | `'pdf' \| 'image'` | Documents intent; core ignores until extended |

### Export

Any of these work:

```javascript
export default myPlugin;
// export const plugin = myPlugin;
// export { myPlugin as plugin };
```

## Recommended folder structure

Name modules by responsibility, not by technology:

```text
plugins/mysource/
  index.js       # SourcePlugin object + setupFields + enrichSetup
  scraper.js     # HTML → catalog (scraper pattern)
  catalog.js     # JSON/API → catalog (API pattern)
  resolver.js    # chapterRef → direct asset URL
```

Pick `scraper.js` **or** `catalog.js` (or both for hybrid). See [`plugins/centralnovel/`](../plugins/centralnovel/) for the HTML scraper reference.

## `parseSeriesPage(body)`

`loadCatalog` fetches `pluginConfig.serieUrl` with `http.fetchText` and passes the raw body to this function. It may be HTML, JSON, or any text your plugin expects.

Return a `Map` where:

- **Keys** = volume identifiers used in `pluginConfig.volumes` (e.g. `"1"`, `"2"`, `"Extra"`)
- **Values** = arrays of `{ capId, pdfPageUrl }` (`pdfPageUrl` = chapter reference)
- `resolvePdfUrl` turns each reference into a direct download URL

Example — HTML (Central Novel uses cheerio):

```javascript
export function parseSeriesPage(html) {
  const $ = cheerio.load(html);
  const catalog = new Map();
  // ... populate catalog
  return catalog;
}
```

Example — JSON API:

```javascript
export function parseSeriesPage(body) {
  const data = JSON.parse(body);
  const catalog = new Map();
  // ... populate from API shape
  return catalog;
}
```

Use `lib/core/catalog.js` → `getChaptersForVolume(catalog, volumeKey)` in tests.

## `resolvePdfUrl(chapterRef, ctx)`

Resolves a chapter reference to a **direct download URL**. For PDF plugins, returns a PDF URL. For image plugins (once core supports them), returns an image URL.

```javascript
/**
 * @param {string} chapterRef - value from Chapter.pdfPageUrl
 * @param {import('../types.js').ResolvePdfContext} ctx
 * @returns {Promise<string>} direct asset download URL
 */
export async function resolvePdfUrl(chapterRef, { http, logger }) {
  // HTML page → extract URL, or API call → download link, or pass-through if already direct
  const html = await http.fetchText(chapterRef);
  return directUrl;
}
```

- Use `ctx.http` — never raw `fetch` (retries/timeouts come from config)
- Throw `AppError` from `lib/shared/errors.js` for failures
- Set `{ retriable: false }` for permanent errors (bad HTML, missing post ID)

## `setupFields` and `enrichSetup`

Fields map to `config.pluginConfig.<key>`.

```javascript
setupFields: [
  {
    key: "serieUrl",
    type: "url",
    label: "Series URL",
    required: true,
    validate(value) {
      if (!value?.trim()) return "URL is required.";
      try { new URL(value); } catch { return "Invalid URL."; }
    },
  },
  {
    key: "volumes",
    type: "multiselect",
    label: "Volumes to download",
    required: true,
    validate(value) {
      if (!Array.isArray(value) || value.length === 0) {
        return "Select at least one volume.";
      }
    },
  },
],
```

For `multiselect`/`select` without static options, implement `enrichSetup`:

```javascript
async enrichSetup({ values, http }) {
  const html = await http.fetchText(values.serieUrl);
  const catalog = parseSeriesPage(html);
  return {
    volumes: [...catalog.entries()].map(([key, chapters]) => ({
      value: key,
      label: `Volume ${key}`,
      hint: `${chapters.length} chapter(s)`,
    })),
  };
},
```

For output formats, reuse `outputFormatSetupOptions(plugin)` from `lib/output/registry.js` and add an `outputFormat` select field (see centralnovel).

## `getChapterFilePatterns(capId)`

The core matches standard names like `Cap 001`. If your site used legacy names, return extra regexes:

```javascript
getChapterFilePatterns(capId) {
  const id = String(capId).trim();
  return [new RegExp(`legacy-${escapeRegex(id)}`, "i")];
},
```

Used by download (skip existing), review, and rename via `createMatchChapter(plugin)`.

## Output formats (optional)

If omitted, only `chapters` is available. To support merge formats, copy from centralnovel:

```javascript
outputFormats: [
  { id: "chapters", label: "Separate chapters", default: true },
  { id: "volume-single", label: "Single PDF per volume", description: "..." },
  { id: "volume-single-only", label: "Single PDF (no chapters)", description: "..." },
],
defaultOutputFormat: "chapters",
```

## Testing

### Catalog tests

1. Save fixture in `tests/fixtures/` — `.html`, `.json`, etc.
2. Test `parseSeriesPage` returns expected volume keys and cap IDs
3. Test URL/API extraction helpers in isolation

### Plugin contract test

```javascript
import myPlugin from "../../plugins/mysource/index.js";

it("exports valid contract", () => {
  assert.equal(myPlugin.id, "mysource");
  assert.ok(typeof myPlugin.parseSeriesPage === "function");
  assert.ok(typeof myPlugin.resolvePdfUrl === "function");
});
```

### Loader tests

`tests/plugins/loader.test.js` — discovery picks up your plugin after `clearPluginCache()`.

Run: `pnpm test`

## Known limitation: config edit wizard

[`lib/config/edit.js`](../lib/config/edit.js) hardcodes `serieUrl`, `volumes`, and `outputFormat`. Plugins with different `setupFields` keys work in `init` but `config` edit may need a core change to support custom fields.

## Troubleshooting

| Problem | Likely cause | Fix |
|---------|--------------|-----|
| Plugin not listed | Missing `index.js` or `id !== folder` | Check loader validation errors |
| Empty volume list | `enrichSetup` not populating options | Fetch serieUrl, call `parseSeriesPage` |
| 403 / blocked requests | Missing referer or rate limit | HTTP client sets referer from serieUrl; lower `concurrency` |
| HTML parse returns empty | Site markup changed | Update selectors; add fixture from live response |
| API parse fails | Wrong endpoint or auth | Fetch in `enrichSetup` with `fetchJson`; validate fixture JSON |
| Image chapter wrong file type | Core assumes PDF | Extend core for `chapterContentType: 'image'` (see extend-core skill) |
| Wrong chapter order in merge | Cap ID sort | Use natural segment sort (`1-1-2` before `1-1-10`) — core handles this if cap IDs are consistent |
| Chapters re-downloaded | Filename mismatch | Implement `getChapterFilePatterns` for legacy names |

## Scaffold

Copy [`plugins/_template/`](../plugins/_template/) to start. The `_template` folder is excluded from discovery.

## Related

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [CONFIG.md](CONFIG.md)
- Skill: `.cursor/skills/create-plugin/SKILL.md`
