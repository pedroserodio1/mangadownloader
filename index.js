#!/usr/bin/env node
import { main } from "./bin/manga-downloader.js";
import { printErrorBlock } from "./lib/ui/index.js";

main().catch((err) => {
  printErrorBlock(err, { verbose: process.argv.includes("--verbose") });
  process.exitCode = 1;
});
