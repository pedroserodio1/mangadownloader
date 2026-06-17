import { AppError } from "../../lib/shared/http.js";
import { extractPostIdFromHtml } from "./scraper.js";

const AJAX_URL = "https://centralnovel.com/wp-admin/admin-ajax.php";

/**
 * @param {string} pdfPageUrl
 * @param {import('../types.js').ResolvePdfContext} ctx
 * @returns {Promise<string>}
 */
export async function resolvePdfUrl(pdfPageUrl, { http, logger }) {
  const html = await http.fetchText(pdfPageUrl);
  const postId = extractPostIdFromHtml(html);

  if (!postId) {
    throw new AppError(`Não consegui extrair post_id de ${pdfPageUrl}`, {
      retriable: false,
    });
  }

  logger.verbose(`post_id encontrado: ${postId}`);

  const ajaxData = await http.fetchJson(AJAX_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      action: "ts_ln_dl_url",
      post_id: postId,
    }).toString(),
  });

  if (!ajaxData?.url) {
    throw new AppError("Resposta admin-ajax sem URL do PDF", { retriable: false });
  }

  logger.verbose(`URL real do PDF: ${ajaxData.url}`);
  return ajaxData.url;
}
