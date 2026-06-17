import path from "path";

const INVALID_FILE_CHARS = /[<>:"/\\|?*]/g;

export function sanitizeFileName(name) {
  return name.replace(INVALID_FILE_CHARS, "-").replace(/\s+/g, " ").trim();
}

export function resolveSeriesName(config) {
  if (config.seriesName?.trim()) {
    return config.seriesName.trim();
  }

  const base = path.basename(config.pastaBase);
  if (!base) return "Novel";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function formatVolumeLabel(volumeKey) {
  const key = String(volumeKey).trim();
  if (/^\d+$/.test(key)) {
    return `Vol ${key.padStart(2, "0")}`;
  }
  return `Vol ${key}`;
}

export function formatCapLabel(capId) {
  const id = String(capId).trim();
  if (/^\d+$/.test(id)) {
    return `Cap ${id.padStart(3, "0")}`;
  }
  return `Cap ${id}`;
}

/**
 * Extrai o identificador do capítulo a partir do nome do PDF.
 * Ex.: "konosuba - Vol 01 - Cap 1-1-10.pdf" → "1-1-10"
 * @param {string} fileName
 * @returns {string|null}
 */
export function extractCapIdFromPdfFileName(fileName) {
  const match = String(fileName).match(/Cap\s+(.+?)\.pdf$/i);
  return match ? match[1].trim() : null;
}

/**
 * Compara IDs de capítulo com segmentos numéricos (1-1-2 antes de 1-1-10).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareCapIdsNatural(a, b) {
  const segA = String(a)
    .split("-")
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part));
  const segB = String(b)
    .split("-")
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part));

  const len = Math.max(segA.length, segB.length);
  for (let i = 0; i < len; i++) {
    const va = segA[i] ?? -1;
    const vb = segB[i] ?? -1;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareVolumeKeysNatural(a, b) {
  const sa = String(a).trim();
  const sb = String(b).trim();
  if (/^\d+$/.test(sa) && /^\d+$/.test(sb)) {
    return Number(sa) - Number(sb);
  }
  return sa.localeCompare(sb);
}

export function buildVolumePdfFileName({ seriesName, volumeKey }) {
  return sanitizeFileName(`${seriesName} - ${formatVolumeLabel(volumeKey)}.pdf`);
}

export function buildPdfFileName({ seriesName, volumeKey, capId }) {
  const parts = [
    seriesName,
    formatVolumeLabel(volumeKey),
    formatCapLabel(capId),
  ];
  return sanitizeFileName(`${parts.join(" - ")}.pdf`);
}

export function buildChapterArchiveFileName({ seriesName, volumeKey, capId, ext }) {
  const parts = [
    seriesName,
    formatVolumeLabel(volumeKey),
    formatCapLabel(capId),
  ];
  return sanitizeFileName(`${parts.join(" - ")}${ext}`);
}

export function buildChapterFolderName(capId) {
  return formatCapLabel(capId);
}

export function pageFileName(index, originalFilename) {
  const ext = path.extname(originalFilename) || ".jpg";
  return `${String(index + 1).padStart(3, "0")}${ext}`;
}
