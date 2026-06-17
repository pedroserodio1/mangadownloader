export const API_BASE = "https://api.mangadex.org";
export const MANGADEX_REFERER = "https://mangadex.org/";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {string} input
 * @returns {string}
 */
export function extractMangaId(input) {
  const raw = String(input).trim();
  if (UUID_RE.test(raw)) {
    return raw;
  }

  const urlMatch = raw.match(
    /mangadex\.org\/title\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  if (urlMatch) {
    return urlMatch[1];
  }

  throw new Error("Não foi possível extrair o ID do manga na URL ou UUID informado.");
}

/**
 * @param {string} mangaId
 * @returns {string}
 */
export function buildMangaTitleUrl(mangaId) {
  return `https://mangadex.org/title/${mangaId}`;
}

/**
 * @param {Record<string, string>} titleMap
 * @param {string} [preferred]
 * @returns {string}
 */
export function pickLocalizedTitle(titleMap, preferred = "pt-br") {
  if (!titleMap || typeof titleMap !== "object") return "Sem título";
  return (
    titleMap[preferred] ||
    titleMap.en ||
    titleMap["ja-ro"] ||
    titleMap.ja ||
    Object.values(titleMap)[0] ||
    "Sem título"
  );
}

const STATUS_LABELS = {
  ongoing: "em publicação",
  completed: "concluído",
  hiatus: "hiato",
  cancelled: "cancelado",
};

/**
 * @param {object} attrs
 * @returns {string}
 */
export function formatMangaHint(attrs) {
  const parts = [];
  if (attrs.year) parts.push(String(attrs.year));
  if (attrs.status && STATUS_LABELS[attrs.status]) {
    parts.push(STATUS_LABELS[attrs.status]);
  }
  if (attrs.contentRating) parts.push(attrs.contentRating);
  if (attrs.publicationDemographic) parts.push(attrs.publicationDemographic);
  return parts.join(" · ");
}

/**
 * @param {string} mangaId
 * @param {string} language
 * @param {import('../../lib/shared/http.js').HttpClient} mdHttp
 * @returns {Promise<object>}
 */
export async function fetchMangaFeedPage(mangaId, language, mdHttp, offset = 0, limit = 500) {
  const params = new URLSearchParams();
  params.set("translatedLanguage[]", language);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  params.set("order[chapter]", "asc");
  for (const rating of ["safe", "suggestive", "erotica", "pornographic"]) {
    params.append("contentRating[]", rating);
  }

  const url = `${API_BASE}/manga/${mangaId}/feed?${params.toString()}`;
  return mdHttp.fetchJson(url);
}

/**
 * @param {string} mangaId
 * @param {string} language
 * @param {import('../../lib/shared/http.js').HttpClient} mdHttp
 * @returns {Promise<{ data: object[], total: number }>}
 */
export async function fetchMangaFeed(mangaId, language, mdHttp) {
  const limit = 500;
  let offset = 0;
  let total = Infinity;
  const all = [];

  while (offset < total && offset + limit <= 10_000) {
    const page = await fetchMangaFeedPage(mangaId, language, mdHttp, offset, limit);
    const batch = page.data ?? [];
    total = page.total ?? batch.length;
    all.push(...batch);
    offset += limit;
    if (batch.length === 0) break;
  }

  return { data: all, total: all.length };
}
