import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as z from "zod/v4";
import {
  configCreateInputSchema,
  downloadInputSchema,
  reviewInputSchema,
} from "../../lib/mcp/schemas.js";
import { formatPayloadWithLogs, formatToolError } from "../../lib/mcp/responses.js";

describe("MCP schemas", () => {
  it("valida download input", () => {
    const schema = z.object(downloadInputSchema);
    const parsed = schema.parse({ volume: "3", dryRun: true });
    assert.equal(parsed.volume, "3");
    assert.equal(parsed.dryRun, true);
  });

  it("valida config_create input", () => {
    const schema = z.object(configCreateInputSchema);
    const parsed = schema.parse({
      source: "centralnovel",
      pastaBase: "D:\\novel",
      pluginConfig: {
        serieUrl: "https://centralnovel.com/series/x/",
        volumes: ["1"],
        outputFormat: "chapters",
      },
    });
    assert.equal(parsed.source, "centralnovel");
  });

  it("review aceita objeto vazio", () => {
    const schema = z.object(reviewInputSchema);
    const parsed = schema.parse({});
    assert.equal(parsed.volume, undefined);
  });
});

describe("MCP responses", () => {
  it("formatPayloadWithLogs inclui logs formatados", () => {
    const result = formatPayloadWithLogs(
      { success: true },
      [{ level: "info", text: "ok" }]
    );
    assert.equal(result.content[0].type, "text");
    assert.match(result.content[0].text, /"success": true/);
    assert.match(result.content[0].text, /\[info\] ok/);
  });

  it("formatToolError marca isError", () => {
    const result = formatToolError(new Error("falhou"));
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /falhou/);
  });
});
