import * as p from "@clack/prompts";
import { cancelFlow, isCancel } from "../ui/prompts.js";
import { getOutputFormat, getPluginOutputFormats } from "./registry.js";

/**
 * @param {import('../../plugins/types.js').SourcePlugin} plugin
 * @param {import('../config.js').ValidatedConfig} config
 * @param {{ cliFormat?: string|null }} [options]
 * @returns {Promise<string>}
 */
export async function promptOutputFormatChoice(plugin, config, { cliFormat } = {}) {
  if (cliFormat) {
    return cliFormat;
  }

  const formats = getPluginOutputFormats(plugin);
  const initialValue = getOutputFormat(config, plugin);

  if (!process.stdin.isTTY) {
    return initialValue;
  }

  const selected = await p.select({
    message: "Formato de saída",
    options: formats.map((format) => ({
      value: format.id,
      label: format.description ? `${format.label} — ${format.description}` : format.label,
    })),
    initialValue,
  });

  if (isCancel(selected)) {
    cancelFlow();
    return initialValue;
  }

  return selected;
}
