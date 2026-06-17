import { PDFDocument } from "pdf-lib";

/**
 * @param {Buffer} buffer
 * @returns {'jpg'|'png'|null}
 */
function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8) return "jpg";
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }
  return null;
}

/**
 * @param {{ index: number, buffer: Buffer, filename: string }[]} pages
 * @returns {Promise<Buffer>}
 */
export async function assemblePdfFromImages(pages) {
  const doc = await PDFDocument.create();

  for (const page of pages) {
    const kind = detectImageType(page.buffer);
    if (kind === "jpg") {
      const image = await doc.embedJpg(page.buffer);
      const pdfPage = doc.addPage([image.width, image.height]);
      pdfPage.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    } else if (kind === "png") {
      const image = await doc.embedPng(page.buffer);
      const pdfPage = doc.addPage([image.width, image.height]);
      pdfPage.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    } else {
      throw new Error(
        `Formato de imagem não suportado: ${page.filename}. Use JPG ou PNG.`
      );
    }
  }

  return Buffer.from(await doc.save());
}
