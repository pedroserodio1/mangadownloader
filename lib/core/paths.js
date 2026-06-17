import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { buildVolumePdfFileName, formatCapLabel, formatVolumeLabel, sanitizeFileName } from "./naming.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.join(__dirname, "..", "..");
export const CONFIG_PATH = path.join(ROOT_DIR, "config.json");

export function getMergedVolumePath(pastaBase, seriesName, volumeKey) {
  const fileName = buildVolumePdfFileName({ seriesName, volumeKey });
  return path.join(pastaBase, fileName);
}

export async function listMergedPdfs(pastaBase) {
  try {
    const files = await fs.readdir(pastaBase);
    return files.filter((f) => f.endsWith(".pdf"));
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

export function getVolumeDir(pastaBase, volumeKey) {
  return path.join(pastaBase, `Vol ${volumeKey}`);
}

export async function listPdfFiles(volumeDir) {
  try {
    const files = await fs.readdir(volumeDir);
    return files.filter((f) => f.endsWith(".pdf"));
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

export async function volumeDirExists(volumeDir) {
  try {
    await fs.access(volumeDir);
    return true;
  } catch {
    return false;
  }
}

const STAGING_DIR = ".manga-downloader-staging";

export function getStagingRoot(pastaBase) {
  return path.join(pastaBase, STAGING_DIR);
}

export function getVolumeStagingDir(pastaBase, volumeKey) {
  return path.join(getStagingRoot(pastaBase), `Vol ${volumeKey}`);
}

export function getChapterStagingDir(pastaBase, volumeKey, capId) {
  return path.join(getVolumeStagingDir(pastaBase, volumeKey), formatCapLabel(capId));
}

export async function listFilesInDir(dir, extension) {
  try {
    const files = await fs.readdir(dir);
    if (extension) {
      return files.filter((f) => f.endsWith(extension));
    }
    return files;
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

/**
 * @param {string} pastaBase
 * @param {string} seriesName
 * @param {string} volumeKey
 * @param {'.zip'|'.cbz'} ext
 */
export function getVolumeArchivePath(pastaBase, seriesName, volumeKey, ext) {
  const fileName = sanitizeFileName(`${seriesName} - ${formatVolumeLabel(volumeKey)}${ext}`);
  return path.join(pastaBase, fileName);
}
