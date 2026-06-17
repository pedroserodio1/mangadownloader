import { escapeRegex } from "../../lib/shared/utils.js";
import { outputFormatSetupOptions } from "../../lib/output/registry.js";
import { parseSeriesPage } from "./scraper.js";
import { resolvePdfUrl } from "./resolver.js";

/** @type {import('../types.js').SourcePlugin} */
const centralnovelPlugin = {
  id: "centralnovel",
  name: "Central Novel",
  description: "Light novels em PDF do centralnovel.com",

  outputFormats: [
    {
      id: "chapters",
      label: "Capítulos separados",
      description: "Um PDF por capítulo em pastas Vol N/",
      default: true,
    },
    {
      id: "volume-single",
      label: "PDF único por volume",
      description: "Junta os capítulos em um PDF na pasta base; mantém os caps",
    },
    {
      id: "volume-single-only",
      label: "PDF único (sem caps)",
      description: "Junta os capítulos e remove os PDFs individuais",
    },
  ],
  defaultOutputFormat: "chapters",

  setupFields: [
    {
      key: "serieUrl",
      type: "url",
      label: "URL da série",
      placeholder: "https://centralnovel.com/series/nome-da-serie/",
      required: true,
      validate(value) {
        if (!value || typeof value !== "string" || !value.trim()) {
          return "URL é obrigatória.";
        }
        try {
          new URL(value);
        } catch {
          return "Informe uma URL válida.";
        }
      },
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

  async enrichSetup({ values, http }) {
    const result = {};

    const serieUrl = values.serieUrl;
    if (serieUrl && typeof serieUrl === "string") {
      const html = await http.fetchText(serieUrl);
      const catalog = parseSeriesPage(html);

      result.volumes = [...catalog.entries()].map(([volumeKey, chapters]) => ({
        value: volumeKey,
        label: `Volume ${volumeKey}`,
        hint: `${chapters.length} capítulo(s)`,
      }));
    }

    result.outputFormat = outputFormatSetupOptions(centralnovelPlugin);
    return result;
  },

  parseSeriesPage,
  resolvePdfUrl,

  getChapterFilePatterns(capId) {
    const id = String(capId).trim();
    return [
      new RegExp(
        `(?:capitulo|extra)-${escapeRegex(id)}(?:-centralnovel|\\.pdf|$)`,
        "i"
      ),
    ];
  },
};

export default centralnovelPlugin;
