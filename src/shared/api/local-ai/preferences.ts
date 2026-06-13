import { invokeCommand } from "@/shared/platform/tauri/command";
import type {
  AnalysisEngine,
  ExternalAiAgentCommandRequest,
  ExternalAiAgentConfigPreferenceRequest,
  LocalAiActionKind,
  LocalAiPreferences,
  LocalAiSetActionPromptOverrideRequest,
  LocalAiSetAnalysisEnginePreferenceRequest,
  LocalAiSetModelPreferenceRequest,
  LocalAiSetModelWarmPreferenceRequest,
} from "./types";

const LOCAL_AI_PREFERENCE_OVERRIDES_KEY =
  "gitano:local-ai-preference-overrides";

type LocalAiPreferenceOverrides = {
  clearedActionModelIds?: string[];
};

let lastKnownLocalAiPreferences: LocalAiPreferences | null = null;

function readPreferenceOverrides(): LocalAiPreferenceOverrides {
  try {
    const raw = globalThis.localStorage?.getItem(
      LOCAL_AI_PREFERENCE_OVERRIDES_KEY,
    );
    if (!raw) return {};

    const parsed = JSON.parse(raw) as LocalAiPreferenceOverrides;
    return {
      clearedActionModelIds: Array.isArray(parsed.clearedActionModelIds)
        ? parsed.clearedActionModelIds.filter(
            (actionKind): actionKind is string => typeof actionKind === "string",
          )
        : [],
    };
  } catch {
    return {};
  }
}

function writePreferenceOverrides(overrides: LocalAiPreferenceOverrides) {
  try {
    const clearedActionModelIds = [
      ...new Set(overrides.clearedActionModelIds ?? []),
    ];
    if (clearedActionModelIds.length === 0) {
      globalThis.localStorage?.removeItem(LOCAL_AI_PREFERENCE_OVERRIDES_KEY);
      return;
    }

    globalThis.localStorage?.setItem(
      LOCAL_AI_PREFERENCE_OVERRIDES_KEY,
      JSON.stringify({ clearedActionModelIds }),
    );
  } catch {
    // localStorage is a best-effort compatibility layer for older backends.
  }
}

function markActionModelCleared(actionKind: LocalAiActionKind) {
  const overrides = readPreferenceOverrides();
  writePreferenceOverrides({
    clearedActionModelIds: [
      ...(overrides.clearedActionModelIds ?? []),
      actionKind,
    ],
  });
}

function unmarkActionModelCleared(actionKind: LocalAiActionKind) {
  const overrides = readPreferenceOverrides();
  writePreferenceOverrides({
    clearedActionModelIds: (overrides.clearedActionModelIds ?? []).filter(
      (clearedActionKind) => clearedActionKind !== actionKind,
    ),
  });
}

function applyPreferenceOverrides(
  preferences: LocalAiPreferences,
): LocalAiPreferences {
  const analysisEngine =
    preferences.analysisEngine ??
    ({
      type: "local_model",
      modelId: preferences.globalModelId || null,
    } satisfies AnalysisEngine);
  const actionEngines = {
    ...Object.fromEntries(
      Object.entries(preferences.actionModelIds ?? {}).map(
        ([actionKind, modelId]) =>
          [
            actionKind,
            { type: "local_model", modelId } satisfies AnalysisEngine,
          ] as const,
      ),
    ),
    ...(preferences.actionEngines ?? {}),
  };
  const normalizedPreferences = {
    ...preferences,
    analysisEngine,
    actionEngines,
    externalAgentOptionValues:
      preferences.externalAgentOptionValues ?? {},
    actionExternalAgentOptionValues:
      preferences.actionExternalAgentOptionValues ?? {},
    actionPromptOverrides: preferences.actionPromptOverrides ?? {},
    defaultActionPrompts: preferences.defaultActionPrompts ?? {},
    warmModelIds: preferences.warmModelIds ?? [],
    keepAliveMinutes: preferences.keepAliveMinutes ?? 30,
  };
  const overrides = readPreferenceOverrides();
  const clearedActionModelIds = overrides.clearedActionModelIds ?? [];
  if (clearedActionModelIds.length === 0) {
    lastKnownLocalAiPreferences = normalizedPreferences;
    return normalizedPreferences;
  }

  const actionModelIds = { ...normalizedPreferences.actionModelIds };
  const nextActionEngines = { ...normalizedPreferences.actionEngines };
  clearedActionModelIds.forEach((actionKind) => {
    delete actionModelIds[actionKind];
    delete nextActionEngines[actionKind];
  });

  const nextPreferences = {
    ...normalizedPreferences,
    actionModelIds,
    actionEngines: nextActionEngines,
  };
  lastKnownLocalAiPreferences = nextPreferences;
  return nextPreferences;
}

