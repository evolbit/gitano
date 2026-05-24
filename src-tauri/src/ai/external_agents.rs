use super::models::{
    load_preferences, local_ai_data_dir, save_preferences, set_analysis_engine_preference,
};
use super::types::{
    AnalysisEngine, ExternalAiAgentCommandRequest, ExternalAiAgentEntry,
    ExternalAiAgentInstallRequest, ExternalAiAgentInstallResponse, ExternalAiAgentProgress,
    ExternalAiAgentProgressState, ExternalAiAgentStatus, ExternalAiAgentStatusState,
    EXTERNAL_AI_AGENT_PROGRESS_EVENT,
};
use catalog::{
    auth_methods_for, curated_agents, find_curated_agent, install_source_for,
    install_source_to_api, ArchiveKind, CuratedAgent, CuratedInstall,
};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

mod catalog;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NpxAgentManifest {
    package: String,
    args: Vec<String>,
}

pub fn external_agent_catalog() -> Vec<ExternalAiAgentEntry> {
    curated_agents()
        .iter()
        .map(|agent| {
            let install_source = install_source_for(agent).map(install_source_to_api);
            ExternalAiAgentEntry {
                id: agent.id.to_string(),
                display_name: agent.display_name.to_string(),
                provider: agent.provider.to_string(),
                description: agent.description.to_string(),
                version: agent.version.to_string(),
                repository: Some(agent.repository.to_string()),
                license: Some(agent.license.to_string()),
                install_source,
                status: external_agent_status(agent.id)
                    .unwrap_or_else(|error| failed_status(agent.id, error)),
            }
        })
        .collect()
}

pub fn external_agent_status(agent_id: &str) -> Result<ExternalAiAgentStatus, String> {
    let agent = find_curated_agent(agent_id)?;
    let Some(source) = install_source_for(agent) else {
        return Ok(ExternalAiAgentStatus {
            agent_id: agent.id.to_string(),
            installed: false,
            authenticated: false,
            available: false,
            state: ExternalAiAgentStatusState::UnsupportedPlatform,
            version: None,
            auth_methods: auth_methods_for(agent.id),
            error: Some("This external agent is not supported on this platform.".to_string()),
        });
    };

    match source {
        CuratedInstall::Binary { .. } => binary_status(agent),
        CuratedInstall::Npx { .. } => npx_status(agent),
    }
}

pub fn external_agent_command(agent_id: &str) -> Result<(String, Vec<String>), String> {
    let agent = find_curated_agent(agent_id)?;
    let source = install_source_for(agent).ok_or_else(|| {
        format!(
            "External agent {} is unsupported on this platform.",
            agent_id
        )
    })?;

    match source {
        CuratedInstall::Binary { cmd, .. } => {
            let path = agent_dir(agent.id).join(command_relative_path(cmd));
            if !path.exists() {
                return Err(format!(
                    "External agent {} is not installed.",
                    agent.display_name
                ));
            }
            Ok((path.to_string_lossy().to_string(), Vec::new()))
        }
        CuratedInstall::Npx { package, args } => {
            let manifest = read_npx_manifest(agent.id).unwrap_or_else(|| NpxAgentManifest {
                package: package.to_string(),
                args: args.iter().map(|arg| arg.to_string()).collect(),
            });
            let mut command_args = vec!["-y".to_string(), manifest.package];
            command_args.extend(manifest.args);
            Ok(("npx".to_string(), command_args))
        }
    }
}

pub fn install_external_agent(
    app: AppHandle,
    request: ExternalAiAgentInstallRequest,
) -> Result<ExternalAiAgentInstallResponse, String> {
    let agent = *find_curated_agent(&request.agent_id)?;
    let source = install_source_for(&agent).ok_or_else(|| {
        format!(
            "External agent {} is unsupported on this platform.",
            agent.id
        )
    })?;
    let operation_id = external_agent_operation_id(agent.id);
    let task_operation_id = operation_id.clone();

    tauri::async_runtime::spawn(async move {
        if let Err(error) =
            install_external_agent_inner(&app, &task_operation_id, agent, source).await
        {
            emit_agent_progress(
                &app,
                &task_operation_id,
                agent.id,
                ExternalAiAgentProgressState::Failed,
                "External agent install failed",
                None,
                None,
                None,
                Some(error),
            );
        }
    });

    Ok(ExternalAiAgentInstallResponse { operation_id })
}

pub fn remove_external_agent(request: ExternalAiAgentCommandRequest) -> Result<(), String> {
    let agent = find_curated_agent(&request.agent_id)?;
    let dir = agent_dir(agent.id);
    if dir.exists() {
        fs::remove_dir_all(&dir)
            .map_err(|e| format!("External agent {} could not be removed: {}", agent.id, e))?;
    }
    remove_agent_from_preferences(agent.id)?;
    Ok(())
}

