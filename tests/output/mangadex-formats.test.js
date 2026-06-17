import assert from "node:assert/strict";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import { assemblePdfFromImages } from "../../lib/output/assemble-pdf.js";
import { archiveExtension, isVolumeArchiveFormat } from "../../lib/output/archive.js";
import { finalizeVolume } from "../../lib/output/finalize.js";
import { writeChapterOutput } from "../../lib/output/write-chapter.js";
import { createArchiveFromBuffers } from "../../lib/output/zip.js";

// Minimal valid 1x1 PNG
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

describe("mangadex output formats", () => {
  it("assemblePdfFromImages produz PDF válido", async () => {
    const pdf = await assemblePdfFromImages([
      { index: 0, buffer: TINY_PNG, filename: "1.png" },
    ]);
    const doc = await PDFDocument.load(pdf);
    assert.equal(doc.getPageCount(), 1);
  });

  it("archiveExtension distingue zip e cbz", () => {
    assert.equal(archiveExtension("zip-chapter"), ".zip");
    assert.equal(archiveExtension("cbz-volume"), ".cbz");
    assert.ok(isVolumeArchiveFormat("zip-volume"));
  });

  it("writeChapterOutput formato folder cria imagens", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "md-folder-"));
    try {
      const dir = await writeChapterOutput({
        format: "folder",
        pages: [{ index: 0, buffer: TINY_PNG, filename: "a.png" }],
        volumeKey: "1",
        capId: "1",
        seriesName: "Test",
        pastaBase: tmp,
      });
      const files = await fs.readdir(dir);
      assert.equal(files.length, 1);
      assert.match(files[0], /\.png$/);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("createArchiveFromBuffers gera zip legível", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "md-zip-"));
    const zipPath = path.join(tmp, "test.zip");
    try {
      await createArchiveFromBuffers(zipPath, [
        { name: "001.png", buffer: TINY_PNG },
      ]);
      const stat = await fs.stat(zipPath);
      assert.ok(stat.size > 0);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("finalizeVolume zip-volume compacta staging", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "md-volzip-"));
    const staging = path.join(tmp, ".manga-downloader-staging", "Vol 1", "Cap 001");
    await fs.mkdir(staging, { recursive: true });
    await fs.writeFile(path.join(staging, "001.png"), TINY_PNG);

    const config = {
      pastaBase: tmp,
      seriesName: "Serie",
      pluginConfig: { outputFormat: "zip-volume" },
    };

    const result = await finalizeVolume({
      format: "zip-volume",
      volumeKey: "1",
      config,
      catalogChapters: [],
    });

    assert.equal(result.status, "finalized");
    assert.ok(result.mergedPath.endsWith(".zip"));
    await fs.access(result.mergedPath);
  });
});
