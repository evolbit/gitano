use std::process::Command;

const SERVICE_PREFIX: &str = "gitano.provider";

fn service_name(provider_id: &str) -> String {
    format!("{}.{}.token", SERVICE_PREFIX, provider_id)
}

fn credential_error(action: &str, provider_id: &str, stderr: &[u8]) -> String {
    let details = String::from_utf8_lossy(stderr).trim().to_string();
    if details.is_empty() {
        format!("Could not {} credential for {}.", action, provider_id)
    } else {
        format!(
            "Could not {} credential for {}: {}",
            action, provider_id, details
        )
    }
}

#[cfg(target_os = "macos")]
fn run_security(args: &[&str]) -> Result<Vec<u8>, String> {
    let output = Command::new("security")
        .args(args)
        .output()
        .map_err(|error| format!("macOS Keychain command failed: {}", error))?;

    if output.status.success() {
        Ok(output.stdout)
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

#[cfg(target_os = "macos")]
pub fn store_provider_token(provider_id: &str, token: &str) -> Result<(), String> {
    run_security(&[
        "add-generic-password",
        "-a",
        provider_id,
        "-s",
        &service_name(provider_id),
        "-w",
        token,
        "-U",
    ])
    .map(|_| ())
    .map_err(|error| {
        if error.is_empty() {
            format!("Could not store credential for {}.", provider_id)
        } else {
            format!("Could not store credential for {}: {}", provider_id, error)
        }
    })
}

#[cfg(target_os = "macos")]
pub fn read_provider_token(provider_id: &str) -> Result<String, String> {
    let output = run_security(&[
        "find-generic-password",
        "-a",
        provider_id,
        "-s",
        &service_name(provider_id),
        "-w",
    ])
    .map_err(|error| {
        if error.is_empty() {
            format!("No credential is stored for {}.", provider_id)
        } else {
            format!("Could not read credential for {}: {}", provider_id, error)
        }
    })?;

    Ok(String::from_utf8_lossy(&output).trim().to_string())
}

#[cfg(target_os = "macos")]
pub fn has_provider_token(provider_id: &str) -> Result<bool, String> {
    match read_provider_token(provider_id) {
        Ok(token) => Ok(!token.trim().is_empty()),
        Err(error) if error.contains("could not be found") || error.contains("No credential") => {
            Ok(false)
        }
        Err(error) => Err(error),
    }
}

#[cfg(target_os = "macos")]
pub fn delete_provider_token(provider_id: &str) -> Result<(), String> {
    let output = Command::new("security")
        .args([
            "delete-generic-password",
            "-a",
            provider_id,
            "-s",
            &service_name(provider_id),
        ])
        .output()
        .map_err(|error| format!("macOS Keychain command failed: {}", error))?;

    if output.status.success() {
        Ok(())
    } else {
        let details = String::from_utf8_lossy(&output.stderr);
        if details.contains("could not be found") {
            Ok(())
        } else {
            Err(credential_error("delete", provider_id, &output.stderr))
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn store_provider_token(provider_id: &str, _token: &str) -> Result<(), String> {
    Err(unsupported_storage_error(provider_id))
}

#[cfg(not(target_os = "macos"))]
pub fn read_provider_token(provider_id: &str) -> Result<String, String> {
    Err(unsupported_storage_error(provider_id))
}

#[cfg(not(target_os = "macos"))]
pub fn has_provider_token(provider_id: &str) -> Result<bool, String> {
    Err(unsupported_storage_error(provider_id))
}

#[cfg(not(target_os = "macos"))]
pub fn delete_provider_token(provider_id: &str) -> Result<(), String> {
    Err(unsupported_storage_error(provider_id))
}

#[cfg(not(target_os = "macos"))]
fn unsupported_storage_error(provider_id: &str) -> String {
    format!(
        "Secure credential storage is not available for {} on this platform yet.",
        provider_id
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn service_name_is_provider_scoped() {
        assert_eq!(service_name("github"), "gitano.provider.github.token");
    }
}
