import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import { ZipArchive } from "archiver";

/**
 * @param {import("archiver").ZipArchive} archive
 * @param {import("fs").WriteStream} output
 * @returns {Promise<void>}
 */
function finalizeArchive(archive, output) {
  return new Promise((resolve, reject) => {
    output.on("close", () => resolve());
    archive.on("error", reject);
    output.on("error", reject);
    archive.finalize();
  });
}

/**
 * @param {string} outputPath
 * @param {{ name: string, buffer: Buffer }[]} entries
 * @returns {Promise<void>}
 */
export async function createArchiveFromBuffers(outputPath, entries) {
  const output = createWriteStream(outputPath);
  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.pipe(output);

  for (const entry of entries) {
    archive.append(entry.buffer, { name: entry.name });
  }

  await finalizeArchive(archive, output);
}

/**
 * @param {string} outputPath
 * @param {string} sourceDir
 * @returns {Promise<void>}
 */
export async function createArchiveFromDirectory(outputPath, sourceDir) {
  const output = createWriteStream(outputPath);
  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.pipe(output);
  archive.directory(sourceDir, false);
  await finalizeArchive(archive, output);
}

/**
 * @param {{ index: number, buffer: Buffer, filename: string }[]} pages
 * @param {string} [prefix]
 * @returns {{ name: string, buffer: Buffer }[]}
 */
export function pagesToArchiveEntries(pages, prefix = "") {
  return pages.map((page, i) => {
    const ext = path.extname(page.filename) || ".jpg";
    const base = String(i + 1).padStart(3, "0") + ext;
    const name = prefix ? path.posix.join(prefix, base) : base;
    return { name, buffer: page.buffer };
  });
}

/**
 * @param {string} dir
 */
export async function removeDirectoryRecursive(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}
