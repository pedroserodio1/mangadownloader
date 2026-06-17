import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import { createMinimalPdf, mergePdfFiles } from "../../lib/output/merge-pdf.js";

describe("mergePdfFiles", () => {
  it("junta dois PDFs na ordem informada", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "merge-pdf-"));
    const first = path.join(dir, "a.pdf");
    const second = path.join(dir, "b.pdf");

    await fs.writeFile(first, await createMinimalPdf("A"));
    await fs.writeFile(second, await createMinimalPdf("B"));

    const merged = await mergePdfFiles([first, second]);
    const doc = await PDFDocument.load(merged);

    assert.equal(doc.getPageCount(), 2);

    await fs.rm(dir, { recursive: true, force: true });
  });
});
