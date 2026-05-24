use super::super::entitlement::ensure_entitled;
use super::super::models::set_external_agent_config_preference;
use super::super::types::{
    ExternalAiAgentCommandRequest, ExternalAiAgentConfigPreferenceRequest, ExternalAiAgentEntry,
    ExternalAiAgentInstallRequest, ExternalAiAgentInstallResponse, ExternalAiAgentSessionConfig,
    ExternalAiAgentSessionConfigRequest, ExternalAiAgentStatus, ExternalAiCancelRequest,
    ExternalAiPromptRequest, ExternalAiPromptResponse, LocalAiPreferences,
};
use tauri::AppHandle;

#[tauri::command]
pub fn ai_get_external_agent_catalog() -> Vec<ExternalAiAgentEntry> {
    super::super::external_agents::external_agent_catalog()
}

#[tauri::command]
pub fn ai_get_external_agent_status(agent_id: String) -> Result<ExternalAiAgentStatus, String> {
    super::super::external_agents::external_agent_status(&agent_id)
}

#[tauri::command]
pub async fn ai_get_external_agent_session_config(
    app: AppHandle,
    request: ExternalAiAgentSessionConfigRequest,
) -> Result<ExternalAiAgentSessionConfig, String> {
    ensure_entitled()?;
    super::super::acp_client::get_external_agent_session_config(app, request).await
}

#[tauri::command]
pub fn ai_set_external_agent_as_default(
    request: ExternalAiAgentCommandRequest,
) -> Result<LocalAiPreferences, String> {
    ensure_entitled()?;
    super::super::external_agents::set_external_agent_as_default(request)
}

#[tauri::command]
pub fn ai_set_external_agent_config_preference(
    request: ExternalAiAgentConfigPreferenceRequest,
) -> Result<LocalAiPreferences, String> {
    ensure_entitled()?;
    set_external_agent_config_preference(
        &request.agent_id,
        request.action_kind,
        &request.config_id,
        request.value.as_deref(),
    )
}

#[tauri::command]
pub fn ai_install_external_agent(
    app: AppHandle,
    request: ExternalAiAgentInstallRequest,
) -> Result<ExternalAiAgentInstallResponse, String> {
    ensure_entitled()?;
    super::super::external_agents::install_external_agent(app, request)
}

#[tauri::command]
pub fn ai_remove_external_agent(request: ExternalAiAgentCommandRequest) -> Result<(), String> {
    ensure_entitled()?;
    super::super::external_agents::remove_external_agent(request)
}

#[tauri::command]
pub fn ai_authenticate_external_agent(
    request: ExternalAiAgentCommandRequest,
) -> Result<ExternalAiAgentStatus, String> {
    ensure_entitled()?;
    super::super::external_agents::authenticate_external_agent(request)
}

#[tauri::command]
pub fn ai_logout_external_agent(
    request: ExternalAiAgentCommandRequest,
) -> Result<ExternalAiAgentStatus, String> {
    ensure_entitled()?;
    super::super::external_agents::logout_external_agent(request)
}

#[tauri::command]
pub async fn ai_run_external_agent_prompt(
    app: AppHandle,
    request: ExternalAiPromptRequest,
) -> Result<ExternalAiPromptResponse, String> {
    ensure_entitled()?;
    super::super::acp_client::run_external_agent_prompt(app, request).await
}

#[tauri::command]
pub fn ai_cancel_external_agent_run(request: ExternalAiCancelRequest) -> Result<(), String> {
    ensure_entitled()?;
    super::super::acp_client::cancel_external_agent_run(&request.run_id)
}
