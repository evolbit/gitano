import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  GIT_CONFLICT_AI_CANDIDATE_KIND,
  GIT_CONFLICT_AI_SCOPE_KIND,
} from "@/shared/types/git-conflicts";
import { ConflictAiPanel } from "./conflict-ai-panel";

describe("ConflictAiPanel", () => {
  it("runs region and file AI actions when no candidate is present", () => {
    const onRunRegion = vi.fn();
    const onRunFile = vi.fn();

    render(
      <ConflictAiPanel
        candidate={null}
        candidateSummary={null}
        loading={false}
        error={null}
        canRunRegion
        canRunFile
        onRunRegion={onRunRegion}
        onRunFile={onRunFile}
        onRefreshRegion={vi.fn()}
        onRefreshFile={vi.fn()}
        onApply={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Region" }));
    fireEvent.click(screen.getByRole("button", { name: "File" }));

    expect(onRunRegion).toHaveBeenCalled();
    expect(onRunFile).toHaveBeenCalled();
  });

  it("renders a reviewable candidate with apply and dismiss actions", () => {
    const onApply = vi.fn();
    const onClear = vi.fn();

    render(
      <ConflictAiPanel
        candidate={{
          kind: GIT_CONFLICT_AI_CANDIDATE_KIND.RegionReplacement,
          scope: {
            kind: GIT_CONFLICT_AI_SCOPE_KIND.Region,
            filePath: "src/conflict.ts",
            regionId: "conflict-1",
          },
          summary: "Use the validated path",
          replacement: "resolved",
          inputSignatures: {
            indexSignature: "index",
            resultSignature: "result",
          },
        }}
        candidateSummary="Use the validated path"
        loading={false}
        error={null}
        canRunRegion
        canRunFile
        onRunRegion={vi.fn()}
        onRunFile={vi.fn()}
        onRefreshRegion={vi.fn()}
        onRefreshFile={vi.fn()}
        onApply={onApply}
        onClear={onClear}
      />,
    );

    expect(screen.getByText("Use the validated path")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss AI candidate" }));

    expect(onApply).toHaveBeenCalled();
    expect(onClear).toHaveBeenCalled();
  });
});
