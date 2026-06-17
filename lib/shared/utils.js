import fs from "fs/promises";
import path from "path";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function barraProgresso(current, total, length = 20) {
  if (total === 0) return "[                    ] 0%";
  const perc = current / total;
  const filledLength = Math.round(length * perc);
  const bar = "=".repeat(filledLength) + " ".repeat(length - filledLength);
  return `[${bar}] ${Math.round(perc * 100)}%`;
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function chapterExists(capId, pdfFileNames, extraPatterns = []) {
  const id = String(capId).trim();
  const patterns = [];

  if (/^\d+$/.test(id)) {
    patterns.push(new RegExp(`Cap\\s+${id.padStart(3, "0")}(?!-)`, "i"));
    patterns.push(new RegExp(`Capitulo\\s+${escapeRegex(id)}\\b`, "i"));
  } else {
    patterns.push(new RegExp(`Cap\\s+${escapeRegex(id)}\\b`, "i"));
  }

  patterns.push(...extraPatterns);

  return pdfFileNames.some(
    (name) =>
      name.endsWith(".pdf") && patterns.some((pattern) => pattern.test(name))
  );
}

export async function writeFileAtomic(filePath, data) {
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, data);
  await fs.rename(tmpPath, filePath);
}

export function createLimiter(concurrency) {
  let active = 0;
  const queue = [];

  const pump = () => {
    while (active < concurrency && queue.length > 0) {
      active++;
      const { fn, resolve, reject } = queue.shift();
      fn()
        .then(resolve, reject)
        .finally(() => {
          active--;
          pump();
        });
    }
  };

  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      pump();
    });
}

export function parseFilenameFromDisposition(headerValue) {
  if (!headerValue) return null;
  const match = headerValue.match(/filename\*?=(?:UTF-8''|"?)([^";]+)"?/i);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1].replace(/"/g, ""));
  } catch {
    return match[1].replace(/"/g, "");
  }
}

export function createStats() {
  return {
    downloaded: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };
}

export function mergeStats(target, source) {
  target.downloaded += source.downloaded;
  target.skipped += source.skipped;
  target.failed += source.failed;
  target.errors.push(...source.errors);
}
