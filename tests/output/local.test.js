import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { buildPdfFileName } from "../../lib/core/naming.js";
import {
  discoverLocalChapterFiles,
  listLocalVolumeKeys,
} from "../../lib/output/local.js";
import { createMinimalPdf } from "../../lib/output/merge-pdf.js";

describe("discoverLocalChapterFiles", () => {
  it("ordena caps konosuba (1-1-2 antes de 1-1-10)", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "local-"));
    const volumeKey = "01";
    const volumeDir = path.join(baseDir, `Vol ${volumeKey}`);
    await fs.mkdir(volumeDir, { recursive: true });

    const capIds = ["1-1-10", "1-0", "1-1-2", "1-2-1"];
    const names = capIds.map((capId) =>
      buildPdfFileName({ seriesName: "konosuba", volumeKey, capId })
    );

    for (const name of names) {
      await fs.writeFile(path.join(volumeDir, name), await createMinimalPdf(name));
    }

    const discovered = discoverLocalChapterFiles({
      pastaBase: baseDir,
      volumeKey,
      chapterFileNames: names,
    });

    assert.deepEqual(
      discovered.map((f) => f.capId),
      ["1-0", "1-1-2", "1-1-10", "1-2-1"]
    );

    await fs.rm(baseDir, { recursive: true, force: true });
  });
});

describe("listLocalVolumeKeys", () => {
  it("lista pastas Vol N na pasta base", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "volumes-"));
    await fs.mkdir(path.join(baseDir, "Vol 1"));
    await fs.mkdir(path.join(baseDir, "Vol 2"));
    await fs.mkdir(path.join(baseDir, "outro"));

    const volumes = await listLocalVolumeKeys(baseDir);
    assert.deepEqual(volumes, ["1", "2"]);

    await fs.rm(baseDir, { recursive: true, force: true });
  });
});
