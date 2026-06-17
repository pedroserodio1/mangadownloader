/** @typedef {'pdf'|'folder'|'zip-chapter'|'zip-volume'|'cbz-chapter'|'cbz-volume'} MangaOutputFormat */

const VOLUME_ARCHIVE_FORMATS = new Set(["zip-volume", "cbz-volume"]);
const CHAPTER_ARCHIVE_FORMATS = new Set(["zip-chapter", "cbz-chapter"]);

/**
 * @param {string} format
 * @returns {boolean}
 */
export function isVolumeArchiveFormat(format) {
  return VOLUME_ARCHIVE_FORMATS.has(format);
}

/**
 * @param {string} format
 * @returns {boolean}
 */
export function isChapterArchiveFormat(format) {
  return CHAPTER_ARCHIVE_FORMATS.has(format);
}

/**
 * @param {string} format
 * @returns {'.zip'|'.cbz'|null}
 */
export function archiveExtension(format) {
  if (format === "zip-chapter" || format === "zip-volume") return ".zip";
  if (format === "cbz-chapter" || format === "cbz-volume") return ".cbz";
  return null;
}

/**
 * @param {string} format
 * @returns {boolean}
 */
export function usesPageStaging(format) {
  return isVolumeArchiveFormat(format);
}

/**
 * @param {string} format
 * @returns {boolean}
 */
export function needsVolumeFinalize(format) {
  if (isVolumeArchiveFormat(format)) return true;
  if (format === "volume-single" || format === "volume-single-only") return true;
  return false;
}
