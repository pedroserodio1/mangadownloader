export const LogLevel = {
  QUIET: 0,
  NORMAL: 1,
  VERBOSE: 2,
};

function formatLogLine(level, args) {
  const text = args
    .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
    .join(" ");
  return { level, text };
}

export function createLogger(level = LogLevel.NORMAL) {
  return {
    error(...args) {
      console.error(...args);
    },
    warn(...args) {
      if (level >= LogLevel.NORMAL) console.warn(...args);
    },
    info(...args) {
      if (level >= LogLevel.NORMAL) console.log(...args);
    },
    verbose(...args) {
      if (level >= LogLevel.VERBOSE) console.log(...args);
    },
  };
}

/**
 * Logger for MCP stdio — collects lines for tool responses; writes only errors to stderr.
 * @param {number} [level]
 * @returns {import('./logger.js').Logger & { lines: { level: string, text: string }[] }}
 */
export function createCollectingLogger(level = LogLevel.NORMAL) {
  /** @type {{ level: string, text: string }[]} */
  const lines = [];

  const push = (logLevel, args, minLevel) => {
    if (level >= minLevel) {
      lines.push(formatLogLine(logLevel, args));
    }
  };

  return {
    lines,
    error(...args) {
      lines.push(formatLogLine("error", args));
      console.error(...args);
    },
    warn(...args) {
      push("warn", args, LogLevel.NORMAL);
    },
    info(...args) {
      push("info", args, LogLevel.NORMAL);
    },
    verbose(...args) {
      push("verbose", args, LogLevel.VERBOSE);
    },
  };
}
