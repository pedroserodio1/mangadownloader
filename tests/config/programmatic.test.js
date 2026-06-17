import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  createConfig,
  getConfigSnapshot,
  listPlugins,
  resolveConfigPath,
  updateConfig,
} from "../../lib/config/programmatic.js";
import centralnovelPlugin from "../../plugins/centralnovel/index.js";
import { clearPluginCache } from "../../lib/plugins/loader.js";

describe("programmatic config", () => {
  /** @type {string} */
  let tempDir;
  /** @type {string} */
  let configPath;

  beforeEach(async () => {
    clearPluginCache();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "manga-config-"));
    configPath = path.join(tempDir, "config.json");
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("createConfig salva config válido", async () => {
    const result = await createConfig(
      {
        source: "centralnovel",
        pastaBase: "D:\\Biblioteca",
        pluginConfig: {
          serieUrl: "https://centralnovel.com/series/test/",
          volumes: ["1", "2"],
          outputFormat: "chapters",
        },
        seriesName: "Minha Série",
      },
      { configPath }
    );

    assert.equal(result.config.source, "centralnovel");
    assert.equal(result.config.seriesName, "Minha Série");
    assert.deepEqual(result.config.pluginConfig.volumes, ["1", "2"]);

    const snapshot = await getConfigSnapshot({ configPath });
    assert.equal(snapshot.config.pastaBase, "D:\\Biblioteca");
  });

  it("createConfig rejeita overwrite sem flag", async () => {
    await createConfig(
      {
        source: "centralnovel",
        pastaBase: "D:\\Biblioteca",
        pluginConfig: {
          serieUrl: "https://centralnovel.com/series/test/",
          volumes: ["1"],
          outputFormat: "chapters",
        },
      },
      { configPath }
    );

    await assert.rejects(
      () =>
        createConfig(
          {
            source: "centralnovel",
            pastaBase: "D:\\Outra",
            pluginConfig: {
              serieUrl: "https://centralnovel.com/series/other/",
              volumes: ["1"],
              outputFormat: "chapters",
            },
          },
          { configPath }
        ),
      /já existe/
    );
  });

  it("updateConfig aplica patch parcial", async () => {
    await createConfig(
      {
        source: "centralnovel",
        pastaBase: "D:\\Biblioteca",
        pluginConfig: {
          serieUrl: "https://centralnovel.com/series/test/",
          volumes: ["1"],
          outputFormat: "chapters",
        },
      },
      { configPath }
    );

    const updated = await updateConfig(
      {
        volumes: ["1", "2", "Extra"],
        outputFormat: "volume-single",
        concurrency: 5,
      },
      { configPath }
    );

    assert.deepEqual(updated.config.pluginConfig.volumes, ["1", "2", "Extra"]);
    assert.equal(updated.config.pluginConfig.outputFormat, "volume-single");
    assert.equal(updated.config.concurrency, 5);
  });

  it("listPlugins inclui centralnovel", async () => {
    const plugins = await listPlugins();
    assert.ok(plugins.some((p) => p.id === "centralnovel"));
    const cn = plugins.find((p) => p.id === "centralnovel");
    assert.ok(cn.setupFields.some((f) => f.key === "serieUrl"));
  });

  it("describePlugin reflete plugin centralnovel", async () => {
    const plugins = await listPlugins();
    const cn = plugins.find((p) => p.id === "centralnovel");
    assert.equal(cn.name, centralnovelPlugin.name);
  });

  it("resolveConfigPath usa env quando definido", () => {
    const original = process.env.MANGA_DOWNLOADER_CONFIG;
    process.env.MANGA_DOWNLOADER_CONFIG = "C:\\custom\\config.json";
    try {
      assert.equal(resolveConfigPath(), "C:\\custom\\config.json");
    } finally {
      if (original === undefined) {
        delete process.env.MANGA_DOWNLOADER_CONFIG;
      } else {
        process.env.MANGA_DOWNLOADER_CONFIG = original;
      }
    }
  });
});
