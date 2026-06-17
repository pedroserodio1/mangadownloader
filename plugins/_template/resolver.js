import { AppError } from "../../lib/shared/errors.js";

/**
 * Resolve a chapter reference to a direct download URL.
 * Returns PDF URL, image URL, or any single-file asset URL.
 * Multi-image chapters require core extension.
 *
 * @param {string} chapterRef - Chapter.pdfPageUrl (opaque reference)
 * @param {import('../types.js').ResolvePdfContext} ctx
 * @returns {Promise<string>}
 */
export async function resolvePdfUrl(chapterRef, { http, logger }) {
  const html = await http.fetchText(chapterRef);

  // TODO: extract direct asset URL from HTML, API, or pass-through if chapterRef is already direct
  const directUrl = extractDirectAssetUrl(html, chapterRef);

  if (!directUrl) {
    throw new AppError("Não foi possível resolver URL do asset.", {
      retriable: false,
    });
  }

  logger.verbose(`Asset resolvido: ${directUrl}`);
  return directUrl;
}

/**
 * @param {string} _html
 * @param {string} chapterRef
 * @returns {string|null}
 */
function extractDirectAssetUrl(_html, chapterRef) {
  if (/\.(pdf|png|jpe?g|webp)(\?|$)/i.test(chapterRef)) {
    return chapterRef;
  }
  return null;
}
