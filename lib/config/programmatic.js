import fs from "fs/promises";
import { CONFIG_PATH } from "../core/paths.js";
import { discoverPlugins, loadPlugin } from "../plugins/loader.js";
import { createHttpClient } from "../shared/http.js";
import { createLogger, LogLevel } from "../shared/logger.js";
import { getPluginOutputFormats } from "../output/registry.js";
import { createCatalogLoader } from "../ui/prompts.js";
import {
  configExists,
  getSerieUrl,
  getVolumes,
  loadConfig,
  normalizeRawConfig,
  saveConfig,
  validateConfig,
} from "./store.js";

/**
 * @param {string} [envPath]
 * @returns {string}
 */
export function resolveConfigPath(envPath = process.env.MANGA_DOWNLOADER_CONFIG) {
  return envPath?.trim() || CONFIG_PATH;
}

/**
 * @param {import('../../plugins/types.js').SourcePlugin} plugin
 */
export function describePlugin(plugin) {
  return {
    id: plugin.id,
    name: plugin.name,
    description: plugin.description ?? null,
    defaultOutputFormat: plugin.defaultOutputFormat ?? null,
    recommendedConcurrency: plugin.recommendedConcurrency ?? 3,
    chapterContentType: plugin.chapterContentType ?? "pdf",
    setupFields: plugin.setupFields.map((f) => ({
      key: f.key,
      type: f.type,
      label: f.label,
      placeholder: f.placeholder ?? null,
      required: f.required !== false,
    })),
    outputFormats: getPluginOutputFormats(plugin).map((f) => ({
      id: f.id,
      label: f.label,
      description: f.description ?? null,
      default: f.default ?? false,
    })),
    hasSearch: typeof plugin.searchManga === "function",
  };
}

export async function listPlugins() {
  const plugins = await discoverPlugins();
  return [...plugins.values()].map(describePlugin);
}

/**
 * @param {{ source: string, pluginConfig: Record<string, unknown>, pastaBase?: string }} params
 */
export async function fetchCatalogOptions({ source, pluginConfig, pastaBase = "" }) {
  const plugin = await loadPlugin(source);
  const logger = createLogger(LogLevel.QUIET);
  const http = createHttpClient({
    requestTimeoutMs: 30000,
    retryDelayMs: 5000,
    maxRetries: 3,
    referer: typeof pluginConfig.serieUrl === "string" ? pluginConfig.serieUrl : undefined,
    logger,
  });

  const values = { ...pluginConfig, pastaBase };
  let enrichOptions = {};

  if (plugin.enrichSetup) {
    const loadCatalogOptions = createCatalogLoader({
      plugin,
      http,
      getValues: () => values,
    });
    enrichOptions = await loadCatalogOptions(null);
  }

  const volumesField = plugin.setupFields.find((f) => f.key === "volumes");
  const volumeOptions = volumesField ? enrichOptions[volumesField.key] ?? [] : [];

  return {
    plugin: describePlugin(plugin),
    enrichOptions,
    volumes: volumeOptions.map((opt) => ({
      value: opt.value,
      label: opt.label,
      hint: opt.hint ?? null,
      chapterCount: opt.meta?.chapterCount ?? null,
    })),
  };
}

/**
 * @param {object} input
 * @param {{ configPath?: string, overwrite?: boolean }} [options]
 */
export async function createConfig(
  input,
  { configPath = resolveConfigPath(), overwrite = false } = {}
) {
  const exists = await configExists(configPath);
  if (exists && !overwrite) {
    throw new Error(
      `config.json já existe em ${configPath}. Use overwrite: true para substituir.`
    );
  }

  const plugin = await loadPlugin(input.source);
  const draft = {
    source: input.source,
    pastaBase: input.pastaBase,
    pluginConfig: input.pluginConfig,
    ...(input.seriesName ? { seriesName: input.seriesName } : {}),
    concurrency: input.concurrency ?? plugin.recommendedConcurrency ?? 3,
    retryDelayMs: input.retryDelayMs ?? 5000,
    requestTimeoutMs: input.requestTimeoutMs ?? 30000,
    maxRetries: input.maxRetries ?? null,
  };

  const config = validateConfig(draft, { plugin });
  await saveConfig(config, configPath);
  return { config, configPath, plugin: describePlugin(plugin) };
}

