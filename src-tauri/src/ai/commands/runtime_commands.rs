use super::super::entitlement::ensure_entitled;
use super::super::machine::machine_profile;
use super::super::ollama::{emit_failed_progress, OllamaClient};
use super::super::runtime::{
    latest_compatible_runtime_version, managed_runtime_supported, managed_runtime_version,
    prepare_managed_runtime, using_external_ollama,
};
use super::super::types::{
    LocalAiPrepareRuntimeRequest, LocalAiPrepareRuntimeResponse, LocalAiRuntimeSetupStatus,
};
use super::model_helpers::operation_id;
use tauri::AppHandle;

#[tauri::command]
pub async fn ai_get_runtime_status() -> Result<LocalAiRuntimeSetupStatus, String> {
    let client = OllamaClient::from_env();
    let runtime = client.runtime_status().await;
    let managed = !using_external_ollama();
    let installed = if managed {
        super::super::runtime::managed_runtime_binary_path().is_some()
    } else {
        runtime.available
    };

    Ok(LocalAiRuntimeSetupStatus {
        runtime,
        managed,
        installed,
        installed_version: if managed {
            managed_runtime_version()
        } else {
            None
        },
        latest_compatible_version: latest_compatible_runtime_version(),
        model_storage_path: machine_profile().model_storage_path,
        can_install: managed && managed_runtime_supported(),
    })
}

#[tauri::command]
pub async fn ai_prepare_runtime(
    app: AppHandle,
    request: LocalAiPrepareRuntimeRequest,
) -> Result<LocalAiPrepareRuntimeResponse, String> {
    ensure_entitled()?;
    let operation_id = operation_id("runtime");
    let runtime_app = app.clone();
    let runtime_operation_id = operation_id.clone();

    tauri::async_runtime::spawn(async move {
        if let Err(error) =
            prepare_managed_runtime(&runtime_app, &runtime_operation_id, request.force_reinstall)
                .await
        {
            emit_failed_progress(
                &runtime_app,
                runtime_operation_id,
                "runtime".to_string(),
                error,
            );
        }
    });

    Ok(LocalAiPrepareRuntimeResponse { operation_id })
}
