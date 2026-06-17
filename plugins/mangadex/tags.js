/** @type {object[]|null} */
let tagCache = null;

/**
 * @param {import('../../lib/shared/http.js').HttpClient} mdHttp
 * @returns {Promise<object[]>}
 */
export async function loadMangaTags(mdHttp) {
  if (tagCache) return tagCache;
  const res = await mdHttp.fetchJson("https://api.mangadex.org/manga/tag");
  tagCache = res.data ?? [];
  return tagCache;
}

/**
 * @param {object[]} tags
 * @param {string} [lang]
 * @returns {import('../types.js').SetupOption[]}
 */
export function tagOptionsForPrompt(tags, lang = "pt-br") {
  return tags
    .map((tag) => {
      const name = tag.attributes?.name ?? {};
      const label = name[lang] || name.en || Object.values(name)[0] || tag.id;
      const group = tag.attributes?.group ?? "";
      return {
        value: tag.id,
        label,
        hint: group,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function clearTagCache() {
  tagCache = null;
}
