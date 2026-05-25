use super::super::types::{
    ExternalAiAgentAuthMethod, ExternalAiAgentInstallKind, ExternalAiAgentInstallSource,
};

pub(super) const CODEX_AGENT_ID: &str = "codex-acp";
pub(super) const CLAUDE_AGENT_ID: &str = "claude-acp";
pub(super) const GEMINI_AGENT_ID: &str = "gemini";
pub(super) const COPILOT_AGENT_ID: &str = "github-copilot-cli";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum ArchiveKind {
    Tgz,
    Zip,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct CuratedBinarySource {
    pub(super) archive: &'static str,
    pub(super) command: &'static str,
    pub(super) args: &'static [&'static str],
    pub(super) archive_kind: ArchiveKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct CuratedNpxSource {
    pub(super) package: &'static str,
    pub(super) args: &'static [&'static str],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum CuratedInstallSource {
    Binary(CuratedBinarySource),
    Npx(CuratedNpxSource),
}

#[derive(Debug, Clone, Copy)]
struct CuratedBinaryTarget {
    platform: &'static str,
    source: CuratedBinarySource,
}

#[derive(Debug, Clone, Copy)]
enum CuratedInstall {
    Binary {
        targets: &'static [CuratedBinaryTarget],
        npx_fallback: Option<CuratedNpxSource>,
    },
    Npx(CuratedNpxSource),
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
    install: CuratedInstall,
}

const CODEX_TARGETS: &[CuratedBinaryTarget] = &[
    CuratedBinaryTarget {
        platform: "darwin-aarch64",
        source: CuratedBinarySource {
            archive: "https://github.com/zed-industries/codex-acp/releases/download/v0.14.0/codex-acp-0.14.0-aarch64-apple-darwin.tar.gz",
            command: "./codex-acp",
            args: &[],
            archive_kind: ArchiveKind::Tgz,
        },
    },
    CuratedBinaryTarget {
        platform: "darwin-x86_64",
        source: CuratedBinarySource {
            archive: "https://github.com/zed-industries/codex-acp/releases/download/v0.14.0/codex-acp-0.14.0-x86_64-apple-darwin.tar.gz",
            command: "./codex-acp",
            args: &[],
            archive_kind: ArchiveKind::Tgz,
        },
    },
    CuratedBinaryTarget {
        platform: "linux-aarch64",
        source: CuratedBinarySource {
            archive: "https://github.com/zed-industries/codex-acp/releases/download/v0.14.0/codex-acp-0.14.0-aarch64-unknown-linux-gnu.tar.gz",
            command: "./codex-acp",
            args: &[],
            archive_kind: ArchiveKind::Tgz,
        },
    },
    CuratedBinaryTarget {
        platform: "linux-x86_64",
        source: CuratedBinarySource {
            archive: "https://github.com/zed-industries/codex-acp/releases/download/v0.14.0/codex-acp-0.14.0-x86_64-unknown-linux-gnu.tar.gz",
            command: "./codex-acp",
            args: &[],
            archive_kind: ArchiveKind::Tgz,
        },
    },
    CuratedBinaryTarget {
        platform: "windows-aarch64",
        source: CuratedBinarySource {
            archive: "https://github.com/zed-industries/codex-acp/releases/download/v0.14.0/codex-acp-0.14.0-aarch64-pc-windows-msvc.zip",
            command: "./codex-acp.exe",
            args: &[],
            archive_kind: ArchiveKind::Zip,
        },
    },
    CuratedBinaryTarget {
        platform: "windows-x86_64",
        source: CuratedBinarySource {
            archive: "https://github.com/zed-industries/codex-acp/releases/download/v0.14.0/codex-acp-0.14.0-x86_64-pc-windows-msvc.zip",
            command: "./codex-acp.exe",
            args: &[],
            archive_kind: ArchiveKind::Zip,
        },
    },
];

const CODEX_NPX_SOURCE: CuratedNpxSource = CuratedNpxSource {
    package: "@zed-industries/codex-acp@0.14.0",
    args: &[],
};

const CLAUDE_NPX_SOURCE: CuratedNpxSource = CuratedNpxSource {
    package: "@agentclientprotocol/claude-agent-acp@0.37.0",
    args: &[],
};

const GEMINI_NPX_SOURCE: CuratedNpxSource = CuratedNpxSource {
    package: "@google/gemini-cli@0.43.0",
    args: &["--acp"],
};

const COPILOT_NPX_SOURCE: CuratedNpxSource = CuratedNpxSource {
    package: "@github/copilot@1.0.51",
    args: &["--acp"],
};

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
            install: CuratedInstall::Binary {
                targets: CODEX_TARGETS,
                npx_fallback: Some(CODEX_NPX_SOURCE),
            },
        },
        CuratedAgent {
            id: CLAUDE_AGENT_ID,
            display_name: "Claude Agent",
            provider: "Anthropic",
            description: "ACP wrapper for Anthropic's Claude",
            version: "0.37.0",
            repository: "https://github.com/agentclientprotocol/claude-agent-acp",
            license: "proprietary",
            install: CuratedInstall::Npx(CLAUDE_NPX_SOURCE),
        },
        CuratedAgent {
            id: GEMINI_AGENT_ID,
            display_name: "Gemini CLI",
            provider: "Google",
            description: "Google's official CLI for Gemini",
            version: "0.43.0",
            repository: "https://github.com/google-gemini/gemini-cli",
            license: "Apache-2.0",
            install: CuratedInstall::Npx(GEMINI_NPX_SOURCE),
        },
        CuratedAgent {
            id: COPILOT_AGENT_ID,
            display_name: "GitHub Copilot",
            provider: "GitHub",
            description: "GitHub's AI pair programmer",
            version: "1.0.51",
            repository: "https://github.com/github/copilot-cli",
            license: "proprietary",
            install: CuratedInstall::Npx(COPILOT_NPX_SOURCE),
        },
    ]
}

