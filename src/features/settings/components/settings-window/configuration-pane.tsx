import type { Dispatch, SetStateAction } from "react";
import { IconCheck } from "@/shared/components/icons/icons";
import type {
  ExternalAiAgentEntry,
  ExternalAiAgentSessionConfig,
  LocalAiActionKind,
  LocalAiModelEntry,
  LocalAiModelStatus,
  LocalAiPreferences,
} from "@/shared/api/local-ai";
import { ACTION_MODEL_REQUIRED_MESSAGE } from "../../constants";
import { ACTIONS } from "./config";
import {
  EngineOptionGroups,
  ExternalAgentConfigControls,
  type EnginePreferenceHandler,
  type ExternalConfigPreferenceHandler,
  type MaybePromise,
  PromptOverrideRow,
  SectionLabel,
  SelectControl,
  SettingsRow,
  ValuePill,
  WarmModelCheckbox,
} from "./settings-controls";
import {
  engineValue,
  hasExternalEngine,
  hasWarmMetadata,
  preferenceActionEngine,
  preferenceGlobalEngine,
  statusLabel,
  warmDisabledReason,
} from "./utils";

export function ConfigurationPane({
  catalog,
  externalAgents,
  externalConfigByAgentId,
  externalConfigErrorsByAgentId,
  externalConfigLoadingByAgentId,
  modelStatuses,
  onSetActionPromptOverride,
  onSetEnginePreference,
  onSetExternalConfigPreference,
  onWarmToggle,
  preferences,
  promptDrafts,
  promptSavingActionKinds,
  setPromptDrafts,
  setupInProgress,
  warmModelIds,
  warmSavingModelIds,
}: {
  catalog: LocalAiModelEntry[];
  externalAgents: ExternalAiAgentEntry[];
  externalConfigByAgentId: Record<
    string,
    ExternalAiAgentSessionConfig | null | undefined
  >;
  externalConfigErrorsByAgentId: Record<string, string | null | undefined>;
  externalConfigLoadingByAgentId: Record<string, boolean | undefined>;
  modelStatuses: Record<string, LocalAiModelStatus | null>;
  onSetActionPromptOverride: (
    actionKind: LocalAiActionKind,
    prompt: string | null,
  ) => MaybePromise;
  onSetEnginePreference: EnginePreferenceHandler;
  onSetExternalConfigPreference: ExternalConfigPreferenceHandler;
  onWarmToggle: (modelId: string, warm: boolean) => void;
  preferences: LocalAiPreferences | null;
  promptDrafts: Record<string, string>;
  promptSavingActionKinds: Record<string, boolean>;
  setPromptDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setupInProgress: boolean;
  warmModelIds: string[];
  warmSavingModelIds: Record<string, boolean>;
}) {
  const modelById = new Map(catalog.map((model) => [model.id, model]));
  const externalAgentById = new Map(
    externalAgents.map((agent) => [agent.id, agent]),
  );
  const globalEngine = preferenceGlobalEngine(preferences);
  const externalEngineSelected = hasExternalEngine(preferences);

  return (
    <>
      <SectionLabel>Engine Selection</SectionLabel>

      <SettingsRow
        title="Global Default"
        description="Default analysis engine used when an action-specific engine is not configured."
      >
        <div className="flex w-full flex-col items-end gap-2">
          <SelectControl
            label="Global default analysis engine"
            value={engineValue(globalEngine)}
            disabled={
              !preferences ||
              (catalog.length === 0 && externalAgents.length === 0)
            }
            onChange={(value) => {
              void onSetEnginePreference(value, null);
            }}
          >
            {engineValue(globalEngine) ? null : <option value="">---</option>}
            <EngineOptionGroups
              catalog={catalog}
              externalAgents={externalAgents}
            />
          </SelectControl>
          {globalEngine?.type === "external_agent" ? (
            <ExternalAgentConfigControls
              agentId={globalEngine.agentId}
              scopeLabel="Global default"
              actionKind={null}
              preferences={preferences}
              config={externalConfigByAgentId[globalEngine.agentId]}
              loading={externalConfigLoadingByAgentId[globalEngine.agentId]}
              error={externalConfigErrorsByAgentId[globalEngine.agentId]}
              onChange={onSetExternalConfigPreference}
            />
          ) : null}
        </div>
      </SettingsRow>

      <SectionLabel>Actions</SectionLabel>

      {ACTIONS.map((action) => {
        const selectedEngine = preferenceActionEngine(preferences, action.kind);
        const selectedModelId =
          selectedEngine?.type === "local_model"
            ? selectedEngine.modelId ?? ""
            : "";
        const selectedExternalAgent =
          selectedEngine?.type === "external_agent"
            ? externalAgentById.get(selectedEngine.agentId)
            : null;
        const selectedModelStatus = selectedModelId
          ? modelStatuses[selectedModelId]
          : null;
        const selectedModel = selectedModelId
          ? modelById.get(selectedModelId)
          : null;
        const warmMetadataAvailable = hasWarmMetadata(selectedModel);
        const selectedMissing =
          !selectedEngine ||
          (selectedEngine.type === "local_model" &&
            (!selectedModelId || selectedModelStatus?.ready === false)) ||
          (selectedEngine.type === "external_agent" &&
            !selectedExternalAgent?.status.available);
        return (
          <SettingsRow
            key={action.kind}
            title={action.label}
            description={action.description}
            warning={selectedMissing ? ACTION_MODEL_REQUIRED_MESSAGE : null}
          >
            <div className="flex w-full flex-col items-end gap-2">
              {selectedModelStatus?.ready ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-lime-300">
                  <IconCheck size={14} />
                  Ready
                </span>
              ) : null}
              <SelectControl
                label={`${action.label} analysis engine`}
                value={engineValue(selectedEngine)}
                disabled={
                  !preferences ||
                  (catalog.length === 0 && externalAgents.length === 0)
                }
                onChange={(value) => {
                  void onSetEnginePreference(value, action.kind);
                }}
              >
                <option value="">---</option>
                <EngineOptionGroups
                  catalog={catalog}
                  externalAgents={externalAgents}
                />
              </SelectControl>
              {selectedExternalAgent ? (
                <ValuePill>{statusLabel(selectedExternalAgent)}</ValuePill>
              ) : null}
              {selectedEngine?.type === "external_agent" ? (
                <ExternalAgentConfigControls
                  agentId={selectedEngine.agentId}
                  scopeLabel={action.label}
                  actionKind={action.kind}
                  preferences={preferences}
                  config={externalConfigByAgentId[selectedEngine.agentId]}
                  loading={
                    externalConfigLoadingByAgentId[selectedEngine.agentId]
                  }
                  error={externalConfigErrorsByAgentId[selectedEngine.agentId]}
                  onChange={onSetExternalConfigPreference}
                />
              ) : null}
              {selectedModel && !externalEngineSelected ? (
                <WarmModelCheckbox
                  checked={warmModelIds.includes(selectedModel.id)}
                  disabled={
                    !warmMetadataAvailable ||
                    !selectedModelStatus?.ready ||
                    setupInProgress ||
                    Boolean(warmSavingModelIds[selectedModel.id])
                  }
                  reason={warmDisabledReason({
                    externalEngineSelected: false,
                    warmMetadataAvailable,
                    modelReady: Boolean(selectedModelStatus?.ready),
                  })}
                  onChange={(checked) => {
                    onWarmToggle(selectedModel.id, checked);
                  }}
                />
              ) : null}
            </div>
          </SettingsRow>
        );
      })}

      <SectionLabel>Prompts</SectionLabel>

      {ACTIONS.map((action) => {
        const defaultPrompt =
          preferences?.defaultActionPrompts?.[action.kind] ?? "";
        const persistedOverride =
          preferences?.actionPromptOverrides?.[action.kind] ?? null;
        const hasOverride = Boolean(persistedOverride?.trim());
        const value =
          promptDrafts[action.kind] ?? persistedOverride ?? defaultPrompt;
        const normalizedValue = value.trim();
        const normalizedDefault = defaultPrompt.trim();
        const normalizedSaved = (persistedOverride ?? defaultPrompt).trim();
        const saving = Boolean(promptSavingActionKinds[action.kind]);
        const isDefaultValue = normalizedValue === normalizedDefault;
        const isSavedValue = normalizedValue === normalizedSaved;

        return (
          <PromptOverrideRow
            key={action.kind}
            action={action}
            value={value}
            hasOverride={hasOverride}
            canSave={
              !saving &&
              normalizedValue.length > 0 &&
              !isSavedValue &&
              !isDefaultValue
            }
            canUseDefault={!saving && (hasOverride || !isDefaultValue)}
            onChange={(value) => {
              setPromptDrafts((current) => ({
                ...current,
                [action.kind]: value,
              }));
            }}
            onSave={() => {
              void onSetActionPromptOverride(
                action.kind,
                promptDrafts[action.kind] ??
                  preferences?.actionPromptOverrides?.[action.kind] ??
                  defaultPrompt,
              );
            }}
            onUseDefault={() => {
              setPromptDrafts((current) => ({
                ...current,
                [action.kind]: defaultPrompt,
              }));
              void onSetActionPromptOverride(action.kind, null);
            }}
          />
        );
      })}
    </>
  );
}
