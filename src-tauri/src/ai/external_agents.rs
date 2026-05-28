use super::models::{
    load_preferences, local_ai_data_dir, save_preferences, set_analysis_engine_preference,
};
use super::types::{
    AnalysisEngine, ExternalAiAgentCommandRequest, ExternalAiAgentEntry,
    ExternalAiAgentInstallRequest, ExternalAiAgentInstallResponse, ExternalAiAgentProgress,
    ExternalAiAgentProgressState, ExternalAiAgentStatus, ExternalAiAgentStatusState,
    EXTERNAL_AI_AGENT_PROGRESS_EVENT,
};
use crate::platform::{
    command_search_dirs, resolve_external_program, resolve_external_program_from_dirs,
    ResolvedExternalProgram,
};
#[cfg(test)]
use crate::platform::{
    external_program_names, push_platform_command_dirs, push_user_home_command_dirs,
};
#[cfg(test)]
use catalog::npm_exec_args;
use catalog::{
    auth_methods_for, curated_agents, find_curated_agent, install_source_for,
    install_source_to_api, ArchiveKind, CuratedAgent, CuratedBinarySource, CuratedInstallSource,
    CuratedNpxSource,
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExternalAgentCommand {
    pub program: String,
    pub args: Vec<String>,
    pub path_env: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct NpxAgentManifest {
    package: String,
    args: Vec<String>,
}

pub fn external_agent_catalog() -> Vec<ExternalAiAgentEntry> {
    curated_agents()
        .iter()
        .map(|agent| ExternalAiAgentEntry {
            id: agent.id.to_string(),
            display_name: agent.display_name.to_string(),
            provider: agent.provider.to_string(),
            description: agent.description.to_string(),
            version: agent.version.to_string(),
            repository: Some(agent.repository.to_string()),
            license: Some(agent.license.to_string()),
            install_source: install_source_for(agent).map(install_source_to_api),
            status: external_agent_status(agent.id)
                .unwrap_or_else(|error| failed_status(agent.id, error)),
        })
        .collect()
}

pub fn external_agent_status(agent_id: &str) -> Result<ExternalAiAgentStatus, String> {
    let agent = find_curated_agent(agent_id)?;
    external_install_status(agent)
}

pub fn external_agent_command(agent_id: &str) -> Result<ExternalAgentCommand, String> {
    let agent = find_curated_agent(agent_id)?;
    let source = install_source_for(agent).ok_or_else(|| unsupported_platform_error(agent))?;

    match source {
        CuratedInstallSource::Binary(source) => binary_external_agent_command(agent, source),
        CuratedInstallSource::Npx(source) => npx_external_agent_command(agent, source),
    }
}

pub fn install_external_agent(
    app: AppHandle,
    request: ExternalAiAgentInstallRequest,
) -> Result<ExternalAiAgentInstallResponse, String> {
    let agent = find_curated_agent(&request.agent_id)?;
    let source = install_source_for(agent).ok_or_else(|| unsupported_platform_error(agent))?;
    let operation_id = external_agent_operation_id(agent.id);
    let install_app = app.clone();
    let install_operation_id = operation_id.clone();

    tauri::async_runtime::spawn(async move {
        let result =
            install_external_agent_inner(&install_app, &install_operation_id, agent, source).await;
        if let Err(error) = result {
            emit_agent_progress(
                &install_app,
                &install_operation_id,
                agent.id,
                ExternalAiAgentProgressState::Failed,
                "External agent setup failed.",
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
    let agent = find_curated_agent(&request.agent_id)?;
    set_analysis_engine_preference(AnalysisEngine::external_agent(agent.id.to_string()), None)
}

pub fn authenticate_external_agent(
    request: ExternalAiAgentCommandRequest,
) -> Result<ExternalAiAgentStatus, String> {
    let agent = find_curated_agent(&request.agent_id)?;
    external_agent_status(agent.id)
}

pub fn logout_external_agent(
    request: ExternalAiAgentCommandRequest,
) -> Result<ExternalAiAgentStatus, String> {
    let agent = find_curated_agent(&request.agent_id)?;
    external_agent_status(agent.id)
}

fn external_install_status(agent: &CuratedAgent) -> Result<ExternalAiAgentStatus, String> {
    let Some(source) = install_source_for(agent) else {
        return Ok(ExternalAiAgentStatus {
            agent_id: agent.id.to_string(),
            installed: false,
            authenticated: false,
            available: false,
            state: ExternalAiAgentStatusState::UnsupportedPlatform,
            version: None,
            auth_methods: auth_methods_for(agent.id),
            error: Some(unsupported_platform_error(agent)),
        });
    };

    match source {
        CuratedInstallSource::Binary(source) => binary_status(agent, source),
        CuratedInstallSource::Npx(source) => npx_status(agent, source),
    }
}

fn binary_status(
    agent: &CuratedAgent,
    source: CuratedBinarySource,
) -> Result<ExternalAiAgentStatus, String> {
    let Some(command_path) = binary_command_path(agent, source)? else {
        return Ok(not_installed_status(agent, None));
    };

    if !command_path.is_file() {
        return Ok(not_installed_status(agent, None));
    }

    Ok(ready_status(agent))
}

fn npx_status(
    agent: &CuratedAgent,
    source: CuratedNpxSource,
) -> Result<ExternalAiAgentStatus, String> {
    npx_status_from_dirs(agent, source, &command_search_dirs())
}

fn npx_status_from_dirs(
    agent: &CuratedAgent,
    source: CuratedNpxSource,
    dirs: &[PathBuf],
) -> Result<ExternalAiAgentStatus, String> {
    if !npx_manifest_path(agent.id).is_file() {
        return Ok(not_installed_status(
            agent,
            npm_missing_error_if_unresolved(agent, source, dirs),
        ));
    }

    if resolve_external_program_from_dirs("npm", dirs).is_none() {
        return Ok(ExternalAiAgentStatus {
            agent_id: agent.id.to_string(),
            installed: true,
            authenticated: false,
            available: false,
            state: ExternalAiAgentStatusState::Unavailable,
            version: Some(agent.version.to_string()),
            auth_methods: auth_methods_for(agent.id),
            error: Some(missing_npm_error(agent, source.package)),
        });
    }

    Ok(ready_status(agent))
}

fn ready_status(agent: &CuratedAgent) -> ExternalAiAgentStatus {
    ExternalAiAgentStatus {
        agent_id: agent.id.to_string(),
        installed: true,
        authenticated: false,
        available: true,
        state: ExternalAiAgentStatusState::Ready,
        version: Some(agent.version.to_string()),
        auth_methods: auth_methods_for(agent.id),
        error: None,
    }
}

fn not_installed_status(agent: &CuratedAgent, error: Option<String>) -> ExternalAiAgentStatus {
    ExternalAiAgentStatus {
        agent_id: agent.id.to_string(),
        installed: false,
        authenticated: false,
        available: false,
        state: ExternalAiAgentStatusState::NotInstalled,
        version: None,
        auth_methods: auth_methods_for(agent.id),
        error,
    }
}

fn binary_external_agent_command(
    agent: &CuratedAgent,
    source: CuratedBinarySource,
) -> Result<ExternalAgentCommand, String> {
    let command_path = binary_command_path(agent, source)?
        .filter(|path| path.is_file())
        .ok_or_else(|| {
            format!(
                "Install {} from Gitano before running it.",
                agent.display_name
            )
        })?;

    Ok(ExternalAgentCommand {
        program: command_path.to_string_lossy().to_string(),
        args: source.args.iter().map(|arg| arg.to_string()).collect(),
        path_env: None,
    })
}

fn npx_external_agent_command(
    agent: &CuratedAgent,
    source: CuratedNpxSource,
) -> Result<ExternalAgentCommand, String> {
    let manifest = read_npx_manifest(agent.id)?.ok_or_else(|| {
        format!(
            "Install {} from Gitano before running it.",
            agent.display_name
        )
    })?;
    let resolved =
        resolve_external_program("npm").ok_or_else(|| missing_npm_error(agent, source.package))?;

    Ok(npx_external_agent_command_from_manifest(
        &manifest,
        resolved,
        npx_prefix_dir(agent.id),
    ))
}

fn npx_external_agent_command_from_manifest(
    manifest: &NpxAgentManifest,
    resolved: ResolvedExternalProgram,
    prefix_dir: PathBuf,
) -> ExternalAgentCommand {
    let mut args = vec![
        "--prefix".to_string(),
        prefix_dir.to_string_lossy().to_string(),
        "exec".to_string(),
        "--yes".to_string(),
        "--".to_string(),
        catalog::bounded_npm_package_spec(&manifest.package),
    ];
    args.extend(manifest.args.iter().cloned());

    ExternalAgentCommand {
        program: resolved.program.to_string_lossy().to_string(),
        args,
        path_env: resolved.path_env,
    }
}

#[cfg(test)]
fn npx_external_agent_command_from_source(
    source: CuratedNpxSource,
    resolved: ResolvedExternalProgram,
    prefix_dir: PathBuf,
) -> ExternalAgentCommand {
    ExternalAgentCommand {
        program: resolved.program.to_string_lossy().to_string(),
        args: npm_exec_args(source, &prefix_dir.to_string_lossy()),
        path_env: resolved.path_env,
    }
}

fn binary_command_path(
    agent: &CuratedAgent,
    source: CuratedBinarySource,
) -> Result<Option<PathBuf>, String> {
    let relative_path = command_relative_path(source.command)?;
    Ok(Some(agent_dir(agent.id).join(relative_path)))
}

async fn install_external_agent_inner(
    app: &AppHandle,
    operation_id: &str,
    agent: &CuratedAgent,
    source: CuratedInstallSource,
) -> Result<(), String> {
    match source {
        CuratedInstallSource::Binary(source) => {
            install_binary_agent(app, operation_id, agent, source).await?
        }
        CuratedInstallSource::Npx(source) => install_npx_agent(app, operation_id, agent, source)?,
    }

    emit_agent_progress(
        app,
        operation_id,
        agent.id,
        ExternalAiAgentProgressState::Completed,
        "External agent setup complete.",
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
    agent: &CuratedAgent,
    source: CuratedBinarySource,
) -> Result<(), String> {
    let dir = agent_dir(agent.id);
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let archive_path = dir.join(archive_file_name(source.archive)?);
    download_agent_archive(app, operation_id, agent, source.archive, &archive_path).await?;

    emit_agent_progress(
        app,
        operation_id,
        agent.id,
        ExternalAiAgentProgressState::Installing,
        "Installing external agent...",
        None,
        None,
        None,
        None,
    );
    extract_archive(&archive_path, &dir, source.archive_kind)?;
    let _ = fs::remove_file(&archive_path);

    let command_path = binary_command_path(agent, source)?
        .ok_or_else(|| "External agent archive did not define a command path.".to_string())?;
    if !command_path.is_file() {
        return Err(format!(
            "External agent archive did not contain {}.",
            source.command
        ));
    }
    make_executable(&command_path)?;

    Ok(())
}

fn install_npx_agent(
    app: &AppHandle,
    operation_id: &str,
    agent: &CuratedAgent,
    source: CuratedNpxSource,
) -> Result<(), String> {
    if resolve_external_program("npm").is_none() {
        return Err(missing_npm_error(agent, source.package));
    }

    emit_agent_progress(
        app,
        operation_id,
        agent.id,
        ExternalAiAgentProgressState::Installing,
        "Installing external agent adapter metadata...",
        None,
        None,
        None,
        None,
    );

    let dir = agent_dir(agent.id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(npx_prefix_dir(agent.id)).map_err(|e| e.to_string())?;
    let manifest = NpxAgentManifest {
        package: source.package.to_string(),
        args: source.args.iter().map(|arg| arg.to_string()).collect(),
    };
    let manifest_json = serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
    fs::write(npx_manifest_path(agent.id), manifest_json).map_err(|e| e.to_string())
}

async fn download_agent_archive(
    app: &AppHandle,
    operation_id: &str,
    agent: &CuratedAgent,
    url: &str,
    archive_path: &Path,
) -> Result<(), String> {
    emit_agent_progress(
        app,
        operation_id,
        agent.id,
        ExternalAiAgentProgressState::Downloading,
        "Downloading external agent...",
        None,
        None,
        None,
        None,
    );

    let response = reqwest::Client::new()
        .get(url)
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
            agent.id,
            ExternalAiAgentProgressState::Downloading,
            "Downloading external agent...",
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
    target_dir: &Path,
    archive_kind: ArchiveKind,
) -> Result<(), String> {
    let output = match archive_kind {
        ArchiveKind::Tgz => Command::new("tar")
            .arg("-xzf")
            .arg(archive_path)
            .arg("-C")
            .arg(target_dir)
            .output(),
        ArchiveKind::Zip => Command::new("unzip")
            .arg("-q")
            .arg(archive_path)
            .arg("-d")
            .arg(target_dir)
            .output(),
    }
    .map_err(|e| format!("External agent extraction failed: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!(
            "External agent extraction failed: {}",
            stderr.trim()
        ))
    }
}

fn archive_file_name(url: &str) -> Result<&str, String> {
    url.rsplit('/')
        .next()
        .filter(|name| !name.trim().is_empty())
        .ok_or_else(|| format!("External agent archive URL is invalid: {url}"))
}

fn command_relative_path(command: &str) -> Result<PathBuf, String> {
    let trimmed = command.trim();
    let relative = trimmed
        .strip_prefix("./")
        .or_else(|| trimmed.strip_prefix(".\\"))
        .unwrap_or(trimmed);
    let path = Path::new(relative);
    if path.is_absolute() || relative.contains("..") || relative.is_empty() {
        return Err(format!("External agent command path is invalid: {command}"));
    }
    Ok(path.to_path_buf())
}

fn read_npx_manifest(agent_id: &str) -> Result<Option<NpxAgentManifest>, String> {
    let path = npx_manifest_path(agent_id);
    if !path.is_file() {
        return Ok(None);
    }

    let contents = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&contents)
        .map(Some)
        .map_err(|e| format!("External agent manifest is invalid: {e}"))
}

fn npx_manifest_path(agent_id: &str) -> PathBuf {
    agent_dir(agent_id).join("agent.json")
}

fn npx_prefix_dir(agent_id: &str) -> PathBuf {
    external_agent_data_dir()
        .join("registry")
        .join("npx")
        .join(agent_id)
}

fn missing_npm_error(agent: &CuratedAgent, package: &str) -> String {
    format!(
        "npm is required to run the {} ACP adapter package `{}`. Install Node.js/npm or make `npm` available in Gitano's PATH.",
        agent.display_name, package
    )
}

fn npm_missing_error_if_unresolved(
    agent: &CuratedAgent,
    source: CuratedNpxSource,
    dirs: &[PathBuf],
) -> Option<String> {
    if resolve_external_program_from_dirs("npm", dirs).is_some() {
        None
    } else {
        Some(missing_npm_error(agent, source.package))
    }
}

fn unsupported_platform_error(agent: &CuratedAgent) -> String {
    format!(
        "{} is not available for {}-{} through the curated ACP registry.",
        agent.display_name,
        std::env::consts::OS,
        std::env::consts::ARCH
    )
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

fn external_agent_operation_id(agent_id: &str) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    format!("external-ai-{}-{}", agent_id.replace([':', '/'], "-"), now)
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
    permissions.set_mode(permissions.mode() | 0o755);
    fs::set_permissions(path, permissions).map_err(|e| e.to_string())
}

#[cfg(not(unix))]
fn make_executable(_path: &Path) -> Result<(), String> {
    Ok(())
}

fn agent_dir(agent_id: &str) -> PathBuf {
    external_agent_data_dir().join(agent_id)
}

fn external_agent_data_dir() -> PathBuf {
    local_ai_data_dir().join("external-agents")
}

#[cfg(test)]
mod tests {
    use super::catalog::{CODEX_AGENT_ID, COPILOT_AGENT_ID};
    use super::*;

    fn write_fake_command(dir: &Path, name: &str) -> PathBuf {
        write_fake_command_with_body(dir, name, "#!/bin/sh\n")
    }

    fn write_fake_command_with_body(dir: &Path, name: &str, body: &str) -> PathBuf {
        let path = dir.join(external_program_names(name)[0].as_str());
        fs::write(&path, body).expect("write fake command");

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            let mut permissions = fs::metadata(&path)
                .expect("fake command metadata")
                .permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(&path, permissions).expect("fake command permissions");
        }

        path
    }

    struct LocalAiHomeGuard {
        previous_home: Option<std::ffi::OsString>,
    }

    impl LocalAiHomeGuard {
        fn new(path: &Path) -> Self {
            let previous_home = std::env::var_os("GITANO_LOCAL_AI_HOME");
            std::env::set_var("GITANO_LOCAL_AI_HOME", path);
            Self { previous_home }
        }
    }

    impl Drop for LocalAiHomeGuard {
        fn drop(&mut self) {
            match &self.previous_home {
                Some(value) => std::env::set_var("GITANO_LOCAL_AI_HOME", value),
                None => std::env::remove_var("GITANO_LOCAL_AI_HOME"),
            }
        }
    }

    #[cfg(not(windows))]
    #[test]
    fn non_windows_search_dirs_include_platform_fallbacks() {
        let mut dirs = Vec::new();

        push_platform_command_dirs(&mut dirs);

        assert!(dirs.contains(&PathBuf::from("/usr/local/bin")));
        assert!(dirs.contains(&PathBuf::from("/usr/bin")));
        assert!(dirs.contains(&PathBuf::from("/bin")));
    }

    #[cfg(not(windows))]
    #[test]
    fn non_windows_user_dirs_include_shell_manager_locations() {
        let mut dirs = Vec::new();
        let temp_dir = tempfile::tempdir().expect("temp home dir");

        push_user_home_command_dirs(&mut dirs, temp_dir.path());

        assert!(dirs.contains(&temp_dir.path().join(".local/bin")));
        assert!(dirs.contains(&temp_dir.path().join(".volta/bin")));
        assert!(dirs.contains(&temp_dir.path().join(".asdf/shims")));
        assert!(dirs.contains(&temp_dir.path().join(".nvm/current/bin")));
    }

    #[cfg(windows)]
    #[test]
    fn windows_user_dirs_include_common_cli_locations() {
        let mut dirs = Vec::new();
        let home = PathBuf::from(r"C:\Users\gitano");

        push_user_home_command_dirs(&mut dirs, &home);

        assert!(dirs.contains(&home.join(".local").join("bin")));
        assert!(dirs.contains(&home.join("AppData").join("Roaming").join("npm")));
        assert!(dirs.contains(
            &home
                .join("AppData")
                .join("Local")
                .join("Microsoft")
                .join("WindowsApps")
        ));
        assert!(dirs.contains(&home.join("AppData").join("Local").join("Volta").join("bin")));
    }

    #[test]
    fn resolves_npm_from_explicit_search_dirs() {
        let temp_dir = tempfile::tempdir().expect("temp local AI dir");
        let fake_npm = write_fake_command(temp_dir.path(), "npm");

        let resolved = resolve_external_program_from_dirs("npm", &[temp_dir.path().to_path_buf()]);

        assert_eq!(resolved.as_deref(), Some(fake_npm.as_path()));
    }

    #[test]
    fn npx_manifest_marks_agent_installed_when_npm_is_available() {
        let _guard = crate::ai::local_ai_env_lock()
            .lock()
            .expect("lock local AI env");
        let temp_home = tempfile::tempdir().expect("temp local AI dir");
        let _home_guard = LocalAiHomeGuard::new(temp_home.path());
        let npm_dir = tempfile::tempdir().expect("temp npm dir");
        write_fake_command(npm_dir.path(), "npm");
        let agent = find_curated_agent(COPILOT_AGENT_ID).expect("copilot agent");
        let CuratedInstallSource::Npx(source) =
            install_source_for(agent).expect("copilot npx source")
        else {
            panic!("copilot should be npx distributed");
        };
        fs::create_dir_all(agent_dir(agent.id)).expect("agent dir");
        fs::write(
            npx_manifest_path(agent.id),
            serde_json::to_string(&NpxAgentManifest {
                package: source.package.to_string(),
                args: source.args.iter().map(|arg| arg.to_string()).collect(),
            })
            .expect("manifest json"),
        )
        .expect("write manifest");

        let status =
            npx_status_from_dirs(agent, source, &[npm_dir.path().to_path_buf()]).expect("status");

        assert!(status.installed);
        assert!(status.available);
        assert_eq!(status.version.as_deref(), Some(agent.version));
    }

    #[test]
    fn missing_npm_marks_npx_agent_unavailable_with_adapter_error() {
        let _guard = crate::ai::local_ai_env_lock()
            .lock()
            .expect("lock local AI env");
        let temp_home = tempfile::tempdir().expect("temp local AI dir");
        let _home_guard = LocalAiHomeGuard::new(temp_home.path());
        let agent = find_curated_agent(COPILOT_AGENT_ID).expect("copilot agent");
        let CuratedInstallSource::Npx(source) =
            install_source_for(agent).expect("copilot npx source")
        else {
            panic!("copilot should be npx distributed");
        };
        fs::create_dir_all(agent_dir(agent.id)).expect("agent dir");
        fs::write(
            npx_manifest_path(agent.id),
            serde_json::to_string(&NpxAgentManifest {
                package: source.package.to_string(),
                args: vec!["--acp".to_string()],
            })
            .expect("manifest json"),
        )
        .expect("write manifest");

        let status = npx_status_from_dirs(agent, source, &[]).expect("status");

        assert!(status.installed);
        assert!(!status.available);
        assert!(status.error.unwrap().contains("ACP adapter package"));
    }

    #[test]
    fn copilot_command_uses_registry_npm_exec_args() {
        let temp_dir = tempfile::tempdir().expect("temp local AI dir");
        let fake_npm = write_fake_command(temp_dir.path(), "npm");
        let agent = find_curated_agent(COPILOT_AGENT_ID).expect("copilot agent");
        let CuratedInstallSource::Npx(source) =
            install_source_for(agent).expect("copilot npx source")
        else {
            panic!("copilot should be npx distributed");
        };
        let prefix_dir = temp_dir.path().join("prefix");
        let command = npx_external_agent_command_from_source(
            source,
            ResolvedExternalProgram {
                program: fake_npm.clone(),
                path_env: Some(temp_dir.path().to_string_lossy().to_string()),
            },
            prefix_dir.clone(),
        );

        assert_eq!(command.program, fake_npm.to_string_lossy().to_string());
        assert_eq!(
            command.args,
            vec![
                "--prefix".to_string(),
                prefix_dir.to_string_lossy().to_string(),
                "exec".to_string(),
                "--yes".to_string(),
                "--".to_string(),
                "@github/copilot@0.0.0 - 1.0.51".to_string(),
                "--acp".to_string(),
            ]
        );
        let expected_path = temp_dir.path().to_string_lossy().to_string();
        assert_eq!(command.path_env.as_deref(), Some(expected_path.as_str()));
    }

    #[test]
    fn binary_status_uses_registry_version_without_version_probe() {
        let _guard = crate::ai::local_ai_env_lock()
            .lock()
            .expect("lock local AI env");
        let temp_home = tempfile::tempdir().expect("temp local AI dir");
        let _home_guard = LocalAiHomeGuard::new(temp_home.path());
        let agent = find_curated_agent(CODEX_AGENT_ID).expect("codex agent");
        let CuratedInstallSource::Binary(source) =
            install_source_for(agent).expect("codex binary source")
        else {
            return;
        };
        let command_path = binary_command_path(agent, source)
            .expect("command path")
            .expect("command path exists");
        fs::create_dir_all(command_path.parent().expect("command parent")).expect("agent dir");
        write_fake_command_with_body(
            command_path.parent().expect("command parent"),
            command_path.file_name().unwrap().to_string_lossy().as_ref(),
            "#!/bin/sh\nexit 42\n",
        );

        let status = binary_status(agent, source).expect("status");

        assert!(status.installed);
        assert!(status.available);
        assert_eq!(status.version.as_deref(), Some("0.14.0"));
    }

    #[test]
    fn removing_selected_agent_clears_engine_preference() {
        let _guard = crate::ai::local_ai_env_lock()
            .lock()
            .expect("lock local AI env");
        let temp_dir = tempfile::tempdir().expect("temp local AI dir");
        let _home_guard = LocalAiHomeGuard::new(temp_dir.path());

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
    }
}
