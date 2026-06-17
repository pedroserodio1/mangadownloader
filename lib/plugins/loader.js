import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import { ROOT_DIR } from "../core/paths.js";

const PLUGINS_DIR = path.join(ROOT_DIR, "plugins");

/** @type {Map<string, import('../../plugins/types.js').SourcePlugin>|null} */
let cache = null;

function isSourcePlugin(value) {
  return value && typeof value === "object" && typeof value.id === "string";
}

/**
 * @param {unknown} mod
 * @param {string} folderId
 * @returns {import('../../plugins/types.js').SourcePlugin}
 */
export function validatePlugin(mod, folderId) {
  const plugin = mod?.default ?? mod?.plugin ?? mod;

  if (!isSourcePlugin(plugin)) {
    throw new Error(`Plugin "${folderId}" não exporta um SourcePlugin válido.`);
  }

  if (plugin.id !== folderId) {
    throw new Error(
      `Plugin em plugins/${folderId}/ deve ter id "${folderId}", recebeu "${plugin.id}".`
    );
  }

  if (!plugin.name || typeof plugin.name !== "string") {
    throw new Error(`Plugin "${folderId}" precisa de name (string).`);
  }

  if (!Array.isArray(plugin.setupFields)) {
    throw new Error(`Plugin "${folderId}" precisa de setupFields (array).`);
  }

  if (typeof plugin.parseSeriesPage !== "function") {
    throw new Error(`Plugin "${folderId}" precisa de parseSeriesPage().`);
  }

  if (typeof plugin.resolvePdfUrl !== "function") {
    throw new Error(`Plugin "${folderId}" precisa de resolvePdfUrl().`);
  }

  return plugin;
}

async function importPluginFromDir(folderId) {
  const indexPath = path.join(PLUGINS_DIR, folderId, "index.js");
  try {
    await fs.access(indexPath);
  } catch {
    return null;
  }

  const mod = await import(pathToFileURL(indexPath).href);
  return validatePlugin(mod, folderId);
}

/**
 * @returns {Promise<Map<string, import('../plugins/types.js').SourcePlugin>>}
 */
export async function discoverPlugins() {
  if (cache) return cache;

  const entries = await fs.readdir(PLUGINS_DIR, { withFileTypes: true });
  const plugins = new Map();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("_")) continue;
    if (entry.name === "types.js") continue;

    const plugin = await importPluginFromDir(entry.name);
    if (plugin) {
      plugins.set(plugin.id, plugin);
    }
  }

  if (plugins.size === 0) {
    throw new Error(`Nenhum plugin encontrado em ${PLUGINS_DIR}`);
  }

  cache = plugins;
  return plugins;
}

/**
 * @param {string} id
 * @returns {Promise<import('../plugins/types.js').SourcePlugin>}
 */
export async function loadPlugin(id) {
  const plugins = await discoverPlugins();
  const plugin = plugins.get(id);

  if (!plugin) {
    const available = [...plugins.keys()].join(", ");
    throw new Error(`Plugin "${id}" não encontrado. Disponíveis: ${available}`);
  }

  return plugin;
}

/**
 * @returns {Promise<Array<{ id: string, name: string, description?: string }>>}
 */
export async function listPlugins() {
  const plugins = await discoverPlugins();
  return [...plugins.values()].map(({ id, name, description }) => ({
    id,
    name,
    description,
  }));
}

export function clearPluginCache() {
  cache = null;
}
