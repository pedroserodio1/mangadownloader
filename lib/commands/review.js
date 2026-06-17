import path from "path";
import { getChaptersForVolume } from "../core/catalog.js";
import { getOutputFormat } from "../output/registry.js";
import { resolveSeriesName } from "../core/naming.js";
import {
  getMergedVolumePath,
  getVolumeDir,
  listMergedPdfs,
  listPdfFiles,
  volumeDirExists,
} from "../core/paths.js";
import { printReviewReport, reviewAll } from "../review/reviewer.js";
import { printReviewUI } from "../ui/index.js";
import {
  assertVolumeInCatalog,
  createHttpForConfig,
  createMatchChapter,
  getVolumeKeysFromCatalog,
  loadCatalog,
  resolveRuntime,
} from "../shared/runtime.js";

export async function runReview({ cli, configPath, logger }) {
  const { config, plugin } = await resolveRuntime(configPath, {
    allowEmptyVolumes: true,
  });

  const http = createHttpForConfig(config, logger);
  const matchChapter = createMatchChapter(plugin, config);
  const chaptersByVolume = await loadCatalog({ config, http, plugin, logger });

  const volumeKeys = getVolumeKeysFromCatalog(chaptersByVolume, cli.volume);

  if (cli.volume && !assertVolumeInCatalog(chaptersByVolume, cli.volume, logger)) {
    process.exitCode = 1;
    return;
  }

  if (!cli.quiet) {
    logger.info(`Pasta base: ${config.pastaBase}`);
  }

  const outputFormat = getOutputFormat(config, plugin);
  const seriesName = resolveSeriesName(config);
  const rootPdfs = await listMergedPdfs(config.pastaBase);

  const localFilesByVolume = new Map();
  const volumeDirExistsByVolume = new Map();
  const mergedExistsByVolume = new Map();
  const filteredChapters = new Map();

  for (const volumeKey of volumeKeys) {
    const volumeDir = getVolumeDir(config.pastaBase, volumeKey);
    volumeDirExistsByVolume.set(volumeKey, await volumeDirExists(volumeDir));
    localFilesByVolume.set(volumeKey, await listPdfFiles(volumeDir));
    const mergedBase = path.basename(
      getMergedVolumePath(config.pastaBase, seriesName, volumeKey)
    );
    mergedExistsByVolume.set(volumeKey, rootPdfs.includes(mergedBase));
    filteredChapters.set(
      volumeKey,
      getChaptersForVolume(chaptersByVolume, volumeKey)
    );
  }

  const result = reviewAll({
    chaptersByVolume: filteredChapters,
    localFilesByVolume,
    volumeDirExistsByVolume,
    matchChapter,
    outputFormat,
    mergedExistsByVolume,
  });

  if (cli.quiet || cli.verbose) {
    printReviewReport(result, logger, {
      verbose: cli.verbose,
      quiet: cli.quiet,
    });
  } else {
    printReviewUI(result);
  }

  if (result.summary.hasErrors) {
    process.exitCode = 1;
  }
}
