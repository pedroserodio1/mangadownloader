import { parseSeriesPage } from "./scraper.js";
import { resolvePdfUrl } from "./resolver.js";

/** @type {import('../types.js').SourcePlugin} */
const templatePlugin = {
  id: "template",
  name: "Template (do not use)",
  description: "Scaffold — copy to plugins/<id>/ and rename",

  setupFields: [
    {
      key: "serieUrl",
      type: "url",
      label: "URL da série",
      placeholder: "https://example.com/series/name/",
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
  ],

  async enrichSetup({ values, http }) {
    if (!values.serieUrl || typeof values.serieUrl !== "string") {
      return {};
    }

    const html = await http.fetchText(values.serieUrl);
    const catalog = parseSeriesPage(html);

    return {
      volumes: [...catalog.entries()].map(([volumeKey, chapters]) => ({
        value: volumeKey,
        label: `Volume ${volumeKey}`,
        hint: `${chapters.length} capítulo(s)`,
      })),
    };
  },

  parseSeriesPage,
  resolvePdfUrl,
};

export default templatePlugin;
