import { describe, expect, it } from "vitest";
import { summarizeAiErrorForDisplay } from "./ai-error-summary";

describe("summarizeAiErrorForDisplay", () => {
  it("keeps provider runtime errors compact and points to the log", () => {
    expect(
      summarizeAiErrorForDisplay(
        "External agent failed before returning a structured result:\n" +
          "Error: You are not authorized to use this Copilot feature.\n\n" +
          'Report this debug payload:\n{"kind":"external_agent_runtime_error"}',
      ),
    ).toBe(
      "Error: You are not authorized to use this Copilot feature.\n\nSee log for more details.",
    );
  });

  it("summarizes parser failures without rendering the payload", () => {
    expect(
      summarizeAiErrorForDisplay(
        "External agent output could not be parsed. Report this debug payload:\n" +
          '{\n  "kind": "external_agent_structured_output_error"\n}',
      ),
    ).toBe(
      "External agent output could not be parsed.\n\nSee log for more details.",
    );
  });

  it("summarizes missing final result failures without rendering progress text", () => {
    expect(
      summarizeAiErrorForDisplay(
        "External agent completed without returning a structured result.\n\n" +
          "Report this debug payload:\n" +
          '{\n  "kind": "external_agent_missing_structured_result_error",\n  "transcript": "Running git show..."\n}',
      ),
    ).toBe(
      "External agent completed without returning a structured result.\n\nSee log for more details.",
    );
  });

  it("leaves short errors unchanged", () => {
    expect(summarizeAiErrorForDisplay("No AI model selected")).toBe(
      "No AI model selected",
    );
  });
});
