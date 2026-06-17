---
name: use-cli
description: >-
  Operate manga-downloader CLI — init, config, download, review, rename, convert.
  Use when configuring downloads, troubleshooting CLI behavior, output formats,
  or config.json questions.
---

# Use CLI

End-user docs (Portuguese): [README.md](../../README.md). Technical reference: [docs/COMMANDS.md](../../docs/COMMANDS.md), [docs/CONFIG.md](../../docs/CONFIG.md).

## Commands

| Command | Config required | Purpose |
|---------|-----------------|---------|
| `init` | No | Create `config.json` interactively |
| `config` | Yes | Edit volumes, folder, URL |
| `download` | Yes | Download (default) |
| `review` | Yes | Site catalog vs local PDFs |
| `rename` | Yes | Kindle-style rename |
| `convert` | Yes | Local format conversion (no network) |

```bash
node bin/manga-downloader.js [command] [options]
pnpm start    # download
pnpm init
pnpm config
pnpm review
pnpm rename
pnpm convert
```

## Common flags

| Flag | Use |
|------|-----|
| `--volume <n>` | Single volume (`3`, `Extra`) |
| `--format <id>` | `chapters`, `volume-single`, `volume-single-only` |
| `--dry-run` | Simulate (download, rename, convert) |
| `--verbose` | Detailed per-chapter logs |
| `--quiet` | Errors + summary only |
| `--force` | Partial merge on convert |

## Config shape

```json
{
  "source": "centralnovel",
  "pastaBase": "D:\\Library",
  "pluginConfig": {
    "serieUrl": "https://...",
    "volumes": ["1", "2"],
    "outputFormat": "chapters"
  },
  "seriesName": "Optional",
  "concurrency": 3
}
```

See [config.example.json](../../config.example.json). **Never commit `config.json`.**

## Output formats

| ID | Result |
|----|--------|
| `chapters` | `{pastaBase}/Vol N/{Series} - Vol NN - Cap NNN.pdf` |
| `volume-single` | `{pastaBase}/{Series} - Vol NN.pdf` + keep chapters |
| `volume-single-only` | Merged PDF, delete chapter files |

Download always writes chapters first; merge runs at end of each volume.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| "Execute init primeiro" | Run `pnpm init` |
| Volume not in catalog | `pluginConfig.volumes` key must match site catalog keys |
| Re-downloading existing | Filename mismatch — plugin `getChapterFilePatterns` |
| Merge wrong order | Cap IDs must sort naturally (`1-1-2` before `1-1-10`) |
| Convert does nothing | Needs chapter PDFs on disk; use `--verbose` |

## Safe debugging

```bash
node bin/manga-downloader.js --dry-run --verbose
node bin/manga-downloader.js review
```

`convert` never contacts the site.
