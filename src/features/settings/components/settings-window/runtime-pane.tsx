import { IconCloudDownload } from "@/shared/components/icons/icons";
import type {
  LocalAiEntitlementStatus,
  LocalAiRuntimeSetupStatus,
} from "@/shared/api/local-ai";
import {
  ActionButton,
  type MaybePromise,
  SectionLabel,
  SettingsRow,
  ValuePill,
} from "./settings-controls";
import { runtimeStatusLabel } from "./utils";

export function RuntimePane({
  entitlement,
  onPrepareRuntime,
  runtimeStatus,
  setupInProgress,
}: {
  entitlement: LocalAiEntitlementStatus | null;
  onPrepareRuntime: (forceReinstall: boolean) => MaybePromise;
  runtimeStatus: LocalAiRuntimeSetupStatus | null;
  setupInProgress: boolean;
}) {
  const runtimeActionLabel = runtimeStatus?.installed
    ? "Upgrade runtime"
    : "Download runtime";

  return (
    <>
      <SectionLabel>Local Runtime</SectionLabel>

      <SettingsRow
        title="Runtime Status"
        description="Whether Gitano can reach the local AI runtime used for model downloads and inference."
      >
        <ValuePill>{runtimeStatusLabel(runtimeStatus)}</ValuePill>
      </SettingsRow>

      {runtimeStatus?.managed === false ? (
        <div className="rounded border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs leading-5 text-blue-100">
          Runtime is controlled by OLLAMA_HOST. Manage upgrades outside Gitano.
        </div>
      ) : null}

      {runtimeStatus?.runtime.error ? (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
          {runtimeStatus.runtime.error}
        </div>
      ) : null}

      <SettingsRow
        title="Runtime Endpoint"
        description="Local endpoint used by Gitano when talking to the managed or externally configured runtime."
      >
        <ValuePill>{runtimeStatus?.runtime.endpoint ?? "Unknown"}</ValuePill>
      </SettingsRow>

      <SettingsRow
        title="Installed Version"
        description="Version reported by the managed local AI runtime currently installed on this machine."
      >
        <ValuePill>
          {runtimeStatus?.installedVersion ??
            (runtimeStatus?.installed ? "Installed" : "None")}
        </ValuePill>
      </SettingsRow>

      <SettingsRow
        title="Runtime Updates"
        description={`Download or upgrade to ${
          runtimeStatus?.latestCompatibleVersion ??
          "the latest compatible runtime"
        }.`}
      >
        <ActionButton
          disabled={
            setupInProgress ||
            !runtimeStatus?.canInstall ||
            entitlement?.entitled === false
          }
          onClick={() => {
            void onPrepareRuntime(Boolean(runtimeStatus?.installed));
          }}
        >
          <IconCloudDownload size={16} />
          {runtimeActionLabel}
        </ActionButton>
      </SettingsRow>

      <SettingsRow
        title="Model Storage"
        description="Directory where Gitano stores model weights when it owns the local runtime."
      >
        <ValuePill>{runtimeStatus?.modelStoragePath ?? "Unknown"}</ValuePill>
      </SettingsRow>
    </>
  );
}
