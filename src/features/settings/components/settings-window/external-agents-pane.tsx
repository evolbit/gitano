import {
  IconCheck,
  IconCloudDownload,
  IconX,
} from "@/shared/components/icons/icons";
import type {
  ExternalAiAgentEntry,
  LocalAiEntitlementStatus,
  LocalAiPreferences,
} from "@/shared/api/local-ai";
import { externalAiAgentAuthenticationUnverified } from "@/shared/utils/external-ai-agent-status";
import {
  ActionButton,
  type MaybePromise,
  SectionLabel,
  SettingsRow,
  ValuePill,
} from "./settings-controls";
import {
  externalAgentDescription,
  preferenceGlobalEngine,
  statusLabel,
} from "./utils";

export function ExternalAgentsPane({
  entitlement,
  externalAgents,
  onInstallExternalAgent,
  onAuthenticateExternalAgent,
  onRemoveExternalAgent,
  onSetExternalAgentDefault,
  preferences,
  setupInProgress,
}: {
  entitlement: LocalAiEntitlementStatus | null;
  externalAgents: ExternalAiAgentEntry[];
  onInstallExternalAgent: (agentId: string) => MaybePromise;
  onAuthenticateExternalAgent: (agentId: string) => MaybePromise;
  onRemoveExternalAgent: (agentId: string) => MaybePromise;
  onSetExternalAgentDefault: (agentId: string) => MaybePromise;
  preferences: LocalAiPreferences | null;
  setupInProgress: boolean;
}) {
  const globalEngine = preferenceGlobalEngine(preferences);

  return (
    <>
      <SectionLabel>Curated Agents</SectionLabel>
      {externalAgents.map((agent) => {
        const selected =
          globalEngine?.type === "external_agent" &&
          globalEngine.agentId === agent.id;
        const setDefaultDisabled =
          selected ||
          !agent.status.available ||
          entitlement?.entitled === false;
        const showAuthRefresh =
          agent.status.installed &&
          externalAiAgentAuthenticationUnverified(agent);

        return (
          <SettingsRow
            key={agent.id}
            title={agent.displayName}
            description={externalAgentDescription(agent)}
            warning={agent.status.error}
          >
            <div className="flex w-full flex-col items-end gap-2">
              <ValuePill>{selected ? "Selected" : statusLabel(agent)}</ValuePill>
              <div className="flex flex-wrap justify-end gap-2">
                {agent.status.installed ? (
                  <>
                    {showAuthRefresh ? (
                      <ActionButton
                        disabled={entitlement?.entitled === false}
                        onClick={() => {
                          void onAuthenticateExternalAgent(agent.id);
                        }}
                      >
                        <IconCheck size={16} />
                        Refresh status
                      </ActionButton>
                    ) : null}
                    <ActionButton
                      disabled={setupInProgress}
                      onClick={() => {
                        void onRemoveExternalAgent(agent.id);
                      }}
                    >
                      <IconX size={16} />
                      Remove
                    </ActionButton>
                  </>
                ) : (
                  <ActionButton
                    disabled={
                      setupInProgress ||
                      entitlement?.entitled === false ||
                      !agent.installSource
                    }
                    onClick={() => {
                      void onInstallExternalAgent(agent.id);
                    }}
                  >
                    <IconCloudDownload size={16} />
                    Install
                  </ActionButton>
                )}
                <ActionButton
                  disabled={setDefaultDisabled}
                  onClick={() => {
                    void onSetExternalAgentDefault(agent.id);
                  }}
                >
                  <IconCheck size={16} />
                  Set default
                </ActionButton>
              </div>
            </div>
          </SettingsRow>
        );
      })}
    </>
  );
}