function isUnsupportedEmptyModelError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.trim() === "Unsupported local AI model:";
}

export async function getLocalAiModelPreferences() {
  const preferences = await invokeCommand<LocalAiPreferences>(
    "ai_get_model_preferences",
  );
  return applyPreferenceOverrides(preferences);
}

export async function setLocalAiModelPreference(
  request: LocalAiSetModelPreferenceRequest,
) {
  const actionKind = request.actionKind ?? null;
  const modelId = request.modelId.trim();
  const nextRequest = {
    ...request,
    modelId,
    actionKind,
  };

  try {
    const preferences = await invokeCommand<LocalAiPreferences>(
      "ai_set_model_preference",
      {
        request: nextRequest,
      },
    );

    if (actionKind && modelId) {
      unmarkActionModelCleared(actionKind);
    } else if (actionKind && !modelId) {
      markActionModelCleared(actionKind);
    }

    return applyPreferenceOverrides(preferences);
  } catch (error) {
    if (actionKind && !modelId && isUnsupportedEmptyModelError(error)) {
      markActionModelCleared(actionKind);
      let preferences = lastKnownLocalAiPreferences;
      try {
        preferences = await invokeCommand<LocalAiPreferences>(
          "ai_get_model_preferences",
        );
      } catch {
        if (!preferences) {
          throw error;
        }
      }
      return applyPreferenceOverrides(preferences);
    }

    throw error;
  }
}

export async function setLocalAiAnalysisEnginePreference(
  request: LocalAiSetAnalysisEnginePreferenceRequest,
) {
  const preferences = await invokeCommand<LocalAiPreferences>(
    "ai_set_analysis_engine_preference",
    {
      request: {
        engine: request.engine,
        actionKind: request.actionKind ?? null,
      },
    },
  );

  return applyPreferenceOverrides(preferences);
}

export function setExternalAiAgentAsDefault(
  request: ExternalAiAgentCommandRequest,
) {
  return invokeCommand<LocalAiPreferences>(
    "ai_set_external_agent_as_default",
    { request },
  ).then(applyPreferenceOverrides);
}

export function setExternalAiAgentConfigPreference(
  request: ExternalAiAgentConfigPreferenceRequest,
) {
  return invokeCommand<LocalAiPreferences>(
    "ai_set_external_agent_config_preference",
    {
      request: {
        agentId: request.agentId,
        actionKind: request.actionKind ?? null,
        configId: request.configId,
        value: request.value ?? null,
      },
    },
  ).then(applyPreferenceOverrides);
}

export function setLocalAiActionPromptOverride(
  request: LocalAiSetActionPromptOverrideRequest,
) {
  return invokeCommand<LocalAiPreferences>(
    "ai_set_action_prompt_override",
    {
      request: {
        actionKind: request.actionKind,
        prompt: request.prompt ?? null,
      },
    },
  ).then(applyPreferenceOverrides);
}

export async function setLocalAiModelWarmPreference(
  request: LocalAiSetModelWarmPreferenceRequest,
) {
  const preferences = await invokeCommand<LocalAiPreferences>(
    "ai_set_model_warm_preference",
    {
      request: {
        modelId: request.modelId.trim(),
        warm: request.warm,
      },
    },
  );

  return applyPreferenceOverrides(preferences);
}
