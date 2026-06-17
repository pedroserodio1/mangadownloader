import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeRawConfig, validateConfig } from "../lib/config/store.js";
import centralnovelPlugin from "../plugins/centralnovel/index.js";

describe("config migration", () => {
  it("normaliza config legado com source inferido", () => {
    const raw = {
      pastaBase: "D:\\novel",
      serieUrl: "https://centralnovel.com/series/foo/",
      volumes: ["1"],
      concurrency: 5,
    };

    const normalized = normalizeRawConfig(raw);
    const config = validateConfig(normalized, { plugin: centralnovelPlugin });

    assert.equal(config.source, "centralnovel");
    assert.equal(config.pluginConfig.serieUrl, raw.serieUrl);
    assert.deepEqual(config.pluginConfig.volumes, ["1"]);
    assert.equal(config.concurrency, 5);
  });

  it("valida campos obrigatórios do plugin", () => {
    assert.throws(
      () =>
        validateConfig(
          {
            source: "centralnovel",
            pastaBase: "D:\\novel",
            pluginConfig: { volumes: ["1"] },
          },
          { plugin: centralnovelPlugin }
        ),
      /URL da série|serieUrl/
    );
  });
});
