use super::models::{managed_ollama_model_dir, managed_ollama_runtime_dir};
use super::types::{LocalAiDownloadProgress, LocalAiProgressState, LOCAL_AI_PROGRESS_EVENT};
use futures_util::StreamExt;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

const MANAGED_OLLAMA_ENDPOINT: &str = "http://127.0.0.1:11435";

static MANAGED_OLLAMA_CHILD: OnceLock<Mutex<Option<Child>>> = OnceLock::new();

#[derive(Clone, Copy)]
enum ArchiveKind {
    Tgz,
    Zip,
}

struct RuntimePackage {
    url: &'static str,
    archive_name: &'static str,
    archive_kind: ArchiveKind,
}

pub fn ollama_endpoint() -> String {
    std::env::var("OLLAMA_HOST").unwrap_or_else(|_| MANAGED_OLLAMA_ENDPOINT.to_string())
}

pub fn using_external_ollama() -> bool {
    std::env::var("OLLAMA_HOST").is_ok()
}

pub fn managed_runtime_binary_path() -> Option<PathBuf> {
    find_ollama_binary(&managed_ollama_runtime_dir())
}

pub async fn ensure_runtime_ready(
    app: &AppHandle,
    operation_id: &str,
    model_id: &str,
) -> Result<(), String> {
    if using_external_ollama() {
        emit_runtime_progress(
            app,
            operation_id,
            model_id,
            LocalAiProgressState::StartingRuntime,
            "Using configured runtime...",
            None,
            None,
            None,
        );
        wait_for_runtime_ready(&ollama_endpoint(), Duration::from_secs(10)).await?;
        return Ok(());
    }

    if managed_runtime_binary_path().is_none() {
        install_managed_runtime(app, operation_id, model_id).await?;
    }

    if endpoint_available(&ollama_endpoint()).await {
        emit_runtime_progress(
            app,
            operation_id,
            model_id,
            LocalAiProgressState::StartingRuntime,
            "Runtime already running...",
            None,
            None,
            None,
        );
        return Ok(());
    }

    emit_runtime_progress(
        app,
        operation_id,
        model_id,
        LocalAiProgressState::StartingRuntime,
        "Starting runtime...",
        None,
        None,
        None,
    );
    start_managed_runtime_process()?;
    wait_for_runtime_ready(&ollama_endpoint(), Duration::from_secs(60)).await
}

pub async fn start_managed_runtime_if_installed() -> Result<(), String> {
    if using_external_ollama() || endpoint_available(&ollama_endpoint()).await {
        return Ok(());
    }

    if managed_runtime_binary_path().is_some() {
        start_managed_runtime_process()?;
        wait_for_runtime_ready(&ollama_endpoint(), Duration::from_secs(30)).await?;
    }

    Ok(())
}

pub async fn prepare_managed_runtime(
    app: &AppHandle,
    operation_id: &str,
    force_reinstall: bool,
) -> Result<(), String> {
    if using_external_ollama() {
        return Err("Runtime is controlled by the configured OLLAMA_HOST.".to_string());
    }

    runtime_package()?;

    if force_reinstall {
        stop_managed_runtime_process()?;
        let runtime_dir = managed_ollama_runtime_dir();
        if runtime_dir.exists() {
            fs::remove_dir_all(&runtime_dir).map_err(|e| {
                format!(
                    "Local AI runtime upgrade could not remove old runtime: {}",
                    e
                )
            })?;
        }
    }

    if managed_runtime_binary_path().is_none() {
        install_managed_runtime(app, operation_id, "runtime").await?;
    } else {
        emit_runtime_progress(
            app,
            operation_id,
            "runtime",
            LocalAiProgressState::InstallingRuntime,
            "Runtime already installed...",
            None,
            None,
            None,
        );
    }

    if !endpoint_available(&ollama_endpoint()).await {
        emit_runtime_progress(
            app,
            operation_id,
            "runtime",
            LocalAiProgressState::StartingRuntime,
            "Starting runtime...",
            None,
            None,
            None,
        );
        start_managed_runtime_process()?;
        wait_for_runtime_ready(&ollama_endpoint(), Duration::from_secs(60)).await?;
    }

    emit_runtime_progress(
        app,
        operation_id,
        "runtime",
        LocalAiProgressState::Completed,
        "Runtime ready",
        None,
        None,
        Some(100.0),
    );

    Ok(())
}

