# CLI commands reference

Entry point: [`bin/manga-downloader.js`](../bin/manga-downloader.js)

```bash
node bin/manga-downloader.js [command] [options]
# or via package.json scripts: pnpm start, pnpm init, etc.
```

## Commands

| Command | Requires config | Description |
|---------|-----------------|-------------|
| `init` | No | Interactive setup — creates `config.json` |
| `config` | Yes | Edit existing config (volumes, folder, URL) |
| `download` | Yes | Download configured volumes (**default** command) |
| `review` | Yes | Compare site catalog vs local PDFs |
| `rename` | Yes | Rename PDFs to Kindle-friendly pattern |
| `convert` | Yes | Convert local PDFs to another output format |

## Global options

| Option | Commands | Description |
|--------|----------|-------------|
| `--volume <n>` | download, review, rename, convert | Limit to one volume (e.g. `3` or `Extra`) |
| `--format <id>` | download, convert | Output format override |
| `--force` | convert | Merge even when chapters are missing |
| `--dry-run` | download, rename, convert | Simulate without writing files |
| `--quiet`, `-q` | all except init/config | Errors and summary only |
| `--verbose` | all except init/config | Per-chapter detailed logs |
| `--help`, `-h` | all | Print help |

**Conflicts:**

- `--quiet` and `--verbose` cannot be combined
- `review` does not support `--dry-run`
- `init` and `config` do not accept `--volume`, `--format`, or `--force`

## Examples

### Setup

```bash
pnpm init
pnpm config
```

### Download

```bash
pnpm start
node bin/manga-downloader.js download --volume 3
node bin/manga-downloader.js --dry-run
node bin/manga-downloader.js download --format volume-single
```

### Review and rename

```bash
pnpm review
pnpm rename --dry-run
node bin/manga-downloader.js rename --volume 1
```

### Convert (local only)

```bash
pnpm convert
node bin/manga-downloader.js convert --format volume-single-only
node bin/manga-downloader.js convert --format volume-single --volume 3 --force
```

`convert` never contacts the site — it only reads existing chapter PDFs from disk.

## Output file layout

### Chapters (`chapters`)

```text
{pastaBase}/Vol {n}/{Series} - Vol {nn} - Cap {nnn}.pdf
```

### Merged (`volume-single` / `volume-single-only`)

```text
{pastaBase}/{Series} - Vol {nn}.pdf
```

See [`lib/core/naming.js`](../lib/core/naming.js) for formatting rules.

## Exit codes

- `0` — success
- `1` — error (missing config, validation failure, download failures)

## Package.json scripts

| Script | Equivalent |
|--------|------------|
| `pnpm start` | `node bin/manga-downloader.js` (download) |
| `pnpm init` | `node bin/manga-downloader.js init` |
| `pnpm config` | `node bin/manga-downloader.js config` |
| `pnpm review` | `node bin/manga-downloader.js review` |
| `pnpm rename` | `node bin/manga-downloader.js rename` |
| `pnpm convert` | `node bin/manga-downloader.js convert` |
| `pnpm test` | `node --test tests/` |

## Related

- [CONFIG.md](CONFIG.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
