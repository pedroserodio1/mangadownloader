# Plugin template

This folder is **not loaded** by the plugin loader (directories starting with `_` are skipped).

## Usage

1. Copy this folder to `plugins/<your-id>/`
2. Rename `id` in `index.js` to match the folder name
3. Implement catalog + resolver for your source type:

| Source type | Implement in | Delete |
|-------------|--------------|--------|
| HTML scraper | `scraper.js` | `catalog.js` if unused |
| REST API | `catalog.js` | `scraper.js` if unused |
| Hybrid | both | — |

4. Add tests in `tests/plugins/<your-id>.test.js` (fixtures: `.html`, `.json`, …)
5. Run `pnpm test` and `node bin/manga-downloader.js init`

See [docs/PLUGIN_AUTHORING.md](../../docs/PLUGIN_AUTHORING.md) for HTML, API, and image content patterns.
