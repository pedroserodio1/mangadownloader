import fs from "fs/promises";
import path from "path";
import { archiveExtension, isChapterArchiveFormat, isVolumeArchiveFormat } from "./archive.js";
import { assemblePdfFromImages } from "./assemble-pdf.js";
import {
  buildChapterArchiveFileName,
  buildChapterFolderName,
  buildPdfFileName,
  pageFileName,
} from "../core/naming.js";
import {
  getChapterStagingDir,
  getVolumeDir,
} from "../core/paths.js";
import { writeFileAtomic } from "../shared/utils.js";
import {
  createArchiveFromBuffers,
  pagesToArchiveEntries,
} from "./zip.js";

/**
 * @param {string} format
 * @param {string} capId
 * @param {string[]} fileNames
 * @param {import('../../plugins/types.js').SourcePlugin} [plugin]
 * @returns {boolean}
 */
export function chapterOutputExists(format, capId, fileNames, plugin) {
  const extraPatterns = plugin?.getChapterFilePatterns?.(capId) ?? [];

  if (format === "pdf") {
    return fileNames.some(
      (name) => name.endsWith(".pdf") && extraPatterns.some((p) => p.test(name))
    );
  }

  if (format === "folder") {
    const folder = buildChapterFolderName(capId);
    return fileNames.includes(folder);
  }

  const ext = archiveExtension(format);
  if (ext && isChapterArchiveFormat(format)) {
    return fileNames.some(
      (name) => name.endsWith(ext) && extraPatterns.some((p) => p.test(name))
    );
  }

  return false;
}

/**
 * @param {object} params
 * @param {string} params.format
 * @param {{ index: number, buffer: Buffer, filename: string }[]} params.pages
 * @param {string} params.volumeKey
 * @param {string} params.capId
 * @param {string} params.seriesName
 * @param {string} params.pastaBase
 * @returns {Promise<string>}
 */
export async function writeChapterOutput({
  format,
  pages,
  volumeKey,
  capId,
  seriesName,
  pastaBase,
}) {
  const volumeDir = getVolumeDir(pastaBase, volumeKey);
  await fs.mkdir(volumeDir, { recursive: true });

  if (format === "pdf") {
    const nomeArquivo = buildPdfFileName({ seriesName, volumeKey, capId });
    const arquivo = path.join(volumeDir, nomeArquivo);
    const buffer = await assemblePdfFromImages(pages);
    await writeFileAtomic(arquivo, buffer);
    return arquivo;
  }

  if (format === "folder") {
    const capDir = path.join(volumeDir, buildChapterFolderName(capId));
    await fs.mkdir(capDir, { recursive: true });
    for (const page of pages) {
      const name = pageFileName(page.index, page.filename);
      await writeFileAtomic(path.join(capDir, name), page.buffer);
    }
    return capDir;
  }

  if (isChapterArchiveFormat(format)) {
    const ext = archiveExtension(format);
    const nomeArquivo = buildChapterArchiveFileName({
      seriesName,
      volumeKey,
      capId,
      ext,
    });
    const arquivo = path.join(volumeDir, nomeArquivo);
    const entries = pagesToArchiveEntries(pages);
    await createArchiveFromBuffers(arquivo, entries);
    return arquivo;
  }

  if (isVolumeArchiveFormat(format)) {
    const capDir = getChapterStagingDir(pastaBase, volumeKey, capId);
    await fs.mkdir(capDir, { recursive: true });
    for (const page of pages) {
      const name = pageFileName(page.index, page.filename);
      await writeFileAtomic(path.join(capDir, name), page.buffer);
    }
    return capDir;
  }

  throw new Error(`Formato de saída não suportado: ${format}`);
}
