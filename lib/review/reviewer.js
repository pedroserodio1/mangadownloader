import { chapterExists as defaultChapterExists } from "../shared/utils.js";

function findNumericGaps(capIds) {
  const numeric = capIds
    .filter((id) => /^\d+$/.test(id))
    .map(Number)
    .sort((a, b) => a - b);

  if (numeric.length < 2) return [];

  const siteSet = new Set(numeric);
  const gaps = [];

  for (let i = numeric[0]; i <= numeric[numeric.length - 1]; i++) {
    if (!siteSet.has(i)) {
      gaps.push(String(i));
    }
  }

  return gaps;
}

export function reviewVolume({
  volumeKey,
  siteChapters,
  localPdfFiles,
  volumeDirExists,
  matchChapter = defaultChapterExists,
  outputFormat = "chapters",
  mergedExists = false,
}) {
  const siteCapIds = siteChapters.map((c) => c.capId);

  const missing = siteCapIds.filter(
    (capId) => !matchChapter(capId, localPdfFiles)
  );

  const orphan = localPdfFiles.filter(
    (filename) => !siteCapIds.some((capId) => matchChapter(capId, [filename]))
  );

  const present = siteCapIds.filter((capId) =>
    matchChapter(capId, localPdfFiles)
  );

  const newVolume = !volumeDirExists && !mergedExists;
  const emptyDir =
    volumeDirExists && siteChapters.length > 0 && localPdfFiles.length === 0;
  const gaps = findNumericGaps(siteCapIds);

  let ok;
  if (outputFormat === "volume-single-only") {
    ok = mergedExists && missing.length === 0;
  } else if (outputFormat === "volume-single") {
    ok = mergedExists && missing.length === 0;
  } else {
    ok = missing.length === 0 && !emptyDir;
  }

  return {
    volumeKey,
    siteCount: siteChapters.length,
    localCount: localPdfFiles.length,
    missing,
    orphan,
    gaps,
    emptyDir,
    newVolume,
    present,
    mergedExists,
    ok,
  };
}

export function reviewAll({
  chaptersByVolume,
  localFilesByVolume,
  volumeDirExistsByVolume,
  matchChapter,
  outputFormat = "chapters",
  mergedExistsByVolume = new Map(),
}) {
  const volumes = [];
  const summary = {
    volumesAnalyzed: 0,
    missing: 0,
    orphan: 0,
    gaps: 0,
    newVolumes: 0,
    hasErrors: false,
    ok: true,
  };

  for (const [volumeKey, siteChapters] of chaptersByVolume) {
    const localPdfFiles = localFilesByVolume.get(volumeKey) ?? [];
    const volumeDirExists = volumeDirExistsByVolume.get(volumeKey) ?? false;

    const result = reviewVolume({
      volumeKey,
      siteChapters,
      localPdfFiles,
      volumeDirExists,
      matchChapter,
      outputFormat,
      mergedExists: mergedExistsByVolume.get(volumeKey) ?? false,
    });

    volumes.push(result);
    summary.volumesAnalyzed++;
    summary.missing += result.missing.length;
    summary.orphan += result.orphan.length;
    summary.gaps += result.gaps.length;

    if (result.newVolume) summary.newVolumes++;
    if (result.missing.length > 0 || result.emptyDir) {
      summary.hasErrors = true;
      summary.ok = false;
    }
  }

  return { volumes, summary };
}

export function printReviewReport({ volumes, summary }, logger, { verbose = false, quiet = false } = {}) {
  const say = (level, ...args) => {
    if (quiet) {
      logger.error(...args);
    } else {
      logger[level](...args);
    }
  };

  for (const vol of volumes) {
    const hasIssues =
      vol.missing.length > 0 ||
      vol.orphan.length > 0 ||
      vol.gaps.length > 0 ||
      vol.newVolume ||
      vol.emptyDir;

    if (!hasIssues && !verbose) continue;

    say("info", `\nVolume ${vol.volumeKey}`);
    say(
      "info",
      `   Site: ${vol.siteCount} capítulo(s) | Local: ${vol.localCount} PDF(s)`
    );

    if (vol.newVolume) {
      say("warn", `   Pasta local inexistente (Vol ${vol.volumeKey})`);
    }

    if (vol.emptyDir) {
      say("error", `   Pasta existe mas não há PDFs`);
    }

    if (vol.missing.length > 0) {
      say("error", `   Faltando: ${vol.missing.join(", ")}`);
    }

    if (vol.orphan.length > 0) {
      say("warn", `   Órfãos: ${vol.orphan.join(", ")}`);
    }

    if (vol.gaps.length > 0) {
      say("warn", `   Lacunas numéricas no site: ${vol.gaps.join(", ")}`);
    }

    if (verbose && vol.present.length > 0) {
      logger.verbose(`   Presentes: ${vol.present.join(", ")}`);
    }

    if (vol.mergedExists) {
      say("info", `   PDF único: presente`);
    }

    if (!hasIssues) {
      say("info", `   Completo`);
    }
  }

  say("info", "\nReview");
  say("info", `   Volumes analisados: ${summary.volumesAnalyzed}`);
  say("info", `   Capítulos faltando: ${summary.missing}`);
  say("info", `   PDFs órfãos: ${summary.orphan}`);
  say("info", `   Lacunas numéricas: ${summary.gaps}`);
  say("info", `   Volumes novos (sem pasta): ${summary.newVolumes}`);
  say("info", `   Status: ${summary.ok ? "OK" : "INCOMPLETO"}`);
}