pub fn set_external_agent_as_default(
    request: ExternalAiAgentCommandRequest,
) -> Result<super::types::LocalAiPreferences, String> {
    find_curated_agent(&request.agent_id)?;
    set_analysis_engine_preference(AnalysisEngine::external_agent(request.agent_id), None)
}

pub fn authenticate_external_agent(
    request: ExternalAiAgentCommandRequest,
) -> Result<ExternalAiAgentStatus, String> {
    find_curated_agent(&request.agent_id)?;
    external_agent_status(&request.agent_id)
}

pub fn logout_external_agent(
    request: ExternalAiAgentCommandRequest,
) -> Result<ExternalAiAgentStatus, String> {
    find_curated_agent(&request.agent_id)?;
    external_agent_status(&request.agent_id)
}

fn binary_status(agent: &CuratedAgent) -> Result<ExternalAiAgentStatus, String> {
    let Some(CuratedInstall::Binary { cmd, .. }) = install_source_for(agent) else {
        return Ok(failed_status(
            agent.id,
            "Binary install metadata is unavailable.".to_string(),
        ));
    };
    let binary_path = agent_dir(agent.id).join(command_relative_path(cmd));
    if !binary_path.exists() {
        return Ok(not_installed_status(agent.id));
    }

    Ok(ExternalAiAgentStatus {
        agent_id: agent.id.to_string(),
        installed: true,
        authenticated: false,
        available: true,
        state: ExternalAiAgentStatusState::Ready,
        version: Some(agent.version.to_string()),
        auth_methods: auth_methods_for(agent.id),
        error: None,
    })
}

fn npx_status(agent: &CuratedAgent) -> Result<ExternalAiAgentStatus, String> {
    if read_npx_manifest(agent.id).is_none() {
        return Ok(not_installed_status(agent.id));
    }

    match Command::new("npx").arg("--version").output() {
        Ok(output) if output.status.success() => Ok(ExternalAiAgentStatus {
            agent_id: agent.id.to_string(),
            installed: true,
            authenticated: false,
            available: true,
            state: ExternalAiAgentStatusState::Ready,
            version: Some(agent.version.to_string()),
            auth_methods: auth_methods_for(agent.id),
            error: None,
        }),
        Ok(output) => Ok(ExternalAiAgentStatus {
            agent_id: agent.id.to_string(),
            installed: true,
            authenticated: false,
            available: false,
            state: ExternalAiAgentStatusState::Unavailable,
            version: Some(agent.version.to_string()),
            auth_methods: auth_methods_for(agent.id),
            error: Some(String::from_utf8_lossy(&output.stderr).trim().to_string()),
        }),
        Err(error) => Ok(ExternalAiAgentStatus {
            agent_id: agent.id.to_string(),
            installed: true,
            authenticated: false,
            available: false,
            state: ExternalAiAgentStatusState::Unavailable,
            version: Some(agent.version.to_string()),
            auth_methods: auth_methods_for(agent.id),
            error: Some(format!("npx is required to run this agent: {}", error)),
        }),
    }
}

async fn install_external_agent_inner(
    app: &AppHandle,
    operation_id: &str,
    agent: CuratedAgent,
    source: CuratedInstall,
) -> Result<(), String> {
    emit_agent_progress(
        app,
        operation_id,
        agent.id,
        ExternalAiAgentProgressState::Queued,
        "Preparing external agent install",
        None,
        None,
        None,
        None,
    );

    fs::create_dir_all(agent_dir(agent.id)).map_err(|e| e.to_string())?;

    match source {
        CuratedInstall::Binary {
            archive,
            cmd,
            archive_kind,
        } => {
            install_binary_agent(app, operation_id, agent.id, archive, cmd, archive_kind).await?;
        }
        CuratedInstall::Npx { package, args } => {
            install_npx_agent(agent.id, package, args)?;
        }
    }

    emit_agent_progress(
        app,
        operation_id,
        agent.id,
        ExternalAiAgentProgressState::Completed,
        "External agent ready",
        None,
        None,
        Some(100.0),
        None,
    );

    Ok(())
}

async fn install_binary_agent(
    app: &AppHandle,
    operation_id: &str,
    agent_id: &str,
    archive: &str,
    cmd: &str,
    archive_kind: ArchiveKind,
) -> Result<(), String> {
    let dir = agent_dir(agent_id);
    let archive_path = dir.join(archive.rsplit('/').next().unwrap_or("agent-archive"));
    download_agent_archive(app, operation_id, agent_id, archive, &archive_path).await?;
    emit_agent_progress(
        app,
        operation_id,
        agent_id,
        ExternalAiAgentProgressState::Installing,
        "Installing external agent",
        None,
        None,
        None,
        None,
    );
    extract_archive(&archive_path, &dir, archive_kind)?;
    let _ = fs::remove_file(&archive_path);
    make_executable(&dir.join(command_relative_path(cmd)))?;
    Ok(())
}

