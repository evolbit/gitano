use std::process::Command;

#[tauri::command]
pub async fn git_push(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let output = Command::new("git")
            .arg("-C")
            .arg(&path)
            .arg("push")
            .output()
            .map_err(|e| e.to_string())?;
        if !output.status.success() {
            return Err(format!(
                "git push failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_fetch(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let output = Command::new("git")
            .arg("-C")
            .arg(&path)
            .arg("fetch")
            .arg("--all")
            .output()
            .map_err(|e| e.to_string())?;
        if !output.status.success() {
            return Err(format!(
                "git fetch failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_pull(path: String, strategy: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = Command::new("git");
        cmd.arg("-C").arg(&path).arg("pull");

        match strategy.as_str() {
            "pull-ff-only" => {
                cmd.arg("--ff-only");
            }
            "pull-rebase" => {
                cmd.arg("--rebase");
            }
            "pull-ff-if-possible" => {}
            other => {
                return Err(format!("Unsupported pull strategy: {}", other));
            }
        }

        let output = cmd.output().map_err(|e| e.to_string())?;
        if !output.status.success() {
            return Err(format!(
                "git pull failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unknown_pull_strategies_before_running_git() {
        let result = tauri::async_runtime::block_on(git_pull(
            "/repo".to_string(),
            "pull-octopus".to_string(),
        ));

        assert_eq!(
            result,
            Err("Unsupported pull strategy: pull-octopus".to_string())
        );
    }
}
