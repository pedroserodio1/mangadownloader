export const LogLevel = {
  QUIET: 0,
  NORMAL: 1,
  VERBOSE: 2,
};

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
