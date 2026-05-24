import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffect,
} from "react";
import type {
  ExternalAiRunEvent,
  LocalAiActionKind,
  LocalAiRunProgress,
  LocalAiRunResult,
} from "@/shared/api/local-ai";

export type BranchAiAction = "analysis" | "review";

export type BranchAiState = {
  result: LocalAiRunResult | null;
  loading: boolean;
  error: string | null;
  progressRunId: string | null;
  progress: LocalAiRunProgress[];
  externalEvents: ExternalAiRunEvent[];
};

export type BranchAiSetupState = {
  actionKind: LocalAiActionKind;
  reason: string;
};

type BranchAiStateSetter = Dispatch<SetStateAction<BranchAiState>>;
type BranchAiRunEvent = Pick<
  LocalAiRunProgress | ExternalAiRunEvent,
  "actionKind" | "runId"
>;
type BranchAiRunListener<TEvent extends BranchAiRunEvent> = (
  handler: (event: TEvent) => void,
) => Promise<() => void> | (() => void);

export const emptyBranchAiState = (): BranchAiState => ({
  result: null,
  loading: false,
  error: null,
  progressRunId: null,
  progress: [],
  externalEvents: [],
});

export function createBranchAiRunId(action: BranchAiAction) {
  return `branch-${action}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function branchAiActionKind(
  action: BranchAiAction,
): LocalAiActionKind {
  return action === "analysis" ? "branchAnalysis" : "branchReview";
}

function branchAiActionForKind(
  actionKind: LocalAiActionKind,
): BranchAiAction | null {
  if (actionKind === "branchAnalysis") return "analysis";
  if (actionKind === "branchReview") return "review";
  return null;
}

export function describeAiError(error: unknown) {
  return error instanceof Error ? error.message : String(error || "");
}

export function shouldOpenAiSetup(errorMessage: string) {
  const normalized = errorMessage.toLowerCase();
  return (
    errorMessage.includes("LOCAL_AI_MODEL_SETUP_REQUIRED") ||
    normalized.includes("no ai model selected") ||
    normalized.includes("no ai models available") ||
    normalized.includes("ollama runtime is unavailable") ||
    normalized.includes("ollama did not respond") ||
    normalized.includes("local ai runtime is unavailable") ||
    normalized.includes("local ai runtime could not be started")
  );
}

export function branchAiFailureTitle(
  action: BranchAiAction,
  errorMessage: string,
) {
  const actionLabel = action === "review" ? "review" : "analysis";
  return `Local AI ${actionLabel} failed: ${errorMessage}`;
}

export function branchAiSetter(
  action: BranchAiAction,
  setBranchAnalysis: BranchAiStateSetter,
  setBranchReview: BranchAiStateSetter,
) {
  return action === "analysis" ? setBranchAnalysis : setBranchReview;
}

export function useBranchAiRunEvents<TEvent extends BranchAiRunEvent>({
  activeRunIdsRef,
  listen,
  updateState,
  appendEvent,
}: {
  activeRunIdsRef: MutableRefObject<Record<BranchAiAction, string | null>>;
  listen: BranchAiRunListener<TEvent>;
  updateState: (
    action: BranchAiAction,
    updater: SetStateAction<BranchAiState>,
  ) => void;
  appendEvent: (current: BranchAiState, event: TEvent) => BranchAiState;
}) {
  useEffect(() => {
    const unlistenPromise = listen((event) => {
      const action = branchAiActionForKind(event.actionKind);
      if (!action || event.runId !== activeRunIdsRef.current[action]) {
        return;
      }

      updateState(action, (current) => appendEvent(current, event));
    });

    return () => {
      void Promise.resolve(unlistenPromise)
        .then((unlisten) => unlisten())
        .catch(() => undefined);
    };
  }, [activeRunIdsRef, appendEvent, listen, updateState]);
}
