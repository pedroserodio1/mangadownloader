import * as cheerio from "cheerio";

/**
 * Parse series page HTML into a volume → chapters catalog.
 * For API/JSON sources, use catalog.js instead.
 *
 * @param {string} body - Response body from loadCatalog (HTML for scraper plugins)
 * @returns {import('../types.js').Catalog}
 */
export function parseSeriesPage(body) {
  const $ = cheerio.load(body);
  const catalog = new Map();

  // TODO: implement site-specific parsing
  // Example:
  // catalog.set("1", [
  //   { capId: "1", pdfPageUrl: "https://example.com/chapter/1/" },
  // ]);

  return catalog;
}
