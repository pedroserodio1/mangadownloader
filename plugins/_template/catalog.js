/**
 * API / JSON catalog parser.
 * Use this module for REST API plugins. For HTML, use scraper.js instead.
 *
 * @param {string} body - Response body from loadCatalog (typically JSON string)
 * @returns {import('../types.js').Catalog}
 */
export function parseSeriesPageFromJson(body) {
  const data = JSON.parse(body);
  const catalog = new Map();

  // TODO: map API response to catalog
  // catalog.set("1", [{ capId: "1", pdfPageUrl: "/chapters/1" }]);

  return catalog;
}

// Default export name matches contract — re-export or alias in index.js
export { parseSeriesPageFromJson as parseSeriesPage };
