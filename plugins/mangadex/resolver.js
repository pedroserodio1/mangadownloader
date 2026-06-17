import { AppError } from "../../lib/shared/http.js";
import { createMangadexHttp } from "./rate-limit.js";

/**
 * @param {string} chapterId
 * @param {import('../types.js').FetchChapterPagesContext} ctx
 * @returns {Promise<import('../types.js').ChapterPage[]>}
 */
export async function fetchChapterPages(chapterId, { http, logger, config }) {
  const mdHttp = createMangadexHttp(http);
  const quality = config.pluginConfig?.imageQuality === "data-saver" ? "data-saver" : "data";

  const atHome = await mdHttp.fetchJson(
    `https://api.mangadex.org/at-home/server/${chapterId}`
  );

  const baseUrl = atHome.baseUrl;
  const hash = atHome.chapter?.hash;
  const files =
    quality === "data-saver"
      ? atHome.chapter?.dataSaver ?? []
      : atHome.chapter?.data ?? [];

  if (!baseUrl || !hash || files.length === 0) {
    throw new AppError(`Capítulo ${chapterId} sem páginas disponíveis.`, {
      retriable: false,
    });
  }

  logger.verbose(`Capítulo ${chapterId}: ${files.length} página(s), qualidade ${quality}`);

  /** @type {import('../types.js').ChapterPage[]} */
  const pages = [];

  for (let index = 0; index < files.length; index++) {
    const filename = files[index];
    const url = `${baseUrl}/${quality}/${hash}/${filename}`;
    const { buffer } = await mdHttp.fetchBuffer(url);
    logger.verbose(`  página ${index + 1}/${files.length}: ${buffer.length} bytes`);
    pages.push({ index, buffer, filename });
  }

  return pages;
}

/**
 * @param {string} _chapterRef
 * @param {import('../types.js').ResolvePdfContext} _ctx
 * @returns {Promise<string>}
 */
export async function resolvePdfUrl(_chapterRef, _ctx) {
  throw new AppError(
    "Plugin MangaDex usa fetchChapterPages — não chame resolvePdfUrl diretamente.",
    { retriable: false }
  );
}
