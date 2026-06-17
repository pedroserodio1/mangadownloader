import fs from "fs/promises";
import { getChaptersForVolume } from "../core/catalog.js";
import { getVolumes, removeVolumeFromConfig } from "../config/store.js";
import { createDownloader } from "../download/downloader.js";
import { getOutputFormat } from "../output/registry.js";
import { promptOutputFormatChoice } from "../output/prompt.js";
import { createDownloadUI, printErrorsSummary } from "../ui/index.js";
import { createStats, mergeStats } from "../shared/utils.js";
import {
  createHttpForConfig,
  createMatchChapter,
  loadCatalog,
  resolveRuntime,
} from "../shared/runtime.js";

export async function runDownload({ cli, configPath, logger }) {
  const { config, plugin } = await resolveRuntime(configPath, {
    allowEmptyVolumes: Boolean(cli.volume),
  });

  const http = createHttpForConfig(config, logger, { verboseRetries: cli.verbose });
  const matchChapter = createMatchChapter(plugin, config);
  const useUi = !cli.quiet && !cli.verbose;
  const isInteractive = useUi && process.stdin.isTTY;

  let outputFormat = cli.format ?? null;
  if (!outputFormat && isInteractive) {
    outputFormat = await promptOutputFormatChoice(plugin, config, {
      cliFormat: cli.format,
    });
  } else if (!outputFormat) {
    outputFormat = getOutputFormat(config, plugin);
  }

  await fs.mkdir(config.pastaBase, { recursive: true });
  if (!useUi) {
    logger.info(`Pasta base: ${config.pastaBase}`);
  }

  const chaptersByVolume = await loadCatalog({ config, http, plugin, logger });

  const volumesToProcess = cli.volume
    ? [String(cli.volume)]
    : getVolumes(config);

  if (cli.volume && !getVolumes(config).includes(String(cli.volume))) {
    logger.warn(
      `Volume "${cli.volume}" não está em config — processando mesmo assim.`
    );
  }

  const downloader = createDownloader({
    config,
    http,
    logger,
    plugin,
    ui: createDownloadUI({ useUi }),
    matchChapter,
    outputFormat,
  });

  const totalStats = createStats();

  for (const volume of volumesToProcess) {
    const capitulos = getChaptersForVolume(chaptersByVolume, volume);

    if (capitulos.length === 0) {
      logger.warn(
        `Volume ${volume}: nenhum capítulo encontrado na página — mantendo no config.`
      );
      continue;
    }

    const volumeStats = await downloader.downloadVolume(volume, capitulos, {
      dryRun: cli.dryRun,
    });

    mergeStats(totalStats, volumeStats);

    const volumeOk = volumeStats.failed === 0;

    if (volumeOk && !cli.dryRun) {
      await removeVolumeFromConfig(config, volume, configPath);
      if (!useUi) {
        logger.info(`Volume ${volume} removido do config.json`);
      }
    } else if (!volumeOk) {
      logger.warn(
        `Volume ${volume} mantido no config (${volumeStats.failed} falha(s)).`
      );
    }
  }

  if (!useUi) {
    logger.info("\nResumo final");
    logger.info(`   Baixados: ${totalStats.downloaded}`);
    logger.info(`   Pulados (já existiam): ${totalStats.skipped}`);
    logger.info(`   Falhas: ${totalStats.failed}`);
  }

  if (cli.dryRun && !useUi) {
    logger.info("   Modo: dry-run (nenhum arquivo foi salvo)");
  }

  if (totalStats.errors.length > 0) {
    if (!useUi) {
      printErrorsSummary(totalStats.errors);
    }
    process.exitCode = 1;
  }

  return { stats: totalStats };
}
