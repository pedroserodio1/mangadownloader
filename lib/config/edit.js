import fs from "fs/promises";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { getSerieUrl, getOutputFormatSetting, getVolumes, normalizeRawConfig, saveConfig, validateConfig } from "./store.js";
import { createHttpClient } from "../shared/http.js";
import { createLogger, LogLevel } from "../shared/logger.js";
import { CONFIG_PATH } from "../core/paths.js";
import { loadPlugin } from "../plugins/loader.js";
import { getPluginOutputFormats } from "../output/registry.js";
import {
  cancelFlow,
  createCatalogLoader,
  fetchCatalogWithSpinner,
  isCancel,
  printConfigSummary,
  promptField,
} from "../ui/prompts.js";

async function loadExistingConfig(configPath) {
  const raw = JSON.parse(await fs.readFile(configPath, "utf-8"));
  const normalized = normalizeRawConfig(raw);
  const plugin = await loadPlugin(normalized.source);
  const config = validateConfig(normalized, { plugin, allowEmptyVolumes: true });
  return { config, plugin };
}

async function promptOutputFormat({ plugin, config }) {
  const outputField = plugin.setupFields.find((f) => f.key === "outputFormat");
  if (!outputField) {
    p.log.warn("Este plugin não suporta formatos de saída configuráveis.");
    return config;
  }

  let enrichOptions = {};
  if (plugin.enrichSetup) {
    enrichOptions = await plugin.enrichSetup({
      values: { ...config.pluginConfig, pastaBase: config.pastaBase },
      http: createHttpClient({
        requestTimeoutMs: config.requestTimeoutMs,
        retryDelayMs: config.retryDelayMs,
        maxRetries: config.maxRetries,
        referer: getSerieUrl(config),
        logger: createLogger(LogLevel.QUIET),
      }),
    });
  }

  const outputFormat = await promptField(outputField, enrichOptions, {
    initialValue: getOutputFormatSetting(config),
  });

  return {
    ...config,
    pluginConfig: { ...config.pluginConfig, outputFormat },
  };
}

