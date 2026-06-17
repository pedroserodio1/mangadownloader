import fs from "fs/promises";
import path from "path";
import { buildPdfFileName, buildVolumePdfFileName } from "../core/naming.js";
import { getMergedVolumePath, getVolumeDir, listPdfFiles } from "../core/paths.js";
import { chapterExists } from "../shared/utils.js";

function findLocalFileForChapter(capId, localPdfFiles, { seriesName, volumeKey, matchChapter = chapterExists }) {
  const targetName = buildPdfFileName({ seriesName, volumeKey, capId });
  if (localPdfFiles.includes(targetName)) return targetName;

  const matches = localPdfFiles.filter(
    (name) => name.endsWith(".pdf") && matchChapter(capId, [name])
  );

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  throw new Error(
    `Múltiplos PDFs correspondem ao capítulo ${capId}: ${matches.join(", ")}`
  );
}

export function planRenames({
  chaptersByVolume,
  localFilesByVolume,
  pastaBase,
  seriesName,
  volumeKeys,
  matchChapter = chapterExists,
  mergedFilesByVolume = new Map(),
}) {
  const renames = [];
  const skipped = [];
  const orphans = [];
  const errors = [];
  const matchedFiles = new Set();
  const targetNamesByVolume = new Map();

  for (const volumeKey of volumeKeys) {
    const siteChapters = chaptersByVolume.get(volumeKey) ?? [];
    const localPdfFiles = localFilesByVolume.get(volumeKey) ?? [];
    const volumeDir = getVolumeDir(pastaBase, volumeKey);

    for (const chapter of siteChapters) {
      const targetName = buildPdfFileName({
        seriesName,
        volumeKey,
        capId: chapter.capId,
      });
      const targetPath = path.join(volumeDir, targetName);

      let sourceName;
      try {
        sourceName = findLocalFileForChapter(chapter.capId, localPdfFiles, {
          seriesName,
          volumeKey,
          matchChapter,
        });
      } catch (err) {
        errors.push({
          volume: volumeKey,
          capId: chapter.capId,
          message: err.message,
        });
        continue;
      }

      if (!sourceName) continue;

      matchedFiles.add(`${volumeKey}/${sourceName}`);

      if (sourceName === targetName) {
        skipped.push({ volume: volumeKey, capId: chapter.capId, file: sourceName });
        continue;
      }

      if (!targetNamesByVolume.has(volumeKey)) {
        targetNamesByVolume.set(volumeKey, new Map());
      }

      const volumeTargets = targetNamesByVolume.get(volumeKey);
      if (volumeTargets.has(targetName)) {
        errors.push({
          volume: volumeKey,
          capId: chapter.capId,
          message: `Conflito de destino: ${targetName}`,
        });
        continue;
      }

      if (localPdfFiles.includes(targetName)) {
        errors.push({
          volume: volumeKey,
          capId: chapter.capId,
          message: `Destino já existe: ${targetName}`,
        });
        continue;
      }

      volumeTargets.set(targetName, true);

      renames.push({
        volume: volumeKey,
        capId: chapter.capId,
        from: sourceName,
        to: targetName,
        fromPath: path.join(volumeDir, sourceName),
        toPath: targetPath,
      });
    }

    for (const fileName of localPdfFiles) {
      const key = `${volumeKey}/${fileName}`;
      if (!matchedFiles.has(key)) {
        orphans.push({ volume: volumeKey, file: fileName });
      }
    }

    const mergedSource = mergedFilesByVolume.get(volumeKey);
    if (mergedSource) {
      const targetName = buildVolumePdfFileName({ seriesName, volumeKey });
      const targetPath = getMergedVolumePath(pastaBase, seriesName, volumeKey);

      if (mergedSource !== targetName) {
        renames.push({
          volume: volumeKey,
          capId: null,
          kind: "merged",
          from: mergedSource,
          to: targetName,
          fromPath: path.join(pastaBase, mergedSource),
          toPath: targetPath,
        });
      }
    }
  }

  return { renames, skipped, orphans, errors };
}

export async function executeRenames(plan, { dryRun = false, logger } = {}) {
  const stats = { renamed: 0, skipped: plan.skipped.length, errors: 0 };

  for (const item of plan.renames) {
    if (dryRun) {
      logger.info(`🔍 [dry-run] ${item.from} → ${item.to}`);
      stats.renamed++;
      continue;
    }

    try {
      await fs.rename(item.fromPath, item.toPath);
      logger.info(`✏️ ${item.from} → ${item.to}`);
      stats.renamed++;
    } catch (err) {
      stats.errors++;
      logger.error(
        `❌ Falha ao renomear Vol ${item.volume} Cap ${item.capId}: ${err.message}`
      );
    }
  }

  return stats;
}

export function printRenameReport(plan, stats, logger, { dryRun = false } = {}) {
  for (const orphan of plan.orphans) {
    logger.warn(`⚠️ Órfão (sem capítulo no site): Vol ${orphan.volume} — ${orphan.file}`);
  }

  for (const err of plan.errors) {
    logger.error(
      `❌ Vol ${err.volume} Cap ${err.capId ?? "?"}: ${err.message}`
    );
  }

  logger.info("\n📊 Rename");
  logger.info(`   Renomeados: ${stats.renamed}${dryRun ? " (dry-run)" : ""}`);
  logger.info(`   Já no formato: ${stats.skipped}`);
  logger.info(`   Órfãos: ${plan.orphans.length}`);
  logger.info(`   Erros: ${stats.errors + plan.errors.length}`);
}