pub fn managed_runtime_supported() -> bool {
    runtime_package().is_ok()
}

pub fn latest_compatible_runtime_version() -> String {
    "Latest compatible".to_string()
}

pub fn managed_runtime_version() -> Option<String> {
    let binary_path = managed_runtime_binary_path()?;
    let output = Command::new(binary_path).arg("--version").output().ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() {
        None
    } else {
        Some(stdout)
    }
}

async fn install_managed_runtime(
    app: &AppHandle,
    operation_id: &str,
    model_id: &str,
) -> Result<(), String> {
    let package = runtime_package()?;
    let runtime_dir = managed_ollama_runtime_dir();
    fs::create_dir_all(&runtime_dir).map_err(|e| e.to_string())?;
    let archive_path = runtime_dir.join(package.archive_name);

    download_archive(app, operation_id, model_id, package.url, &archive_path).await?;
    emit_runtime_progress(
        app,
        operation_id,
        model_id,
        LocalAiProgressState::InstallingRuntime,
        "Installing runtime...",
        None,
        None,
        None,
    );
    extract_archive(&archive_path, &runtime_dir, package.archive_kind)?;
    let _ = fs::remove_file(&archive_path);

    let binary_path = managed_runtime_binary_path()
        .ok_or_else(|| "Local AI runtime download did not contain an Ollama binary.".to_string())?;
    make_executable(&binary_path)?;

    Ok(())
}

async fn download_archive(
    app: &AppHandle,
    operation_id: &str,
    model_id: &str,
    url: &str,
    archive_path: &Path,
) -> Result<(), String> {
    emit_runtime_progress(
        app,
        operation_id,
        model_id,
        LocalAiProgressState::InstallingRuntime,
        "Downloading runtime...",
        None,
        None,
        None,
    );

    let response = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Local AI runtime download failed: {}", e))?
        .error_for_status()
        .map_err(|e| format!("Local AI runtime download failed: {}", e))?;
    let total_bytes = response.content_length();
    let mut completed_bytes = 0_u64;
    let mut file = File::create(archive_path).map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Local AI runtime download failed: {}", e))?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        completed_bytes += chunk.len() as u64;
        let percentage = total_bytes
            .filter(|total| *total > 0)
            .map(|total| ((completed_bytes as f64 / total as f64) * 100.0).clamp(0.0, 100.0));

        emit_runtime_progress(
            app,
            operation_id,
            model_id,
            LocalAiProgressState::InstallingRuntime,
            "Downloading runtime...",
            Some(completed_bytes),
            total_bytes,
            percentage,
        );
    }

    Ok(())
}

fn extract_archive(
    archive_path: &Path,
    runtime_dir: &Path,
    archive_kind: ArchiveKind,
) -> Result<(), String> {
    let output = match archive_kind {
        ArchiveKind::Tgz => Command::new("tar")
            .arg("-xzf")
            .arg(archive_path)
            .arg("-C")
            .arg(runtime_dir)
            .output(),
        ArchiveKind::Zip => Command::new("unzip")
            .arg("-q")
            .arg(archive_path)
            .arg("-d")
            .arg(runtime_dir)
            .output(),
    }
    .map_err(|e| format!("Local AI runtime extraction failed: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!(
            "Local AI runtime extraction failed: {}",
            stderr.trim()
        ))
    }
}

fn runtime_package() -> Result<RuntimePackage, String> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", _) => Ok(RuntimePackage {
            url: "https://ollama.com/download/Ollama-darwin.zip",
            archive_name: "Ollama-darwin.zip",
            archive_kind: ArchiveKind::Zip,
        }),
        ("linux", "x86_64") => Ok(RuntimePackage {
            url: "https://ollama.com/download/ollama-linux-amd64.tgz",
            archive_name: "ollama-linux-amd64.tgz",
            archive_kind: ArchiveKind::Tgz,
        }),
        ("linux", "aarch64") => Ok(RuntimePackage {
            url: "https://ollama.com/download/ollama-linux-arm64.tgz",
            archive_name: "ollama-linux-arm64.tgz",
            archive_kind: ArchiveKind::Tgz,
        }),
        (os, arch) => Err(format!(
            "Gitano-managed local AI runtime is not available for {} {} yet.",
            os, arch
        )),
    }
}

