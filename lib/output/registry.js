/** @typedef {{ id: string, label: string, description?: string, default?: boolean }} OutputFormatDef */

/**
 * @param {import('../../plugins/types.js').SourcePlugin} plugin
 * @returns {OutputFormatDef[]}
 */
export function getPluginOutputFormats(plugin) {
  if (Array.isArray(plugin.outputFormats) && plugin.outputFormats.length > 0) {
    return plugin.outputFormats;
  }

  return [
    {
      id: "chapters",
      label: "Capítulos separados",
      description: "Um PDF por capítulo em pastas Vol N/",
      default: true,
    },
  ];
}

/**
 * @param {import('../../plugins/types.js').SourcePlugin} plugin
 * @returns {string}
 */
export function getDefaultOutputFormat(plugin) {
  const formats = getPluginOutputFormats(plugin);
  const explicit = plugin.defaultOutputFormat;
  if (explicit && formats.some((f) => f.id === explicit)) {
    return explicit;
  }
  return formats.find((f) => f.default)?.id ?? formats[0].id;
}

/**
 * @param {import('../config.js').ValidatedConfig} config
 * @param {import('../../plugins/types.js').SourcePlugin} plugin
 * @returns {string}
 */
export function getOutputFormat(config, plugin) {
  const value = config.pluginConfig?.outputFormat;
  const formats = getPluginOutputFormats(plugin);
  if (value && formats.some((f) => f.id === value)) {
    return String(value);
  }
  return getDefaultOutputFormat(plugin);
}

/**
 * @param {string} formatId
 * @param {import('../../plugins/types.js').SourcePlugin} plugin
 */
export function validateOutputFormat(formatId, plugin) {
  const formats = getPluginOutputFormats(plugin);
  if (!formats.some((f) => f.id === formatId)) {
    const available = formats.map((f) => f.id).join(", ");
    throw new Error(`Formato "${formatId}" inválido. Disponíveis: ${available}`);
  }
}

/**
 * @param {import('../../plugins/types.js').SourcePlugin} plugin
 * @returns {import('../../plugins/types.js').SetupOption[]}
 */
export function outputFormatSetupOptions(plugin) {
  return getPluginOutputFormats(plugin).map((format) => ({
    value: format.id,
    label: format.label,
    hint: format.description,
  }));
}
