/**
 * Chapter entry in the catalog.
 * Field names are historical — see semantic aliases below.
 *
 * @typedef {Object} Chapter
 * @property {string} capId - Stable chapter identifier (used in filenames and skip logic)
 * @property {string} pdfPageUrl - **Semantic: chapterRef** — opaque reference the plugin
 *   understands (series page link, API path, chapter ID, image gallery URL, etc.).
 *   Not required to be a PDF URL or even a fetchable URL (can be JSON-encoded ref).
 *
 * @typedef {Map<string, Chapter[]>} Catalog
 *
 * @typedef {{ index: number, buffer: Buffer, filename: string }} ChapterPage
 *
 * @typedef {Object} MangaSearchFilters
 * @property {string[]} [contentRating]
 * @property {string[]} [status]
 * @property {string[]} [publicationDemographic]
 * @property {string[]} [includedTagIds]
 * @property {string[]} [excludedTagIds]
 *
 * @typedef {'text'|'url'|'tags'|'multiselect'|'select'|'confirm'|'search'} SetupFieldType
 *
 * @typedef {Object} SetupField
 * @property {string} key
 * @property {SetupFieldType} type
 * @property {string} label
 * @property {string} [placeholder]
 * @property {boolean} [required]
 * @property {(value: unknown) => string|void} [validate]
 *
 * @typedef {Object} SetupOption
 * @property {string} value
 * @property {string} label
 * @property {string} [hint]
 * @property {Record<string, unknown>} [meta]
 *
 * @typedef {Object} OutputFormatDef
 * @property {string} id
 * @property {string} label
 * @property {string} [description]
 * @property {boolean} [default]
 *
 * @typedef {Object} EnrichSetupContext
 * @property {Record<string, unknown>} values
 * @property {import('../lib/shared/http.js').HttpClient} http
 *
 * @typedef {Object} LoadCatalogContext
 * @property {import('../lib/config/store.js').ValidatedConfig} config
 * @property {import('../lib/shared/http.js').HttpClient} http
 * @property {import('../lib/shared/logger.js').Logger} logger
 * @property {SourcePlugin} plugin
 *
 * @typedef {Object} ResolvePdfContext
 * @property {import('../lib/shared/http.js').HttpClient} http
 * @property {import('../lib/shared/logger.js').Logger} logger
 * @property {import('../lib/config/store.js').ValidatedConfig} [config]
 *
 * @typedef {Object} FetchChapterPagesContext
 * @property {import('../lib/shared/http.js').HttpClient} http
 * @property {import('../lib/shared/logger.js').Logger} logger
 * @property {import('../lib/config/store.js').ValidatedConfig} config
 *
 * @typedef {Object} SearchMangaContext
 * @property {import('../lib/shared/http.js').HttpClient} http
 * @property {MangaSearchFilters} [filters]
 * @property {Record<string, unknown>} [values]
 *
 * @typedef {'pdf'|'image'} ChapterContentType
 *   Declared content type. Not yet consumed by core — today downloader always writes .pdf files.
 *
 * @typedef {Object} SourcePlugin
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {SetupField[]} setupFields
 * @property {OutputFormatDef[]} [outputFormats]
 * @property {string} [defaultOutputFormat]
 * @property {number} [recommendedConcurrency]
 * @property {ChapterContentType} [chapterContentType] - Default `pdf`. Image plugins need core work.
 * @property {(ctx: EnrichSetupContext) => Promise<Record<string, SetupOption[]>>} [enrichSetup]
 * @property {(ctx: LoadCatalogContext) => Promise<Catalog>} [loadCatalog]
 * @property {(query: string, ctx: SearchMangaContext) => Promise<SetupOption[]>} [searchManga]
 * @property {(ctx: EnrichSetupContext) => Promise<SetupOption[]>} [loadSearchTagOptions]
 * @property {(body: string) => Catalog} parseSeriesPage - **Semantic: parseCatalog(body)** —
 *   receives the text body from `loadCatalog` (HTML, JSON string, etc.). Plugin parses it.
 * @property {(chapterRef: string, ctx: ResolvePdfContext) => Promise<string>} resolvePdfUrl -
 *   **Semantic: resolveChapterAssetUrl** — returns a direct download URL for the chapter
 *   asset (PDF, image, or first of many — multi-asset chapters need core extension).
 * @property {(chapterRef: string, ctx: FetchChapterPagesContext) => Promise<ChapterPage[]>} [fetchChapterPages]
 * @property {(capId: string) => RegExp[]} [getChapterFilePatterns]
 */

export {};
