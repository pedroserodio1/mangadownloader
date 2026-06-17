import fs from "fs/promises";
import { PDFDocument } from "pdf-lib";

/**
 * @param {string[]} orderedPaths
 * @returns {Promise<Buffer>}
 */
export async function mergePdfFiles(orderedPaths) {
  const merged = await PDFDocument.create();

  for (const filePath of orderedPaths) {
    const bytes = await fs.readFile(filePath);
    const doc = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const page of pages) {
      merged.addPage(page);
    }
  }

  const pdfBytes = await merged.save();
  return Buffer.from(pdfBytes);
}

/**
 * @param {import('pdf-lib').PDFDocument} doc
 * @param {string} label
 */
export async function createMinimalPdf(label = "test") {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  page.drawText(label, { x: 50, y: page.getHeight() - 50, size: 12 });
  return Buffer.from(await doc.save());
}
