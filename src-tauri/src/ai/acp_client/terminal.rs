use super::super::types::{ExternalAiPromptRequest, ExternalAiRunEventKind};
use super::emit_external_run_event;
use serde_json::{json, Value};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::AppHandle;

const DEFAULT_TERMINAL_OUTPUT_LIMIT: usize = 256_000;
const MAX_TERMINAL_OUTPUT_LIMIT: usize = 1_048_576;
pub(super) const SANITIZED_GIT_CONFIG_ARGS: &[&str] = &[
    "-c",
    "diff.external=",
    "-c",
    "core.pager=cat",
    "-c",
    "color.ui=false",
];

pub(super) struct TerminalSession {
    pub(super) child: Child,
    pub(super) output: Arc<Mutex<TerminalOutput>>,
}

#[derive(Default)]
pub(super) struct TerminalOutput {
    pub(super) text: String,
    pub(super) truncated: bool,
}

pub(super) struct PreparedTerminalCommand {
    pub(super) program: String,
    pub(super) args: Vec<String>,
    pub(super) display: String,
}

pub(super) struct TerminalCreateRequest {
    pub(super) command: String,
    pub(super) args: Vec<String>,
    pub(super) cwd: PathBuf,
    output_limit: usize,
}

pub(super) fn terminal_id_param(params: &Value) -> Result<String, String> {
    params
        .get("terminalId")
        .and_then(Value::as_str)
        .map(ToString::to_string)
        .ok_or_else(|| "External agent terminal request did not include a terminal id.".to_string())
}

pub(super) fn terminal_try_exit_status(terminal: &mut TerminalSession) -> Value {
    match terminal.child.try_wait() {
        Ok(Some(status)) => json!({
            "exitCode": status.code(),
            "signal": Value::Null,
        }),
        Ok(None) | Err(_) => Value::Null,
    }
}

pub(super) fn terminal_output_snapshot(output: &Arc<Mutex<TerminalOutput>>) -> TerminalOutput {
    let Ok(output) = output.lock() else {
        return TerminalOutput::default();
    };

    TerminalOutput {
        text: output.text.clone(),
        truncated: output.truncated,
    }
}

