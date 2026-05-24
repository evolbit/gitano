import { describe, expect, it } from "vitest";
import { shouldOpenCommitAiSetup } from "./use-commit-ai-analysis";

describe("shouldOpenCommitAiSetup", () => {
  it("detects setup-related local AI failures", () => {
    expect(
      shouldOpenCommitAiSetup(new Error("LOCAL_AI_MODEL_SETUP_REQUIRED")),
    ).toBe(true);
    expect(shouldOpenCommitAiSetup(new Error("Ollama is not running"))).toBe(
      true,
    );
    expect(shouldOpenCommitAiSetup(new Error("network failed"))).toBe(false);
  });
});
