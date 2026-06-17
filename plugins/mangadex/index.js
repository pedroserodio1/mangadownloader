import { escapeRegex } from "../../lib/shared/utils.js";
import { getPluginSetting, getSerieUrl } from "../../lib/config/store.js";
import { outputFormatSetupOptions } from "../../lib/output/registry.js";
import {
  extractMangaId,
  fetchMangaFeed,
} from "./api.js";
import { parseSeriesPage } from "./catalog.js";
import { createMangadexHttp } from "./rate-limit.js";
import { fetchChapterPages, resolvePdfUrl } from "./resolver.js";
import { searchMangaByTitle } from "./search.js";
import { loadMangaTags, tagOptionsForPrompt } from "./tags.js";

/** @type {import('../types.js').SourcePlugin} */
const mangadexPlugin = {
  id: "mangadex",
  name: "MangaDex",
  description: "Manga e manhwa via API MangaDex (imagens → PDF, pasta, ZIP ou CBZ)",
  chapterContentType: "image",
  recommendedConcurrency: 1,
  defaultOutputFormat: "pdf",

  outputFormats: [
    {
      id: "pdf",
      label: "PDF por capítulo",
      description: "Um PDF por capítulo em pastas Vol N/",
      default: true,
    },
    {
      id: "folder",
      label: "Pasta com imagens",
      description: "Subpasta Cap XXX/ com uma imagem por página",
    },
    {
      id: "zip-chapter",
      label: "ZIP por capítulo",
      description: "Arquivo .zip por capítulo na pasta do volume",
    },
    {
      id: "zip-volume",
      label: "ZIP por volume",
      description: "Um .zip na pasta base com todos os capítulos do volume",
    },
    {
      id: "cbz-chapter",
      label: "CBZ por capítulo",
      description: "Arquivo .cbz por capítulo (leitores de comics)",
    },
    {
      id: "cbz-volume",
      label: "CBZ por volume",
      description: "Um .cbz na pasta base com todos os capítulos do volume",
    },
  ],

  setupFields: [
    {
      key: "serieUrl",
      type: "search",
      label: "Manga",
      placeholder: "Buscar por nome ou colar URL/UUID",
      required: true,
      validate(value) {
        if (!value || typeof value !== "string" || !value.trim()) {
          return "Selecione ou informe um manga.";
        }
        try {
          extractMangaId(value);
        } catch {
          return "URL ou UUID do MangaDex inválido.";
        }
      },
    },
    {
      key: "translatedLanguage",
      type: "select",
      label: "Idioma dos capítulos",
      required: true,
    },
    {
      key: "imageQuality",
      type: "select",
      label: "Qualidade das imagens",
      required: true,
    },
    {
      key: "volumes",
      type: "multiselect",
      label: "Volumes para baixar",
      required: true,
      validate(value) {
        if (!Array.isArray(value) || value.length === 0) {
          return "Selecione ao menos um volume.";
        }
      },
    },
    {
      key: "outputFormat",
      type: "select",
      label: "Formato de saída",
      required: true,
    },
  ],

  async searchManga(query, { http, filters, values }) {
    const mdHttp = createMangadexHttp(http);
    const mergedFilters = {
      ...(values?.searchFilters ?? {}),
      ...(filters ?? {}),
    };
    return searchMangaByTitle(query, mergedFilters, mdHttp);
  },

  async loadSearchTagOptions({ http }) {
    const mdHttp = createMangadexHttp(http);
    const tags = await loadMangaTags(mdHttp);
    return tagOptionsForPrompt(tags);
  },

  async enrichSetup({ values, http }) {
    const result = {};

    result.translatedLanguage = [
      { value: "pt-br", label: "Português (Brasil)" },
      { value: "en", label: "Inglês" },
      { value: "es", label: "Espanhol" },
      { value: "es-la", label: "Espanhol (Latam)" },
      { value: "fr", label: "Francês" },
      { value: "ja", label: "Japonês" },
    ];

    result.imageQuality = [
      { value: "data", label: "Original (data)", hint: "melhor qualidade" },
      { value: "data-saver", label: "Comprimido (data-saver)", hint: "menor tamanho" },
    ];

    const serieUrl = values.serieUrl;
    const language = values.translatedLanguage;

    if (serieUrl && typeof serieUrl === "string" && language) {
      const mangaId = extractMangaId(serieUrl);
      const mdHttp = createMangadexHttp(http);
      const feed = await fetchMangaFeed(mangaId, String(language), mdHttp);
      const catalog = parseSeriesPage(JSON.stringify({ data: feed.data }));

      result.volumes = [...catalog.entries()].map(([volumeKey, chapters]) => ({
        value: volumeKey,
        label: volumeKey === "0" ? "Sem volume" : `Volume ${volumeKey}`,
        hint: `${chapters.length} capítulo(s)`,
      }));
    }

    result.outputFormat = outputFormatSetupOptions(mangadexPlugin);
    return result;
  },

  async loadCatalog({ config, http, logger }) {
    const mangaId = extractMangaId(getSerieUrl(config));
    const language = getPluginSetting(config, "translatedLanguage") ?? "pt-br";
    logger.info(`Carregando catálogo MangaDex: ${mangaId} (${language})`);
    const mdHttp = createMangadexHttp(http);
    const feed = await fetchMangaFeed(mangaId, String(language), mdHttp);
    return parseSeriesPage(JSON.stringify({ data: feed.data }));
  },

  parseSeriesPage,
  resolvePdfUrl,
  fetchChapterPages,

  getChapterFilePatterns(capId) {
    const id = String(capId).trim();
    const escaped = escapeRegex(id);
    return [
      new RegExp(`Cap\\s+${escaped}\\.(pdf|zip|cbz)$`, "i"),
      new RegExp(`Cap\\s+${escaped}\\b`, "i"),
    ];
  },
};

export default mangadexPlugin;
