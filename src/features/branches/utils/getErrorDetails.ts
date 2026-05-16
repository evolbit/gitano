export function getErrorDetails(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Unknown error");
}
