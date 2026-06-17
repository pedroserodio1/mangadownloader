import fs from "fs/promises";
import path from "path";
import {
  compareCapIdsNatural,
  compareVolumeKeysNatural,
  extractCapIdFromPdfFileName,
} from "../core/naming.js";
import { getMergedVolumePath, getVolumeDir, listMergedPdfs, listPdfFiles } from "../core/paths.js";

/**
 * @param {string} pastaBase
 * @returns {Promise<string[]>}
 */
export async function listLocalVolumeKeys(pastaBase) {
  let entries;
  try {
    entries = await fs.readdir(pastaBase, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }

  const volumes = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(/^Vol\s+(.+)$/i);
    if (match) {
      volumes.push(match[1]);
    }
  }

  return volumes.sort(compareVolumeKeysNatural);
}

/**
 * @param {object} params
 * @param {string} params.pastaBase
 * @param {string} params.volumeKey
 * @param {string[]} params.chapterFileNames
 * @returns {{ capId: string, fileName: string, filePath: string }[]}
 */
export function discoverLocalChapterFiles({ pastaBase, volumeKey, chapterFileNames }) {
  const volumeDir = getVolumeDir(pastaBase, volumeKey);
  const files = [];

  for (const fileName of chapterFileNames) {
    if (!fileName.endsWith(".pdf")) continue;
    const capId = extractCapIdFromPdfFileName(fileName);
    if (!capId) continue;

    files.push({
      capId,
      fileName,
      filePath: path.join(volumeDir, fileName),
    });
  }

  files.sort((a, b) => compareCapIdsNatural(a.capId, b.capId));
  return files;
}

/**
 * @param {object} params
 * @returns {Promise<{
 *   state: 'chapters'|'volume-single'|'volume-single-only'|'partial',
 *   mergedPath: string,
 *   mergedExists: boolean,
 *   chapterFiles: { capId: string, fileName: string, filePath: string }[],
 *   complete: boolean,
 * }>}
 */
export async function detectLocalVolumeState({ volumeKey, pastaBase, seriesName }) {
  const mergedPath = getMergedVolumePath(pastaBase, seriesName, volumeKey);
  const mergedFileName = path.basename(mergedPath);
  const rootPdfs = await listMergedPdfs(pastaBase);
  const mergedExists = rootPdfs.includes(mergedFileName);

  const volumeDir = getVolumeDir(pastaBase, volumeKey);
  const chapterFileNames = await listPdfFiles(volumeDir);
  const chapterFiles = discoverLocalChapterFiles({
    pastaBase,
    volumeKey,
    chapterFileNames,
  });

  const hasChapters = chapterFiles.length > 0;

  let state = "partial";
  let complete = false;

  if (mergedExists && !hasChapters) {
    state = "volume-single-only";
    complete = true;
  } else if (mergedExists && hasChapters) {
    state = "volume-single";
    complete = true;
  } else if (!mergedExists && hasChapters) {
    state = "chapters";
    complete = true;
  }

  return {
    state,
    mergedPath,
    mergedExists,
    chapterFiles,
    complete,
  };
}
