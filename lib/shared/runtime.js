import fs from "fs/promises";
import { getChaptersForVolume } from "../core/catalog.js";
import { getSerieUrl, normalizeRawConfig, validateConfig } from "../config/store.js";
import { createHttpClient } from "./http.js";
import { loadPlugin } from "../plugins/loader.js";
import { getOutputFormat } from "../output/registry.js";
import { chapterOutputExists } from "../output/write-chapter.js";
import { chapterExists } from "./utils.js";

export function createMatchChapter(plugin, config) {
  if (typeof plugin.fetchChapterPages === "function") {
    const format = getOutputFormat(config, plugin);
    return (capId, files) => chapterOutputExists(format, capId, files, plugin);
  }

  return (capId, files) =>
    chapterExists(capId, files, plugin.getChapterFilePatterns?.(capId) ?? []);
}

export async function loadCatalog({ config, http, plugin, logger }) {
  if (typeof plugin.loadCatalog === "function") {
    return plugin.loadCatalog({ config, http, plugin, logger });
  }

  const serieUrl = getSerieUrl(config);
  if (!serieUrl) {
    throw new Error("serieUrl não configurada em pluginConfig.");
  }

  logger.info(`Carregando catálogo: ${serieUrl}`);
  const seriesBody = await http.fetchText(serieUrl);
  logger.verbose(`Resposta do catálogo: ${seriesBody.length} bytes`);
  return plugin.parseSeriesPage(seriesBody);
}

export async function resolveRuntime(configPath, cliOptions = {}) {
  let raw;

  try {
    raw = JSON.parse(await fs.readFile(configPath, "utf-8"));
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error("CONFIG_MISSING");
    }
    throw err;
  }

  const normalized = normalizeRawConfig(raw);
  const plugin = await loadPlugin(normalized.source);

  const config = validateConfig(normalized, {
    allowEmptyVolumes: cliOptions.allowEmptyVolumes ?? false,
    plugin,
  });

  return { config, plugin };
}

export function createHttpForConfig(config, logger, { onRetry, verboseRetries = false } = {}) {
  return createHttpClient({
    requestTimeoutMs: config.requestTimeoutMs,
    retryDelayMs: config.retryDelayMs,
    maxRetries: config.maxRetries,
    referer: getSerieUrl(config),
    logger,
    onRetry,
    verboseRetries,
  });
}

export function getVolumeKeysFromCatalog(chaptersByVolume, cliVolume) {
  if (cliVolume) {
    return [String(cliVolume)];
  }
  return [...chaptersByVolume.keys()];
}

export function assertVolumeInCatalog(chaptersByVolume, volume, logger) {
  const capitulos = getChaptersForVolume(chaptersByVolume, volume);
  if (capitulos.length === 0) {
    logger.error(`Volume "${volume}" não encontrado no catálogo do site.`);
    return false;
  }
  return true;
}
