import { describe, expect, it } from "vitest";
import type { LocalAiModelEntry, LocalAiPreferences } from "@/shared/api/local-ai";
import {
  engineFromValue,
  engineValue,
  formatGigabytes,
  formatWarmMemoryDetails,
  promptDraftsFromPreferences,
  warmDisabledReason,
  warmModelIdsWithToggle,
} from "./utils";

const model: LocalAiModelEntry = {
  id: "qwen",
  displayName: "Qwen",
  provider: "Ollama",
  qualityTier: "fast",
  downloadSizeGb: 1,
  contextWindow: 4096,
  actionSuitability: ["commitMessage"],
  warmMemoryEstimateGb: 2.5,
  warmMemoryClass: "small",
  minRequirements: {
    minMemoryGb: 4,
    recommendedMemoryGb: 8,
    minDiskFreeGb: 2,
    recommendedDiskFreeGb: 4,
  },
  recommendedRequirements: {
    minMemoryGb: 8,
    recommendedMemoryGb: 8,
    minDiskFreeGb: 2,
    recommendedDiskFreeGb: 4,
  },
};

describe("settings window utilities", () => {
  it("formats memory and warm metadata for model descriptions", () => {
    expect(formatGigabytes(2)).toBe("2GB");
    expect(formatGigabytes(2.5)).toBe("2.5GB");
    expect(formatWarmMemoryDetails(model)).toBe("Small warm, about 2.5GB");
  });

  it("round-trips analysis engine select values", () => {
    expect(engineFromValue("local:qwen")).toEqual({
      type: "local_model",
      modelId: "qwen",
    });
    expect(engineFromValue("external:codex")).toEqual({
      type: "external_agent",
      agentId: "codex",
    });
    expect(engineValue({ type: "external_agent", agentId: "codex" })).toBe(
      "external:codex",
    );
  });

  it("updates warm model id selections without duplicates", () => {
    expect(warmModelIdsWithToggle(["qwen"], "qwen", true)).toEqual(["qwen"]);
    expect(warmModelIdsWithToggle(["qwen"], "mistral", true)).toEqual([
      "qwen",
      "mistral",
    ]);
    expect(warmModelIdsWithToggle(["qwen", "mistral"], "qwen", false)).toEqual([
      "mistral",
    ]);
  });

  it("builds prompt drafts from overrides and explains disabled warmup", () => {
    const preferences = {
      globalModelId: "",
      actionModelIds: {},
      actionPromptOverrides: {
        commitMessage: "Custom commit prompt",
      },
    } as unknown as LocalAiPreferences;

    expect(promptDraftsFromPreferences(preferences).commitMessage).toBe(
      "Custom commit prompt",
    );
    expect(
      warmDisabledReason({
        externalEngineSelected: true,
        warmMetadataAvailable: true,
        modelReady: true,
      }),
    ).toBe("Warmup is unavailable while an external agent is selected.");
  });
});
