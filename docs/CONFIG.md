# Configuration reference

Configuration is stored in `config.json` at the project root. This file is **local** and must not be committed (see `.gitignore`). Use [`config.example.json`](../config.example.json) as a template.

## Schema

```json
{
  "source": "centralnovel",
  "pastaBase": "D:\\Library\\Novels",
  "pluginConfig": {
    "serieUrl": "https://example.com/series/name/",
    "volumes": ["1", "2"],
    "outputFormat": "chapters"
  },
  "seriesName": "Series Display Name",
  "concurrency": 3,
  "retryDelayMs": 5000,
  "requestTimeoutMs": 30000,
  "maxRetries": null
}
```

## Top-level fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `source` | Yes | `centralnovel` (inferred) | Plugin ID — must match a folder in `plugins/` |
| `pastaBase` | Yes | — | Root directory for downloads |
| `pluginConfig` | Yes | `{}` | Plugin-specific settings (see below) |
| `seriesName` | No | derived from `pastaBase` | Name used in PDF filenames |
| `concurrency` | No | `3` | Parallel chapter downloads (integer ≥ 1) |
| `retryDelayMs` | No | `5000` | Delay between HTTP retries (ms) |
| `requestTimeoutMs` | No | `30000` | Per-request timeout (ms, min 1000) |
| `maxRetries` | No | `null` | Max HTTP retries; `null` = unlimited |

## `pluginConfig`

Keys are defined by each plugin's `setupFields`. For Central Novel:

| Key | Type | Description |
|-----|------|-------------|
| `serieUrl` | string (URL) | Series page URL |
| `volumes` | string[] | Volume keys to download (from catalog) |
| `outputFormat` | string | `chapters`, `volume-single`, or `volume-single-only` |

Validation runs via `validatePluginConfig` in `lib/config/store.js` — each field's `required` and `validate` callbacks are applied.

## Output formats

| ID | Behavior |
|----|----------|
| `chapters` | One PDF per chapter in `Vol N/` subfolders |
| `volume-single` | Merged PDF at `{pastaBase}/{Series} - Vol NN.pdf`; chapter PDFs kept |
| `volume-single-only` | Merged PDF; chapter PDFs deleted after merge |

Available formats depend on the plugin's `outputFormats` array. Invalid IDs throw during validation.

## Legacy migration

`normalizeRawConfig` in `lib/config/store.js` handles old configs:

- Top-level `serieUrl` / `volumes` → moved into `pluginConfig`
- Missing `source` → inferred from URL (`centralnovel.com` → `centralnovel`)
- Missing `outputFormat` → defaults to `chapters`

## Volume lifecycle

After a volume downloads successfully, `removeVolumeFromConfig` removes it from `pluginConfig.volumes`. Re-add volumes via `manga-downloader config` or manual edit.

## Validation rules

`validateConfig` checks:

- `source`, `pastaBase`, `pluginConfig` present
- At least one volume in `pluginConfig.volumes` (unless `allowEmptyVolumes`)
- Valid `serieUrl` when required by plugin
- Numeric constraints on `concurrency`, `retryDelayMs`, etc.

CLI commands that need config call `resolveRuntime(configPath)` which normalizes and validates before running.

## Creating config

```bash
pnpm init
# or
node bin/manga-downloader.js init
```

Interactive wizard: pick source → base folder → plugin fields → optional series name.

## Editing config

```bash
pnpm config
# or
node bin/manga-downloader.js config
```

Requires existing `config.json`.

## Helpers

| Function | Module | Purpose |
|----------|--------|---------|
| `getSerieUrl(config)` | `lib/config/store.js` | Read `pluginConfig.serieUrl` |
| `getVolumes(config)` | `lib/config/store.js` | Read volume list as strings |
| `getOutputFormatSetting(config)` | `lib/config/store.js` | Read output format |
| `loadConfig` / `saveConfig` | `lib/config/store.js` | File I/O with validation |

## Related

- [COMMANDS.md](COMMANDS.md)
- [PLUGIN_AUTHORING.md](PLUGIN_AUTHORING.md)
