export function isAiSetupRequiredError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return isAiSetupRequiredMessage(message);
}

export function isAiSetupRequiredMessage(message: string) {
  const normalized = message.toLowerCase();

  return (
    message.includes("LOCAL_AI_MODEL_SETUP_REQUIRED") ||
    message.includes("EXTERNAL_AI_AGENT_SETUP_REQUIRED") ||
    normalized.includes("no ai model selected") ||
    normalized.includes("no ai models available") ||
    normalized.includes("ollama is not running") ||
    normalized.includes("ollama runtime is unavailable") ||
    normalized.includes("ollama did not respond") ||
    normalized.includes("local ai runtime is unavailable") ||
    normalized.includes("local ai runtime could not be started")
  );
}
