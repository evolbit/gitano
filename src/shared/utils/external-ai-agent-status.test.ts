import { describe, expect, it } from "vitest";
import type { ExternalAiAgentEntry } from "@/shared/api/local-ai";
import {
  externalAiAgentAuthenticationUnverified,
  externalAiAgentStatusLabel,
} from "./external-ai-agent-status";

function agentWithStatus(
  status: Partial<ExternalAiAgentEntry["status"]>,
): ExternalAiAgentEntry {
  return {
    id: "github-copilot-cli",
    displayName: "GitHub Copilot",
    provider: "GitHub",
    description: "GitHub's official coding agent CLI",
    version: "1.0.51",
    repository: null,
    license: "proprietary",
    installSource: null,
    status: {
      agentId: "github-copilot-cli",
      installed: true,
      authenticated: false,
      available: true,
      state: "ready",
      version: "1.0.51",
      authMethods: [
        {
          id: "github_copilot_cli",
          displayName: "GitHub Copilot account",
        },
      ],
      error: null,
      ...status,
    },
  };
}

describe("external AI agent status labels", () => {
  it("does not label an installed adapter as ready when auth is unverified", () => {
    expect(externalAiAgentStatusLabel(agentWithStatus({}))).toBe("Installed");
  });

  it("labels authenticated or auth-free available agents as ready", () => {
    expect(
      externalAiAgentStatusLabel(agentWithStatus({ authenticated: true })),
    ).toBe("Ready");
    expect(externalAiAgentStatusLabel(agentWithStatus({ authMethods: [] }))).toBe(
      "Ready",
    );
  });

  it("tracks when auth exists but is not verified", () => {
    expect(externalAiAgentAuthenticationUnverified(agentWithStatus({}))).toBe(
      true,
    );
    expect(
      externalAiAgentAuthenticationUnverified(
        agentWithStatus({ authenticated: true }),
      ),
    ).toBe(false);
    expect(
      externalAiAgentAuthenticationUnverified(agentWithStatus({ authMethods: [] })),
    ).toBe(false);
  });
});
