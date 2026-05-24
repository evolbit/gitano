import { listenToEvent } from "@/shared/platform/tauri/events";
import {
  EXTERNAL_AI_AGENT_PROGRESS_EVENT,
  EXTERNAL_AI_RUN_EVENT,
  LOCAL_AI_PROGRESS_EVENT,
  LOCAL_AI_RUN_PROGRESS_EVENT,
  type ExternalAiAgentProgress,
  type ExternalAiRunEvent,
  type LocalAiDownloadProgress,
  type LocalAiRunProgress,
} from "./types";

export function listenToLocalAiProgress(
  handler: (progress: LocalAiDownloadProgress) => void,
) {
  return listenToEvent<LocalAiDownloadProgress>(
    LOCAL_AI_PROGRESS_EVENT,
    (event) => handler(event.payload),
  );
}

export function listenToLocalAiRunProgress(
  handler: (progress: LocalAiRunProgress) => void,
) {
  return listenToEvent<LocalAiRunProgress>(
    LOCAL_AI_RUN_PROGRESS_EVENT,
    (event) => handler(event.payload),
  );
}

export function listenToExternalAiAgentProgress(
  handler: (progress: ExternalAiAgentProgress) => void,
) {
  return listenToEvent<ExternalAiAgentProgress>(
    EXTERNAL_AI_AGENT_PROGRESS_EVENT,
    (event) => handler(event.payload),
  );
}

export function listenToExternalAiRunEvents(
  handler: (event: ExternalAiRunEvent) => void,
) {
  return listenToEvent<ExternalAiRunEvent>(
    EXTERNAL_AI_RUN_EVENT,
    (event) => handler(event.payload),
  );
}
