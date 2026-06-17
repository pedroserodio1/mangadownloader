/**
 * @param {unknown} result
 * @param {{ isError?: boolean }} [options]
 */
export function formatToolResult(result, { isError = false } = {}) {
  const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
  return {
    content: [{ type: "text", text }],
    isError,
  };
}

/**
 * @param {Error|string} error
 */
export function formatToolError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return formatToolResult({ success: false, error: message }, { isError: true });
}

/**
 * @param {object} payload
 * @param {{ level: string, text: string }[]} [logs]
 */
export function formatPayloadWithLogs(payload, logs = []) {
  return formatToolResult({
    ...payload,
    logs: logs.map((line) => `[${line.level}] ${line.text}`),
  });
}
