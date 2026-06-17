import { parseCliArgs } from "../cli/args.js";
import { runConvert } from "../commands/convert.js";
import { runDownload } from "../commands/download.js";
import { runRename } from "../commands/rename.js";
import { runReview } from "../commands/review.js";
import { createCollectingLogger, LogLevel } from "../shared/logger.js";
import { resolveConfigPath } from "../config/programmatic.js";

/**
 * @param {object} opts
 * @returns {import('../cli/args.js').ReturnType<typeof parseCliArgs>}
 */
function toCliOptions(opts) {
  return {
    command: opts.command ?? "download",
    volume: opts.volume ?? null,
    format: opts.format ?? null,
    dryRun: Boolean(opts.dryRun),
    quiet: opts.quiet !== false,
    verbose: Boolean(opts.verbose),
    force: Boolean(opts.force),
    help: false,
  };
}

function resolveLogLevel({ quiet, verbose }) {
  if (verbose) return LogLevel.VERBOSE;
  if (quiet) return LogLevel.QUIET;
  return LogLevel.NORMAL;
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 */
async function withExitCodeCapture(fn) {
  const previous = process.exitCode;
  process.exitCode = 0;
  try {
    const data = await fn();
    const exitCode = process.exitCode ?? 0;
    return { success: exitCode === 0, exitCode, data };
  } finally {
    process.exitCode = previous;
  }
}

/**
 * @param {object} opts
 * @param {string} [opts.configPath]
 */
export async function executeDownload(opts = {}) {
  const configPath = opts.configPath ?? resolveConfigPath();
  const cli = toCliOptions({ ...opts, command: "download" });
  const logger = createCollectingLogger(resolveLogLevel(cli));

  const { success, exitCode, data } = await withExitCodeCapture(() =>
    runDownload({ cli, configPath, logger })
  );

  return {
    success,
    exitCode,
    logs: logger.lines,
    stats: data?.stats ?? null,
  };
}

export async function executeReview(opts = {}) {
  const configPath = opts.configPath ?? resolveConfigPath();
  const cli = toCliOptions({ ...opts, command: "review" });
  const logger = createCollectingLogger(resolveLogLevel(cli));

  const { success, exitCode, data } = await withExitCodeCapture(() =>
    runReview({ cli, configPath, logger })
  );

  return {
    success,
    exitCode,
    logs: logger.lines,
    review: data ?? null,
  };
}

export async function executeRename(opts = {}) {
  const configPath = opts.configPath ?? resolveConfigPath();
  const cli = toCliOptions({ ...opts, command: "rename" });
  const logger = createCollectingLogger(resolveLogLevel(cli));

  const { success, exitCode, data } = await withExitCodeCapture(() =>
    runRename({ cli, configPath, logger })
  );

  return {
    success,
    exitCode,
    logs: logger.lines,
    rename: data ?? null,
  };
}

export async function executeConvert(opts = {}) {
  const configPath = opts.configPath ?? resolveConfigPath();
  const cli = toCliOptions({ ...opts, command: "convert" });
  const logger = createCollectingLogger(resolveLogLevel(cli));

  const { success, exitCode, data } = await withExitCodeCapture(() =>
    runConvert({ cli, configPath, logger })
  );

  return {
    success,
    exitCode,
    logs: logger.lines,
    convert: data ?? null,
  };
}
