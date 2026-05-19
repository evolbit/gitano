use super::models::{find_model, managed_ollama_model_dir, model_catalog};
use super::types::{
    LocalAiCompatibility, LocalAiCompatibilityLevel, LocalAiMachineProfile, LocalAiModelEntry,
    LocalAiRuntimeStatus,
};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;

pub fn machine_profile() -> LocalAiMachineProfile {
    let storage_path = model_storage_path();

    LocalAiMachineProfile {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        cpu_count: thread::available_parallelism()
            .map(|count| count.get())
            .unwrap_or(1),
        total_memory_gb: total_memory_gb(),
        available_memory_gb: available_memory_gb(),
        model_storage_free_disk_gb: free_disk_gb(&storage_path),
        model_storage_path: storage_path.to_string_lossy().to_string(),
    }
}

pub fn model_storage_path() -> PathBuf {
    if let Ok(path) = std::env::var("OLLAMA_MODELS") {
        return PathBuf::from(path);
    }

    managed_ollama_model_dir()
}

fn bytes_to_gb(bytes: u64) -> f64 {
    bytes as f64 / 1024.0 / 1024.0 / 1024.0
}

fn parse_first_u64(value: &str) -> Option<u64> {
    value
        .split_whitespace()
        .find_map(|part| part.parse::<u64>().ok())
}

fn total_memory_gb() -> Option<f64> {
    match std::env::consts::OS {
        "macos" => Command::new("sysctl")
            .args(["-n", "hw.memsize"])
            .output()
            .ok()
            .and_then(|output| {
                if output.status.success() {
                    parse_first_u64(&String::from_utf8_lossy(&output.stdout)).map(bytes_to_gb)
                } else {
                    None
                }
            }),
        "linux" => fs::read_to_string("/proc/meminfo")
            .ok()
            .and_then(|contents| {
                contents
                    .lines()
                    .find(|line| line.starts_with("MemTotal:"))
                    .and_then(parse_first_u64)
                    .map(|kb| bytes_to_gb(kb * 1024))
            }),
        "windows" => Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory",
            ])
            .output()
            .ok()
            .and_then(|output| {
                if output.status.success() {
                    parse_first_u64(&String::from_utf8_lossy(&output.stdout)).map(bytes_to_gb)
                } else {
                    None
                }
            }),
        _ => None,
    }
}

fn available_memory_gb() -> Option<f64> {
    match std::env::consts::OS {
        "linux" => fs::read_to_string("/proc/meminfo")
            .ok()
            .and_then(|contents| {
                contents
                    .lines()
                    .find(|line| line.starts_with("MemAvailable:"))
                    .and_then(parse_first_u64)
                    .map(|kb| bytes_to_gb(kb * 1024))
            }),
        "macos" | "windows" => None,
        _ => None,
    }
}

fn nearest_existing_path(path: &Path) -> PathBuf {
    let mut current = path.to_path_buf();
    while !current.exists() {
        if !current.pop() {
            return PathBuf::from(".");
        }
    }
    current
}

fn free_disk_gb(path: &Path) -> Option<f64> {
    let existing = nearest_existing_path(path);

    match std::env::consts::OS {
        "windows" => Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!(
                    "(Get-PSDrive -Name '{}').Free",
                    existing
                        .components()
                        .next()
                        .map(|component| component.as_os_str().to_string_lossy().replace(':', ""))
                        .unwrap_or_else(|| "C".to_string())
                ),
            ])
            .output()
            .ok()
            .and_then(|output| {
                if output.status.success() {
                    parse_first_u64(&String::from_utf8_lossy(&output.stdout)).map(bytes_to_gb)
                } else {
                    None
                }
            }),
        _ => Command::new("df")
            .arg("-k")
            .arg(existing)
            .output()
            .ok()
            .and_then(|output| {
                if !output.status.success() {
                    return None;
                }

                let stdout = String::from_utf8_lossy(&output.stdout);
                stdout.lines().nth(1).and_then(|line| {
                    let columns: Vec<&str> = line.split_whitespace().collect();
                    columns
                        .get(3)
                        .and_then(|value| value.parse::<u64>().ok())
                        .map(|kb| bytes_to_gb(kb * 1024))
                })
            }),
    }
}

pub fn compatibility_for_model(
    model_id: &str,
    machine: LocalAiMachineProfile,
    runtime: LocalAiRuntimeStatus,
) -> Result<LocalAiCompatibility, String> {
    let model =
        find_model(model_id).ok_or_else(|| format!("Unsupported local AI model: {}", model_id))?;

    Ok(evaluate_compatibility(&model, machine, runtime))
}

