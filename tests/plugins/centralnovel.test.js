import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { getChaptersForVolume } from "../../lib/core/catalog.js";
import {
  extractCapIdFromUrl,
  extractPostIdFromHtml,
  extractVolumeKeyFromLabel,
  parseSeriesPage,
  volumeLabelMatches,
} from "../../plugins/centralnovel/scraper.js";
import centralnovelPlugin from "../../plugins/centralnovel/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("centralnovel scraper", () => {
  it("volumeLabelMatches trata Extra", () => {
    assert.equal(volumeLabelMatches("Volume Extra", "Extra"), true);
    assert.equal(volumeLabelMatches("Volume Extras", "Extra"), true);
    assert.equal(volumeLabelMatches("Volume 1", "1"), true);
    assert.equal(volumeLabelMatches("Volume 1", "2"), false);
  });

  it("extractCapIdFromUrl aceita capitulo e extra", () => {
    assert.equal(extractCapIdFromUrl("https://site/capitulo-42/"), "42");
    assert.equal(extractCapIdFromUrl("https://site/extra-side-story/"), "side-story");
    assert.equal(extractCapIdFromUrl("https://site/outro/"), null);
  });

  it("extractPostIdFromHtml encontra post_id em JSON e atributo", () => {
    assert.equal(extractPostIdFromHtml('"post_id": 12345'), "12345");
    assert.equal(extractPostIdFromHtml('<div data-post-id="999"></div>'), "999");
    assert.equal(extractPostIdFromHtml("<html></html>"), null);
  });

  it("parseSeriesPage agrupa capítulos por volume", async () => {
    const html = await fs.readFile(
      path.join(__dirname, "..", "fixtures", "series.html"),
      "utf-8"
    );
    const map = parseSeriesPage(html);

    assert.equal(extractVolumeKeyFromLabel("Volume 1"), "1");
    assert.deepEqual(getChaptersForVolume(map, "1").map((c) => c.capId), [
      "101",
      "102",
    ]);
    assert.deepEqual(getChaptersForVolume(map, "Extra").map((c) => c.capId), [
      "side-story",
    ]);
  });
});

describe("centralnovel plugin", () => {
  it("exporta contrato válido", () => {
    assert.equal(centralnovelPlugin.id, "centralnovel");
    assert.equal(centralnovelPlugin.name, "Central Novel");
    assert.ok(Array.isArray(centralnovelPlugin.setupFields));
    assert.equal(typeof centralnovelPlugin.parseSeriesPage, "function");
    assert.equal(typeof centralnovelPlugin.resolvePdfUrl, "function");
  });

  it("getChapterFilePatterns reconhece nomes legados", () => {
    const patterns = centralnovelPlugin.getChapterFilePatterns("54");
    assert.equal(chapterExistsWithPatterns("54", ["capitulo-54-centralnovel.com.pdf"], patterns), true);
  });
});

function chapterExistsWithPatterns(capId, files, patterns) {
  return files.some((name) => patterns.some((p) => p.test(name)));
}
