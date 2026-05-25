const DEBUG_PAYLOAD_MARKER = "Report this debug payload:";
const EXTERNAL_RUNTIME_PREFIX =
  "External agent failed before returning a structured result:";
const EXTERNAL_MISSING_RESULT_PREFIX =
  "External agent completed without returning a structured result.";

export function summarizeAiErrorForDisplay(error: string | null | undefined) {
  const trimmed = error?.trim();
  if (!trimmed) return "";

  const fullDetailsAvailable =
    trimmed.includes(DEBUG_PAYLOAD_MARKER) ||
    trimmed.includes("external_agent_structured_output_error") ||
    trimmed.includes("external_agent_runtime_error") ||
    trimmed.includes("external_agent_missing_structured_result_error");

  let summary = trimmed;
  if (summary.startsWith(EXTERNAL_RUNTIME_PREFIX)) {
    summary = summary.slice(EXTERNAL_RUNTIME_PREFIX.length).trim();
  }
  if (summary.startsWith(EXTERNAL_MISSING_RESULT_PREFIX)) {
    summary = EXTERNAL_MISSING_RESULT_PREFIX;
  }

  summary = summary.split(DEBUG_PAYLOAD_MARKER)[0]?.trim() ?? summary;
  summary = summary.split(/\n\s*\n/u)[0]?.trim() ?? summary;

  if (!summary) {
    summary = "AI action failed.";
  }

  return fullDetailsAvailable
    ? `${summary}\n\nSee log for more details.`
    : summary;
}
