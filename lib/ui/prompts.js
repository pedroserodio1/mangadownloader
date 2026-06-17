import * as p from "@clack/prompts";
import ora from "ora";
import pc from "picocolors";
import { describeAppError, formatErrorShort } from "../shared/errors.js";

export function isCancel(value) {
  return p.isCancel(value);
}

export function cancelFlow(message = "Configuração cancelada.") {
  p.cancel(message);
  process.exitCode = 1;
}

export async function promptField(
  field,
  enrichOptions = {},
  { initialValue, plugin, http, pluginConfig, onSearchResult } = {}
) {
  const required = field.required !== false;

  if (field.type === "search" && plugin?.searchManga && http) {
    const result = await promptSearchField(field, plugin, {
      http,
      initialValue,
      pluginConfig,
      onSearchResult,
    });
    if (result.searchFilters) {
      pluginConfig.searchFilters = result.searchFilters;
    }
    return result.value;
  }

  if (field.type === "multiselect") {
    const options = enrichOptions[field.key] ?? [];
    if (options.length === 0) {
      p.log.warn(`Nenhuma opção disponível para ${field.label}.`);
      return initialValue ?? [];
    }

    const selected = await p.multiselect({
      message: field.label,
      options: options.map((opt) => ({
        value: opt.value,
        label: opt.hint ? `${opt.label} (${opt.hint})` : opt.label,
      })),
      required,
      initialValues: initialValue,
    });

    if (isCancel(selected)) {
      cancelFlow();
      return initialValue ?? [];
    }

    return selected;
  }

  if (field.type === "select") {
    const options = enrichOptions[field.key] ?? [];
    if (options.length === 0) {
      p.log.warn(`Nenhuma opção disponível para ${field.label}.`);
      return initialValue ?? "";
    }

    const selected = await p.select({
      message: field.label,
      options: options.map((opt) => ({
        value: opt.value,
        label: opt.hint ? `${opt.label} — ${opt.hint}` : opt.label,
      })),
      initialValue,
    });

    if (isCancel(selected)) {
      cancelFlow();
      return initialValue ?? "";
    }

    return selected;
  }

  if (field.type === "tags") {
    const raw = await p.text({
      message: field.label,
      placeholder: field.placeholder ?? "1, 2, Extra",
      defaultValue: Array.isArray(initialValue) ? initialValue.join(", ") : undefined,
    });

    if (isCancel(raw)) {
      cancelFlow();
      return initialValue ?? [];
    }

    return String(raw)
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  const value = await p.text({
    message: field.label,
    placeholder: field.placeholder,
    defaultValue: initialValue !== undefined ? String(initialValue) : undefined,
    validate: (input) => {
      if (required && !input?.trim()) {
        return `${field.label} é obrigatório.`;
      }
      if (field.type === "url" && input?.trim()) {
        try {
          new URL(input);
        } catch {
          return "Informe uma URL válida.";
        }
      }
      if (field.validate) {
        return field.validate(input) ?? undefined;
      }
      return undefined;
    },
  });

  if (isCancel(value)) {
    cancelFlow();
    return initialValue ?? "";
  }

  return value.trim();
}

export function printConfigSummary(config) {
  const rows = [
    ["Fonte", config.source],
    ["Pasta base", config.pastaBase],
    ...Object.entries(config.pluginConfig).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(", ") || "(nenhum)" : String(value),
    ]),
  ];

  if (config.seriesName) {
    rows.push(["Nome da série", config.seriesName]);
  }

  rows.push(["Concorrência", String(config.concurrency)]);

  p.note(
    rows.map(([k, v]) => `${pc.dim(k)}: ${v}`).join("\n"),
    "Configuração atual"
  );
}

export function createCatalogLoader({ plugin, http, getValues }) {
  return async function loadCatalogOptions(spinner) {
    http.setOnRetry(({ attempt, error }) => {
      if (spinner) {
        spinner.text = `Aguardando… ${formatErrorShort(error)} (tentativa ${attempt})`;
      }
    });

    try {
      return await plugin.enrichSetup({
        values: getValues(),
        http,
      });
    } finally {
      http.setOnRetry(null);
    }
  };
}

export async function fetchCatalogWithSpinner({ loadCatalogOptions, onFailure }) {
  const spinner = ora("Carregando catálogo…").start();
  try {
    const options = await loadCatalogOptions(spinner);
    spinner.succeed("Catálogo carregado");
    return options;
  } catch (err) {
    const described = describeAppError(err);
    spinner.fail(`Falha ao carregar catálogo: ${formatErrorShort(err)}`);
    if (described.hint) {
      p.log.message(pc.dim(described.hint));
    }
    if (onFailure) {
      return onFailure(err);
    }
    throw err;
  }
}

const SEARCH_AGAIN = "__search_again__";
const MANUAL_URL = "__manual_url__";

/**
 * @param {import('../../plugins/types.js').MangaSearchFilters} current
 * @param {import('../../plugins/types.js').SourcePlugin} plugin
 * @param {import('../shared/http.js').HttpClient} http
 * @returns {Promise<import('../../plugins/types.js').MangaSearchFilters>}
 */
