# Core extension hook points

## resolveRuntime (`lib/shared/runtime.js`)

Entry point for all config-backed commands:

```javascript
const { config, plugin } = await resolveRuntime(configPath, { allowEmptyVolumes });
const http = createHttpForConfig(config, logger);
const catalog = await loadCatalog({ config, http, plugin, logger });
```

## validateConfig (`lib/config/store.js`)

Add top-level fields here with validation + defaults in `DEFAULTS`.

Plugin fields validated via `validatePluginConfig(plugin, pluginConfig)`.

## Output format registry (`lib/output/registry.js`)

```javascript
export function getOutputFormats(plugin) {
  return plugin.outputFormats ?? [{ id: "chapters", label: "...", default: true }];
}
```

Plugins can override `outputFormats`; core merge logic is in `finalize.js`.

## createMatchChapter (`lib/shared/runtime.js`)

Wraps `chapterExists` with plugin `getChapterFilePatterns`. Used by download, review, rename.

## Plugin loader (`lib/plugins/loader.js`)

Skips directories starting with `_`. To exclude other patterns, add filter in `discoverPlugins` loop.

## Command template

```javascript
export async function runMyCommand({ cli, configPath, logger }) {
  const { config, plugin } = await resolveRuntime(configPath);
  const http = createHttpForConfig(config, logger);
  // ...
}
```
