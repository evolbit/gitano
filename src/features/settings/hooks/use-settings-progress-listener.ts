import {
  type Dispatch,
  type SetStateAction,
  useEffect,
} from "react";
import type {
  ExternalAiAgentProgress,
  LocalAiDownloadProgress,
} from "@/shared/api/local-ai";

export type SettingsProgress =
  | LocalAiDownloadProgress
  | ExternalAiAgentProgress;

type SettingsProgressListener<TProgress extends SettingsProgress> = (
  handler: (progress: TProgress) => void,
) => Promise<() => void>;

export function useSettingsProgressListener<TProgress extends SettingsProgress>({
  open,
  listen,
  setProgressByOperationId,
  loadSettings,
}: {
  open: boolean;
  listen: SettingsProgressListener<TProgress>;
  setProgressByOperationId: Dispatch<
    SetStateAction<Record<string, TProgress>>
  >;
  loadSettings: () => Promise<void>;
}) {
  useEffect(() => {
    if (!open) return;

    let mounted = true;
    let unlisten: (() => void) | null = null;

    void listen((progress) => {
      setProgressByOperationId((current) => ({
        ...current,
        [progress.operationId]: progress,
      }));

      if (progress.state === "completed") {
        void loadSettings();
      }
    }).then((nextUnlisten) => {
      if (mounted) {
        unlisten = nextUnlisten;
      } else {
        nextUnlisten();
      }
    });

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, [listen, loadSettings, open, setProgressByOperationId]);
}
