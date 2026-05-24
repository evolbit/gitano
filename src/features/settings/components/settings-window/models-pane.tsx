import { IconCloudDownload } from "@/shared/components/icons/icons";
import type {
  LocalAiEntitlementStatus,
  LocalAiModelEntry,
  LocalAiModelStatus,
} from "@/shared/api/local-ai";
import {
  ActionButton,
  type MaybePromise,
  SectionLabel,
  SettingsRow,
  ValuePill,
  WarmModelCheckbox,
} from "./settings-controls";
import {
  getModelStatusLabel,
  hasWarmMetadata,
  modelDescription,
  warmDisabledReason,
} from "./utils";

export function ModelsPane({
  catalog,
  entitlement,
  externalEngineSelected,
  modelStatuses,
  modelUsageById,
  onDeleteModel,
  onPrepareModel,
  onWarmToggle,
  setupInProgress,
  warmModelIds,
  warmSavingModelIds,
}: {
  catalog: LocalAiModelEntry[];
  entitlement: LocalAiEntitlementStatus | null;
  externalEngineSelected: boolean;
  modelStatuses: Record<string, LocalAiModelStatus | null>;
  modelUsageById: Record<string, string[]>;
  onDeleteModel: (modelId: string) => MaybePromise;
  onPrepareModel: (modelId: string) => MaybePromise;
  onWarmToggle: (modelId: string, warm: boolean) => void;
  setupInProgress: boolean;
  warmModelIds: string[];
  warmSavingModelIds: Record<string, boolean>;
}) {
  return (
    <>
      <SectionLabel>Available Local Models</SectionLabel>
      {catalog.map((model) => {
        const status = modelStatuses[model.id];
        const usage = modelUsageById[model.id] ?? [];
        const warmMetadataAvailable = hasWarmMetadata(model);
        const warmChecked = warmModelIds.includes(model.id);
        const warmDisabled =
          externalEngineSelected ||
          !warmMetadataAvailable ||
          !status?.ready ||
          setupInProgress ||
          Boolean(warmSavingModelIds[model.id]);
        const warmReason = warmDisabledReason({
          externalEngineSelected,
          warmMetadataAvailable,
          modelReady: Boolean(status?.ready),
        });
        return (
          <SettingsRow
            key={model.id}
            title={model.displayName}
            description={modelDescription(model, usage)}
          >
            <div className="flex w-full flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <ValuePill>{getModelStatusLabel(status)}</ValuePill>
                {status?.ready ? (
                  <ActionButton
                    variant="danger"
                    disabled={setupInProgress}
                    onClick={() => {
                      void onDeleteModel(model.id);
                    }}
                  >
                    Delete
                  </ActionButton>
                ) : (
                  <ActionButton
                    disabled={
                      setupInProgress || entitlement?.entitled === false
                    }
                    onClick={() => {
                      void onPrepareModel(model.id);
                    }}
                  >
                    <IconCloudDownload size={16} />
                    Download
                  </ActionButton>
                )}
              </div>
              <WarmModelCheckbox
                checked={warmChecked}
                disabled={warmDisabled}
                reason={warmReason}
                onChange={(checked) => {
                  onWarmToggle(model.id, checked);
                }}
              />
            </div>
          </SettingsRow>
        );
      })}
    </>
  );
}
