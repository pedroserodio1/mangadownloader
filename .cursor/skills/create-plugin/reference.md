# Plugin skeleton snippets

## index.js (common)

```javascript
import { parseSeriesPage } from "./catalog.js"; // or ./scraper.js
import { resolvePdfUrl } from "./resolver.js";

/** @type {import('../types.js').SourcePlugin} */
const mysourcePlugin = {
  id: "mysource",
  name: "My Source",
  description: "API / scraper / hybrid — short description",
  // chapterContentType: "pdf",  // or "image" (needs core extension)

  setupFields: [ /* ... see SKILL.md */ ],

  async enrichSetup({ values, http }) {
    const body = await http.fetchText(values.serieUrl);
    const catalog = parseSeriesPage(body);
    return {
      volumes: [...catalog.entries()].map(([key, chapters]) => ({
        value: key,
        label: `Volume ${key}`,
        hint: `${chapters.length} capítulo(s)`,
      })),
    };
  },

  parseSeriesPage,
  resolvePdfUrl,
};

export default mysourcePlugin;
```

## catalog.js — REST API pattern

```javascript
/**
 * @param {string} body - JSON string from loadCatalog (fetchText on API URL)
 * @returns {import('../types.js').Catalog}
 */
export function parseSeriesPage(body) {
  const data = JSON.parse(body);
  const catalog = new Map();

  for (const vol of data.volumes ?? []) {
    const chapters = (vol.chapters ?? []).map((ch) => ({
      capId: String(ch.id),
      pdfPageUrl: ch.downloadPath ?? ch.url, // chapterRef — API path or URL
    }));
    catalog.set(String(vol.id), chapters);
  }

  return catalog;
}
```

## scraper.js — HTML pattern

```javascript
import * as cheerio from "cheerio";

/** @param {string} body - HTML from series page */
export function parseSeriesPage(body) {
  const $ = cheerio.load(body);
  const catalog = new Map();
  // TODO: populate catalog
  return catalog;
}
```

## resolver.js — PDF via HTML page

```javascript
import { AppError } from "../../lib/shared/errors.js";

export async function resolvePdfUrl(chapterRef, { http, logger }) {
  // Pass-through if already a direct file URL
  if (/\.pdf(\?|$)/i.test(chapterRef)) return chapterRef;

  const html = await http.fetchText(chapterRef);
  const directUrl = extractPdfUrlFromHtml(html);
  if (!directUrl) {
    throw new AppError("Não foi possível resolver URL do asset.", { retriable: false });
  }
  logger.verbose(`Asset resolvido: ${directUrl}`);
  return directUrl;
}
```

## resolver.js — API pattern

```javascript
import { AppError } from "../../lib/shared/errors.js";

const API_BASE = "https://api.example.com";

export async function resolvePdfUrl(chapterRef, { http, logger }) {
  const url = chapterRef.startsWith("http") ? chapterRef : `${API_BASE}${chapterRef}`;
  const meta = await http.fetchJson(url);
  const directUrl = meta.downloadUrl ?? meta.url;
  if (!directUrl) {
    throw new AppError("API não retornou URL de download.", { retriable: false });
  }
  logger.verbose(`Asset resolvido: ${directUrl}`);
  return directUrl;
}
```

## resolver.js — image (direct URL)

```javascript
export async function resolvePdfUrl(chapterRef, { logger }) {
  // Returns image URL — core still writes .pdf filename until extended
  logger.verbose(`Image URL: ${chapterRef}`);
  return chapterRef;
}
```

## Test stub

```javascript
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseSeriesPage } from "../../plugins/mysource/catalog.js";
import mysourcePlugin from "../../plugins/mysource/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("mysource catalog", () => {
  it("parseSeriesPage from JSON fixture", async () => {
    const body = await fs.readFile(
      path.join(__dirname, "..", "fixtures", "mysource-series.json"),
      "utf-8"
    );
    const catalog = parseSeriesPage(body);
    assert.ok(catalog.has("1"));
  });
});

describe("mysource plugin", () => {
  it("exports valid contract", () => {
    assert.equal(mysourcePlugin.id, "mysource");
    assert.ok(typeof mysourcePlugin.parseSeriesPage === "function");
    assert.ok(typeof mysourcePlugin.resolvePdfUrl === "function");
  });
});
```
