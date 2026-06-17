import fs from "fs/promises";
import { resolveSeriesName } from "../core/naming.js";
import { getVolumeDir, listPdfFiles, getVolumeStagingDir, getVolumeArchivePath } from "../core/paths.js";
import { writeFileAtomic } from "../shared/utils.js";
import { detectVolumeState, resolveChapterFiles } from "./detect.js";
import { detectLocalVolumeState, discoverLocalChapterFiles } from "./local.js";
import { mergePdfFiles } from "./merge-pdf.js";
import { archiveExtension, isVolumeArchiveFormat } from "./archive.js";
import { createArchiveFromDirectory, removeDirectoryRecursive } from "./zip.js";

/**
 * @param {object} params
 * @param {string} params.format
 * @param {string} params.volumeKey
 * @param {import('../../plugins/types.js').Chapter[]} [params.catalogChapters]
 * @param {import('../config.js').ValidatedConfig} config
 * @param {import('../logger.js').Logger} [logger]
 * @param {boolean} [params.dryRun]
 * @param {(capId: string, files: string[]) => boolean} [params.matchChapter]
 * @param {boolean} [params.force]
 * @param {boolean} [params.localOnly]
 */
export async function finalizeVolume({
  format,
  volumeKey,
  catalogChapters = [],
  config,
  logger,
  dryRun = false,
  matchChapter,
  force = false,
  localOnly = false,
}) {
  if (
    format === "chapters" ||
    format === "pdf" ||
    format === "folder" ||
    format === "zip-chapter" ||
    format === "cbz-chapter"
  ) {
    return { status: "noop" };
  }

  const seriesName = resolveSeriesName(config);
  const pastaBase = config.pastaBase;

  if (isVolumeArchiveFormat(format)) {
    const ext = archiveExtension(format);
    const stagingDir = getVolumeStagingDir(pastaBase, volumeKey);
    const archivePath = getVolumeArchivePath(pastaBase, seriesName, volumeKey, ext);

    try {
      await fs.access(stagingDir);
    } catch {
      return { status: "noop" };
    }

    if (dryRun) {
      logger?.info?.(`[dry-run] Criaria ${archivePath} a partir de ${stagingDir}`);
      return { status: "dry-run", mergedPath: archivePath };
    }

    await createArchiveFromDirectory(archivePath, stagingDir);
    await removeDirectoryRecursive(stagingDir);
    logger?.info?.(`Arquivo do volume criado: ${archivePath}`);
    return { status: "finalized", mergedPath: archivePath };
  }

  const volumeDir = getVolumeDir(pastaBase, volumeKey);

  let state;
  let chapterFiles;
  let orderedPaths;

  if (localOnly) {
    state = await detectLocalVolumeState({ volumeKey, pastaBase, seriesName });
    chapterFiles = state.chapterFiles;
    orderedPaths = chapterFiles.map((file) => file.filePath);

    if (chapterFiles.length === 0 && !state.mergedExists) {
      const err = new Error(`Volume ${volumeKey}: nenhum PDF de capítulo encontrado para merge.`);
      err.code = "NO_CHAPTERS";
      throw err;
    }
  } else {
    state = await detectVolumeState({
      volumeKey,
      catalogChapters,
      pastaBase,
      seriesName,
      matchChapter,
    });

    if (!force && !state.complete) {
      const err = new Error(
        `Volume ${volumeKey}: capítulos faltando (${state.missingCaps.join(", ")}). Use --force para merge parcial.`
      );
      err.code = "INCOMPLETE_VOLUME";
      throw err;
    }

    const chapterFileNames = await listPdfFiles(volumeDir);
    chapterFiles = resolveChapterFiles({
      volumeKey,
      catalogChapters,
      pastaBase,
      seriesName,
      chapterFileNames,
      matchChapter,
    });

    if (chapterFiles.length === 0 && !state.mergedExists) {
      const err = new Error(`Volume ${volumeKey}: nenhum PDF de capítulo encontrado para merge.`);
      err.code = "NO_CHAPTERS";
      throw err;
    }

    orderedPaths = catalogChapters
      .map((chapter) => chapterFiles.find((file) => file.capId === chapter.capId))
      .filter(Boolean)
      .map((file) => file.filePath);

    if (orderedPaths.length === 0 && !state.mergedExists) {
      const err = new Error(`Volume ${volumeKey}: nenhum capítulo disponível para merge.`);
      err.code = "NO_CHAPTERS";
      throw err;
    }
  }

  const mergedPath = state.mergedPath;

  if (!state.mergedExists) {
    const orderLabel = chapterFiles.map((f) => f.capId).join(", ");
    logger?.verbose?.(`Ordem do merge: ${orderLabel}`);

    if (dryRun) {
      logger?.info?.(
        `[dry-run] Criaria ${mergedPath} a partir de ${orderedPaths.length} capítulo(s)`
      );
    } else {
      const buffer = await mergePdfFiles(orderedPaths);
      await writeFileAtomic(mergedPath, buffer);
      logger?.info?.(`PDF do volume criado: ${mergedPath}`);
    }
  }

  if (format === "volume-single-only") {
    const filesToRemove =
      chapterFiles.length > 0
        ? chapterFiles
        : discoverLocalChapterFiles({
            pastaBase,
            volumeKey,
            chapterFileNames: await listPdfFiles(volumeDir),
          });

    for (const chapterFile of filesToRemove) {
      if (dryRun) {
        logger?.info?.(`[dry-run] Removeria ${chapterFile.filePath}`);
      } else {
        await fs.unlink(chapterFile.filePath);
        logger?.verbose?.(`Removido: ${chapterFile.filePath}`);
      }
    }
  }

  return {
    status: dryRun ? "dry-run" : "finalized",
    mergedPath,
    chaptersMerged: orderedPaths.length,
    chaptersRemoved: format === "volume-single-only" ? chapterFiles.length : 0,
  };
}
