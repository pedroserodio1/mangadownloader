#!/usr/bin/env node
import { startHttpServer, startStdioServer } from "../lib/mcp/server.js";

const args = process.argv.slice(2);
const useHttp = args.includes("--http");

if (useHttp) {
  await startHttpServer();
} else {
  await startStdioServer();
}
