import logUpdate from "log-update";
import pc from "picocolors";
import { formatErrorBlock, groupErrors } from "../shared/errors.js";
import { barraProgresso } from "../shared/utils.js";

const STATUS_ICON = {
  queued: pc.dim("○"),
  downloading: pc.cyan("↓"),
  retrying: pc.yellow("…"),
  skipped: pc.yellow("⊘"),
  done: pc.green("✓"),
  error: pc.red("✗"),
  "dry-run": pc.blue("◇"),
};

/**
 * @param {{ useUi?: boolean }} options
 */
export function createDownloadUI({ useUi = true } = {}) {
  if (!useUi) {
    return {
      onVolumeStart() {},
      onProgress() {},
      onRetry() {},
      onVolumeComplete() {},
      dispose() {},
    };
  }

  /** @type {string|null} */
  let currentVolume = null;
  let total = 0;
  /** @type {Map<string, { status: string, message?: string, attempt?: number }>} */
  const chapters = new Map();
  let completed = 0;
  let disposed = false;

  function render() {
    if (disposed || !currentVolume) return;

    const lines = [];
    lines.push(pc.bold(`Baixando Volume ${currentVolume}`));
    lines.push("");
    lines.push(`  ${barraProgresso(completed, total)}  ${completed}/${total}`);
    lines.push("");

    const active = [...chapters.entries()].filter(([, v]) =>
      ["downloading", "queued", "retrying"].includes(v.status)
    );
    const recent = [...chapters.entries()]
      .filter(([, v]) => ["done", "skipped", "error", "dry-run"].includes(v.status))
      .slice(-3);

    for (const [capId, info] of active.slice(0, 4)) {
      const icon = STATUS_ICON[info.status] ?? "·";
      let label;

      if (info.status === "downloading") {
        label = pc.cyan(`Cap ${capId}  baixando…`);
      } else if (info.status === "retrying") {
        const attempt = info.attempt ? ` (tentativa ${info.attempt})` : "";
        label = pc.yellow(
          `Cap ${capId}  aguardando… ${info.message ?? "tentando novamente"}${attempt}`
        );
      } else {
        label = pc.dim(`Cap ${capId}  na fila`);
      }

      lines.push(`  ${icon} ${label}`);
    }

    for (const [capId, info] of recent) {
      const icon = STATUS_ICON[info.status] ?? "·";
      const prefix = info.status === "error" ? "falhou — " : "";
      const suffix = info.message ? `${prefix}${info.message}` : "";
      lines.push(
        `  ${icon} Cap ${capId}` + (suffix ? pc.red(`  ${suffix}`) : "")
      );
    }

    logUpdate(lines.join("\n"));
  }

  return {
    onVolumeStart(volume, chapterTotal) {
      currentVolume = volume;
      total = chapterTotal;
      chapters.clear();
      completed = 0;
      render();
    },

    onProgress(volume, capId, status, message) {
      const prev = chapters.get(capId);
      chapters.set(capId, {
        status,
        message,
        attempt: prev?.attempt,
      });

      if (["done", "skipped", "error", "dry-run"].includes(status)) {
        completed++;
      }

      render();
    },

    onRetry(volume, capId, { attempt, message, delaySec }) {
      chapters.set(capId, {
        status: "retrying",
        message: message ?? "site limitou acesso",
        attempt,
        delaySec,
      });
      render();
    },

    onVolumeComplete(volume, stats) {
      logUpdate.clear();
      disposed = true;
      console.log(
        pc.bold(`Volume ${volume}`) +
          pc.dim(
            `  ·  ${stats.downloaded} baixados · ${stats.skipped} pulados · ${stats.failed} falhas`
          )
      );

      if (stats.errors?.length > 0) {
        printErrorsSummary(stats.errors);
      }
    },

    dispose() {
      logUpdate.clear();
      disposed = true;
    },
  };
}

/**
 * @param {Array<{ volume: string, capId: string, status?: number, title: string, hint?: string }>} errors
 */
export function printErrorsSummary(errors) {
  if (!errors.length) return;

  const groups = groupErrors(errors);
  console.log("");
  console.log(pc.red(pc.bold(`Falhas (${errors.length})`)));

  for (const group of groups) {
    const statusLabel = group.status ? ` (${group.status})` : "";
    console.log(
      pc.yellow(`  ${group.title}${statusLabel}`) +
        pc.dim(` — ${group.items.length} capítulo(s)`)
    );

    const caps = group.items
      .map((item) => `Vol ${item.volume} Cap ${item.capId}`)
      .join(", ");
    console.log(pc.dim(`    ${caps}`));

    if (group.hint) {
      console.log(pc.dim(`    Dica: ${group.hint}`));
    }
  }
}

/**
 * @param {{ volumes: import('./reviewer.js').ReviewVolumeResult[], summary: object }} result
 */
export function printReviewUI(result) {
  const { volumes, summary } = result;

  console.log(pc.bold("\nReview"));

  for (const vol of volumes) {
    const hasIssues =
      vol.missing.length > 0 ||
      vol.orphan.length > 0 ||
      vol.gaps.length > 0 ||
      vol.newVolume ||
      vol.emptyDir;

    if (!hasIssues) {
      console.log(pc.green(`  ✓ Volume ${vol.volumeKey}`) + pc.dim(`  (${vol.localCount} PDFs)`));
      continue;
    }

    console.log(pc.yellow(`  ! Volume ${vol.volumeKey}`));
    console.log(
      pc.dim(`    Site: ${vol.siteCount} | Local: ${vol.localCount}`)
    );
    if (vol.missing.length > 0) {
      console.log(pc.red(`    Faltando: ${vol.missing.join(", ")}`));
    }
    if (vol.orphan.length > 0) {
      console.log(pc.yellow(`    Órfãos: ${vol.orphan.join(", ")}`));
    }
    if (vol.gaps.length > 0) {
      console.log(pc.yellow(`    Lacunas: ${vol.gaps.join(", ")}`));
    }
  }

  console.log("");
  console.log(
    summary.ok
      ? pc.green("  Status: OK")
      : pc.red(`  Status: INCOMPLETO (${summary.missing} faltando)`)
  );
}

/**
 * @param {object} plan
 * @param {object} stats
 * @param {{ dryRun?: boolean }} options
 */
export function printRenameUI(plan, stats, { dryRun = false } = {}) {
  console.log(pc.bold("\nRename"));
  console.log(
    pc.dim(
      `  ${stats.renamed} renomeados${dryRun ? " (dry-run)" : ""} · ${stats.skipped} já no formato · ${plan.orphans.length} órfãos`
    )
  );

  for (const err of plan.errors) {
    console.log(pc.red(`  ✗ Vol ${err.volume}: ${err.message}`));
  }
}

/**
 * @param {Error} err
 * @param {{ verbose?: boolean }} options
 */
export function printErrorBlock(err, { verbose = false } = {}) {
  const block = formatErrorBlock(err, { verbose });
  console.error(pc.red(pc.bold(block.title)));
  if (block.hint) {
    console.error(pc.dim(block.hint));
  }
  if (block.detail) {
    console.error(pc.dim(block.detail));
  }
  if (block.stack && verbose) {
    console.error(pc.dim(block.stack));
  }
}
