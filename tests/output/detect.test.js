import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  detectVolumeState,
  isTargetFormat,
  resolveChapterFiles,
} from "../../lib/output/detect.js";
import { buildPdfFileName, buildVolumePdfFileName } from "../../lib/core/naming.js";
import { chapterExists } from "../../lib/shared/utils.js";
import { createMinimalPdf } from "../../lib/output/merge-pdf.js";

describe("detectVolumeState", () => {
  const seriesName = "Slime";
  const volumeKey = "3";
  const catalogChapters = [{ capId: "1" }, { capId: "2" }];

  async function setupChapterFiles(baseDir, capIds) {
    const volumeDir = path.join(baseDir, `Vol ${volumeKey}`);
    await fs.mkdir(volumeDir, { recursive: true });

    for (const capId of capIds) {
      const name = buildPdfFileName({ seriesName, volumeKey, capId });
      await fs.writeFile(path.join(volumeDir, name), await createMinimalPdf(capId));
    }
  }

  it("detecta chapters quando só há caps completos", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "detect-"));
    await setupChapterFiles(baseDir, ["1", "2"]);

    const state = await detectVolumeState({
      volumeKey,
      catalogChapters,
      pastaBase: baseDir,
      seriesName,
      matchChapter: chapterExists,
    });

    assert.equal(state.state, "chapters");
    assert.equal(state.complete, true);
    assert.equal(isTargetFormat(state, "chapters"), true);

    await fs.rm(baseDir, { recursive: true, force: true });
  });

  it("detecta volume-single com merged e caps", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "detect-"));
    await setupChapterFiles(baseDir, ["1", "2"]);
    const mergedName = buildVolumePdfFileName({ seriesName, volumeKey });
    await fs.writeFile(path.join(baseDir, mergedName), await createMinimalPdf("merged"));

    const state = await detectVolumeState({
      volumeKey,
      catalogChapters,
      pastaBase: baseDir,
      seriesName,
      matchChapter: chapterExists,
    });

    assert.equal(state.state, "volume-single");
    assert.equal(isTargetFormat(state, "volume-single"), true);

    await fs.rm(baseDir, { recursive: true, force: true });
  });

  it("detecta volume-single-only sem caps", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "detect-"));
    const mergedName = buildVolumePdfFileName({ seriesName, volumeKey });
    await fs.writeFile(path.join(baseDir, mergedName), await createMinimalPdf("merged"));

    const state = await detectVolumeState({
      volumeKey,
      catalogChapters,
      pastaBase: baseDir,
      seriesName,
      matchChapter: chapterExists,
    });

    assert.equal(state.state, "volume-single-only");
    assert.equal(isTargetFormat(state, "volume-single-only"), true);

    await fs.rm(baseDir, { recursive: true, force: true });
  });

  it("detecta partial quando faltam caps", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "detect-"));
    await setupChapterFiles(baseDir, ["1"]);

    const state = await detectVolumeState({
      volumeKey,
      catalogChapters,
      pastaBase: baseDir,
      seriesName,
      matchChapter: chapterExists,
    });

    assert.equal(state.state, "partial");
    assert.deepEqual(state.missingCaps, ["2"]);
    assert.equal(isTargetFormat(state, "chapters"), false);

    await fs.rm(baseDir, { recursive: true, force: true });
  });
});

describe("resolveChapterFiles", () => {
  it("resolve nomes padronizados", () => {
    const files = resolveChapterFiles({
      volumeKey: "3",
      catalogChapters: [{ capId: "54" }],
      pastaBase: "D:\\novel",
      seriesName: "Slime",
      chapterFileNames: ["Slime - Vol 03 - Cap 054.pdf"],
      matchChapter: chapterExists,
    });

    assert.equal(files.length, 1);
    assert.equal(files[0].capId, "54");
  });
});
