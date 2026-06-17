#!/usr/bin/env node
import path from "path";
import { pathToFileURL } from "url";
import { runConvert } from "../lib/commands/convert.js";
import { runDownload } from "../lib/commands/download.js";
import { runRename } from "../lib/commands/rename.js";
import { runReview } from "../lib/commands/review.js";
import { parseCliArgs, printHelp } from "../lib/cli/args.js";
import { configExists } from "../lib/config/store.js";
import { runConfigEdit } from "../lib/config/edit.js";
import { runInit } from "../lib/config/init.js";
import { createLogger, LogLevel } from "../lib/shared/logger.js";
import { CONFIG_PATH } from "../lib/core/paths.js";
import { printErrorBlock } from "../lib/ui/index.js";

const INIT_HINT = "Execute manga-downloader init primeiro.";

export async function main(argv = process.argv.slice(2)) {
  const cli = parseCliArgs(argv);

  if (cli.help) {
    printHelp();
    return;
  }

  if (cli.command === "init") {
    await runInit({ configPath: CONFIG_PATH });
    return;
  }

  if (cli.command === "config") {
    const hasConfig = await configExists(CONFIG_PATH);
    if (!hasConfig) {
      console.error(INIT_HINT);
      process.exitCode = 1;
      return;
    }
    await runConfigEdit({ configPath: CONFIG_PATH });
    return;
  }

  const hasConfig = await configExists(CONFIG_PATH);
  if (!hasConfig) {
    console.error(INIT_HINT);
    process.exitCode = 1;
    return;
  }

  const logLevel = cli.quiet
    ? LogLevel.QUIET
    : cli.verbose
      ? LogLevel.VERBOSE
      : LogLevel.NORMAL;

  const logger = createLogger(logLevel);

  try {
    if (cli.command === "review") {
      await runReview({ cli, configPath: CONFIG_PATH, logger });
      return;
    }

    if (cli.command === "rename") {
      await runRename({ cli, configPath: CONFIG_PATH, logger });
      return;
    }

    if (cli.command === "convert") {
      await runConvert({ cli, configPath: CONFIG_PATH, logger });
      return;
    }

    await runDownload({ cli, configPath: CONFIG_PATH, logger });
  } catch (err) {
    if (err.message === "CONFIG_MISSING") {
      console.error(INIT_HINT);
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}

const isMainModule =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  main().catch((err) => {
    printErrorBlock(err, { verbose: process.argv.includes("--verbose") });
    process.exitCode = 1;
  });
}
