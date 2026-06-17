export const HTTP_MESSAGES = {
  400: {
    title: "Requisição inválida",
    hint: "Verifique a URL e tente novamente.",
  },
  401: {
    title: "Não autorizado",
    hint: "O site exige autenticação que este CLI não suporta.",
  },
  403: {
    title: "Acesso negado",
    hint: "Verifique se a série está disponível no site.",
  },
  404: {
    title: "Conteúdo não encontrado",
    hint: "Confira a URL no config.json.",
  },
  408: {
    title: "Tempo esgotado",
    hint: "Conexão lenta; tentará de novo automaticamente.",
  },
  429: {
    title: "Site limitou o acesso",
    hint: "Aguarde alguns minutos ou reduza concurrency no config.",
  },
  500: {
    title: "Site indisponível",
    hint: "Problema temporário no servidor; tentará de novo.",
  },
  502: {
    title: "Site indisponível",
    hint: "Problema temporário no servidor; tentará de novo.",
  },
  503: {
    title: "Site indisponível",
    hint: "Problema temporário no servidor; tentará de novo.",
  },
};

const NETWORK_ERROR = {
  title: "Falha de conexão",
  hint: "Verifique sua internet e tente novamente.",
};

const TIMEOUT_ERROR = {
  title: "Tempo esgotado",
  hint: "Conexão lenta; tentará de novo automaticamente.",
};

const RETRY_EXHAUSTED = {
  title: "Muitas tentativas sem sucesso",
  hint: "Aumente retryDelayMs no config ou tente mais tarde.",
};

const GENERIC_ERROR = {
  title: "Erro inesperado",
  hint: "Use --verbose para detalhes técnicos.",
};

/**
 * @param {{ status?: number, kind?: string }} options
 */
export function describeHttpError({ status, kind } = {}) {
  if (kind === "timeout") {
    return { ...TIMEOUT_ERROR, status };
  }

  if (kind === "network") {
    return { ...NETWORK_ERROR, status };
  }

  if (kind === "retry_exhausted") {
    return { ...RETRY_EXHAUSTED, status };
  }

  if (status && HTTP_MESSAGES[status]) {
    return { ...HTTP_MESSAGES[status], status };
  }

  if (status && status >= 500) {
    return { ...HTTP_MESSAGES[500], status };
  }

  if (status) {
    return {
      title: `Erro HTTP ${status}`,
      hint: "Use --verbose para detalhes técnicos.",
      status,
    };
  }

  return { ...GENERIC_ERROR, status };
}

/**
 * @param {Error & { userMessage?: string, hint?: string, status?: number, retriable?: boolean, name?: string }} err
 */
export function describeAppError(err) {
  if (err.name === "AppError" || err.retriable !== undefined) {
    if (err.userMessage) {
      return {
        title: err.userMessage,
        hint: err.hint ?? GENERIC_ERROR.hint,
        status: err.status,
      };
    }

    if (err.message.includes("Timeout ao acessar")) {
      return describeHttpError({ kind: "timeout", status: err.status });
    }

    if (err.message.includes("Falha de rede")) {
      return describeHttpError({ kind: "network", status: err.status });
    }

    if (err.message.includes("limite de") && err.message.includes("tentativas")) {
      return describeHttpError({ kind: "retry_exhausted", status: err.status });
    }

    if (err.status) {
      return describeHttpError({ status: err.status });
    }
  }

  return {
    title: err.message?.split("\n")[0] || GENERIC_ERROR.title,
    hint: GENERIC_ERROR.hint,
    status: undefined,
  };
}

/**
 * @param {Error} err
 */
export function formatErrorShort(err) {
  const { title } = describeAppError(err);
  return title;
}

/**
 * @param {Error} err
 * @param {{ verbose?: boolean }} options
 */
export function formatErrorBlock(err, { verbose = false } = {}) {
  const { title, hint, status } = describeAppError(err);
  const block = { title, hint, status };

  if (verbose) {
    block.detail = err.message;
    if (err.stack) {
      block.stack = err.stack;
    }
  }

  return block;
}

/**
 * @param {Array<{ volume: string, capId: string, status?: number, title: string, hint?: string }>} errors
 */
export function groupErrors(errors) {
  const groups = new Map();

  for (const err of errors) {
    const key = err.status ? String(err.status) : err.title;
    if (!groups.has(key)) {
      groups.set(key, {
        status: err.status,
        title: err.title,
        hint: err.hint,
        items: [],
      });
    }
    groups.get(key).items.push({ volume: err.volume, capId: err.capId });
  }

  return [...groups.values()];
}

/**
 * @param {import('./http.js').AppError} error
 * @param {{ retriable?: boolean, status?: number, kind?: string }} options
 */
export function applyUserFacingFields(error, { retriable, status, kind } = {}) {
  const described = describeHttpError({ status, kind });
  error.retriable = retriable;
  error.status = status;
  error.userMessage = described.title;
  error.hint = described.hint;
  return error;
}
