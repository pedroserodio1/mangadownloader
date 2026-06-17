import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateConfig } from "../lib/config/store.js";
import centralnovelPlugin from "../plugins/centralnovel/index.js";

describe("buildInitConfig", () => {
  it("monta config a partir de respostas do wizard", () => {
    const draft = {
      source: "centralnovel",
      pastaBase: "D:\\Biblioteca",
      pluginConfig: {
        serieUrl: "https://centralnovel.com/series/test/",
        volumes: ["1", "Extra"],
        outputFormat: "volume-single",
      },
      seriesName: "Minha Série",
      concurrency: 3,
      retryDelayMs: 5000,
      requestTimeoutMs: 30000,
      maxRetries: null,
    };

    const config = validateConfig(draft, { plugin: centralnovelPlugin });

    assert.equal(config.source, "centralnovel");
    assert.equal(config.pastaBase, "D:\\Biblioteca");
    assert.deepEqual(config.pluginConfig.volumes, ["1", "Extra"]);
    assert.equal(config.seriesName, "Minha Série");
    assert.equal(config.pluginConfig.outputFormat, "volume-single");
  });
});
