use super::types::{LocalAiEntitlementSource, LocalAiEntitlementStatus};
use crate::licensing::{ensure_feature_entitled, license_status, PREMIUM_AI_FEATURE};

pub fn entitlement_status() -> LocalAiEntitlementStatus {
    let status = license_status();
    let source = if status.ai_entitled {
        LocalAiEntitlementSource::License
    } else {
        match status.state {
            crate::licensing::LicenseState::ValidationRequired => {
                LocalAiEntitlementSource::StaleValidation
            }
            crate::licensing::LicenseState::Invalid
            | crate::licensing::LicenseState::Expired
            | crate::licensing::LicenseState::WrongMachine
            | crate::licensing::LicenseState::ValidationFailed
            | crate::licensing::LicenseState::Revoked => LocalAiEntitlementSource::Invalid,
            _ => LocalAiEntitlementSource::Missing,
        }
    };

    LocalAiEntitlementStatus {
        entitled: status.ai_entitled,
        source,
        reason: status.reason,
    }
}

pub fn ensure_entitled() -> Result<LocalAiEntitlementStatus, String> {
    ensure_feature_entitled(PREMIUM_AI_FEATURE).map(|_| entitlement_status())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_license_reports_missing_entitlement() {
        let _guard = crate::ai::local_ai_env_lock().lock().unwrap();
        let previous_home = std::env::var_os("GITANO_LICENSE_HOME");
        let previous_dev_entitlement = std::env::var_os(crate::licensing::DEV_AI_ENTITLEMENT_ENV);
        let previous_local_ai_dev_entitlement =
            std::env::var_os(crate::licensing::LOCAL_AI_DEV_ENTITLEMENT_ENV);
        let temp_dir = tempfile::tempdir().expect("temp dir");
        std::env::set_var("GITANO_LICENSE_HOME", temp_dir.path());
        std::env::set_var(crate::licensing::DEV_AI_ENTITLEMENT_ENV, "0");
        std::env::set_var(crate::licensing::LOCAL_AI_DEV_ENTITLEMENT_ENV, "0");

        let status = entitlement_status();

        match previous_home {
            Some(value) => std::env::set_var("GITANO_LICENSE_HOME", value),
            None => std::env::remove_var("GITANO_LICENSE_HOME"),
        }
        match previous_dev_entitlement {
            Some(value) => std::env::set_var(crate::licensing::DEV_AI_ENTITLEMENT_ENV, value),
            None => std::env::remove_var(crate::licensing::DEV_AI_ENTITLEMENT_ENV),
        }
        match previous_local_ai_dev_entitlement {
            Some(value) => std::env::set_var(crate::licensing::LOCAL_AI_DEV_ENTITLEMENT_ENV, value),
            None => std::env::remove_var(crate::licensing::LOCAL_AI_DEV_ENTITLEMENT_ENV),
        }

        assert!(!status.entitled);
        assert_eq!(status.source, LocalAiEntitlementSource::Missing);
    }
}