/**
 * @param {object} patch
 * @param {{ configPath?: string, reloadVolumes?: boolean }} [options]
 */
export async function updateConfig(
  patch,
  { configPath = resolveConfigPath(), reloadVolumes = false } = {}
) {
  const raw = JSON.parse(await fs.readFile(configPath, "utf-8"));
  const normalized = normalizeRawConfig(raw);
  const plugin = await loadPlugin(normalized.source);

  let config = validateConfig(normalized, { plugin, allowEmptyVolumes: true });

  if (patch.pastaBase !== undefined) {
    config = { ...config, pastaBase: String(patch.pastaBase).trim() };
  }

  if (patch.seriesName !== undefined) {
    const name = String(patch.seriesName).trim();
    config = { ...config, seriesName: name || undefined };
  }

  if (patch.concurrency !== undefined) {
    config = { ...config, concurrency: patch.concurrency };
  }
  if (patch.retryDelayMs !== undefined) {
    config = { ...config, retryDelayMs: patch.retryDelayMs };
  }
  if (patch.requestTimeoutMs !== undefined) {
    config = { ...config, requestTimeoutMs: patch.requestTimeoutMs };
  }
  if (patch.maxRetries !== undefined) {
    config = { ...config, maxRetries: patch.maxRetries };
  }

  const pluginPatch = patch.pluginConfig ?? {};
  const mergedPluginConfig = { ...config.pluginConfig };

  if (patch.outputFormat !== undefined) {
    mergedPluginConfig.outputFormat = patch.outputFormat;
  }
  if (patch.volumes !== undefined) {
    mergedPluginConfig.volumes = patch.volumes.map(String);
  }
  if (patch.serieUrl !== undefined) {
    mergedPluginConfig.serieUrl = patch.serieUrl;
  }

  for (const [key, value] of Object.entries(pluginPatch)) {
    mergedPluginConfig[key] = value;
  }

  config = { ...config, pluginConfig: mergedPluginConfig };

  const serieUrlChanged =
    patch.serieUrl !== undefined && patch.serieUrl !== getSerieUrl(normalized);

  if ((reloadVolumes || serieUrlChanged) && patch.volumes === undefined) {
    const catalog = await fetchCatalogOptions({
      source: config.source,
      pluginConfig: config.pluginConfig,
      pastaBase: config.pastaBase,
    });
    if (catalog.volumes.length > 0) {
      mergedPluginConfig.volumes = catalog.volumes.map((v) => v.value);
      config = { ...config, pluginConfig: mergedPluginConfig };
    }
  }

  const validated = validateConfig(config, { plugin, allowEmptyVolumes: true });
  await saveConfig(validated, configPath);
  return { config: validated, configPath, plugin: describePlugin(plugin) };
}

export async function getConfigSnapshot({ configPath = resolveConfigPath() } = {}) {
  const exists = await configExists(configPath);
  if (!exists) {
    throw new Error("CONFIG_MISSING");
  }

  const config = await loadConfig(configPath, { allowEmptyVolumes: true });
  const plugin = await loadPlugin(config.source);

  return {
    config,
    configPath,
    plugin: describePlugin(plugin),
    volumes: getVolumes(config),
  };
}

/**
 * @param {string} source
 * @param {string} query
 * @param {Record<string, unknown>} [filters]
 */
export async function searchManga(source, query, filters = {}) {
  const plugin = await loadPlugin(source);
  if (typeof plugin.searchManga !== "function") {
    throw new Error(`Plugin "${source}" não suporta busca de manga.`);
  }

  const logger = createLogger(LogLevel.QUIET);
  const http = createHttpClient({
    requestTimeoutMs: 30000,
    retryDelayMs: 5000,
    maxRetries: 3,
    logger,
  });

  const results = await plugin.searchManga(query, { http, filters, values: {} });
  return results.map((opt) => ({
    value: opt.value,
    label: opt.label,
    hint: opt.hint ?? null,
    meta: opt.meta ?? null,
  }));
}
