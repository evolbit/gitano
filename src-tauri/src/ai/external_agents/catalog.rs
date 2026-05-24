use super::super::types::{
    ExternalAiAgentAuthMethod, ExternalAiAgentInstallKind, ExternalAiAgentInstallSource,
};

pub(super) const CODEX_AGENT_ID: &str = "codex-acp";
pub(super) const CLAUDE_AGENT_ID: &str = "claude-acp";
pub(super) const GEMINI_AGENT_ID: &str = "gemini";

#[derive(Debug, Clone, Copy)]
pub(super) enum ArchiveKind {
    Tgz,
    Zip,
}

#[derive(Debug, Clone, Copy)]
pub(super) enum CuratedInstall {
    Binary {
        archive: &'static str,
        cmd: &'static str,
        archive_kind: ArchiveKind,
    },
    Npx {
        package: &'static str,
        args: &'static [&'static str],
    },
}

#[derive(Debug, Clone, Copy)]
pub(super) struct CuratedAgent {
    pub(super) id: &'static str,
    pub(super) display_name: &'static str,
    pub(super) provider: &'static str,
    pub(super) description: &'static str,
    pub(super) version: &'static str,
    pub(super) repository: &'static str,
    pub(super) license: &'static str,
    npx_fallback: Option<CuratedInstall>,
}

pub(super) fn curated_agents() -> &'static [CuratedAgent] {
    &[
        CuratedAgent {
            id: CODEX_AGENT_ID,
            display_name: "Codex CLI",
            provider: "OpenAI",
            description: "ACP adapter for OpenAI's coding assistant",
            version: "0.14.0",
            repository: "https://github.com/zed-industries/codex-acp",
            license: "Apache-2.0",
            npx_fallback: Some(CuratedInstall::Npx {
                package: "@zed-industries/codex-acp@0.14.0",
                args: &[],
            }),
        },
        CuratedAgent {
            id: CLAUDE_AGENT_ID,
            display_name: "Claude Agent",
            provider: "Anthropic",
            description: "ACP wrapper for Anthropic's Claude",
            version: "0.37.0",
            repository: "https://github.com/agentclientprotocol/claude-agent-acp",
            license: "Proprietary",
            npx_fallback: Some(CuratedInstall::Npx {
                package: "@agentclientprotocol/claude-agent-acp@0.37.0",
                args: &[],
            }),
        },
        CuratedAgent {
            id: GEMINI_AGENT_ID,
            display_name: "Gemini CLI",
            provider: "Google",
            description: "Google's official CLI for Gemini",
            version: "0.42.0",
            repository: "https://github.com/google-gemini/gemini-cli",
            license: "Apache-2.0",
            npx_fallback: Some(CuratedInstall::Npx {
                package: "@google/gemini-cli@0.42.0",
                args: &["--acp"],
            }),
        },
    ]
}

pub(super) fn find_curated_agent(agent_id: &str) -> Result<&'static CuratedAgent, String> {
    curated_agents()
        .iter()
        .find(|agent| agent.id == agent_id.trim())
        .ok_or_else(|| format!("Unsupported external AI agent: {}", agent_id))
}

pub(super) fn install_source_for(agent: &CuratedAgent) -> Option<CuratedInstall> {
    if agent.id == CODEX_AGENT_ID {
        return codex_binary_source().or(agent.npx_fallback);
    }

    agent.npx_fallback
}