export async function promptMangaSearchFilters(plugin, http, current = {}) {
  /** @type {import('../../plugins/types.js').MangaSearchFilters} */
  const filters = {
    contentRating: current.contentRating ?? [
      "safe",
      "suggestive",
      "erotica",
      "pornographic",
    ],
    status: current.status ?? [],
    publicationDemographic: current.publicationDemographic ?? [],
    includedTagIds: current.includedTagIds ?? [],
    excludedTagIds: current.excludedTagIds ?? [],
  };

  const adjust = await p.confirm({
    message: "Ajustar filtros de busca?",
    initialValue: false,
  });
  if (isCancel(adjust) || !adjust) {
    return filters;
  }

  const ratings = await p.multiselect({
    message: "Classificação de conteúdo",
    options: [
      { value: "safe", label: "Seguro" },
      { value: "suggestive", label: "Sugestivo" },
      { value: "erotica", label: "Erótico" },
      { value: "pornographic", label: "Pornográfico" },
    ],
    initialValues: filters.contentRating,
    required: true,
  });
  if (isCancel(ratings)) cancelFlow();
  filters.contentRating = ratings;

  const status = await p.multiselect({
    message: "Status (vazio = todos)",
    options: [
      { value: "ongoing", label: "Em publicação" },
      { value: "completed", label: "Concluído" },
      { value: "hiatus", label: "Hiato" },
      { value: "cancelled", label: "Cancelado" },
    ],
    required: false,
    initialValues: filters.status,
  });
  if (isCancel(status)) cancelFlow();
  filters.status = status;

  const demo = await p.multiselect({
    message: "Demográfico (vazio = todos)",
    options: [
      { value: "shounen", label: "Shounen" },
      { value: "shoujo", label: "Shoujo" },
      { value: "seinen", label: "Seinen" },
      { value: "josei", label: "Josei" },
    ],
    required: false,
    initialValues: filters.publicationDemographic,
  });
  if (isCancel(demo)) cancelFlow();
  filters.publicationDemographic = demo;

  if (typeof plugin.loadSearchTagOptions === "function") {
    const tagOptions = await plugin.loadSearchTagOptions({ http });
    if (tagOptions.length > 0) {
      const useTags = await p.confirm({
        message: "Filtrar por tags?",
        initialValue:
          filters.includedTagIds.length > 0 || filters.excludedTagIds.length > 0,
      });
      if (isCancel(useTags)) cancelFlow();

      if (useTags) {
        const included = await p.multiselect({
          message: "Incluir tags (AND)",
          options: tagOptions.map((t) => ({
            value: t.value,
            label: t.hint ? `${t.label} (${t.hint})` : t.label,
          })),
          required: false,
          initialValues: filters.includedTagIds,
        });
        if (isCancel(included)) cancelFlow();
        filters.includedTagIds = included;

        const excluded = await p.multiselect({
          message: "Excluir tags (OR)",
          options: tagOptions.map((t) => ({
            value: t.value,
            label: t.hint ? `${t.label} (${t.hint})` : t.label,
          })),
          required: false,
          initialValues: filters.excludedTagIds,
        });
        if (isCancel(excluded)) cancelFlow();
        filters.excludedTagIds = excluded;
      }
    }
  }

  return filters;
}

/**
 * @param {import('../../plugins/types.js').SetupField} field
 * @param {import('../../plugins/types.js').SourcePlugin} plugin
 * @param {object} ctx
 */
export async function promptSearchField(field, plugin, ctx) {
  const { http, initialValue, pluginConfig = {}, onSearchResult } = ctx;
  /** @type {import('../../plugins/types.js').MangaSearchFilters} */
  let searchFilters = pluginConfig.searchFilters ?? {};

  while (true) {
    const mode = await p.select({
      message: "Como quer encontrar o manga?",
      options: [
        { value: "search", label: "Buscar por nome" },
        { value: "manual", label: "Colar URL ou UUID do MangaDex" },
      ],
      initialValue: "search",
    });
    if (isCancel(mode)) cancelFlow();

    if (mode === "manual") {
      const manual = await p.text({
        message: field.label,
        placeholder: field.placeholder ?? "https://mangadex.org/title/… ou UUID",
        defaultValue: initialValue ? String(initialValue) : undefined,
        validate: (input) => field.validate?.(input) ?? undefined,
      });
      if (isCancel(manual)) cancelFlow();
      return { value: manual.trim(), searchFilters };
    }

    searchFilters = await promptMangaSearchFilters(plugin, http, searchFilters);

    const query = await p.text({
      message: "Nome do manga",
      validate: (input) =>
        input?.trim().length >= 2 ? undefined : "Digite ao menos 2 caracteres.",
    });
    if (isCancel(query)) cancelFlow();

    const spinner = ora("Buscando…").start();
    let results;
    try {
      results = await plugin.searchManga(query.trim(), {
        http,
        filters: searchFilters,
        values: { ...pluginConfig, searchFilters },
      });
      spinner.succeed(`Encontrados: ${results.length}`);
    } catch (err) {
      spinner.fail(`Falha na busca: ${formatErrorShort(err)}`);
      continue;
    }

    if (results.length === 0) {
      p.log.warn("Nenhum resultado. Tente outro termo ou filtros.");
      continue;
    }

    const choice = await p.select({
      message: "Selecione o manga",
      options: [
        ...results.map((opt) => ({
          value: opt.value,
          label: opt.hint ? `${opt.label} — ${opt.hint}` : opt.label,
        })),
        { value: SEARCH_AGAIN, label: "Buscar com outro termo" },
        { value: MANUAL_URL, label: "Colar URL ou UUID" },
      ],
    });
    if (isCancel(choice)) cancelFlow();

    if (choice === SEARCH_AGAIN) continue;

    if (choice === MANUAL_URL) {
      const manual = await p.text({
        message: field.label,
        placeholder: field.placeholder,
        validate: (input) => field.validate?.(input) ?? undefined,
      });
      if (isCancel(manual)) cancelFlow();
      return { value: manual.trim(), searchFilters };
    }

    const picked = results.find((r) => r.value === choice);
    if (picked?.meta?.seriesName && onSearchResult) {
      onSearchResult(picked.meta);
    }

    return { value: choice, searchFilters };
  }
}
