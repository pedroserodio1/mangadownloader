import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPdfFileName,
  buildVolumePdfFileName,
  compareCapIdsNatural,
  extractCapIdFromPdfFileName,
  formatCapLabel,
  formatVolumeLabel,
  resolveSeriesName,
  sanitizeFileName,
} from "../lib/core/naming.js";

describe("naming", () => {
  it("formata volume numérico com zero à esquerda", () => {
    assert.equal(formatVolumeLabel("3"), "Vol 03");
    assert.equal(formatVolumeLabel("Extra"), "Vol Extra");
  });

  it("formata capítulo numérico com zero à esquerda", () => {
    assert.equal(formatCapLabel("54"), "Cap 054");
    assert.equal(formatCapLabel("1"), "Cap 001");
  });

  it("ordena caps compostos naturalmente (1-1-10 após 1-1-2)", () => {
    assert.ok(compareCapIdsNatural("1-1-2", "1-1-10") < 0);
    assert.ok(compareCapIdsNatural("1-0", "1-1-1") < 0);
    assert.ok(compareCapIdsNatural("1-1-9", "1-2-1") < 0);
  });

  it("extrai capId de nome de arquivo", () => {
    assert.equal(
      extractCapIdFromPdfFileName("konosuba - Vol 01 - Cap 1-1-10.pdf"),
      "1-1-10"
    );
    assert.equal(
      extractCapIdFromPdfFileName("Slime - Vol 03 - Cap 054.pdf"),
      "054"
    );
  });

  it("monta nome de PDF único por volume", () => {
    assert.equal(
      buildVolumePdfFileName({ seriesName: "Slime", volumeKey: "3" }),
      "Slime - Vol 03.pdf"
    );
  });

  it("monta nome de arquivo padronizado", () => {
    assert.equal(
      buildPdfFileName({ seriesName: "Slime", volumeKey: "3", capId: "54" }),
      "Slime - Vol 03 - Cap 054.pdf"
    );
    assert.equal(
      buildPdfFileName({ seriesName: "Slime", volumeKey: "Extra", capId: "1" }),
      "Slime - Vol Extra - Cap 001.pdf"
    );
  });

  it("remove caracteres inválidos do nome", () => {
    assert.equal(sanitizeFileName('Teste: Cap "1"'), "Teste- Cap -1-");
  });

  it("resolve seriesName do config ou pasta base", () => {
    assert.equal(
      resolveSeriesName({
        pastaBase: "D:\\Midias\\Novel\\slime",
        seriesName: "Slime",
      }),
      "Slime"
    );
    assert.equal(
      resolveSeriesName({ pastaBase: "D:\\Midias\\Novel\\slime" }),
      "Slime"
    );
  });
});
