import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { barraProgresso } from "../lib/shared/utils.js";
import { createDownloadUI } from "../lib/ui/index.js";

describe("createDownloadUI", () => {
  it("renderiza sem erro em modo desabilitado", () => {
    const ui = createDownloadUI({ useUi: false });
    ui.onVolumeStart("1", 3);
    ui.onProgress("1", "101", "queued");
    ui.onProgress("1", "101", "done");
    ui.onVolumeComplete("1", { downloaded: 1, skipped: 0, failed: 0, errors: [] });
    ui.dispose();
  });

  it("onRetry atualiza capítulo para retrying sem lançar", () => {
    const ui = createDownloadUI({ useUi: false });
    ui.onVolumeStart("1", 2);
    ui.onRetry("1", "101", {
      attempt: 2,
      message: "Site limitou o acesso",
      delaySec: 5,
    });
    ui.onProgress("1", "101", "done");
    ui.dispose();
  });

  it("barraProgresso usada na UI", () => {
    assert.match(barraProgresso(3, 10), /30%/);
  });
});