pub fn evaluate_compatibility(
    model: &LocalAiModelEntry,
    machine: LocalAiMachineProfile,
    runtime: LocalAiRuntimeStatus,
) -> LocalAiCompatibility {
    let mut reasons = Vec::new();
    let mut level = LocalAiCompatibilityLevel::Compatible;
    let mut blocking = false;

    if !runtime.available {
        reasons.push(
            runtime
                .error
                .clone()
                .unwrap_or_else(|| "Ollama runtime is unavailable.".to_string()),
        );
        level = LocalAiCompatibilityLevel::RuntimeUnavailable;
        blocking = true;
    }

    if let Some(free_disk_gb) = machine.model_storage_free_disk_gb {
        if free_disk_gb < model.min_requirements.min_disk_free_gb {
            reasons.push(format!(
                "{} requires at least {:.1}GB free disk in local AI model storage; {:.1}GB is available.",
                model.display_name, model.min_requirements.min_disk_free_gb, free_disk_gb
            ));
            level = LocalAiCompatibilityLevel::InsufficientDisk;
            blocking = true;
        } else if free_disk_gb < model.recommended_requirements.recommended_disk_free_gb
            && !matches!(
                level,
                LocalAiCompatibilityLevel::RuntimeUnavailable
                    | LocalAiCompatibilityLevel::InsufficientDisk
            )
        {
            reasons.push(format!(
                "{} works best with {:.1}GB free disk in local AI model storage; {:.1}GB is available.",
                model.display_name,
                model.recommended_requirements.recommended_disk_free_gb,
                free_disk_gb
            ));
            level = LocalAiCompatibilityLevel::Limited;
        }
    }

    if let Some(total_memory_gb) = machine.total_memory_gb {
        if total_memory_gb < model.min_requirements.min_memory_gb
            && !matches!(
                level,
                LocalAiCompatibilityLevel::RuntimeUnavailable
                    | LocalAiCompatibilityLevel::InsufficientDisk
            )
        {
            reasons.push(format!(
                "{} may be too large for {:.1}GB memory; minimum guidance is {:.1}GB.",
                model.display_name, total_memory_gb, model.min_requirements.min_memory_gb
            ));
            level = LocalAiCompatibilityLevel::LikelyTooLarge;
        } else if total_memory_gb < model.recommended_requirements.recommended_memory_gb
            && matches!(level, LocalAiCompatibilityLevel::Compatible)
        {
            reasons.push(format!(
                "{} may run slowly on {:.1}GB memory; recommended memory is {:.1}GB.",
                model.display_name,
                total_memory_gb,
                model.recommended_requirements.recommended_memory_gb
            ));
            level = LocalAiCompatibilityLevel::Limited;
        }
    }

    let recommended_model_id = if matches!(
        level,
        LocalAiCompatibilityLevel::Limited | LocalAiCompatibilityLevel::LikelyTooLarge
    ) {
        smaller_compatible_model_id(model, &machine)
    } else {
        None
    };

    LocalAiCompatibility {
        model_id: model.id.clone(),
        level,
        blocking,
        reasons,
        recommended_model_id,
        machine,
    }
}

fn smaller_compatible_model_id(
    selected: &LocalAiModelEntry,
    machine: &LocalAiMachineProfile,
) -> Option<String> {
    model_catalog()
        .into_iter()
        .filter(|candidate| candidate.download_size_gb < selected.download_size_gb)
        .find(|candidate| {
            let memory_ok = machine
                .total_memory_gb
                .map(|gb| gb >= candidate.min_requirements.min_memory_gb)
                .unwrap_or(true);
            let disk_ok = machine
                .model_storage_free_disk_gb
                .map(|gb| gb >= candidate.min_requirements.min_disk_free_gb)
                .unwrap_or(true);
            memory_ok && disk_ok
        })
        .map(|candidate| candidate.id)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn profile(memory: f64, disk: f64) -> LocalAiMachineProfile {
        LocalAiMachineProfile {
            os: "test".to_string(),
            arch: "test".to_string(),
            cpu_count: 8,
            total_memory_gb: Some(memory),
            available_memory_gb: None,
            model_storage_path: "/tmp".to_string(),
            model_storage_free_disk_gb: Some(disk),
        }
    }

    fn runtime(available: bool) -> LocalAiRuntimeStatus {
        LocalAiRuntimeStatus {
            available,
            endpoint: "http://127.0.0.1:11434".to_string(),
            error: if available {
                None
            } else {
                Some("not running".to_string())
            },
        }
    }

    #[test]
    fn blocks_when_runtime_is_unavailable() {
        let model = find_model("qwen2.5-coder:7b").unwrap();
        let result = evaluate_compatibility(&model, profile(32.0, 32.0), runtime(false));

        assert_eq!(result.level, LocalAiCompatibilityLevel::RuntimeUnavailable);
        assert!(result.blocking);
    }

    #[test]
    fn blocks_when_disk_is_below_minimum() {
        let model = find_model("qwen2.5-coder:7b").unwrap();
        let result = evaluate_compatibility(&model, profile(32.0, 2.0), runtime(true));

        assert_eq!(result.level, LocalAiCompatibilityLevel::InsufficientDisk);
        assert!(result.blocking);
    }

    #[test]
    fn warns_when_model_is_likely_too_large() {
        let model = find_model("qwen2.5-coder:14b").unwrap();
        let result = evaluate_compatibility(&model, profile(16.0, 32.0), runtime(true));

        assert_eq!(result.level, LocalAiCompatibilityLevel::LikelyTooLarge);
        assert!(!result.blocking);
        assert_eq!(
            result.recommended_model_id,
            Some("qwen2.5-coder:1.5b".to_string())
        );
    }
}
