import {
  IconCheck,
  IconCloudDownload,
} from "@/shared/components/icons/icons";
import type {
  ExternalAiAgentEntry,
  LocalAiEntitlementStatus,
  LocalAiPreferences,
} from "@/shared/api/local-ai";
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
  onAuthenticateExternalAgent,
  onInstallExternalAgent,
  onRemoveExternalAgent,
  onSetExternalAgentDefault,
  preferences,
  setupInProgress,
}: {
  entitlement: LocalAiEntitlementStatus | null;
  externalAgents: ExternalAiAgentEntry[];
  onAuthenticateExternalAgent: (agentId: string) => MaybePromise;
  onInstallExternalAgent: (agentId: string) => MaybePromise;
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
        const installDisabled =
          setupInProgress ||
          entitlement?.entitled === false ||
          !agent.installSource;
        const setDefaultDisabled =
          selected ||
          !agent.status.available ||
          entitlement?.entitled === false;

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
                {!agent.status.installed ? (
                  <ActionButton
                    disabled={installDisabled}
                    onClick={() => {
                      void onInstallExternalAgent(agent.id);
                    }}
                  >
                    <IconCloudDownload size={16} />
                    Install
                  </ActionButton>
                ) : (
                  <>
                    <ActionButton
                      disabled={entitlement?.entitled === false}
                      onClick={() => {
                        void onAuthenticateExternalAgent(agent.id);
                      }}
                    >
                      <IconCheck size={16} />
                      Authenticate
                    </ActionButton>
                    <ActionButton
                      variant="danger"
                      disabled={setupInProgress}
                      onClick={() => {
                        void onRemoveExternalAgent(agent.id);
                      }}
                    >
                      Remove
                    </ActionButton>
                  </>
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
