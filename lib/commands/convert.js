import ora from "ora";
import pc from "picocolors";
import { getVolumes } from "../config/store.js";
import { getConversionBlockReason, isTargetFormat } from "../output/detect.js";
import { finalizeVolume } from "../output/finalize.js";
import { detectLocalVolumeState, listLocalVolumeKeys } from "../output/local.js";
import { promptOutputFormatChoice } from "../output/prompt.js";
import { resolveSeriesName } from "../core/naming.js";
import { resolveRuntime } from "../shared/runtime.js";

export async function runConvert({ cli, configPath, logger }) {
  const { config, plugin } = await resolveRuntime(configPath, {
    allowEmptyVolumes: true,
  });

  const seriesName = resolveSeriesName(config);
  const targetFormat = await promptOutputFormatChoice(plugin, config, {
    cliFormat: cli.format,
  });

  let volumeKeys;
  if (cli.volume) {
    volumeKeys = [String(cli.volume)];
  } else if (getVolumes(config).length > 0) {
    volumeKeys = getVolumes(config);
  } else {
    volumeKeys = await listLocalVolumeKeys(config.pastaBase);
  }

  if (volumeKeys.length === 0) {
    logger.warn("Nenhuma pasta Vol N encontrada na pasta base.");
    process.exitCode = 1;
    return { converted: 0, skipped: 0, blocked: 0, failed: 1, targetFormat };
  }

  if (!cli.quiet) {
    logger.info(`Pasta base: ${config.pastaBase}`);
    logger.info(`Formato alvo: ${targetFormat}`);
    logger.info(`Volumes locais: ${volumeKeys.join(", ")}`);
  }

  let converted = 0;
  let skipped = 0;
  let blocked = 0;
  let failed = 0;

  for (const volumeKey of volumeKeys) {
    const state = await detectLocalVolumeState({
      volumeKey,
      pastaBase: config.pastaBase,
      seriesName,
    });

    if (state.chapterFiles.length === 0 && !state.mergedExists) {
      logger.warn(`Volume ${volumeKey}: pasta vazia ou sem PDFs de capítulo.`);
      failed++;
      continue;
    }

    if (isTargetFormat(state, targetFormat)) {
      logger.info(`Volume ${volumeKey} já está em ${targetFormat}.`);
      skipped++;
      continue;
    }

    const blockReason = getConversionBlockReason(state.state, targetFormat);
    if (blockReason) {
      logger.warn(`Volume ${volumeKey}: ${blockReason}`);
      blocked++;
      continue;
    }

    const spinner = cli.quiet ? null : ora(`Juntando Volume ${volumeKey}…`).start();

    try {
      await finalizeVolume({
        format: targetFormat,
        volumeKey,
        config,
        logger,
        dryRun: cli.dryRun,
        localOnly: true,
      });

      const successMsg = cli.dryRun
        ? `Volume ${volumeKey} (dry-run)`
        : `Volume ${volumeKey} convertido para ${targetFormat}`;

      if (spinner) {
        spinner.succeed(cli.dryRun ? pc.dim(successMsg) : pc.green(successMsg));
      } else {
        logger.info(successMsg);
      }
      converted++;
    } catch (err) {
      if (spinner) {
        spinner.fail(`Volume ${volumeKey}: ${err.message}`);
      } else {
        logger.error(`Volume ${volumeKey}: ${err.message}`);
      }
      failed++;
    }
  }

  if (!cli.quiet) {
    logger.info("\nConvert");
    logger.info(`   Convertidos: ${converted}${cli.dryRun ? " (dry-run)" : ""}`);
    logger.info(`   Já no formato: ${skipped}`);
    logger.info(`   Bloqueados: ${blocked}`);
    logger.info(`   Falhas: ${failed}`);
  }

  if (failed > 0) {
    process.exitCode = 1;
  }

  return { converted, skipped, blocked, failed, targetFormat };
}
