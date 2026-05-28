use crate::platform::resolve_external_program;
use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GhCommand {
    pub args: Vec<String>,
    pub stdin: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GhOutput {
    pub status_success: bool,
    pub stdout: String,
    pub stderr: String,
}

pub trait GhRunner {
    fn run(&self, cwd: Option<&Path>, command: &GhCommand) -> Result<GhOutput, String>;
}

pub struct ProcessGhRunner;

impl GhRunner for ProcessGhRunner {
    fn run(&self, cwd: Option<&Path>, command: &GhCommand) -> Result<GhOutput, String> {
        let resolved = resolve_external_program("gh").ok_or_else(|| {
            "GitHub CLI is not installed or could not be started. Install gh or make it available in Gitano's PATH.".to_string()
        })?;
        let mut process = Command::new(&resolved.program);
        if let Some(path_env) = &resolved.path_env {
            process.env("PATH", path_env);
        }
        process.args(&command.args);
        if let Some(cwd) = cwd {
            process.current_dir(cwd);
        }
        if command.stdin.is_some() {
            process.stdin(Stdio::piped());
        }
        process.stdout(Stdio::piped()).stderr(Stdio::piped());

        let mut child = process.spawn().map_err(|error| {
            format!(
                "GitHub CLI is not installed or could not be started: {}",
                error
            )
        })?;

        if let Some(stdin) = &command.stdin {
            let mut child_stdin = child
                .stdin
                .take()
                .ok_or_else(|| "GitHub CLI stdin could not be opened.".to_string())?;
            child_stdin
                .write_all(stdin.as_bytes())
                .map_err(|error| format!("GitHub CLI stdin could not be written: {}", error))?;
        }

        let output = child
            .wait_with_output()
            .map_err(|error| format!("GitHub CLI failed to finish: {}", error))?;

        Ok(GhOutput {
            status_success: output.status.success(),
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        })
    }
}
