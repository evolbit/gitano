use std::fs;
use std::path::Path;
use std::process::Command;

#[tauri::command]
pub fn git_add_file(path: String, file_path: String) -> Result<(), String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("add")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        return Ok(());
    }

    let full_path = Path::new(&path).join(&file_path);
    if !full_path.exists() {
        let remove_cached_output = Command::new("git")
            .arg("-C")
            .arg(&path)
            .arg("rm")
            .arg("--cached")
            .arg("--ignore-unmatch")
            .arg("--quiet")
            .arg("--")
            .arg(&file_path)
            .output()
            .map_err(|e| e.to_string())?;

        if remove_cached_output.status.success() {
            return Ok(());
        }

        let add_all_output = Command::new("git")
            .arg("-C")
            .arg(&path)
            .arg("add")
            .arg("-A")
            .arg("--")
            .arg(&file_path)
            .output()
            .map_err(|e| e.to_string())?;

        if add_all_output.status.success() {
            return Ok(());
        }

        let update_output = Command::new("git")
            .arg("-C")
            .arg(&path)
            .arg("add")
            .arg("-u")
            .arg("--")
            .arg(&file_path)
            .output()
            .map_err(|e| e.to_string())?;

        if update_output.status.success() {
            return Ok(());
        }

        return Err(format!(
            "git add failed: {}\ngit rm --cached failed: {}\ngit add -A failed: {}\ngit add -u failed: {}",
            String::from_utf8_lossy(&output.stderr),
            String::from_utf8_lossy(&remove_cached_output.stderr),
            String::from_utf8_lossy(&add_all_output.stderr),
            String::from_utf8_lossy(&update_output.stderr)
        ));
    }

    Err(format!(
        "git add failed: {}",
        String::from_utf8_lossy(&output.stderr)
    ))
}

#[tauri::command]
pub fn git_stage_all(path: String) -> Result<(), String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("add")
        .arg("-A")
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        return Ok(());
    }

    Err(format!(
        "git add -A failed: {}",
        String::from_utf8_lossy(&output.stderr)
    ))
}

#[tauri::command]
pub fn git_unstage_file(path: String, file_path: String) -> Result<(), String> {
    let restore_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("restore")
        .arg("--staged")
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    if restore_output.status.success() {
        return Ok(());
    }

    let reset_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("reset")
        .arg("HEAD")
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    if reset_output.status.success() {
        return Ok(());
    }

    let remove_cached_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("rm")
        .arg("--cached")
        .arg("--quiet")
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    if remove_cached_output.status.success() {
        return Ok(());
    }

    Err(format!(
        "git unstage failed:\nrestore: {}\nreset: {}\nrm --cached: {}",
        String::from_utf8_lossy(&restore_output.stderr),
        String::from_utf8_lossy(&reset_output.stderr),
        String::from_utf8_lossy(&remove_cached_output.stderr)
    ))
}

#[tauri::command]
pub fn git_unstage_all(path: String) -> Result<(), String> {
    let restore_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("restore")
        .arg("--staged")
        .arg("--")
        .arg(".")
        .output()
        .map_err(|e| e.to_string())?;

    if restore_output.status.success() {
        return Ok(());
    }

    let reset_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("reset")
        .arg("HEAD")
        .arg("--")
        .arg(".")
        .output()
        .map_err(|e| e.to_string())?;

    if reset_output.status.success() {
        return Ok(());
    }

    Err(format!(
        "git unstage all failed:\nrestore: {}\nreset: {}",
        String::from_utf8_lossy(&restore_output.stderr),
        String::from_utf8_lossy(&reset_output.stderr)
    ))
}

#[tauri::command]
pub fn git_has_staged_changes(path: String) -> Result<bool, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("diff")
        .arg("--cached")
        .arg("--quiet")
        .arg("--exit-code")
        .output()
        .map_err(|e| e.to_string())?;

    match output.status.code() {
        Some(0) => Ok(false),
        Some(1) => Ok(true),
        _ => Err(format!(
            "git diff --cached failed: {}",
            String::from_utf8_lossy(&output.stderr)
        )),
    }
}

#[tauri::command]
pub fn git_discard_file_changes(path: String, file_path: String) -> Result<(), String> {
    let restore_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("restore")
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    if restore_output.status.success() {
        return Ok(());
    }

    let checkout_output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .arg("checkout")
        .arg("--")
        .arg(&file_path)
        .output()
        .map_err(|e| e.to_string())?;

    if checkout_output.status.success() {
        return Ok(());
    }

    Err(format!(
        "git discard failed:\nrestore: {}\ncheckout: {}",
        String::from_utf8_lossy(&restore_output.stderr),
        String::from_utf8_lossy(&checkout_output.stderr)
    ))
}

#[tauri::command]
pub fn trash_untracked_file(path: String, file_path: String) -> Result<(), String> {
    let full_path = Path::new(&path).join(&file_path);

    if !full_path.exists() {
        return Ok(());
    }

    if full_path.is_dir() {
        fs::remove_dir_all(&full_path).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(&full_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}
