import * as z from "zod/v4";

export const logOptionsSchema = {
  quiet: z.boolean().optional().describe("Mostra apenas erros e resumo (padrão: true no MCP)"),
  verbose: z.boolean().optional().describe("Logs detalhados por capítulo"),
};

export const volumeOptionSchema = {
  volume: z
    .string()
    .optional()
    .describe("Limita a um volume (ex.: 3 ou Extra)"),
};

export const downloadInputSchema = {
  ...volumeOptionSchema,
  format: z.string().optional().describe("Formato de saída (ex.: volume-single)"),
  dryRun: z.boolean().optional().describe("Simula sem salvar arquivos"),
  ...logOptionsSchema,
};

export const reviewInputSchema = {
  ...volumeOptionSchema,
  ...logOptionsSchema,
};

export const renameInputSchema = {
  ...volumeOptionSchema,
  dryRun: z.boolean().optional().describe("Simula sem renomear arquivos"),
  ...logOptionsSchema,
};

export const convertInputSchema = {
  ...volumeOptionSchema,
  format: z.string().optional().describe("Formato alvo (obrigatório se ambíguo)"),
  force: z.boolean().optional().describe("Merge parcial mesmo com caps faltando"),
  dryRun: z.boolean().optional().describe("Simula sem converter arquivos"),
  ...logOptionsSchema,
};

export const configCreateInputSchema = {
  source: z.string().describe("ID do plugin (ex.: centralnovel)"),
  pastaBase: z.string().describe("Pasta base dos downloads"),
  pluginConfig: z.record(z.string(), z.unknown()).describe("Configuração do plugin"),
  seriesName: z.string().optional().describe("Nome da série para arquivos"),
  concurrency: z.number().int().min(1).optional(),
  retryDelayMs: z.number().int().min(0).optional(),
  requestTimeoutMs: z.number().int().min(1000).optional(),
  maxRetries: z.number().int().min(0).nullable().optional(),
  overwrite: z.boolean().optional().describe("Sobrescrever config.json existente"),
};

export const configUpdateInputSchema = {
  outputFormat: z.string().optional(),
  volumes: z.array(z.string()).optional(),
  pastaBase: z.string().optional(),
  serieUrl: z.string().optional(),
  seriesName: z.string().optional(),
  concurrency: z.number().int().min(1).optional(),
  retryDelayMs: z.number().int().min(0).optional(),
  requestTimeoutMs: z.number().int().min(1000).optional(),
  maxRetries: z.number().int().min(0).nullable().optional(),
  pluginConfig: z.record(z.string(), z.unknown()).optional(),
  reloadVolumes: z
    .boolean()
    .optional()
    .describe("Recarregar volumes do catálogo após mudar serieUrl"),
};

export const catalogGetInputSchema = {
  source: z.string().describe("ID do plugin"),
  pluginConfig: z.record(z.string(), z.unknown()).describe("Valores atuais do plugin"),
  pastaBase: z.string().optional(),
};

export const mangaSearchInputSchema = {
  source: z.string().describe("ID do plugin com busca (ex.: mangadex)"),
  query: z.string().describe("Termo de busca"),
  filters: z.record(z.string(), z.unknown()).optional(),
};
