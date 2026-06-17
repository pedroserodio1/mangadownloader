import * as cheerio from "cheerio";

export function volumeLabelMatches(labelText, volumeNumero) {
  const normalized = labelText.trim().replace(/\s+/g, " ");
  const key = String(volumeNumero).trim();

  if (key.toLowerCase() === "extra") {
    return /^volume\s+extra(s)?$/i.test(normalized);
  }

  return normalized.toLowerCase() === `volume ${key}`.toLowerCase();
}

export function extractVolumeKeyFromLabel(labelText) {
  const normalized = labelText.trim().replace(/\s+/g, " ");

  if (/^volume\s+extra(s)?$/i.test(normalized)) {
    return "Extra";
  }

  const match = normalized.match(/^volume\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function extractCapIdFromUrl(url) {
  if (!url) return null;
  const match = url.match(/(?:capitulo|extra|cap)[-_]([^/?#.]+)/i);
  return match ? match[1] : null;
}

export function extractPostIdFromHtml(html) {
  const jsonMatch = html.match(/"post_id"\s*:\s*(\d+)/);
  if (jsonMatch) return jsonMatch[1];

  const attrMatch = html.match(/data-post-id=["'](\d+)["']/i);
  if (attrMatch) return attrMatch[1];

  const $ = cheerio.load(html);
  const dataPostId = $("[data-post-id]").first().attr("data-post-id");
  if (dataPostId) return dataPostId;

  return null;
}

/**
 * @param {string} html
 * @returns {import('../types.js').Catalog}
 */
export function parseSeriesPage(html) {
  const $ = cheerio.load(html);
  const chaptersByVolume = new Map();

  $("span.ts-chl-collapsible").each((_i, el) => {
    const labelText = $(el).text();
    const volumeKey = extractVolumeKeyFromLabel(labelText);
    if (!volumeKey) return;

    const capitulos = [];
    const divConteudo = $(el).next("div.ts-chl-collapsible-content");

    divConteudo.find("ul li").each((_j, li) => {
      const linkPdf = $(li).find("a.dlpdf").attr("href");
      const capId = extractCapIdFromUrl(linkPdf);

      if (linkPdf && capId) {
        capitulos.push({ capId, pdfPageUrl: linkPdf });
      }
    });

    chaptersByVolume.set(volumeKey, capitulos);
  });

  return chaptersByVolume;
}
