import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import {
  handleCatalogGet,
  handleConfigCreate,
  handleConfigGet,
  handleConfigUpdate,
  handleConvert,
  handleDownload,
  handleMangaSearch,
  handlePluginsList,
  handleRename,
  handleReview,
  readConfigResource,
  readPluginResource,
} from "./handlers.js";
import {
  catalogGetInputSchema,
  configCreateInputSchema,
  configUpdateInputSchema,
  convertInputSchema,
  downloadInputSchema,
  mangaSearchInputSchema,
  renameInputSchema,
  reviewInputSchema,
} from "./schemas.js";
import { listPlugins } from "../config/programmatic.js";

export function createMcpServer() {
  const server = new McpServer(
    {
      name: "manga-downloader",
      version: "2.0.0",
    },
    { capabilities: { logging: {} } }
  );

  server.registerTool(
    "plugins_list",
    {
      description: "Lista plugins de fonte disponíveis (centralnovel, mangadex, etc.)",
      inputSchema: {},
    },
    async () => handlePluginsList()
  );

  server.registerTool(
    "config_get",
    {
      description: "Lê e valida config.json atual",
      inputSchema: {},
    },
    async () => handleConfigGet()
  );

  server.registerTool(
    "config_create",
    {
      description: "Cria config.json (equivalente ao comando init, sem wizard interativo)",
      inputSchema: configCreateInputSchema,
    },
    async (input) => handleConfigCreate(input)
  );

  server.registerTool(
    "config_update",
    {
      description: "Atualiza config.json (equivalente ao comando config, sem wizard interativo)",
      inputSchema: configUpdateInputSchema,
    },
    async (input) => handleConfigUpdate(input)
  );

  server.registerTool(
    "catalog_get",
    {
      description: "Carrega catálogo/volumes disponíveis para um plugin e serieUrl",
      inputSchema: catalogGetInputSchema,
    },
    async (input) => handleCatalogGet(input)
  );

  server.registerTool(
    "manga_search",
    {
      description: "Busca manga por nome (plugins com searchManga, ex.: mangadex)",
      inputSchema: mangaSearchInputSchema,
    },
    async (input) => handleMangaSearch(input)
  );

  server.registerTool(
    "download",
    {
      description: "Baixa volumes configurados (equivalente ao comando download)",
      inputSchema: downloadInputSchema,
    },
    async (input) => handleDownload(input)
  );

  server.registerTool(
    "review",
    {
      description: "Compara catálogo do site com arquivos locais",
      inputSchema: reviewInputSchema,
    },
    async (input) => handleReview(input)
  );

  server.registerTool(
    "rename",
    {
      description: "Renomeia PDFs para formato Kindle",
      inputSchema: renameInputSchema,
    },
    async (input) => handleRename(input)
  );

  server.registerTool(
    "convert",
    {
      description: "Converte PDFs locais para outro formato de saída",
      inputSchema: convertInputSchema,
    },
    async (input) => handleConvert(input)
  );

  server.registerResource(
    "config-current",
    "config://current",
    {
      description: "Snapshot do config.json validado",
      mimeType: "application/json",
    },
    async () => readConfigResource()
  );

  server.registerResource(
    "plugin-catalog",
    "plugin://{pluginId}",
    {
      description: "Metadata e setupFields de um plugin",
      mimeType: "application/json",
    },
    async (_uri, { pluginId }) => readPluginResource(pluginId)
  );

  return server;
}

export async function startStdioServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}

/**
 * @param {{ host?: string, port?: number }} [options]
 */
export async function startHttpServer({ host, port } = {}) {
  const listenHost = host ?? process.env.MCP_HTTP_HOST ?? "127.0.0.1";
  const listenPort = Number(port ?? process.env.MCP_HTTP_PORT ?? 3847);
  const app = createMcpExpressApp();

  app.post("/mcp", async (req, res) => {
    const server = createMcpServer();
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on("close", () => {
        transport.close();
        server.close();
      });
    } catch (err) {
      console.error("Erro MCP HTTP:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  app.get("/mcp", (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    });
  });

  app.delete("/mcp", (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    });
  });

  await new Promise((resolve, reject) => {
    app.listen(listenPort, listenHost, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  console.error(`manga-downloader MCP HTTP em http://${listenHost}:${listenPort}/mcp`);

  const plugins = await listPlugins();
  console.error(`Plugins: ${plugins.map((p) => p.id).join(", ")}`);

  return { app, host: listenHost, port: listenPort };
}
