import { invokeCommand } from "@/shared/platform/tauri/command";
import type {
  ExternalAiAgentCommandRequest,
  ExternalAiAgentEntry,
  ExternalAiAgentInstallRequest,
  ExternalAiAgentInstallResponse,
  ExternalAiAgentSessionConfig,
  ExternalAiAgentSessionConfigRequest,
  ExternalAiAgentStatus,
  ExternalAiCancelRequest,
  ExternalAiPromptRequest,
  ExternalAiPromptResponse,
  LocalAiCompatibility,
  LocalAiEntitlementStatus,
  LocalAiMachineProfile,
  LocalAiModelEntry,
  LocalAiModelStatus,
  LocalAiPrepareModelRequest,
  LocalAiPrepareModelResponse,
  LocalAiPrepareRuntimeRequest,
  LocalAiPrepareRuntimeResponse,
  LocalAiRunRequest,
  LocalAiRunResult,
  LocalAiRuntimeSetupStatus,
  LocalAiWarmModelsResponse,
} from "./types";

export function getLocalAiEntitlementStatus() {
  return invokeCommand<LocalAiEntitlementStatus>(
    "ai_get_entitlement_status",
  );
}

export function getLocalAiModelCatalog() {
  return invokeCommand<LocalAiModelEntry[]>("ai_get_model_catalog");
}

export function getExternalAiAgentCatalog() {
  return invokeCommand<ExternalAiAgentEntry[]>(
    "ai_get_external_agent_catalog",
  );
}

export function getExternalAiAgentStatus(agentId: string) {
  return invokeCommand<ExternalAiAgentStatus>(
    "ai_get_external_agent_status",
    { agentId },
  );
}

export function getExternalAiAgentSessionConfig(
  request: ExternalAiAgentSessionConfigRequest,
) {
  return invokeCommand<ExternalAiAgentSessionConfig>(
    "ai_get_external_agent_session_config",
    {
      request: {
        agentId: request.agentId,
        repoPath: request.repoPath ?? null,
      },
    },
  );
}

export function installExternalAiAgent(
  request: ExternalAiAgentInstallRequest,
) {
  return invokeCommand<ExternalAiAgentInstallResponse>(
    "ai_install_external_agent",
    { request },
  );
}

export function removeExternalAiAgent(
  request: ExternalAiAgentCommandRequest,
) {
  return invokeCommand<void>("ai_remove_external_agent", { request });
}

export function authenticateExternalAiAgent(
  request: ExternalAiAgentCommandRequest,
) {
  return invokeCommand<ExternalAiAgentStatus>(
    "ai_authenticate_external_agent",
    { request },
  );
}

export function logoutExternalAiAgent(
  request: ExternalAiAgentCommandRequest,
) {
  return invokeCommand<ExternalAiAgentStatus>(
    "ai_logout_external_agent",
    { request },
  );
}

export function runExternalAiPrompt(request: ExternalAiPromptRequest) {
  return invokeCommand<ExternalAiPromptResponse>(
    "ai_run_external_agent_prompt",
    { request },
  );
}

export function cancelExternalAiRun(request: ExternalAiCancelRequest) {
  return invokeCommand<void>("ai_cancel_external_agent_run", { request });
}

export function getLocalAiMachineProfile() {
  return invokeCommand<LocalAiMachineProfile>("ai_get_machine_profile");
}

export function getLocalAiModelStatus(modelId?: string | null) {
  return invokeCommand<LocalAiModelStatus>("ai_get_model_status", {
    modelId,
  });
}

export function getLocalAiRuntimeStatus() {
  return invokeCommand<LocalAiRuntimeSetupStatus>("ai_get_runtime_status");
}

export function getLocalAiModelCompatibility(modelId: string) {
  return invokeCommand<LocalAiCompatibility>(
    "ai_get_model_compatibility",
    { modelId },
  );
}

export function prepareLocalAiModel(request: LocalAiPrepareModelRequest) {
  return invokeCommand<LocalAiPrepareModelResponse>("ai_prepare_model", {
    request,
  });
}

export function prepareLocalAiRuntime(request: LocalAiPrepareRuntimeRequest) {
  return invokeCommand<LocalAiPrepareRuntimeResponse>("ai_prepare_runtime", {
    request,
  });
}

export function deleteLocalAiModel(modelId: string) {
  return invokeCommand<void>("ai_delete_model", { modelId });
}

export function warmConfiguredLocalAiModels() {
  return invokeCommand<LocalAiWarmModelsResponse>(
    "ai_warm_configured_models",
  );
}

export function runLocalAiAction(request: LocalAiRunRequest) {
  return invokeCommand<LocalAiRunResult>("ai_run_action", { request });
}