async function promptVolumes({ plugin, http, config }) {
  const volumesField = plugin.setupFields.find((f) => f.key === "volumes");
  if (!volumesField) {
    p.log.warn("Este plugin não suporta edição de volumes.");
    return config;
  }

  const loadCatalogOptions = createCatalogLoader({
    plugin,
    http,
    getValues: () => ({
      ...config.pluginConfig,
      pastaBase: config.pastaBase,
    }),
  });

  let enrichOptions = {};
  if (plugin.enrichSetup) {
    enrichOptions = await fetchCatalogWithSpinner({
      loadCatalogOptions,
      async onFailure() {
        const retry = await p.confirm({
          message: "Tentar carregar o catálogo novamente?",
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

  const volumes = await promptField(volumesField, enrichOptions, {
    initialValue: getVolumes(config),
  });

  return {
    ...config,
    pluginConfig: { ...config.pluginConfig, volumes },
  };
}

async function promptAdvanced(config) {
  const concurrency = await p.text({
    message: "Downloads simultâneos (concurrency)",
    defaultValue: String(config.concurrency),
    validate: (value) => {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1) {
        return "Informe um inteiro >= 1.";
      }
      return undefined;
    },
  });

  if (isCancel(concurrency)) {
    cancelFlow();
    return config;
  }

  const retryDelayMs = await p.text({
    message: "Espera entre tentativas (ms)",
    defaultValue: String(config.retryDelayMs),
    validate: (value) => {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0) {
        return "Informe um inteiro >= 0.";
      }
      return undefined;
    },
  });

  if (isCancel(retryDelayMs)) {
    cancelFlow();
    return config;
  }

  const requestTimeoutMs = await p.text({
    message: "Timeout por requisição (ms)",
    defaultValue: String(config.requestTimeoutMs),
    validate: (value) => {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1000) {
        return "Informe um inteiro >= 1000.";
      }
      return undefined;
    },
  });

  if (isCancel(requestTimeoutMs)) {
    cancelFlow();
    return config;
  }

  const maxRetriesRaw = await p.text({
    message: "Máximo de tentativas (vazio = infinito)",
    defaultValue: config.maxRetries === null ? "" : String(config.maxRetries),
    validate: (value) => {
      if (!value.trim()) return undefined;
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0) {
        return "Informe um inteiro >= 0 ou deixe vazio.";
      }
      return undefined;
    },
  });

  if (isCancel(maxRetriesRaw)) {
    cancelFlow();
    return config;
  }

  return {
    ...config,
    concurrency: Number(concurrency),
    retryDelayMs: Number(retryDelayMs),
    requestTimeoutMs: Number(requestTimeoutMs),
    maxRetries: maxRetriesRaw.trim() ? Number(maxRetriesRaw) : null,
  };
}

export async function runConfigEdit({ configPath = CONFIG_PATH } = {}) {
  p.intro(pc.bgCyan(pc.black(" editar config ")));

  let { config, plugin } = await loadExistingConfig(configPath);

  const logger = createLogger(LogLevel.QUIET);
  const http = createHttpClient({
    requestTimeoutMs: config.requestTimeoutMs,
    retryDelayMs: config.retryDelayMs,
    maxRetries: config.maxRetries,
    referer: getSerieUrl(config),
    logger,
  });

  let saved = false;

  while (!saved) {
    printConfigSummary(config);

    const action = await p.select({
      message: "O que deseja editar?",
      options: [
        {
          value: "outputFormat",
          label: "Formato de saída",
          hint:
            getPluginOutputFormats(plugin).find((f) => f.id === getOutputFormatSetting(config))
              ?.label ?? getOutputFormatSetting(config),
        },
        {
          value: "volumes",
          label: "Volumes para baixar",
          hint: getVolumes(config).join(", ") || "nenhum",
        },
        {
          value: "pastaBase",
          label: "Pasta base",
          hint: config.pastaBase,
        },
        {
          value: "serieUrl",
          label:
            plugin.setupFields.find((f) => f.key === "serieUrl")?.type === "search"
              ? "Buscar / trocar manga"
              : "URL da série",
          hint: getSerieUrl(config) ?? "",
        },
        {
          value: "seriesName",
          label: "Nome da série",
          hint: config.seriesName || "(nome da pasta)",
        },
        { value: "advanced", label: "Opções avançadas" },
        { value: "save", label: "Salvar e sair" },
        { value: "discard", label: "Descartar alterações" },
      ],
    });

    if (isCancel(action)) {
      cancelFlow();
      return;
    }

    if (action === "discard") {
      p.outro("Alterações descartadas.");
      return;
    }

    if (action === "save") {
      const volumes = getVolumes(config);
      if (volumes.length === 0) {
        const proceed = await p.confirm({
          message: "Nenhum volume selecionado. Salvar mesmo assim?",
          initialValue: false,
        });
        if (isCancel(proceed) || !proceed) {
          continue;
        }
      }

      const validated = validateConfig(config, { plugin, allowEmptyVolumes: true });
      printConfigSummary(validated);

      const confirm = await p.confirm({
        message: "Salvar configuração?",
        initialValue: true,
      });

      if (isCancel(confirm) || !confirm) {
        continue;
      }

      await saveConfig(validated, configPath);
      p.outro(pc.green(`Config salvo em ${configPath}`));
      saved = true;
      continue;
    }

    if (action === "outputFormat") {
      config = await promptOutputFormat({ plugin, config });
      continue;
    }

    if (action === "volumes") {
      config = await promptVolumes({ plugin, http, config });
      continue;
    }

    if (action === "pastaBase") {
      const pastaBase = await p.text({
        message: "Pasta base dos downloads",
        defaultValue: config.pastaBase,
        validate: (value) => (value?.trim() ? undefined : "Pasta base é obrigatória."),
      });
      if (isCancel(pastaBase)) {
        cancelFlow();
        return;
      }
      config = { ...config, pastaBase: pastaBase.trim() };
      continue;
    }

    if (action === "serieUrl") {
      const serieUrlField = plugin.setupFields.find((f) => f.key === "serieUrl");
      if (!serieUrlField) {
        p.log.warn("Este plugin não suporta edição de URL da série.");
        continue;
      }

      const previousUrl = getSerieUrl(config);
      /** @type {string|undefined} */
      let suggestedSeriesName;

      const serieUrl = await promptField(serieUrlField, {}, {
        initialValue: previousUrl,
        plugin,
        http,
        pluginConfig: config.pluginConfig,
        onSearchResult(meta) {
          if (meta?.seriesName) {
            suggestedSeriesName = String(meta.seriesName);
          }
        },
      });

      config = {
        ...config,
        pluginConfig: { ...config.pluginConfig, serieUrl },
      };

      if (suggestedSeriesName) {
        const updateName = await p.confirm({
          message: `Atualizar nome da série para "${suggestedSeriesName}"?`,
          initialValue: true,
        });
        if (!isCancel(updateName) && updateName) {
          config = { ...config, seriesName: suggestedSeriesName };
        }
      }

      if (previousUrl !== serieUrl) {
        const reloadVolumes = await p.confirm({
          message: "O manga mudou. Recarregar lista de volumes?",
          initialValue: true,
        });
        if (!isCancel(reloadVolumes) && reloadVolumes) {
          config = await promptVolumes({ plugin, http, config });
        }
      }
      continue;
    }

    if (action === "seriesName") {
      const seriesName = await p.text({
        message: "Nome da série (vazio = nome da pasta)",
        defaultValue: config.seriesName ?? "",
      });
      if (isCancel(seriesName)) {
        cancelFlow();
        return;
      }
      config = {
        ...config,
        seriesName: seriesName.trim() || undefined,
      };
      continue;
    }

    if (action === "advanced") {
      config = await promptAdvanced(config);
    }
  }
}
