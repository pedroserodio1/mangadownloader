import { getChaptersForVolume } from "../core/catalog.js";
import { resolveSeriesName, buildVolumePdfFileName, formatVolumeLabel } from "../core/naming.js";
import { getVolumeDir, listMergedPdfs, listPdfFiles } from "../core/paths.js";
import {
  executeRenames,
  planRenames,
  printRenameReport,
} from "../rename/renamer.js";
import { printRenameUI } from "../ui/index.js";
import { assertVolumeInCatalog, createMatchChapter, createHttpForConfig, getVolumeKeysFromCatalog, loadCatalog, resolveRuntime } from "../shared/runtime.js";

export async function runRename({ cli, configPath, logger }) {
  const { config, plugin } = await resolveRuntime(configPath, {
    allowEmptyVolumes: true,
  });

  const http = createHttpForConfig(config, logger);
  const matchChapter = createMatchChapter(plugin, config);
  const chaptersByVolume = await loadCatalog({ config, http, plugin, logger });
  const seriesName = resolveSeriesName(config);

  const volumeKeys = getVolumeKeysFromCatalog(chaptersByVolume, cli.volume);

  if (cli.volume && !assertVolumeInCatalog(chaptersByVolume, cli.volume, logger)) {
    process.exitCode = 1;
    return { plan: null, stats: null };
  }

  logger.info(`Pasta base: ${config.pastaBase}`);
  logger.info(`Série: ${seriesName}`);

  const localFilesByVolume = new Map();
  const mergedFilesByVolume = new Map();
  const filteredChapters = new Map();
  const rootPdfs = await listMergedPdfs(config.pastaBase);

  for (const volumeKey of volumeKeys) {
    const volumeDir = getVolumeDir(config.pastaBase, volumeKey);
    localFilesByVolume.set(volumeKey, await listPdfFiles(volumeDir));
    filteredChapters.set(
      volumeKey,
      getChaptersForVolume(chaptersByVolume, volumeKey)
    );

    const targetMerged = buildVolumePdfFileName({ seriesName, volumeKey });
    const volumeLabel = formatVolumeLabel(volumeKey);
    const candidate = rootPdfs.find(
      (name) => name.endsWith(".pdf") && name.includes(volumeLabel)
    );

    if (candidate && candidate !== targetMerged) {
      mergedFilesByVolume.set(volumeKey, candidate);
    }
  }

  const plan = planRenames({
    chaptersByVolume: filteredChapters,
    localFilesByVolume,
    pastaBase: config.pastaBase,
    seriesName,
    volumeKeys,
    matchChapter,
    mergedFilesByVolume,
  });

  const stats = await executeRenames(plan, {
    dryRun: cli.dryRun,
    logger,
  });

  if (cli.quiet || cli.verbose) {
    printRenameReport(plan, stats, logger, { dryRun: cli.dryRun });
  } else {
    printRenameUI(plan, stats, { dryRun: cli.dryRun });
  }

  if (stats.errors + plan.errors.length > 0) {
    process.exitCode = 1;
  }

  return {
    plan: {
      renames: plan.renames,
      errors: plan.errors,
    },
    stats,
  };
}
