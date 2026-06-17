import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCollectingLogger, LogLevel } from "../../lib/shared/logger.js";
import { promptOutputFormatChoice } from "../../lib/output/prompt.js";
import centralnovelPlugin from "../../plugins/centralnovel/index.js";
import { validateConfig } from "../../lib/config/store.js";

describe("createCollectingLogger", () => {
  it("acumula linhas sem escrever info em stdout", () => {
    const logger = createCollectingLogger(LogLevel.NORMAL);
    const originalLog = console.log;
    let logCalls = 0;
    console.log = () => {
      logCalls++;
    };

    try {
      logger.info("mensagem info");
      logger.warn("mensagem warn");
      logger.error("mensagem erro");
    } finally {
      console.log = originalLog;
    }

    assert.equal(logCalls, 0);
    assert.equal(logger.lines.length, 3);
    assert.equal(logger.lines[0].level, "info");
    assert.equal(logger.lines[1].level, "warn");
    assert.equal(logger.lines[2].level, "error");
  });
});

describe("promptOutputFormatChoice non-TTY", () => {
  it("usa formato do config sem prompt interativo", async () => {
    const config = validateConfig(
      {
        source: "centralnovel",
        pastaBase: "D:\\novel",
        pluginConfig: {
          serieUrl: "https://centralnovel.com/series/test/",
          volumes: ["1"],
          outputFormat: "volume-single",
        },
      },
      { plugin: centralnovelPlugin }
    );

    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });

    try {
      const format = await promptOutputFormatChoice(centralnovelPlugin, config, {});
      assert.equal(format, "volume-single");
    } finally {
      Object.defineProperty(process.stdin, "isTTY", {
        value: originalIsTTY,
        configurable: true,
      });
    }
  });
});
