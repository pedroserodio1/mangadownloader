import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { getVolumeDir } from "../lib/core/paths.js";
import { planRenames } from "../lib/rename/renamer.js";
import { createMatchChapter } from "../lib/shared/runtime.js";
import centralnovelPlugin from "../plugins/centralnovel/index.js";

const matchChapter = createMatchChapter(centralnovelPlugin);

describe("planRenames", () => {
  it("planeja renomeação de arquivos longos para formato padronizado", () => {
    const chaptersByVolume = new Map([
      ["3", [{ capId: "54", pdfPageUrl: "https://example.com/capitulo-54/" }]],
    ]);
    const localFilesByVolume = new Map([
      [
        "3",
        ["tensei-shitara-slime-datta-ken-capitulo-54-centralnovel.com.pdf"],
      ],
    ]);

    const plan = planRenames({
      chaptersByVolume,
      localFilesByVolume,
      pastaBase: "D:\\Midias\\Novel\\slime",
      seriesName: "Slime",
      volumeKeys: ["3"],
      matchChapter,
    });

    assert.equal(plan.renames.length, 1);
    assert.equal(plan.renames[0].from, "tensei-shitara-slime-datta-ken-capitulo-54-centralnovel.com.pdf");
    assert.equal(plan.renames[0].to, "Slime - Vol 03 - Cap 054.pdf");
    assert.equal(plan.skipped.length, 0);
  });

  it("pula arquivos que já estão no formato correto", () => {
    const chaptersByVolume = new Map([
      ["3", [{ capId: "54", pdfPageUrl: "https://example.com/capitulo-54/" }]],
    ]);
    const localFilesByVolume = new Map([["3", ["Slime - Vol 03 - Cap 054.pdf"]]]);

    const plan = planRenames({
      chaptersByVolume,
      localFilesByVolume,
      pastaBase: "D:\\Midias\\Novel\\slime",
      seriesName: "Slime",
      volumeKeys: ["3"],
      matchChapter,
    });

    assert.equal(plan.renames.length, 0);
    assert.equal(plan.skipped.length, 1);
  });

  it("lista órfãos sem capítulo correspondente no site", () => {
    const chaptersByVolume = new Map([["3", []]]);
    const localFilesByVolume = new Map([["3", ["arquivo-desconhecido.pdf"]]]);

    const plan = planRenames({
      chaptersByVolume,
      localFilesByVolume,
      pastaBase: "D:\\Midias\\Novel\\slime",
      seriesName: "Slime",
      volumeKeys: ["3"],
      matchChapter,
    });

    assert.equal(plan.orphans.length, 1);
    assert.equal(plan.orphans[0].file, "arquivo-desconhecido.pdf");
  });

  it("integra com filesystem temporário", async () => {
    const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), "rename-test-"));
    const volDir = getVolumeDir(tmpBase, "3");
    await fs.mkdir(volDir, { recursive: true });
    const oldName = "tensei-shitara-slime-datta-ken-capitulo-45-centralnovel.com.pdf";
    await fs.writeFile(path.join(volDir, oldName), "pdf");

    const chaptersByVolume = new Map([
      ["3", [{ capId: "45", pdfPageUrl: "https://example.com/capitulo-45/" }]],
    ]);
    const localFilesByVolume = new Map([[ "3", [oldName] ]]);

    const plan = planRenames({
      chaptersByVolume,
      localFilesByVolume,
      pastaBase: tmpBase,
      seriesName: "Slime",
      volumeKeys: ["3"],
      matchChapter,
    });

    assert.equal(plan.renames[0].to, "Slime - Vol 03 - Cap 045.pdf");
    await fs.rename(plan.renames[0].fromPath, plan.renames[0].toPath);

    const files = await fs.readdir(volDir);
    assert.deepEqual(files, ["Slime - Vol 03 - Cap 045.pdf"]);

    await fs.rm(tmpBase, { recursive: true, force: true });
  });
});
