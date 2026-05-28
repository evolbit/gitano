use super::GitHubAccessMethod;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationPreferences {
    #[serde(default)]
    pub github_access_method: GitHubAccessMethod,
}

impl Default for IntegrationPreferences {
    fn default() -> Self {
        Self {
            github_access_method: GitHubAccessMethod::AutoFallback,
        }
    }
}

fn integrations_data_dir() -> PathBuf {
    if let Ok(path) = std::env::var("GITANO_INTEGRATIONS_HOME") {
        return PathBuf::from(path);
    }

    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());

    Path::new(&home).join(".gitano").join("integrations")
}

fn preferences_path() -> PathBuf {
    integrations_data_dir().join("preferences.json")
}

pub fn load_preferences() -> IntegrationPreferences {
    let Ok(contents) = fs::read_to_string(preferences_path()) else {
        return IntegrationPreferences::default();
    };

    serde_json::from_str(&contents).unwrap_or_default()
}

pub fn save_preferences(preferences: &IntegrationPreferences) -> Result<(), String> {
    let path = preferences_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let contents = serde_json::to_string_pretty(preferences).map_err(|error| error.to_string())?;
    fs::write(path, contents).map_err(|error| error.to_string())
}

pub fn set_github_access_method(
    access_method: GitHubAccessMethod,
) -> Result<IntegrationPreferences, String> {
    let mut preferences = load_preferences();
    preferences.github_access_method = access_method;
    save_preferences(&preferences)?;
    Ok(preferences)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_to_auto_fallback() {
        assert_eq!(
            IntegrationPreferences::default().github_access_method,
            GitHubAccessMethod::AutoFallback,
        );
    }
}
