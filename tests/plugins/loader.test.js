import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  clearPluginCache,
  discoverPlugins,
  loadPlugin,
  validatePlugin,
} from "../../lib/plugins/loader.js";
import centralnovelPlugin from "../../plugins/centralnovel/index.js";

describe("plugin loader", () => {
  beforeEach(() => {
    clearPluginCache();
  });

  it("descobre centralnovel automaticamente", async () => {
    const plugins = await discoverPlugins();
    assert.ok(plugins.has("centralnovel"));
    assert.ok(plugins.has("mangadex"));
    assert.equal(plugins.get("centralnovel").name, "Central Novel");
    assert.equal(plugins.get("mangadex").id, "mangadex");
    assert.ok(!plugins.has("_template"));
    assert.ok(!plugins.has("template"));
  });

  it("loadPlugin retorna plugin por id", async () => {
    const plugin = await loadPlugin("centralnovel");
    assert.equal(plugin.id, "centralnovel");
  });

  it("loadPlugin falha para id inexistente", async () => {
    await assert.rejects(() => loadPlugin("site-inexistente"), /não encontrado/);
  });

  it("validatePlugin rejeita id divergente da pasta", () => {
    assert.throws(
      () => validatePlugin({ default: { ...centralnovelPlugin, id: "outro" } }, "centralnovel"),
      /deve ter id/
    );
  });
});