fn install_npx_agent(agent_id: &str, package: &str, args: &[&str]) -> Result<(), String> {
    let manifest = NpxAgentManifest {
        package: package.to_string(),
        args: args.iter().map(|arg| arg.to_string()).collect(),
    };
    let path = npx_manifest_path(agent_id);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let contents = serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
    fs::write(path, contents).map_err(|e| e.to_string())
}

async fn download_agent_archive(
    app: &AppHandle,
    operation_id: &str,
    agent_id: &str,
    archive: &str,
    archive_path: &Path,
) -> Result<(), String> {
    emit_agent_progress(
        app,
        operation_id,
        agent_id,
        ExternalAiAgentProgressState::Downloading,
        "Downloading external agent",
        None,
        None,
        None,
        None,
    );

    let response = reqwest::Client::new()
        .get(archive)
        .send()
        .await
        .map_err(|e| format!("External agent download failed: {}", e))?
        .error_for_status()
        .map_err(|e| format!("External agent download failed: {}", e))?;
    let total_bytes = response.content_length();
    let mut completed_bytes = 0_u64;
    let mut file = File::create(archive_path).map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("External agent download failed: {}", e))?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        completed_bytes += chunk.len() as u64;
        let percentage = total_bytes
            .filter(|total| *total > 0)
            .map(|total| ((completed_bytes as f64 / total as f64) * 100.0).clamp(0.0, 100.0));

        emit_agent_progress(
            app,
            operation_id,
            agent_id,
            ExternalAiAgentProgressState::Downloading,
            "Downloading external agent",
            Some(completed_bytes),
            total_bytes,
            percentage,
            None,
        );
    }

    Ok(())
}

