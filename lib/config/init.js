import fs from "fs/promises";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { saveConfig, validateConfig } from "./store.js";
import { createHttpClient } from "../shared/http.js";
import { CONFIG_PATH } from "../core/paths.js";
import { discoverPlugins } from "../plugins/loader.js";
import { createLogger, LogLevel } from "../shared/logger.js";
import {
  cancelFlow,
  createCatalogLoader,
  fetchCatalogWithSpinner,
  isCancel,
  printConfigSummary,
  promptField,
} from "../ui/prompts.js";

export async function runInit({ configPath = CONFIG_PATH } = {}) {
  p.intro(pc.bgCyan(pc.black(" manga-downloader ")));

  const configExists = await fs
    .access(configPath)
    .then(() => true)
    .catch(() => false);

  if (configExists) {
    const overwrite = await p.confirm({
      message: "config.json já existe. Sobrescrever?",
      initialValue: false,
    });

    if (isCancel(overwrite)) {
      cancelFlow();
      return;
    }

    if (!overwrite) {
      p.outro("Mantendo configuração existente.");
      return;
    }
  }

  const plugins = await discoverPlugins();
  const pluginOptions = [...plugins.values()].map((plugin) => ({
    value: plugin.id,
    label: plugin.name,
    hint: plugin.description,
  }));

  const source = await p.select({
    message: "Qual a fonte?",
    options: pluginOptions,
  });

  if (isCancel(source)) {
    cancelFlow();
    return;
  }

  const plugin = plugins.get(source);

  const pastaBase = await p.text({
    message: "Pasta base dos downloads",
    placeholder: "D:\\Biblioteca\\Novels",
    validate: (value) => (value?.trim() ? undefined : "Pasta base é obrigatória."),
  });

  if (isCancel(pastaBase)) {
    cancelFlow();
    return;
  }

  /** @type {Record<string, unknown>} */
  const pluginConfig = {};
  /** @type {Record<string, import('../plugins/types.js').SetupOption[]>} */
  let enrichOptions = {};

  const logger = createLogger(LogLevel.QUIET);
  const http = createHttpClient({
    requestTimeoutMs: 30000,
    retryDelayMs: 5000,
    maxRetries: 3,
    logger,
  });

  const loadCatalogOptions = createCatalogLoader({
    plugin,
    http,
    getValues: () => ({ ...pluginConfig, pastaBase: pastaBase.trim() }),
  });

  /** @type {string|undefined} */
  let suggestedSeriesName;

  for (const field of plugin.setupFields) {
    if (field.type === "multiselect" && plugin.enrichSetup) {
      enrichOptions = await fetchCatalogWithSpinner({
        loadCatalogOptions,
        async onFailure() {
          const retry = await p.confirm({
            message: "Tentar novamente?",
            initialValue: true,
          });
          if (isCancel(retry) || !retry) {
            cancelFlow();
            return {};
          }
          return fetchCatalogWithSpinner({ loadCatalogOptions });
        },
      });
    }

    if (
      field.type === "select" &&
      (!enrichOptions[field.key] || enrichOptions[field.key].length === 0) &&
      plugin.enrichSetup
    ) {
      const extra = await plugin.enrichSetup({
        values: { ...pluginConfig, pastaBase: pastaBase.trim() },
        http,
      });
      enrichOptions = { ...enrichOptions, ...extra };
    }

    const initialValue =
      field.key === "outputFormat"
        ? plugin.defaultOutputFormat ?? pluginConfig[field.key]
        : pluginConfig[field.key];

    pluginConfig[field.key] = await promptField(field, enrichOptions, {
      initialValue,
      plugin,
      http,
      pluginConfig,
      onSearchResult(meta) {
        if (meta?.seriesName) {
          suggestedSeriesName = String(meta.seriesName);
        }
      },
    });
  }

  const seriesName = await p.text({
    message: "Nome da série (opcional)",
    placeholder: "Enter para usar nome da pasta",
    defaultValue: suggestedSeriesName,
  });

  if (isCancel(seriesName)) {
    cancelFlow();
    return;
  }

  const draftConfig = {
    source,
    pastaBase: pastaBase.trim(),
    pluginConfig,
    ...(seriesName?.trim() ? { seriesName: seriesName.trim() } : {}),
    concurrency: plugin.recommendedConcurrency ?? 3,
    retryDelayMs: 5000,
    requestTimeoutMs: 30000,
    maxRetries: null,
  };

  const config = validateConfig(draftConfig, { plugin });

  printConfigSummary(config);

  const save = await p.confirm({
    message: "Salvar configuração?",
    initialValue: true,
  });

  if (isCancel(save) || !save) {
    p.cancel("Configuração não salva.");
    return;
  }

  await saveConfig(config, configPath);

  p.outro(
    pc.green(`Config salvo em ${configPath}`) +
      pc.dim("\nRode ") +
      pc.cyan("manga-downloader") +
      pc.dim(" para baixar.")
  );
}