fn codex_binary_source() -> Option<CuratedInstall> {
    match platform_key().as_deref() {
        Some("darwin-aarch64") => Some(CuratedInstall::Binary {
            archive: "https://github.com/zed-industries/codex-acp/releases/download/v0.14.0/codex-acp-0.14.0-aarch64-apple-darwin.tar.gz",
            cmd: "./codex-acp",
            archive_kind: ArchiveKind::Tgz,
        }),
        Some("darwin-x86_64") => Some(CuratedInstall::Binary {
            archive: "https://github.com/zed-industries/codex-acp/releases/download/v0.14.0/codex-acp-0.14.0-x86_64-apple-darwin.tar.gz",
            cmd: "./codex-acp",
            archive_kind: ArchiveKind::Tgz,
        }),
        Some("linux-aarch64") => Some(CuratedInstall::Binary {
            archive: "https://github.com/zed-industries/codex-acp/releases/download/v0.14.0/codex-acp-0.14.0-aarch64-unknown-linux-gnu.tar.gz",
            cmd: "./codex-acp",
            archive_kind: ArchiveKind::Tgz,
        }),
        Some("linux-x86_64") => Some(CuratedInstall::Binary {
            archive: "https://github.com/zed-industries/codex-acp/releases/download/v0.14.0/codex-acp-0.14.0-x86_64-unknown-linux-gnu.tar.gz",
            cmd: "./codex-acp",
            archive_kind: ArchiveKind::Tgz,
        }),
        Some("windows-aarch64") => Some(CuratedInstall::Binary {
            archive: "https://github.com/zed-industries/codex-acp/releases/download/v0.14.0/codex-acp-0.14.0-aarch64-pc-windows-msvc.zip",
            cmd: "./codex-acp.exe",
            archive_kind: ArchiveKind::Zip,
        }),
        Some("windows-x86_64") => Some(CuratedInstall::Binary {
            archive: "https://github.com/zed-industries/codex-acp/releases/download/v0.14.0/codex-acp-0.14.0-x86_64-pc-windows-msvc.zip",
            cmd: "./codex-acp.exe",
            archive_kind: ArchiveKind::Zip,
        }),
        _ => None,
    }
}

fn platform_key() -> Option<String> {
    let os = match std::env::consts::OS {
        "macos" => "darwin",
        "linux" => "linux",
        "windows" => "windows",
        _ => return None,
    };
    let arch = match std::env::consts::ARCH {
        "aarch64" => "aarch64",
        "x86_64" => "x86_64",
        _ => return None,
    };

    Some(format!("{}-{}", os, arch))
}

pub(super) fn install_source_to_api(source: CuratedInstall) -> ExternalAiAgentInstallSource {
    match source {
        CuratedInstall::Binary { archive, cmd, .. } => ExternalAiAgentInstallSource {
            kind: ExternalAiAgentInstallKind::Binary,
            package: None,
            archive: Some(archive.to_string()),
            command: vec![cmd.to_string()],
        },
        CuratedInstall::Npx { package, args } => ExternalAiAgentInstallSource {
            kind: ExternalAiAgentInstallKind::Npx,
            package: Some(package.to_string()),
            archive: None,
            command: std::iter::once("npx".to_string())
                .chain(std::iter::once("-y".to_string()))
                .chain(std::iter::once(package.to_string()))
                .chain(args.iter().map(|arg| arg.to_string()))
                .collect(),
        },
    }
}

pub(super) fn auth_methods_for(agent_id: &str) -> Vec<ExternalAiAgentAuthMethod> {
    match agent_id {
        CODEX_AGENT_ID => vec![
            ExternalAiAgentAuthMethod {
                id: "chatgpt".to_string(),
                display_name: "ChatGPT account".to_string(),
            },
            ExternalAiAgentAuthMethod {
                id: "codex_api_key".to_string(),
                display_name: "CODEX_API_KEY".to_string(),
            },
            ExternalAiAgentAuthMethod {
                id: "openai_api_key".to_string(),
                display_name: "OPENAI_API_KEY".to_string(),
            },
        ],
        CLAUDE_AGENT_ID => vec![ExternalAiAgentAuthMethod {
            id: "claude_cli".to_string(),
            display_name: "Claude CLI account".to_string(),
        }],
        GEMINI_AGENT_ID => vec![ExternalAiAgentAuthMethod {
            id: "gemini_cli".to_string(),
            display_name: "Gemini CLI account".to_string(),
        }],
        _ => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn curated_agents_include_expected_ids() {
        let ids: Vec<&str> = curated_agents().iter().map(|agent| agent.id).collect();

        assert_eq!(ids, vec![CODEX_AGENT_ID, CLAUDE_AGENT_ID, GEMINI_AGENT_ID]);
    }

    #[test]
    fn rejects_non_allowlisted_agent_ids() {
        let error = find_curated_agent("unknown-agent").expect_err("unsupported agent");

        assert!(error.contains("Unsupported external AI agent"));
    }

    #[test]
    fn codex_has_install_metadata_for_supported_platforms() {
        let agent = find_curated_agent(CODEX_AGENT_ID).expect("codex agent exists");
        let source = install_source_for(agent).expect("codex install source exists");

        let api_source = install_source_to_api(source);
        assert!(!api_source.command.is_empty());
    }
}
