import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppError } from "../lib/shared/http.js";
import {
  describeHttpError,
  describeAppError,
  formatErrorShort,
  formatErrorBlock,
  groupErrors,
  applyUserFacingFields,
} from "../lib/shared/errors.js";

function makeAppError(message, options) {
  const err = new AppError(message, options);
  return applyUserFacingFields(err, options);
}

describe("describeHttpError", () => {
  it("mapeia 429 com dica de rate limit", () => {
    const result = describeHttpError({ status: 429 });
    assert.equal(result.title, "Site limitou o acesso");
    assert.match(result.hint, /concurrency/i);
  });

  it("mapeia 404", () => {
    const result = describeHttpError({ status: 404 });
    assert.equal(result.title, "Conteúdo não encontrado");
  });

  it("mapeia timeout e rede", () => {
    assert.equal(describeHttpError({ kind: "timeout" }).title, "Tempo esgotado");
    assert.equal(describeHttpError({ kind: "network" }).title, "Falha de conexão");
  });

  it("mapeia 5xx genérico", () => {
    const result = describeHttpError({ status: 503 });
    assert.equal(result.title, "Site indisponível");
  });
});

describe("formatErrorShort", () => {
  it("não inclui URL na mensagem curta", () => {
    const err = makeAppError("HTTP 429 ao acessar https://centralnovel.com/series/foo/", {
      retriable: true,
      status: 429,
    });
    const short = formatErrorShort(err);
    assert.equal(short, "Site limitou o acesso");
    assert.doesNotMatch(short, /centralnovel/);
  });

  it("formata AppError com userMessage", () => {
    const err = new AppError("detalhe técnico", { status: 403 });
    err.userMessage = "Acesso negado";
    assert.equal(formatErrorShort(err), "Acesso negado");
  });
});

describe("formatErrorBlock", () => {
  it("inclui detail apenas em verbose", () => {
    const err = makeAppError("HTTP 404 ao acessar https://example.com/x", {
      status: 404,
    });
    const normal = formatErrorBlock(err);
    assert.equal(normal.title, "Conteúdo não encontrado");
    assert.equal(normal.detail, undefined);

    const verbose = formatErrorBlock(err, { verbose: true });
    assert.equal(verbose.detail, err.message);
  });
});

describe("groupErrors", () => {
  it("agrupa falhas pelo status", () => {
    const groups = groupErrors([
      { volume: "1", capId: "12", status: 429, title: "Site limitou o acesso", hint: "aguarde" },
      { volume: "1", capId: "13", status: 429, title: "Site limitou o acesso", hint: "aguarde" },
      { volume: "2", capId: "01", status: 404, title: "Conteúdo não encontrado", hint: "url" },
    ]);

    assert.equal(groups.length, 2);
    assert.equal(groups[0].items.length, 2);
    assert.equal(groups[1].status, 404);
  });
});

describe("describeAppError", () => {
  it("detecta retry esgotado pela mensagem", () => {
    const err = new AppError("GET url: limite de 3 tentativas atingido — HTTP 429", {
      retriable: false,
    });
    const result = describeAppError(err);
    assert.equal(result.title, "Muitas tentativas sem sucesso");
  });
});
