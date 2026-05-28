use std::env;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ResolvedExternalProgram {
    pub program: PathBuf,
    pub path_env: Option<String>,
}

pub(crate) fn resolve_external_program(program: &str) -> Option<ResolvedExternalProgram> {
    let dirs = command_search_dirs();
    let path = resolve_external_program_from_dirs(program, &dirs)?;
    Some(ResolvedExternalProgram {
        program: path,
        path_env: join_path_env(&dirs),
    })
}

pub(crate) fn command_search_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if let Some(path) = env::var_os("PATH") {
        for dir in env::split_paths(&path) {
            push_unique_dir(&mut dirs, dir);
        }
    }

    push_platform_command_dirs(&mut dirs);
    push_user_command_dirs(&mut dirs);

    dirs
}

#[cfg(target_os = "macos")]
pub(crate) fn push_platform_command_dirs(dirs: &mut Vec<PathBuf>) {
    for dir in [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/opt/local/bin",
    ] {
        push_unique_dir(dirs, PathBuf::from(dir));
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
pub(crate) fn push_platform_command_dirs(dirs: &mut Vec<PathBuf>) {
    for dir in [
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/opt/local/bin",
        "/snap/bin",
    ] {
        push_unique_dir(dirs, PathBuf::from(dir));
    }
}

#[cfg(windows)]
pub(crate) fn push_platform_command_dirs(dirs: &mut Vec<PathBuf>) {
    for key in ["ProgramFiles", "ProgramFiles(x86)"] {
        if let Some(base) = env::var_os(key) {
            push_unique_dir(dirs, PathBuf::from(base).join("nodejs"));
        }
    }

    if let Some(appdata) = env::var_os("APPDATA") {
        push_unique_dir(dirs, PathBuf::from(appdata).join("npm"));
    }

    if let Some(local_appdata) = env::var_os("LOCALAPPDATA") {
        let local_appdata = PathBuf::from(local_appdata);
        push_unique_dir(dirs, local_appdata.join("Microsoft").join("WindowsApps"));
        push_unique_dir(dirs, local_appdata.join("Programs"));
        push_unique_dir(dirs, local_appdata.join("Programs").join("nodejs"));
        push_unique_dir(dirs, local_appdata.join("Volta").join("bin"));
    }

    if let Some(nvm_symlink) = env::var_os("NVM_SYMLINK") {
        push_unique_dir(dirs, PathBuf::from(nvm_symlink));
    }
}

fn push_user_command_dirs(dirs: &mut Vec<PathBuf>) {
    if let Some(home) = env::var_os("HOME").or_else(|| env::var_os("USERPROFILE")) {
        push_user_home_command_dirs(dirs, &PathBuf::from(home));
    }
}

#[cfg(not(windows))]
pub(crate) fn push_user_home_command_dirs(dirs: &mut Vec<PathBuf>, home: &Path) {
    push_unique_dir(dirs, home.join(".local/bin"));
    push_unique_dir(dirs, home.join(".volta/bin"));
    push_unique_dir(dirs, home.join(".asdf/shims"));
    push_unique_dir(dirs, home.join(".nvm/current/bin"));
    push_nvm_version_dirs(dirs, home);
}

#[cfg(windows)]
pub(crate) fn push_user_home_command_dirs(dirs: &mut Vec<PathBuf>, home: &Path) {
    push_unique_dir(dirs, home.join(".local").join("bin"));
    push_unique_dir(dirs, home.join("AppData").join("Roaming").join("npm"));
    push_unique_dir(
        dirs,
        home.join("AppData")
            .join("Local")
            .join("Microsoft")
            .join("WindowsApps"),
    );
    push_unique_dir(
        dirs,
        home.join("AppData").join("Local").join("Volta").join("bin"),
    );
}

fn push_unique_dir(dirs: &mut Vec<PathBuf>, dir: PathBuf) {
    if !dirs.iter().any(|existing| existing == &dir) {
        dirs.push(dir);
    }
}

fn push_nvm_version_dirs(dirs: &mut Vec<PathBuf>, home: &Path) {
    let base = home.join(".nvm/versions/node");
    let Ok(entries) = fs::read_dir(base) else {
        return;
    };

    let mut version_dirs = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path().join("bin"))
        .collect::<Vec<_>>();
    version_dirs.sort();

    for dir in version_dirs {
        push_unique_dir(dirs, dir);
    }
}

pub(crate) fn resolve_external_program_from_dirs(
    program: &str,
    dirs: &[PathBuf],
) -> Option<PathBuf> {
    let program_path = Path::new(program);
    if program_path.components().count() > 1 && program_path.is_file() {
        return Some(program_path.to_path_buf());
    }

    for dir in dirs {
        for name in external_program_names(program) {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    None
}

#[cfg(windows)]
pub(crate) fn external_program_names(program: &str) -> Vec<String> {
    let path = Path::new(program);
    if path.extension().is_some() {
        return vec![program.to_string()];
    }

    vec![
        format!("{program}.cmd"),
        format!("{program}.exe"),
        program.to_string(),
    ]
}

#[cfg(not(windows))]
pub(crate) fn external_program_names(program: &str) -> Vec<String> {
    vec![program.to_string()]
}

fn join_path_env(dirs: &[PathBuf]) -> Option<String> {
    env::join_paths(dirs)
        .ok()
        .map(|paths| paths.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(not(windows))]
    #[test]
    fn non_windows_search_dirs_include_platform_fallbacks() {
        let mut dirs = Vec::new();

        push_platform_command_dirs(&mut dirs);

        assert!(dirs.contains(&PathBuf::from("/usr/local/bin")));
        assert!(dirs.contains(&PathBuf::from("/usr/bin")));
        assert!(dirs.contains(&PathBuf::from("/bin")));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_search_dirs_include_homebrew_fallbacks() {
        let mut dirs = Vec::new();

        push_platform_command_dirs(&mut dirs);

        assert!(dirs.contains(&PathBuf::from("/opt/homebrew/bin")));
        assert!(dirs.contains(&PathBuf::from("/usr/local/bin")));
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
    fn resolves_program_from_explicit_search_dirs() {
        let temp_dir = tempfile::tempdir().expect("temp command dir");
        let fake_command = write_fake_command(temp_dir.path(), "gh");

        let resolved = resolve_external_program_from_dirs("gh", &[temp_dir.path().to_path_buf()]);

        assert_eq!(resolved.as_deref(), Some(fake_command.as_path()));
    }

    fn write_fake_command(dir: &Path, name: &str) -> PathBuf {
        let path = dir.join(external_program_names(name)[0].as_str());
        fs::write(&path, "#!/bin/sh\n").expect("write fake command");

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
}