pub(super) fn find_curated_agent(agent_id: &str) -> Result<&'static CuratedAgent, String> {
    let normalized_agent_id = normalize_agent_id(agent_id);
    curated_agents()
        .iter()
        .find(|agent| agent.id == normalized_agent_id)
        .ok_or_else(|| format!("Unsupported external AI agent: {}", agent_id))
}

fn normalize_agent_id(agent_id: &str) -> &str {
    match agent_id.trim() {
        // Compatibility with the draft id used before matching the ACP registry.
        "copilot" => COPILOT_AGENT_ID,
        trimmed => trimmed,
    }
}

pub(super) fn install_source_for(agent: &CuratedAgent) -> Option<CuratedInstallSource> {
    match agent.install {
        CuratedInstall::Npx(source) => Some(CuratedInstallSource::Npx(source)),
        CuratedInstall::Binary {
            targets,
            npx_fallback,
        } => binary_source_for_current_platform(targets)
            .map(CuratedInstallSource::Binary)
            .or(npx_fallback.map(CuratedInstallSource::Npx)),
    }
}

pub(super) fn install_source_to_api(source: CuratedInstallSource) -> ExternalAiAgentInstallSource {
    match source {
        CuratedInstallSource::Binary(source) => ExternalAiAgentInstallSource {
            kind: ExternalAiAgentInstallKind::Binary,
            package: None,
            archive: Some(source.archive.to_string()),
            command: binary_command_for_display(source),
        },
        CuratedInstallSource::Npx(source) => ExternalAiAgentInstallSource {
            kind: ExternalAiAgentInstallKind::Npx,
            package: Some(source.package.to_string()),
            archive: None,
            command: npm_exec_command_for_display(source),
        },
    }
}

#[cfg(test)]
pub(super) fn npm_exec_args(source: CuratedNpxSource, prefix_dir: &str) -> Vec<String> {
    let mut args = vec![
        "--prefix".to_string(),
        prefix_dir.to_string(),
        "exec".to_string(),
        "--yes".to_string(),
        "--".to_string(),
        bounded_npm_package_spec(source.package),
    ];
    args.extend(source.args.iter().map(|arg| arg.to_string()));
    args
}

pub(super) fn bounded_npm_package_spec(package_spec: &str) -> String {
    let Some((package_name, version)) = package_spec.rsplit_once('@') else {
        return package_spec.to_string();
    };
    if package_name.is_empty() || !is_semver_version(version) {
        return package_spec.to_string();
    }

    format!("{package_name}@0.0.0 - {version}")
}

