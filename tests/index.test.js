import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateConfig, normalizeRawConfig, getVolumes } from "../lib/config/store.js";
import { parseCliArgs } from "../lib/cli/args.js";
import {
  barraProgresso,
  chapterExists,
  parseFilenameFromDisposition,
} from "../lib/shared/utils.js";
import { isRetriableStatus, isNonRetriableStatus } from "../lib/shared/http.js";

describe("validateConfig", () => {
  const baseConfig = {
    source: "centralnovel",
    pastaBase: "D:\\novel",
    pluginConfig: {
      serieUrl: "https://centralnovel.com/series/test/",
      volumes: ["1"],
      outputFormat: "chapters",
    },
  };

  it("aceita config válido com defaults", () => {
    const config = validateConfig(baseConfig);

    assert.equal(config.concurrency, 3);
    assert.equal(config.retryDelayMs, 5000);
    assert.equal(config.requestTimeoutMs, 30000);
    assert.equal(config.maxRetries, null);
  });

  it("rejeita config sem volumes", () => {
    assert.throws(
      () =>
        validateConfig({
          ...baseConfig,
          pluginConfig: {
            serieUrl: "https://centralnovel.com/series/test/",
            volumes: [],
          },
        }),
      /volumes está vazio/
    );
  });

  it("aceita volumes vazio quando allowEmptyVolumes", () => {
    const config = validateConfig(
      {
        ...baseConfig,
        pluginConfig: {
          serieUrl: "https://centralnovel.com/series/test/",
          volumes: [],
        },
      },
      { allowEmptyVolumes: true }
    );

    assert.deepEqual(getVolumes(config), []);
  });

  it("rejeita serieUrl inválida", () => {
    assert.throws(
      () =>
        validateConfig({
          ...baseConfig,
          pluginConfig: {
            serieUrl: "nao-e-url",
            volumes: ["1"],
          },
        }),
      /serieUrl deve ser uma URL válida/
    );
  });
});

describe("normalizeRawConfig", () => {
  it("migra config legado para novo formato", () => {
    const normalized = normalizeRawConfig({
      pastaBase: "D:\\novel",
      serieUrl: "https://centralnovel.com/series/test/",
      volumes: ["1", "2"],
    });

    assert.equal(normalized.source, "centralnovel");
    assert.deepEqual(normalized.pluginConfig.serieUrl, "https://centralnovel.com/series/test/");
    assert.deepEqual(normalized.pluginConfig.volumes, ["1", "2"]);
    assert.equal(normalized.pluginConfig.outputFormat, "chapters");
    assert.equal(normalized.serieUrl, undefined);
  });
});

describe("parseCliArgs", () => {
  it("parseia flags básicas", () => {
    const opts = parseCliArgs(["--volume", "3", "--dry-run", "--verbose"]);
    assert.equal(opts.command, "download");
    assert.equal(opts.volume, "3");
    assert.equal(opts.dryRun, true);
    assert.equal(opts.verbose, true);
  });

  it("parseia subcomando review", () => {
    const opts = parseCliArgs(["review", "--volume", "Extra"]);
    assert.equal(opts.command, "review");
    assert.equal(opts.volume, "Extra");
  });

  it("parseia subcomando init", () => {
    const opts = parseCliArgs(["init"]);
    assert.equal(opts.command, "init");
  });

  it("parseia subcomando config", () => {
    const opts = parseCliArgs(["config"]);
    assert.equal(opts.command, "config");
  });

  it("parseia subcomando convert com --format", () => {
    const opts = parseCliArgs(["convert", "--format", "volume-single", "--force"]);
    assert.equal(opts.command, "convert");
    assert.equal(opts.format, "volume-single");
    assert.equal(opts.force, true);
  });

  it("rejeita config com --volume", () => {
    assert.throws(
      () => parseCliArgs(["config", "--volume", "1"]),
      /config não aceita --volume/
    );
  });

  it("rejeita review com --dry-run", () => {
    assert.throws(
      () => parseCliArgs(["review", "--dry-run"]),
      /review e --dry-run/
    );
  });

  it("parseia rename e permite --dry-run", () => {
    const opts = parseCliArgs(["rename", "--dry-run", "--volume", "3"]);
    assert.equal(opts.command, "rename");
    assert.equal(opts.dryRun, true);
    assert.equal(opts.volume, "3");
  });

  it("rejeita quiet e verbose juntos", () => {
    assert.throws(() => parseCliArgs(["--quiet", "--verbose"]), /quiet e --verbose/);
  });
});

describe("utils", () => {
  it("barraProgresso calcula percentual", () => {
    assert.match(barraProgresso(1, 2), /50%/);
    assert.equal(barraProgresso(0, 0), "[                    ] 0%");
  });

  it("chapterExists evita colisão parcial de IDs", () => {
    const files = ["Capitulo 100.pdf", "Capitulo 1100.pdf"];
    assert.equal(chapterExists("100", files), true);
    assert.equal(chapterExists("200", files), false);
  });

  it("chapterExists reconhece formato padronizado Cap 054", () => {
    const files = ["Slime - Vol 03 - Cap 054.pdf"];
    assert.equal(chapterExists("54", files), true);
    assert.equal(chapterExists("1", ["Slime - Vol 03 - Cap 101.pdf"]), false);
    assert.equal(chapterExists("185", ["Slime - Vol 09 - Cap 185-5.pdf"]), false);
  });

  it("chapterExists aceita padrões extras do plugin", () => {
    const files = ["capitulo-42-centralnovel.com.pdf"];
    const patterns = [/capitulo-42(?:-centralnovel|\.pdf|$)/i];
    assert.equal(chapterExists("42", files, patterns), true);
    assert.equal(chapterExists("42", files), false);
  });

  it("parseFilenameFromDisposition extrai nome", () => {
    assert.equal(
      parseFilenameFromDisposition('attachment; filename="cap-1.pdf"'),
      "cap-1.pdf"
    );
  });
});

describe("http status helpers", () => {
  it("classifica status retentáveis e permanentes", () => {
    assert.equal(isRetriableStatus(429), true);
    assert.equal(isRetriableStatus(503), true);
    assert.equal(isNonRetriableStatus(404), true);
    assert.equal(isRetriableStatus(404), false);
  });
});
