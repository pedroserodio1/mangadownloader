import {
  createConfig,
  fetchCatalogOptions,
  getConfigSnapshot,
  listPlugins,
  resolveConfigPath,
  searchManga,
  updateConfig,
} from "../config/programmatic.js";
import {
  executeConvert,
  executeDownload,
  executeRename,
  executeReview,
} from "./execute.js";
import { formatPayloadWithLogs, formatToolError } from "./responses.js";

/**
 * @param {() => Promise<unknown>} fn
 */
async function safeCall(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err.message === "CONFIG_MISSING") {
      return formatToolError(
        "config.json não encontrado. Use config_create ou execute manga-downloader init."
      );
    }
    return formatToolError(err);
  }
}

export async function handlePluginsList() {
  const plugins = await listPlugins();
  return formatPayloadWithLogs({ success: true, plugins });
}

export async function handleConfigGet() {
  return safeCall(async () => {
    const snapshot = await getConfigSnapshot();
    return formatPayloadWithLogs({ success: true, ...snapshot });
  });
}

export async function handleConfigCreate(input) {
  return safeCall(async () => {
    const { overwrite, ...configInput } = input;
    const result = await createConfig(configInput, { overwrite: Boolean(overwrite) });
    return formatPayloadWithLogs({ success: true, ...result });
  });
}

export async function handleConfigUpdate(input) {
  return safeCall(async () => {
    const result = await updateConfig(input);
    return formatPayloadWithLogs({ success: true, ...result });
  });
}

export async function handleCatalogGet(input) {
  return safeCall(async () => {
    const catalog = await fetchCatalogOptions(input);
    return formatPayloadWithLogs({ success: true, ...catalog });
  });
}

export async function handleMangaSearch(input) {
  return safeCall(async () => {
    const results = await searchManga(input.source, input.query, input.filters ?? {});
    return formatPayloadWithLogs({ success: true, results });
  });
}

export async function handleDownload(input) {
  return safeCall(async () => {
    const result = await executeDownload(input);
    return formatPayloadWithLogs(result, result.logs);
  });
}

export async function handleReview(input) {
  return safeCall(async () => {
    const result = await executeReview(input);
    return formatPayloadWithLogs(result, result.logs);
  });
}

export async function handleRename(input) {
  return safeCall(async () => {
    const result = await executeRename(input);
    return formatPayloadWithLogs(result, result.logs);
  });
}

export async function handleConvert(input) {
  return safeCall(async () => {
    const result = await executeConvert(input);
    return formatPayloadWithLogs(result, result.logs);
  });
}

export async function readConfigResource() {
  const snapshot = await getConfigSnapshot();
  return {
    contents: [
      {
        uri: "config://current",
        mimeType: "application/json",
        text: JSON.stringify(snapshot, null, 2),
      },
    ],
  };
}

export async function readPluginResource(pluginId) {
  const plugins = await listPlugins();
  const plugin = plugins.find((p) => p.id === pluginId);
  if (!plugin) {
    throw new Error(`Plugin "${pluginId}" não encontrado.`);
  }
  return {
    contents: [
      {
        uri: `plugin://${pluginId}`,
        mimeType: "application/json",
        text: JSON.stringify(plugin, null, 2),
      },
    ],
  };
}

export function getConfigPathForMcp() {
  return resolveConfigPath();
}
