import {
  API_BASE,
  buildMangaTitleUrl,
  formatMangaHint,
  pickLocalizedTitle,
} from "./api.js";

const DEFAULT_CONTENT_RATINGS = ["safe", "suggestive", "erotica", "pornographic"];

/**
 * @param {string} query
 * @param {import('../types.js').MangaSearchFilters} [filters]
 * @returns {URLSearchParams}
 */
export function buildMangaSearchParams(query, filters = {}) {
  const params = new URLSearchParams();
  params.set("title", query.trim());
  params.set("limit", "15");
  params.set("order[followedCount]", "desc");

  const ratings =
    filters.contentRating?.length > 0 ? filters.contentRating : DEFAULT_CONTENT_RATINGS;
  for (const r of ratings) {
    params.append("contentRating[]", r);
  }

  for (const s of filters.status ?? []) {
    params.append("status[]", s);
  }

  for (const d of filters.publicationDemographic ?? []) {
    params.append("publicationDemographic[]", d);
  }

  for (const id of filters.includedTagIds ?? []) {
    params.append("includedTags[]", id);
  }

  for (const id of filters.excludedTagIds ?? []) {
    params.append("excludedTags[]", id);
  }

  return params;
}

/**
 * @param {object} manga
 * @returns {import('../types.js').SetupOption}
 */
export function toSearchOption(manga) {
  const attrs = manga.attributes ?? {};
  const title = pickLocalizedTitle(attrs.title);
  return {
    value: buildMangaTitleUrl(manga.id),
    label: title,
    hint: formatMangaHint(attrs),
    meta: { seriesName: title },
  };
}

/**
 * @param {string} query
 * @param {import('../types.js').MangaSearchFilters} filters
 * @param {import('../../lib/shared/http.js').HttpClient} mdHttp
 * @returns {Promise<import('../types.js').SetupOption[]>}
 */
export async function searchMangaByTitle(query, filters, mdHttp) {
  const params = buildMangaSearchParams(query, filters);
  const data = await mdHttp.fetchJson(`${API_BASE}/manga?${params.toString()}`);
  return (data.data ?? []).map(toSearchOption);
}
