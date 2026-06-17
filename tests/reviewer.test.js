import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { getVolumeDir } from "../lib/core/paths.js";
import { reviewAll, reviewVolume } from "../lib/review/reviewer.js";
import { getChaptersForVolume } from "../lib/core/catalog.js";
import { parseSeriesPage } from "../plugins/centralnovel/scraper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function chapter(capId) {
  return { capId, pdfPageUrl: `https://centralnovel.com/capitulo-${capId}/` };
}

describe("reviewVolume", () => {
  it("marca volume completo quando todos os capítulos existem localmente", () => {
    const result = reviewVolume({
      volumeKey: "1",
      siteChapters: [chapter("101"), chapter("102")],
      localPdfFiles: ["Capitulo 101.pdf", "Capitulo 102.pdf"],
      volumeDirExists: true,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.orphan, []);
    assert.deepEqual(result.gaps, []);
    assert.equal(result.newVolume, false);
    assert.equal(result.emptyDir, false);
  });

  it("detecta capítulos faltando no disco", () => {
    const result = reviewVolume({
      volumeKey: "1",
      siteChapters: [chapter("101"), chapter("102")],
      localPdfFiles: ["Capitulo 101.pdf"],
      volumeDirExists: true,
    });

    assert.equal(result.ok, false);
    assert.deepEqual(result.missing, ["102"]);
  });

  it("detecta PDFs órfãos locais", () => {
    const result = reviewVolume({
      volumeKey: "1",
      siteChapters: [chapter("101")],
      localPdfFiles: ["Capitulo 101.pdf", "extra.pdf"],
      volumeDirExists: true,
    });

    assert.deepEqual(result.orphan, ["extra.pdf"]);
  });

  it("detecta lacunas numéricas no catálogo do site", () => {
    const result = reviewVolume({
      volumeKey: "1",
      siteChapters: [chapter("101"), chapter("103")],
      localPdfFiles: ["Capitulo 101.pdf", "Capitulo 103.pdf"],
      volumeDirExists: true,
    });

    assert.deepEqual(result.gaps, ["102"]);
    assert.equal(result.ok, true);
  });

  it("marca volume novo quando pasta não existe", () => {
    const result = reviewVolume({
      volumeKey: "5",
      siteChapters: [chapter("501"), chapter("502")],
      localPdfFiles: [],
      volumeDirExists: false,
    });

    assert.equal(result.newVolume, true);
    assert.equal(result.emptyDir, false);
    assert.deepEqual(result.missing, ["501", "502"]);
    assert.equal(result.ok, false);
  });

  it("marca emptyDir quando pasta existe sem PDFs", () => {
    const result = reviewVolume({
      volumeKey: "2",
      siteChapters: [chapter("201")],
      localPdfFiles: [],
      volumeDirExists: true,
    });

    assert.equal(result.emptyDir, true);
    assert.equal(result.ok, false);
    assert.deepEqual(result.missing, ["201"]);
  });
});

describe("reviewAll", () => {
  it("agrega resultados de múltiplos volumes", () => {
    const chaptersByVolume = new Map([
      ["1", [chapter("101"), chapter("102")]],
      ["2", [chapter("201")]],
    ]);

    const localFilesByVolume = new Map([
      ["1", ["Capitulo 101.pdf"]],
      ["2", ["Capitulo 201.pdf"]],
    ]);

    const volumeDirExistsByVolume = new Map([
      ["1", true],
      ["2", true],
    ]);

    const { volumes, summary } = reviewAll({
      chaptersByVolume,
      localFilesByVolume,
      volumeDirExistsByVolume,
    });

    assert.equal(volumes.length, 2);
    assert.equal(summary.volumesAnalyzed, 2);
    assert.equal(summary.missing, 1);
    assert.equal(summary.ok, false);
  });

  it("integra com parseSeriesPage e filesystem temporário", async () => {
    const html = await fs.readFile(
      path.join(__dirname, "fixtures", "series.html"),
      "utf-8"
    );
    const chaptersByVolume = parseSeriesPage(html);
    const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), "review-test-"));

    const vol1Dir = getVolumeDir(tmpBase, "1");
    await fs.mkdir(vol1Dir, { recursive: true });
    await fs.writeFile(path.join(vol1Dir, "Capitulo 101.pdf"), "pdf");

    const localFilesByVolume = new Map();
    const volumeDirExistsByVolume = new Map();

    for (const volumeKey of chaptersByVolume.keys()) {
      const volumeDir = getVolumeDir(tmpBase, volumeKey);
      volumeDirExistsByVolume.set(
        volumeKey,
        await fs
          .access(volumeDir)
          .then(() => true)
          .catch(() => false)
      );

      try {
        const files = await fs.readdir(volumeDir);
        localFilesByVolume.set(
          volumeKey,
          files.filter((f) => f.endsWith(".pdf"))
        );
      } catch {
        localFilesByVolume.set(volumeKey, []);
      }
    }

    const filtered = new Map([["1", getChaptersForVolume(chaptersByVolume, "1")]]);

    const { volumes, summary } = reviewAll({
      chaptersByVolume: filtered,
      localFilesByVolume,
      volumeDirExistsByVolume,
    });

    assert.equal(volumes.length, 1);
    assert.deepEqual(volumes[0].missing, ["102"]);
    assert.equal(summary.missing, 1);

    await fs.rm(tmpBase, { recursive: true, force: true });
  });
});