fn start_managed_runtime_process() -> Result<(), String> {
    let binary_path = managed_runtime_binary_path()
        .ok_or_else(|| "Local AI runtime is not installed yet.".to_string())?;
    let child_lock = MANAGED_OLLAMA_CHILD.get_or_init(|| Mutex::new(None));
    let mut child_guard = child_lock.lock().map_err(|e| e.to_string())?;

    if let Some(child) = child_guard.as_mut() {
        if child.try_wait().map_err(|e| e.to_string())?.is_none() {
            return Ok(());
        }
    }

    fs::create_dir_all(managed_ollama_model_dir()).map_err(|e| e.to_string())?;
    let child = Command::new(binary_path)
        .arg("serve")
        .env("OLLAMA_HOST", ollama_bind_address())
        .env("OLLAMA_MODELS", managed_ollama_model_dir())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Local AI runtime could not be started: {}", e))?;

    *child_guard = Some(child);

    Ok(())
}

fn stop_managed_runtime_process() -> Result<(), String> {
    let child_lock = MANAGED_OLLAMA_CHILD.get_or_init(|| Mutex::new(None));
    let mut child_guard = child_lock.lock().map_err(|e| e.to_string())?;

    if let Some(child) = child_guard.as_mut() {
        if child.try_wait().map_err(|e| e.to_string())?.is_none() {
            child.kill().map_err(|e| e.to_string())?;
            let _ = child.wait();
        }
    }

    *child_guard = None;
    Ok(())
}

async fn wait_for_runtime_ready(endpoint: &str, timeout: Duration) -> Result<(), String> {
    let start = Instant::now();

    while start.elapsed() < timeout {
        if endpoint_available(endpoint).await {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(500));
    }

    Err(format!(
        "Local AI runtime did not become ready at {} within {} seconds.",
        endpoint,
        timeout.as_secs()
    ))
}

async fn endpoint_available(endpoint: &str) -> bool {
    let Ok(client) = reqwest::Client::builder()
        .timeout(Duration::from_secs(1))
        .build()
    else {
        return false;
    };
    let url = format!("{}/api/tags", endpoint.trim_end_matches('/'));

    client
        .get(url)
        .send()
        .await
        .map(|response| response.status().is_success())
        .unwrap_or(false)
}

fn ollama_bind_address() -> String {
    ollama_endpoint()
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .trim_end_matches('/')
        .to_string()
}

fn find_ollama_binary(root: &Path) -> Option<PathBuf> {
    let mut stack = vec![root.to_path_buf()];

    while let Some(path) = stack.pop() {
        let entries = fs::read_dir(path).ok()?;
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
                continue;
            }

            let file_name = path.file_name().and_then(|name| name.to_str());
            if matches!(file_name, Some("ollama") | Some("ollama.exe")) {
                return Some(path);
            }
        }
    }

    None
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

fn emit_runtime_progress(
    app: &AppHandle,
    operation_id: &str,
    model_id: &str,
    state: LocalAiProgressState,
    status: &str,
    completed_bytes: Option<u64>,
    total_bytes: Option<u64>,
    percentage: Option<f64>,
) {
    let _ = app.emit(
        LOCAL_AI_PROGRESS_EVENT,
        LocalAiDownloadProgress {
            operation_id: operation_id.to_string(),
            model_id: model_id.to_string(),
            state,
            status: status.to_string(),
            completed_bytes,
            total_bytes,
            percentage,
            error: None,
        },
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_endpoint_is_gitano_managed() {
        std::env::remove_var("OLLAMA_HOST");

        assert_eq!(ollama_endpoint(), MANAGED_OLLAMA_ENDPOINT);
    }

    #[test]
    fn bind_address_removes_scheme() {
        std::env::set_var("OLLAMA_HOST", "http://127.0.0.1:11435");

        assert_eq!(ollama_bind_address(), "127.0.0.1:11435");

        std::env::remove_var("OLLAMA_HOST");
    }
}
