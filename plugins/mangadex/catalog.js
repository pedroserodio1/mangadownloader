import { compareCapIdsNatural } from "../../lib/core/naming.js";

/**
 * @param {object} chapter
 * @returns {boolean}
 */
function isChapterDownloadable(chapter) {
  const attrs = chapter.attributes ?? {};
  if (attrs.isUnavailable) return false;
  if (attrs.externalUrl) return false;
  if (!attrs.pages || attrs.pages <= 0) return false;
  return true;
}

/**
 * @param {string} body - JSON feed response
 * @returns {import('../types.js').Catalog}
 */
export function parseSeriesPage(body) {
  const parsed = JSON.parse(body);
  const chapters = parsed.data ?? [];
  const catalog = new Map();

  /** @type {Map<string, { chapter: object, readableAt: number }>} */
  const dedupe = new Map();

  for (const chapter of chapters) {
    if (!isChapterDownloadable(chapter)) continue;

    const attrs = chapter.attributes;
    const volumeKey = attrs.volume?.trim() ? String(attrs.volume).trim() : "0";
    const capId = attrs.chapter?.trim()
      ? String(attrs.chapter).trim()
      : chapter.id.slice(-8);

    const key = `${volumeKey}::${capId}`;
    const readableAt = Date.parse(attrs.readableAt ?? attrs.createdAt ?? 0) || 0;
    const existing = dedupe.get(key);

    if (!existing || readableAt >= existing.readableAt) {
      dedupe.set(key, { chapter, readableAt });
    }
  }

  for (const { chapter } of dedupe.values()) {
    const attrs = chapter.attributes;
    const volumeKey = attrs.volume?.trim() ? String(attrs.volume).trim() : "0";
    const capId = attrs.chapter?.trim()
      ? String(attrs.chapter).trim()
      : chapter.id.slice(-8);

    if (!catalog.has(volumeKey)) {
      catalog.set(volumeKey, []);
    }

    catalog.get(volumeKey).push({
      capId,
      pdfPageUrl: chapter.id,
    });
  }

  for (const [volumeKey, list] of catalog.entries()) {
    list.sort((a, b) => compareCapIdsNatural(a.capId, b.capId));
    catalog.set(volumeKey, list);
  }

  return catalog;
}

/**
 * @param {import('../types.js').Catalog} catalog
 * @param {string} volumeKey
 * @returns {string}
 */
export function volumeOptionLabel(volumeKey, catalog) {
  const count = catalog.get(volumeKey)?.length ?? 0;
  if (volumeKey === "0") {
    return `Sem volume (${count} capítulo(s))`;
  }
  return `Volume ${volumeKey} (${count} capítulo(s))`;
}