fn extract_archive(
    archive_path: &Path,
    destination_dir: &Path,
    archive_kind: ArchiveKind,
) -> Result<(), String> {
    let output = match archive_kind {
        ArchiveKind::Tgz => Command::new("tar")
            .arg("-xzf")
            .arg(archive_path)
            .arg("-C")
            .arg(destination_dir)
            .output(),
        ArchiveKind::Zip => Command::new("unzip")
            .arg("-q")
            .arg(archive_path)
            .arg("-d")
            .arg(destination_dir)
            .output(),
    }
    .map_err(|e| format!("External agent extraction failed: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "External agent extraction failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

fn remove_agent_from_preferences(agent_id: &str) -> Result<(), String> {
    let mut preferences = load_preferences();
    if matches!(
        &preferences.analysis_engine,
        AnalysisEngine::ExternalAgent { agent_id: selected } if selected == agent_id
    ) {
        preferences.analysis_engine = AnalysisEngine::LocalModel { model_id: None };
    }
    preferences.action_engines.retain(|_, engine| {
        !matches!(engine, AnalysisEngine::ExternalAgent { agent_id: selected } if selected == agent_id)
    });
    preferences.sync_legacy_model_fields();
    save_preferences(&preferences)
}

fn not_installed_status(agent_id: &str) -> ExternalAiAgentStatus {
    ExternalAiAgentStatus {
        agent_id: agent_id.to_string(),
        installed: false,
        authenticated: false,
        available: false,
        state: ExternalAiAgentStatusState::NotInstalled,
        version: None,
        auth_methods: auth_methods_for(agent_id),
        error: None,
    }
}

fn failed_status(agent_id: &str, error: String) -> ExternalAiAgentStatus {
    ExternalAiAgentStatus {
        agent_id: agent_id.to_string(),
        installed: false,
        authenticated: false,
        available: false,
        state: ExternalAiAgentStatusState::Failed,
        version: None,
        auth_methods: auth_methods_for(agent_id),
        error: Some(error),
    }
}

fn read_npx_manifest(agent_id: &str) -> Option<NpxAgentManifest> {
    let contents = fs::read_to_string(npx_manifest_path(agent_id)).ok()?;
    serde_json::from_str(&contents).ok()
}

fn agent_dir(agent_id: &str) -> PathBuf {
    external_agent_data_dir().join(agent_id)
}

fn external_agent_data_dir() -> PathBuf {
    local_ai_data_dir().join("external-agents")
}

fn npx_manifest_path(agent_id: &str) -> PathBuf {
    agent_dir(agent_id).join("agent.json")
}

fn command_relative_path(cmd: &str) -> &str {
    cmd.strip_prefix("./").unwrap_or(cmd)
}

fn external_agent_operation_id(agent_id: &str) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    format!("external-agent-{}-{}", agent_id, now)
}

fn emit_agent_progress(
    app: &AppHandle,
    operation_id: &str,
    agent_id: &str,
    state: ExternalAiAgentProgressState,
    status: &str,
    completed_bytes: Option<u64>,
    total_bytes: Option<u64>,
    percentage: Option<f64>,
    error: Option<String>,
) {
    let _ = app.emit(
        EXTERNAL_AI_AGENT_PROGRESS_EVENT,
        ExternalAiAgentProgress {
            operation_id: operation_id.to_string(),
            agent_id: agent_id.to_string(),
            state,
            status: status.to_string(),
            completed_bytes,
            total_bytes,
            percentage,
            error,
        },
    );
}

#[cfg(unix)]
fn make_executable(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    let mut permissions = fs::metadata(path).map_err(|e| e.to_string())?.permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions).map_err(|e| e.to_string())
}

#[cfg(not(unix))]
fn make_executable(_path: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::catalog::{CODEX_AGENT_ID, GEMINI_AGENT_ID};
    use super::*;

    #[test]
    fn npx_manifest_marks_agent_installed() {
        let _guard = crate::ai::local_ai_env_lock()
            .lock()
            .expect("lock local AI env");
        let temp_dir = tempfile::tempdir().expect("temp local AI dir");
        let previous_home = std::env::var_os("GITANO_LOCAL_AI_HOME");
        std::env::set_var("GITANO_LOCAL_AI_HOME", temp_dir.path());

        install_npx_agent(GEMINI_AGENT_ID, "@google/gemini-cli@0.42.0", &["--acp"])
            .expect("write manifest");

        let status = external_agent_status(GEMINI_AGENT_ID).expect("agent status");

        assert!(status.installed);
        assert_ne!(status.state, ExternalAiAgentStatusState::NotInstalled);

        match previous_home {
            Some(value) => std::env::set_var("GITANO_LOCAL_AI_HOME", value),
            None => std::env::remove_var("GITANO_LOCAL_AI_HOME"),
        }
    }

    #[test]
    fn binary_status_does_not_require_version_flag_support() {
        let _guard = crate::ai::local_ai_env_lock()
            .lock()
            .expect("lock local AI env");
        let temp_dir = tempfile::tempdir().expect("temp local AI dir");
        let previous_home = std::env::var_os("GITANO_LOCAL_AI_HOME");
        std::env::set_var("GITANO_LOCAL_AI_HOME", temp_dir.path());

        let agent = find_curated_agent(CODEX_AGENT_ID).expect("codex agent exists");
        let source = install_source_for(agent).expect("codex install source exists");
        let CuratedInstall::Binary { cmd, .. } = source else {
            panic!("codex should use a binary install source on supported test platforms");
        };
        let binary_path = agent_dir(agent.id).join(command_relative_path(cmd));
        fs::create_dir_all(binary_path.parent().expect("binary parent")).expect("create agent dir");
        fs::write(&binary_path, "not an executable with --version support").expect("write binary");

        let status = external_agent_status(agent.id).expect("agent status");

        assert_eq!(status.state, ExternalAiAgentStatusState::Ready);
        assert!(status.available);
        assert_eq!(status.version.as_deref(), Some(agent.version));
        assert!(status.error.is_none());

        match previous_home {
            Some(value) => std::env::set_var("GITANO_LOCAL_AI_HOME", value),
            None => std::env::remove_var("GITANO_LOCAL_AI_HOME"),
        }
    }

    #[test]
    fn removing_selected_agent_clears_engine_preference() {
        let _guard = crate::ai::local_ai_env_lock()
            .lock()
            .expect("lock local AI env");
        let temp_dir = tempfile::tempdir().expect("temp local AI dir");
        let previous_home = std::env::var_os("GITANO_LOCAL_AI_HOME");
        std::env::set_var("GITANO_LOCAL_AI_HOME", temp_dir.path());

        set_analysis_engine_preference(
            AnalysisEngine::ExternalAgent {
                agent_id: CODEX_AGENT_ID.to_string(),
            },
            None,
        )
        .expect("set external engine");

        remove_agent_from_preferences(CODEX_AGENT_ID).expect("remove preference");

        let preferences = load_preferences();
        assert!(preferences.analysis_engine.is_local_model());

        match previous_home {
            Some(value) => std::env::set_var("GITANO_LOCAL_AI_HOME", value),
            None => std::env::remove_var("GITANO_LOCAL_AI_HOME"),
        }
    }
}
