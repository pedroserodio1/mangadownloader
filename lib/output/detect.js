import path from "path";
import { buildPdfFileName } from "../core/naming.js";
import { getMergedVolumePath, getVolumeDir, listMergedPdfs, listPdfFiles } from "../core/paths.js";

/**
 * @param {object} params
 * @param {string} params.volumeKey
 * @param {import('../../plugins/types.js').Chapter[]} catalogChapters
 * @param {string} params.pastaBase
 * @param {string} params.seriesName
 * @param {string[]} params.chapterFileNames
 * @param {(capId: string, files: string[]) => boolean} params.matchChapter
 * @returns {{ capId: string, fileName: string, filePath: string }[]}
 */
export function resolveChapterFiles({
  volumeKey,
  catalogChapters,
  pastaBase,
  seriesName,
  chapterFileNames,
  matchChapter,
}) {
  const volumeDir = getVolumeDir(pastaBase, volumeKey);
  const resolved = [];

  for (const chapter of catalogChapters) {
    const targetName = buildPdfFileName({
      seriesName,
      volumeKey,
      capId: chapter.capId,
    });

    let fileName = null;
    if (chapterFileNames.includes(targetName)) {
      fileName = targetName;
    } else {
      const matches = chapterFileNames.filter(
        (name) => name.endsWith(".pdf") && matchChapter(chapter.capId, [name])
      );
      if (matches.length === 1) {
        fileName = matches[0];
      }
    }

    if (fileName) {
      resolved.push({
        capId: chapter.capId,
        fileName,
        filePath: path.join(volumeDir, fileName),
      });
    }
  }

  return resolved;
}

/**
 * @param {object} params
 * @returns {Promise<{
 *   state: 'chapters'|'volume-single'|'volume-single-only'|'partial',
 *   mergedPath: string,
 *   mergedExists: boolean,
 *   chapterFiles: { capId: string, fileName: string, filePath: string }[],
 *   missingCaps: string[],
 *   complete: boolean,
 * }>}
 */
export async function detectVolumeState({
  volumeKey,
  catalogChapters,
  pastaBase,
  seriesName,
  matchChapter,
}) {
  const mergedPath = getMergedVolumePath(pastaBase, seriesName, volumeKey);
  const mergedFileName = path.basename(mergedPath);
  const rootPdfs = await listMergedPdfs(pastaBase);
  const mergedExists = rootPdfs.includes(mergedFileName);

  const volumeDir = getVolumeDir(pastaBase, volumeKey);
  const chapterFileNames = await listPdfFiles(volumeDir);

  const chapterFiles = resolveChapterFiles({
    volumeKey,
    catalogChapters,
    pastaBase,
    seriesName,
    chapterFileNames,
    matchChapter,
  });

  const siteCapIds = catalogChapters.map((c) => c.capId);
  const presentCapIds = new Set(chapterFiles.map((f) => f.capId));
  const missingCaps = siteCapIds.filter((id) => !presentCapIds.has(id));
  const hasChapters = chapterFiles.length > 0;

  let state = "partial";
  let complete = missingCaps.length === 0;

  if (mergedExists && !hasChapters) {
    state = "volume-single-only";
    complete = true;
  } else if (mergedExists && hasChapters && missingCaps.length === 0) {
    state = "volume-single";
    complete = true;
  } else if (!mergedExists && hasChapters && missingCaps.length === 0) {
    state = "chapters";
    complete = true;
  }

  return {
    state,
    mergedPath,
    mergedExists,
    chapterFiles,
    missingCaps,
    complete,
  };
}

/**
 * @param {Awaited<ReturnType<typeof detectVolumeState>>} current
 * @param {string} targetFormat
 */
export function isTargetFormat(current, targetFormat) {
  if (!current.complete) {
    return false;
  }

  if (targetFormat === "chapters") {
    return current.state === "chapters";
  }

  if (targetFormat === "volume-single") {
    return current.state === "volume-single";
  }

  if (targetFormat === "volume-single-only") {
    return current.state === "volume-single-only";
  }

  return false;
}

/**
 * @param {string} fromState
 * @param {string} toFormat
 * @returns {string|null}
 */
export function getConversionBlockReason(fromState, toFormat) {
  if (fromState === "volume-single-only" && toFormat === "volume-single") {
    return "Os PDFs de capítulo foram removidos; não é possível voltar a manter os caps.";
  }

  if (
    (fromState === "volume-single" || fromState === "volume-single-only") &&
    toFormat === "chapters"
  ) {
    return "Não é possível separar o PDF único de volta em capítulos.";
  }

  return null;
}