pub(super) fn parse_terminal_create_request(
    params: &Value,
    repo_root: &Path,
) -> Result<TerminalCreateRequest, String> {
    let command = params
        .get("command")
        .and_then(Value::as_str)
        .ok_or_else(|| "External agent terminal request did not include a command.".to_string())?
        .to_string();
    let args = params
        .get("args")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(ToString::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let cwd = params
        .get("cwd")
        .and_then(Value::as_str)
        .map(PathBuf::from)
        .unwrap_or_else(|| repo_root.to_path_buf());
    let cwd =
        fs::canonicalize(&cwd).map_err(|e| format!("Could not resolve terminal cwd: {}", e))?;
    let output_limit = params
        .get("outputByteLimit")
        .and_then(Value::as_u64)
        .map(|value| (value as usize).clamp(1, MAX_TERMINAL_OUTPUT_LIMIT))
        .unwrap_or(DEFAULT_TERMINAL_OUTPUT_LIMIT);

    Ok(TerminalCreateRequest {
        command,
        args,
        cwd,
        output_limit,
    })
}

pub(super) fn spawn_terminal_session(
    request: &TerminalCreateRequest,
    prepared_command: &PreparedTerminalCommand,
    app: AppHandle,
    prompt_request: ExternalAiPromptRequest,
    terminal_id: &str,
) -> Result<TerminalSession, String> {
    let mut terminal_command = Command::new(&prepared_command.program);
    terminal_command
        .args(&prepared_command.args)
        .current_dir(&request.cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    terminal_command
        .env_remove("GIT_EXTERNAL_DIFF")
        .env_remove("GIT_DIFF_OPTS")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_CONFIG_GLOBAL", empty_git_config_path())
        .env("GIT_PAGER", "cat")
        .env("NO_COLOR", "1");

    let mut child = terminal_command
        .spawn()
        .map_err(|e| format!("Could not start external agent terminal command: {}", e))?;
    let output = Arc::new(Mutex::new(TerminalOutput::default()));

    if let Some(stdout) = child.stdout.take() {
        spawn_terminal_reader(
            stdout,
            output.clone(),
            request.output_limit,
            app.clone(),
            prompt_request.clone(),
            terminal_id.to_string(),
            "stdout",
        );
    }
    if let Some(stderr) = child.stderr.take() {
        spawn_terminal_reader(
            stderr,
            output.clone(),
            request.output_limit,
            app,
            prompt_request,
            terminal_id.to_string(),
            "stderr",
        );
    }

    Ok(TerminalSession { child, output })
}

fn spawn_terminal_reader<R>(
    mut reader: R,
    output: Arc<Mutex<TerminalOutput>>,
    output_limit: usize,
    app: AppHandle,
    request: ExternalAiPromptRequest,
    terminal_id: String,
    stream_name: &'static str,
) where
    R: Read + Send + 'static,
{
    std::thread::spawn(move || {
        let mut buffer = [0_u8; 4096];
        loop {
            let bytes_read = match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(bytes_read) => bytes_read,
                Err(_) => break,
            };
            let chunk = String::from_utf8_lossy(&buffer[..bytes_read]).to_string();
            append_terminal_output(&output, &chunk, output_limit);
            emit_external_run_event(
                &app,
                &request,
                ExternalAiRunEventKind::ToolCallUpdate,
                terminal_output_message(stream_name, &chunk),
                Some(json!({
                    "terminalId": terminal_id,
                    "stream": stream_name,
                    "chunk": chunk,
                })),
            );
        }
    });
}

fn append_terminal_output(output: &Arc<Mutex<TerminalOutput>>, chunk: &str, output_limit: usize) {
    let Ok(mut output) = output.lock() else {
        return;
    };
    output.text.push_str(chunk);

    if output.text.len() <= output_limit {
        return;
    }

    let mut start = output.text.len().saturating_sub(output_limit);
    while start < output.text.len() && !output.text.is_char_boundary(start) {
        start += 1;
    }
    output.text.drain(..start);
    output.truncated = true;
}

fn terminal_output_message(stream_name: &str, chunk: &str) -> String {
    let trimmed = chunk.trim();
    if trimmed.is_empty() {
        format!("Terminal {} output", stream_name)
    } else {
        format!("Terminal {}: {}", stream_name, trimmed)
    }
}

pub(super) fn terminal_command_display(command: &str, args: &[String]) -> String {
    std::iter::once(command.to_string())
        .chain(args.iter().map(|arg| shell_quote_for_display(arg)))
        .collect::<Vec<_>>()
        .join(" ")
}

fn shell_quote_for_display(value: &str) -> String {
    if value.chars().any(char::is_whitespace) {
        format!("'{}'", value.replace('\'', "'\\''"))
    } else {
        value.to_string()
    }
}

pub(super) fn prepare_terminal_command(
    command: &str,
    args: &[String],
) -> Option<PreparedTerminalCommand> {
    let command_name = command_name(command);
    if command_name == "git" {
        return prepare_git_command(command, args);
    }

    if matches!(command_name, "bash" | "sh" | "zsh") {
        let shell_args = parse_read_only_shell_command(args)?;
        return prepare_git_command("git", &shell_args);
    }

    None
}

pub(super) fn is_read_only_terminal_command(command: &str, args: &[String]) -> bool {
    prepare_terminal_command(command, args).is_some()
}

pub(super) fn command_name(command: &str) -> &str {
    Path::new(command)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(command)
}

fn parse_read_only_shell_command(args: &[String]) -> Option<Vec<String>> {
    let command_text = match args {
        [flag, command_text] if flag == "-c" || flag == "-lc" => command_text,
        [login_flag, command_flag, command_text]
            if login_flag == "-l" && (command_flag == "-c" || command_flag == "-lc") =>
        {
            command_text
        }
        _ => return None,
    };

    if command_text
        .chars()
        .any(|character| matches!(character, ';' | '&' | '|' | '>' | '<' | '`' | '\n' | '\r'))
        || command_text.contains("$(")
    {
        return None;
    }

    let parts = command_text
        .split_whitespace()
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    let Some((command, args)) = parts.split_first() else {
        return None;
    };

    if command == "git" && is_read_only_git_command(args) {
        Some(args.to_vec())
    } else {
        None
    }
}

fn prepare_git_command(command: &str, args: &[String]) -> Option<PreparedTerminalCommand> {
    if !is_read_only_git_command(args) {
        return None;
    }

    let sanitized_args = SANITIZED_GIT_CONFIG_ARGS
        .iter()
        .map(|arg| (*arg).to_string())
        .chain(args.iter().cloned())
        .collect::<Vec<_>>();

    Some(PreparedTerminalCommand {
        program: command.to_string(),
        args: sanitized_args.clone(),
        display: terminal_command_display(command, args),
    })
}

fn is_read_only_git_command(args: &[String]) -> bool {
    let Some(subcommand) = args.first() else {
        return false;
    };

    matches!(
        subcommand.as_str(),
        "diff" | "status" | "show" | "log" | "ls-files" | "rev-parse" | "merge-base"
    ) && args.iter().all(git_arg_is_read_only)
}

fn git_arg_is_read_only(arg: &String) -> bool {
    if arg == "--ext-diff"
        || arg.starts_with("--ext-diff=")
        || arg == "--no-index"
        || arg == "--output"
        || arg.starts_with("--output=")
    {
        return false;
    }

    let path = Path::new(arg);
    !path.is_absolute()
        && !path
            .components()
            .any(|component| matches!(component, std::path::Component::ParentDir))
}

fn empty_git_config_path() -> &'static str {
    if cfg!(windows) {
        "NUL"
    } else {
        "/dev/null"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_only_terminal_command_allows_git_diff() {
        let args = vec![
            "diff".to_string(),
            "--cached".to_string(),
            "--name-only".to_string(),
        ];

        assert!(is_read_only_terminal_command("git", &args));
    }

    #[test]
    fn read_only_terminal_command_rejects_git_checkout() {
        let args = vec!["checkout".to_string(), "main".to_string()];

        assert!(!is_read_only_terminal_command("git", &args));
    }

    #[test]
    fn read_only_terminal_command_rejects_git_output_write() {
        let args = vec!["diff".to_string(), "--output=result.patch".to_string()];

        assert!(!is_read_only_terminal_command("git", &args));
    }

    #[test]
    fn read_only_terminal_command_rejects_path_escape() {
        let args = vec![
            "diff".to_string(),
            "--no-index".to_string(),
            "../outside".to_string(),
            "src/main.rs".to_string(),
        ];

        assert!(!is_read_only_terminal_command("git", &args));
    }

    #[test]
    fn read_only_terminal_command_allows_simple_shell_git_status() {
        let args = vec!["-lc".to_string(), "git status --short".to_string()];

        assert!(is_read_only_terminal_command("bash", &args));
    }

    #[test]
    fn shell_git_command_is_sanitized_to_direct_git() {
        let args = vec!["-lc".to_string(), "git status --short".to_string()];
        let prepared = prepare_terminal_command("bash", &args).expect("prepared command");
        let sanitized_args = SANITIZED_GIT_CONFIG_ARGS
            .iter()
            .map(|arg| (*arg).to_string())
            .collect::<Vec<_>>();

        assert_eq!(prepared.program, "git");
        assert_eq!(
            &prepared.args[..sanitized_args.len()],
            sanitized_args.as_slice()
        );
        assert!(prepared
            .args
            .ends_with(&["status".to_string(), "--short".to_string()]));
    }

    #[test]
    fn read_only_terminal_command_rejects_shell_control_operators() {
        let args = vec![
            "-lc".to_string(),
            "git status --short && rm file".to_string(),
        ];

        assert!(!is_read_only_terminal_command("bash", &args));
    }
}
