import type {
  ExternalAiRunEvent,
  LocalAiRunProgress,
} from "@/shared/api/local-ai";

export type LocalAiRunEventsState = {
  progressRunId: string | null;
  progress: LocalAiRunProgress[];
  externalEvents: ExternalAiRunEvent[];
};

export function appendLocalAiRunProgress<State extends LocalAiRunEventsState>(
  current: State,
  progress: LocalAiRunProgress,
): State {
  if (current.progressRunId !== progress.runId) {
    return current;
  }

  const previous = current.progress[current.progress.length - 1];
  if (
    previous?.state === progress.state &&
    previous.message === progress.message &&
    previous.error === progress.error
  ) {
    return current;
  }

  return {
    ...current,
    progress: [...current.progress, progress],
  };
}

export function appendExternalAiRunEvent<State extends LocalAiRunEventsState>(
  current: State,
  event: ExternalAiRunEvent,
): State {
  if (current.progressRunId !== event.runId) {
    return current;
  }

  const previous = current.externalEvents[current.externalEvents.length - 1];
  if (previous?.kind === event.kind && previous.message === event.message) {
    return current;
  }

  return {
    ...current,
    externalEvents: [...current.externalEvents, event],
  };
}
