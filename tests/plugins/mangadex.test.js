import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { getChaptersForVolume } from "../../lib/core/catalog.js";
import { extractMangaId, pickLocalizedTitle } from "../../plugins/mangadex/api.js";
import { parseSeriesPage } from "../../plugins/mangadex/catalog.js";
import { buildMangaSearchParams, toSearchOption } from "../../plugins/mangadex/search.js";
import { tagOptionsForPrompt } from "../../plugins/mangadex/tags.js";
import { createMangadexHttp, MANGADEX_HTTP_HEADERS } from "../../plugins/mangadex/rate-limit.js";
import mangadexPlugin from "../../plugins/mangadex/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("mangadex api", () => {
  it("extractMangaId aceita UUID e URL", () => {
    const id = "f98660a1-d2e2-461c-960d-7bd13df8b76d";
    assert.equal(extractMangaId(id), id);
    assert.equal(
      extractMangaId(`https://mangadex.org/title/${id}/slug`),
      id
    );
  });

  it("extractMangaId rejeita entrada inválida", () => {
    assert.throws(() => extractMangaId("not-a-url"), /extrair o ID/);
  });

  it("pickLocalizedTitle prioriza pt-br", () => {
    assert.equal(
      pickLocalizedTitle({ en: "English", "pt-br": "Português" }),
      "Português"
    );
  });
});

describe("mangadex catalog", () => {
  it("parseSeriesPage agrupa por volume e deduplica", async () => {
    const body = await fs.readFile(
      path.join(__dirname, "..", "fixtures", "mangadex-feed.json"),
      "utf-8"
    );
    const catalog = parseSeriesPage(body);

    assert.deepEqual(getChaptersForVolume(catalog, "1").map((c) => c.capId), [
      "1",
      "2",
    ]);
    assert.equal(
      getChaptersForVolume(catalog, "1").find((c) => c.capId === "1")?.pdfPageUrl,
      "aaa11111-1111-4111-8111-111111111101"
    );
    assert.equal(getChaptersForVolume(catalog, "2").length, 1);
    assert.equal(getChaptersForVolume(catalog, "0").length, 1);
  });
});

describe("mangadex search", () => {
  it("buildMangaSearchParams inclui filtros", () => {
    const params = buildMangaSearchParams("one piece", {
      contentRating: ["safe"],
      status: ["ongoing"],
      publicationDemographic: ["shounen"],
      includedTagIds: ["tag-1"],
      excludedTagIds: ["tag-2"],
    });

    assert.equal(params.get("title"), "one piece");
    assert.equal(params.get("contentRating[]"), "safe");
    assert.equal(params.get("status[]"), "ongoing");
    assert.equal(params.get("publicationDemographic[]"), "shounen");
    assert.equal(params.get("includedTags[]"), "tag-1");
    assert.equal(params.get("excludedTags[]"), "tag-2");
  });

  it("toSearchOption mapeia manga da API", async () => {
    const body = await fs.readFile(
      path.join(__dirname, "..", "fixtures", "mangadex-search.json"),
      "utf-8"
    );
    const manga = JSON.parse(body).data[0];
    const opt = toSearchOption(manga);
    assert.equal(opt.value, "https://mangadex.org/title/f98660a1-d2e2-461c-960d-7bd13df8b76d");
    assert.equal(opt.label, "Manga Teste");
    assert.ok(opt.hint.includes("2020"));
  });
});

describe("mangadex tags", () => {
  it("tagOptionsForPrompt usa pt-br", async () => {
    const body = await fs.readFile(
      path.join(__dirname, "..", "fixtures", "mangadex-tags.json"),
      "utf-8"
    );
    const tags = JSON.parse(body).data;
    const options = tagOptionsForPrompt(tags);
    assert.ok(options.some((o) => o.label === "Ação"));
  });
});

describe("mangadex rate-limit", () => {
  it("createMangadexHttp envia User-Agent aceito pela API", async () => {
    /** @type {Record<string, string>|undefined} */
    let capturedHeaders;

    const http = {
      async fetchJson(_url, options) {
        capturedHeaders = options?.headers;
        return {};
      },
      async fetchText(_url, options) {
        capturedHeaders = options?.headers;
        return "";
      },
      async fetchBuffer(_url, options) {
        capturedHeaders = options?.headers;
        return { buffer: Buffer.alloc(0), headers: new Headers() };
      },
      setOnRetry() {},
    };

    const mdHttp = createMangadexHttp(http);
    await mdHttp.fetchJson("https://api.mangadex.org/manga/x/feed");

    assert.equal(capturedHeaders?.["User-Agent"], MANGADEX_HTTP_HEADERS["User-Agent"]);
    assert.equal(capturedHeaders?.Referer, MANGADEX_HTTP_HEADERS.Referer);
    assert.doesNotMatch(capturedHeaders?.["User-Agent"] ?? "", /Chrome/);
  });
});

describe("mangadex plugin", () => {
  it("exporta contrato válido", () => {
    assert.equal(mangadexPlugin.id, "mangadex");
    assert.equal(mangadexPlugin.recommendedConcurrency, 1);
    assert.equal(typeof mangadexPlugin.parseSeriesPage, "function");
    assert.equal(typeof mangadexPlugin.resolvePdfUrl, "function");
    assert.equal(typeof mangadexPlugin.fetchChapterPages, "function");
    assert.equal(typeof mangadexPlugin.searchManga, "function");
    assert.equal(typeof mangadexPlugin.loadCatalog, "function");
    assert.equal(mangadexPlugin.outputFormats.length, 6);
  });

  it("getChapterFilePatterns reconhece pdf zip cbz", () => {
    const patterns = mangadexPlugin.getChapterFilePatterns("5");
    assert.ok(patterns.some((p) => p.test("Serie - Vol 01 - Cap 5.pdf")));
    assert.ok(patterns.some((p) => p.test("Serie - Vol 01 - Cap 5.cbz")));
  });
});
