import { create } from "zustand";
import {
  getLocalAiEntitlementStatus,
  getLocalAiModelCatalog,
  getLocalAiModelCompatibility,
  getLocalAiModelPreferences,
  getLocalAiModelStatus,
  listenToLocalAiProgress,
  prepareLocalAiModel,
  setLocalAiModelPreference,
  type LocalAiActionKind,
  type LocalAiCompatibility,
  type LocalAiDownloadProgress,
  type LocalAiEntitlementStatus,
  type LocalAiModelEntry,
  type LocalAiModelStatus,
  type LocalAiPreferences,
} from "@/shared/api/local-ai";

type SetupRequest = {
  actionKind?: LocalAiActionKind | null;
  modelId?: string | null;
  onReady?: (() => void) | null;
};

type LocalAiStore = {
  catalog: LocalAiModelEntry[];
  entitlement: LocalAiEntitlementStatus | null;
  preferences: LocalAiPreferences | null;
  modelStatus: LocalAiModelStatus | null;
  compatibility: LocalAiCompatibility | null;
  progressByOperationId: Record<string, LocalAiDownloadProgress>;
  progressTimelineByOperationId: Record<string, LocalAiDownloadProgress[]>;
  activeOperationId: string | null;
  setupOpen: boolean;
  setupRequest: SetupRequest | null;
  loading: boolean;
  error: string | null;
  openSetup: (request?: SetupRequest) => void;
  closeSetup: () => void;
  loadSetupState: (modelId?: string | null) => Promise<void>;
  setPreference: (
    modelId: string,
    actionKind?: LocalAiActionKind | null,
  ) => Promise<void>;
  prepareSelectedModel: (modelId: string, allowLimited: boolean) => Promise<void>;
  markReadyIfActive: (progress: LocalAiDownloadProgress) => void;
  resetError: () => void;
};

let progressUnlisten: Promise<() => void> | null = null;
const MAX_PROGRESS_TIMELINE_STEPS = 12;

function ensureProgressListener() {
  if (progressUnlisten) return;
  progressUnlisten = listenToLocalAiProgress((progress) => {
    useLocalAiStore.getState().markReadyIfActive(progress);
  });
}

function appendProgressTimeline(
  timelineByOperationId: Record<string, LocalAiDownloadProgress[]>,
  progress: LocalAiDownloadProgress,
) {
  const currentTimeline = timelineByOperationId[progress.operationId] ?? [];
  const previousStep = currentTimeline[currentTimeline.length - 1];
  const shouldReplacePreviousStep =
    !!previousStep &&
    previousStep.state === progress.state &&
    previousStep.status === progress.status;
  const nextTimeline = shouldReplacePreviousStep
    ? [...currentTimeline.slice(0, -1), progress]
    : [...currentTimeline, progress];

  return {
    ...timelineByOperationId,
    [progress.operationId]: nextTimeline.slice(-MAX_PROGRESS_TIMELINE_STEPS),
  };
}

export const useLocalAiStore = create<LocalAiStore>((set, get) => ({
  catalog: [],
  entitlement: null,
  preferences: null,
  modelStatus: null,
  compatibility: null,
  progressByOperationId: {},
  progressTimelineByOperationId: {},
  activeOperationId: null,
  setupOpen: false,
  setupRequest: null,
  loading: false,
  error: null,
  openSetup: (request) => {
    ensureProgressListener();
    set({
      setupOpen: true,
      setupRequest: request ?? null,
      error: null,
    });
  },
  closeSetup: () =>
    set({
      setupOpen: false,
      setupRequest: null,
      error: null,
    }),
  loadSetupState: async (modelId) => {
    ensureProgressListener();
    set({ loading: true, error: null });
    try {
      const [catalog, entitlement, preferences] = await Promise.all([
        getLocalAiModelCatalog(),
        getLocalAiEntitlementStatus(),
        getLocalAiModelPreferences(),
      ]);
      const selectedModelId = modelId ?? preferences.globalModelId;
      const [modelStatus, compatibility] = await Promise.all([
        getLocalAiModelStatus(selectedModelId),
        getLocalAiModelCompatibility(selectedModelId),
      ]);
      set({
        catalog,
        entitlement,
        preferences,
        modelStatus,
        compatibility,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      set({ loading: false });
    }
  },
  setPreference: async (modelId, actionKind) => {
    set({ loading: true, error: null });
    try {
      const preferences = await setLocalAiModelPreference({
        modelId,
        actionKind,
      });
      const [modelStatus, compatibility] = await Promise.all([
        getLocalAiModelStatus(modelId),
        getLocalAiModelCompatibility(modelId),
      ]);
      set({ preferences, modelStatus, compatibility });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      set({ loading: false });
    }
  },
  prepareSelectedModel: async (modelId, allowLimited) => {
    ensureProgressListener();
    set({ loading: true, error: null });
    try {
      const response = await prepareLocalAiModel({ modelId, allowLimited });
      const optimisticProgress: LocalAiDownloadProgress = {
        operationId: response.operationId,
        modelId,
        state: "queued",
        status: "Starting local AI setup...",
        completedBytes: null,
        totalBytes: null,
        percentage: null,
        error: null,
      };
      set((state) => ({
        activeOperationId: response.operationId,
        progressByOperationId: {
          ...state.progressByOperationId,
          [response.operationId]:
            state.progressByOperationId[response.operationId] ??
            optimisticProgress,
        },
        progressTimelineByOperationId: {
          ...state.progressTimelineByOperationId,
          [response.operationId]:
            state.progressTimelineByOperationId[response.operationId] ?? [
              optimisticProgress,
            ],
        },
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      set({ loading: false });
    }
  },
  markReadyIfActive: (progress) => {
    set((state) => ({
      progressByOperationId: {
        ...state.progressByOperationId,
        [progress.operationId]: progress,
      },
      progressTimelineByOperationId: appendProgressTimeline(
        state.progressTimelineByOperationId,
        progress,
      ),
    }));

    if (progress.state === "completed") {
      void get().loadSetupState(progress.modelId).then(() => {
        const request = get().setupRequest;
        request?.onReady?.();
      });
    }
  },
  resetError: () => set({ error: null }),
}));