fn is_semver_version(version: &str) -> bool {
    let core = version
        .split(|ch| ch == '-' || ch == '+')
        .next()
        .unwrap_or(version);
    let parts = core.split('.').collect::<Vec<_>>();
    parts.len() == 3
        && parts
            .iter()
            .all(|part| !part.is_empty() && part.chars().all(|ch| ch.is_ascii_digit()))
}

fn binary_source_for_current_platform(
    targets: &[CuratedBinaryTarget],
) -> Option<CuratedBinarySource> {
    let platform_key = platform_key()?;
    targets
        .iter()
        .find(|target| target.platform == platform_key)
        .map(|target| target.source)
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
    Some(format!("{os}-{arch}"))
}

fn binary_command_for_display(source: CuratedBinarySource) -> Vec<String> {
    let mut command = vec![source.command.to_string()];
    command.extend(source.args.iter().map(|arg| arg.to_string()));
    command
}

fn npm_exec_command_for_display(source: CuratedNpxSource) -> Vec<String> {
    let mut command = vec![
        "npm".to_string(),
        "exec".to_string(),
        "--yes".to_string(),
        "--".to_string(),
        bounded_npm_package_spec(source.package),
    ];
    command.extend(source.args.iter().map(|arg| arg.to_string()));
    command
}

pub(super) fn auth_methods_for(agent_id: &str) -> Vec<ExternalAiAgentAuthMethod> {
    match normalize_agent_id(agent_id) {
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
        COPILOT_AGENT_ID => vec![
            ExternalAiAgentAuthMethod {
                id: "github_copilot_cli".to_string(),
                display_name: "GitHub Copilot account".to_string(),
            },
            ExternalAiAgentAuthMethod {
                id: "github_token".to_string(),
                display_name: "GITHUB_TOKEN".to_string(),
            },
            ExternalAiAgentAuthMethod {
                id: "gh_token".to_string(),
                display_name: "GH_TOKEN".to_string(),
            },
        ],
        _ => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn curated_agents_include_expected_registry_ids() {
        let ids: Vec<&str> = curated_agents().iter().map(|agent| agent.id).collect();

        assert_eq!(
            ids,
            vec![
                CODEX_AGENT_ID,
                CLAUDE_AGENT_ID,
                GEMINI_AGENT_ID,
                COPILOT_AGENT_ID
            ]
        );
    }

    #[test]
    fn rejects_non_allowlisted_agent_ids() {
        let error = find_curated_agent("unknown-agent").expect_err("unsupported agent");

        assert!(error.contains("Unsupported external AI agent"));
    }

    #[test]
    fn codex_prefers_binary_install_source_for_supported_platforms() {
        let agent = find_curated_agent(CODEX_AGENT_ID).expect("codex agent exists");
        let source = install_source_for(agent).expect("codex install source exists");

        if platform_key().is_some() {
            assert!(matches!(source, CuratedInstallSource::Binary(_)));
        }
    }

    #[test]
    fn copilot_install_source_starts_acp_server() {
        let agent = find_curated_agent(COPILOT_AGENT_ID).expect("copilot agent exists");
        let source = install_source_for(agent).expect("copilot install source exists");
        let api_source = install_source_to_api(source);

        assert_eq!(api_source.kind, ExternalAiAgentInstallKind::Npx);
        assert_eq!(
            api_source.package.as_deref(),
            Some("@github/copilot@1.0.51")
        );
        assert_eq!(
            api_source.command,
            vec![
                "npm".to_string(),
                "exec".to_string(),
                "--yes".to_string(),
                "--".to_string(),
                "@github/copilot@0.0.0 - 1.0.51".to_string(),
                "--acp".to_string(),
            ]
        );
    }

    #[test]
    fn aliases_draft_copilot_id_to_registry_id() {
        let agent = find_curated_agent("copilot").expect("legacy alias resolves");

        assert_eq!(agent.id, COPILOT_AGENT_ID);
    }

    #[test]
    fn bounded_npm_package_specs_follow_zed_range_form() {
        assert_eq!(
            bounded_npm_package_spec("@github/copilot@1.0.51"),
            "@github/copilot@0.0.0 - 1.0.51"
        );
        assert_eq!(
            bounded_npm_package_spec("@scope/package@1.2.3-beta.1"),
            "@scope/package@0.0.0 - 1.2.3-beta.1"
        );
        assert_eq!(bounded_npm_package_spec("package@latest"), "package@latest");
    }
}
