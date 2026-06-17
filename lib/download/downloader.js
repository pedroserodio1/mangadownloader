import fs from "fs/promises";
import path from "path";
import { describeAppError, formatErrorShort } from "../shared/errors.js";
import { resolveSeriesName } from "../core/naming.js";
import { finalizeVolume } from "../output/finalize.js";
import { getOutputFormat } from "../output/registry.js";
import { needsVolumeFinalize } from "../output/archive.js";
import { chapterOutputExists, writeChapterOutput } from "../output/write-chapter.js";
import { getVolumeDir, getChapterStagingDir } from "../core/paths.js";
import { isVolumeArchiveFormat } from "../output/archive.js";
import {
  chapterExists,
  createLimiter,
  createStats,
  writeFileAtomic,
} from "../shared/utils.js";
import { buildPdfFileName } from "../core/naming.js";

export function createDownloader({ config, http, logger, plugin, ui, matchChapter, outputFormat }) {
  const inFlight = new Map();
  const resolveChapter = matchChapter ?? ((capId, files) => chapterExists(capId, files));

  function runOnce(key, fn) {
    if (inFlight.has(key)) return inFlight.get(key);
    const promise = fn().finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  }

  async function ensureVolumeDir(volume) {
    const dir = getVolumeDir(config.pastaBase, volume);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  function bindRetryHandler(volume, capId) {
    if (!ui?.onRetry && !http.setOnRetry) return;

    http.setOnRetry(({ attempt, error, delayMs }) => {
      if (ui?.onRetry) {
        ui.onRetry(volume, capId, {
          attempt,
          message: formatErrorShort(error),
          delaySec: Math.round(delayMs / 1000),
        });
      }
    });
  }

  function clearRetryHandler() {
    http.setOnRetry?.(null);
  }

  async function listVolumeEntries(volumeDir) {
    try {
      return await fs.readdir(volumeDir);
    } catch {
      return [];
    }
  }

  async function chapterAlreadyDownloaded(volume, capId, existingFiles, format) {
    if (isVolumeArchiveFormat(format)) {
      const capDir = getChapterStagingDir(config.pastaBase, volume, capId);
      try {
        const entries = await fs.readdir(capDir);
        return entries.some((f) => /\.(jpe?g|png)$/i.test(f));
      } catch {
        return false;
      }
    }
    return resolveChapter(capId, existingFiles);
  }

  async function downloadChapter(volume, capId, pdfPageUrl, existingFiles, format, { dryRun = false } = {}) {
    bindRetryHandler(volume, capId);

    try {
      if (await chapterAlreadyDownloaded(volume, capId, existingFiles, format)) {
        if (ui) {
          ui.onProgress(volume, capId, "skipped");
        } else {
          logger.info(`Capítulo ${capId} já existe, pulando download.`);
        }
        return { status: "skipped" };
      }

      if (dryRun) {
        if (ui) {
          ui.onProgress(volume, capId, "dry-run");
        } else {
          logger.info(`[dry-run] Baixaria Vol ${volume} Cap ${capId} — ${pdfPageUrl}`);
        }
        return { status: "dry-run" };
      }

      if (ui) {
        ui.onProgress(volume, capId, "downloading");
      }

      const volumeDir = await ensureVolumeDir(volume);
      const seriesName = resolveSeriesName(config);

      if (typeof plugin.fetchChapterPages === "function") {
        const pages = await plugin.fetchChapterPages(pdfPageUrl, { http, logger, config });
        logger.verbose(`Páginas recebidas: ${pages.length}`);

        const arquivo = await writeChapterOutput({
          format,
          pages,
          volumeKey: volume,
          capId,
          seriesName,
          pastaBase: config.pastaBase,
        });

        const entryName = path.basename(arquivo);
        if (!existingFiles.includes(entryName)) {
          existingFiles.push(entryName);
        }

        if (ui) {
          ui.onProgress(volume, capId, "done");
        } else {
          logger.info(`Download concluído: ${arquivo}`);
        }

        return { status: "downloaded", arquivo };
      }

      const realPdfUrl = await plugin.resolvePdfUrl(pdfPageUrl, { http, logger, config });
      const { buffer } = await http.fetchBuffer(realPdfUrl);

      logger.verbose(`Buffer recebido: ${buffer.length} bytes`);

      const nomeArquivo = buildPdfFileName({
        seriesName,
        volumeKey: volume,
        capId,
      });

      logger.verbose(`Nome do arquivo: ${nomeArquivo}`);

      const arquivo = path.join(volumeDir, nomeArquivo);
      await writeFileAtomic(arquivo, buffer);
      existingFiles.push(nomeArquivo);

      if (ui) {
        ui.onProgress(volume, capId, "done");
      } else {
        logger.info(`Download concluído: ${arquivo}`);
      }

      return { status: "downloaded", arquivo };
    } finally {
      clearRetryHandler();
    }
  }

  function recordError(stats, volume, capId, err) {
    const described = describeAppError(err);
    const shortMessage = formatErrorShort(err);

    stats.failed++;
    stats.errors.push({
      volume,
      capId,
      status: described.status,
      title: described.title,
      hint: described.hint,
      message: shortMessage,
    });

    if (ui) {
      ui.onProgress(volume, capId, "error", shortMessage);
    } else {
      logger.error(`Falha permanente Vol ${volume} Cap ${capId}: ${shortMessage}`);
      logger.verbose(err.message);
    }
  }

  async function downloadVolume(volumeNumero, capitulos, { dryRun = false } = {}) {
    const stats = createStats();
    const total = capitulos.length;

    if (total === 0) {
      logger.warn(`Nenhum capítulo encontrado para Volume ${volumeNumero}.`);
      return stats;
    }

    if (ui) {
      ui.onVolumeStart(volumeNumero, total);
    } else {
      logger.info(`\nVolume ${volumeNumero}: ${total} capítulo(s) para processar.`);
    }

    const volumeDir = await ensureVolumeDir(volumeNumero);
    const formatForOutput = outputFormat ?? getOutputFormat(config, plugin);
    const existingFiles = await listVolumeEntries(volumeDir);
    const limit = createLimiter(config.concurrency);

    for (const cap of capitulos) {
      if (ui) ui.onProgress(volumeNumero, cap.capId, "queued");
    }

    const tasks = capitulos.map((cap) =>
      limit(() =>
        runOnce(`${volumeNumero}:${cap.capId}`, async () => {
          try {
            const result = await downloadChapter(
              volumeNumero,
              cap.capId,
              cap.pdfPageUrl,
              existingFiles,
              formatForOutput,
              { dryRun }
            );

            if (result.status === "downloaded") stats.downloaded++;
            else if (result.status === "skipped") stats.skipped++;
            else if (result.status === "dry-run") stats.downloaded++;

            if (!ui) {
              logger.verbose(
                `Vol ${volumeNumero} Cap ${cap.capId} → ${result.arquivo || result.status}`
              );
            }
          } catch (err) {
            recordError(stats, volumeNumero, cap.capId, err);
          }
        })
      )
    );

    await Promise.all(tasks);

    const formatForMerge = outputFormat ?? getOutputFormat(config, plugin);

    if (!dryRun && stats.failed === 0 && needsVolumeFinalize(formatForMerge)) {
      try {
        await finalizeVolume({
          format: formatForMerge,
          volumeKey: volumeNumero,
          catalogChapters: capitulos,
          config,
          logger,
          matchChapter: resolveChapter,
        });
      } catch (err) {
        recordError(stats, volumeNumero, "merge", err);
      }
    }

    if (ui) {
      ui.onVolumeComplete(volumeNumero, stats);
    }

    return stats;
  }

  return { downloadVolume };
}
