import fs from "fs/promises";
import { CONFIG_PATH } from "../core/paths.js";
import { validateOutputFormat } from "../output/registry.js";

const DEFAULTS = {
  concurrency: 3,
  retryDelayMs: 5000,
  requestTimeoutMs: 30000,
  maxRetries: null,
};

export function normalizeRawConfig(raw) {
  if (!raw || typeof raw !== "object") {
    return raw;
  }

  const normalized = { ...raw };

  if (!normalized.pluginConfig && (normalized.serieUrl || normalized.volumes)) {
    normalized.pluginConfig = {
      ...(normalized.serieUrl ? { serieUrl: normalized.serieUrl } : {}),
      ...(normalized.volumes ? { volumes: normalized.volumes } : {}),
    };
    delete normalized.serieUrl;
    delete normalized.volumes;
  }

  if (!normalized.source && normalized.pluginConfig?.serieUrl) {
    const url = String(normalized.pluginConfig.serieUrl);
    if (url.includes("centralnovel.com")) {
      normalized.source = "centralnovel";
    } else if (url.includes("mangadex.org")) {
      normalized.source = "mangadex";
    }
  }

  if (!normalized.source) {
    normalized.source = "centralnovel";
  }

  if (!normalized.pluginConfig || typeof normalized.pluginConfig !== "object") {
    normalized.pluginConfig = {};
  }

  if (!normalized.pluginConfig.outputFormat) {
    normalized.pluginConfig.outputFormat = "chapters";
  }

  return normalized;
}

export function getPluginSetting(config, key) {
  return config.pluginConfig?.[key];
}

export function getSerieUrl(config) {
  return getPluginSetting(config, "serieUrl");
}

export function getVolumes(config) {
  const volumes = getPluginSetting(config, "volumes");
  return Array.isArray(volumes) ? volumes.map(String) : [];
}

export function getOutputFormatSetting(config) {
  return getPluginSetting(config, "outputFormat") ?? "chapters";
}

export function validatePluginConfig(plugin, pluginConfig, { allowEmptyVolumes = false } = {}) {
  const errors = [];

  for (const field of plugin.setupFields) {
    const value = pluginConfig[field.key];
    const required = field.required !== false;

    if (required && (value === undefined || value === null || value === "")) {
      errors.push(`${field.label} (${field.key}) é obrigatório.`);
      continue;
    }

    if (
      allowEmptyVolumes &&
      field.key === "volumes" &&
      Array.isArray(value) &&
      value.length === 0
    ) {
      continue;
    }

    if (value !== undefined && field.validate) {
      const fieldError = field.validate(value);
      if (fieldError) {
        errors.push(fieldError);
      }
    }
  }

  if (pluginConfig.outputFormat !== undefined && plugin.outputFormats) {
    try {
      validateOutputFormat(String(pluginConfig.outputFormat), plugin);
    } catch (err) {
      errors.push(err.message);
    }
  }

  return errors;
}

export function validateConfig(raw, { allowEmptyVolumes = false, plugin = null } = {}) {
  const errors = [];
  const normalized = normalizeRawConfig(raw);

  if (!normalized || typeof normalized !== "object") {
    throw new Error("Config inválido: arquivo deve ser um objeto JSON.");
  }

  if (!normalized.source || typeof normalized.source !== "string") {
    errors.push("source é obrigatório (string).");
  }

  if (!normalized.pastaBase || typeof normalized.pastaBase !== "string") {
    errors.push("pastaBase é obrigatório (string).");
  }

  if (!normalized.pluginConfig || typeof normalized.pluginConfig !== "object") {
    errors.push("pluginConfig é obrigatório (objeto).");
  }

  if (plugin && normalized.pluginConfig) {
    errors.push(
      ...validatePluginConfig(plugin, normalized.pluginConfig, { allowEmptyVolumes })
    );
  }

  const volumes = getVolumes(normalized);
  if (volumes.length === 0 && !allowEmptyVolumes) {
    errors.push("volumes está vazio — adicione ao menos um volume em pluginConfig.");
  }

  const serieUrl = getSerieUrl(normalized);
  if (serieUrl) {
    try {
      new URL(serieUrl);
    } catch {
      errors.push("serieUrl deve ser uma URL válida.");
    }
  } else if (plugin?.setupFields?.some((f) => f.key === "serieUrl" && f.required !== false)) {
    errors.push("serieUrl é obrigatório em pluginConfig.");
  }

  if (
    normalized.concurrency !== undefined &&
    (!Number.isInteger(normalized.concurrency) || normalized.concurrency < 1)
  ) {
    errors.push("concurrency deve ser um inteiro >= 1.");
  }

  if (
    normalized.retryDelayMs !== undefined &&
    (!Number.isInteger(normalized.retryDelayMs) || normalized.retryDelayMs < 0)
  ) {
    errors.push("retryDelayMs deve ser um inteiro >= 0.");
  }

  if (
    normalized.requestTimeoutMs !== undefined &&
    (!Number.isInteger(normalized.requestTimeoutMs) || normalized.requestTimeoutMs < 1000)
  ) {
    errors.push("requestTimeoutMs deve ser um inteiro >= 1000.");
  }

  if (
    normalized.maxRetries !== undefined &&
    normalized.maxRetries !== null &&
    (!Number.isInteger(normalized.maxRetries) || normalized.maxRetries < 0)
  ) {
    errors.push("maxRetries deve ser null (infinito) ou um inteiro >= 0.");
  }

  if (normalized.seriesName !== undefined && typeof normalized.seriesName !== "string") {
    errors.push("seriesName deve ser uma string.");
  }

  if (errors.length > 0) {
    throw new Error(`Config inválido:\n- ${errors.join("\n- ")}`);
  }

  return {
    source: normalized.source,
    pastaBase: normalized.pastaBase,
    pluginConfig: { ...normalized.pluginConfig },
    seriesName: normalized.seriesName?.trim() || undefined,
    concurrency: normalized.concurrency ?? DEFAULTS.concurrency,
    retryDelayMs: normalized.retryDelayMs ?? DEFAULTS.retryDelayMs,
    requestTimeoutMs: normalized.requestTimeoutMs ?? DEFAULTS.requestTimeoutMs,
    maxRetries: normalized.maxRetries ?? DEFAULTS.maxRetries,
  };
}

export async function configExists(configPath = CONFIG_PATH) {
  try {
    await fs.access(configPath);
    return true;
  } catch {
    return false;
  }
}

export async function loadConfig(configPath = CONFIG_PATH, options = {}) {
  const raw = JSON.parse(await fs.readFile(configPath, "utf-8"));
  return validateConfig(raw, options);
}

export async function saveConfig(config, configPath = CONFIG_PATH) {
  const payload = {
    source: config.source,
    pastaBase: config.pastaBase,
    pluginConfig: config.pluginConfig,
    ...(config.seriesName ? { seriesName: config.seriesName } : {}),
    concurrency: config.concurrency,
    retryDelayMs: config.retryDelayMs,
    requestTimeoutMs: config.requestTimeoutMs,
    maxRetries: config.maxRetries,
  };
  await fs.writeFile(configPath, JSON.stringify(payload, null, 2), "utf-8");
}

export async function removeVolumeFromConfig(config, volumeNumero, configPath = CONFIG_PATH) {
  const volumes = getVolumes(config).filter((v) => v !== String(volumeNumero));
  config.pluginConfig = { ...config.pluginConfig, volumes };
  await saveConfig(config, configPath);
}
