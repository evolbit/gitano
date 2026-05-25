import type { ExternalAiAgentEntry } from "@/shared/api/local-ai";

function hasAuthenticationMethods(agent: ExternalAiAgentEntry) {
  return (agent.status.authMethods?.length ?? 0) > 0;
}

export function externalAiAgentAuthenticationUnverified(
  agent: ExternalAiAgentEntry,
) {
  return !agent.status.authenticated && hasAuthenticationMethods(agent);
}

export function externalAiAgentStatusLabel(agent: ExternalAiAgentEntry) {
  if (agent.status.available) {
    if (!externalAiAgentAuthenticationUnverified(agent)) {
      return "Ready";
    }

    return "Installed";
  }

  switch (agent.status.state) {
    case "notInstalled":
      return "Not installed";
    case "unsupportedPlatform":
      return "Unsupported";
    case "unavailable":
      return "Unavailable";
    case "failed":
      return "Failed";
    default:
      return "Unknown";
  }
}
