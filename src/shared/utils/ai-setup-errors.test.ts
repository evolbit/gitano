import { describe, expect, it } from "vitest";
import {
  isAiSetupRequiredError,
  isAiSetupRequiredMessage,
} from "./ai-setup-errors";

describe("AI setup error detection", () => {
  it("detects setup and runtime readiness errors", () => {
    expect(isAiSetupRequiredMessage("LOCAL_AI_MODEL_SETUP_REQUIRED")).toBe(true);
    expect(isAiSetupRequiredMessage("EXTERNAL_AI_AGENT_SETUP_REQUIRED")).toBe(true);
    expect(isAiSetupRequiredMessage("No AI model selected for Commit")).toBe(true);
    expect(isAiSetupRequiredMessage("Ollama is not running")).toBe(true);
    expect(
      isAiSetupRequiredMessage("Local AI runtime could not be started"),
    ).toBe(true);
  });

  it("does not treat model output or external-agent parse errors as setup errors", () => {
    expect(
      isAiSetupRequiredError(
        new Error("Local AI returned invalid JSON: expected value"),
      ),
    ).toBe(false);
    expect(
      isAiSetupRequiredMessage(
        "External agent output could not be parsed. Report this debug payload:\n" +
          '{\n  "kind": "external_agent_structured_output_error",\n  "parseError": "Local AI returned invalid JSON"\n}',
      ),
    ).toBe(false);
  });
});
