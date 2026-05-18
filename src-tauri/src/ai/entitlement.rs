use super::types::{LocalAiEntitlementSource, LocalAiEntitlementStatus};

pub fn entitlement_status() -> LocalAiEntitlementStatus {
    let dev_enabled = std::env::var("GITANO_LOCAL_AI_DEV_ENTITLEMENT")
        .map(|value| value != "0" && value.to_lowercase() != "false")
        .unwrap_or(true);

    development_entitlement_status(dev_enabled)
}

pub fn development_entitlement_status(enabled: bool) -> LocalAiEntitlementStatus {
    if enabled {
        // TODO(local-ai-license): replace this development stub with signed
        // premium license verification before shipping paid local AI.
        return LocalAiEntitlementStatus {
            entitled: true,
            source: LocalAiEntitlementSource::DevelopmentStub,
            reason: Some("Development local AI entitlement is enabled.".to_string()),
        };
    }

    LocalAiEntitlementStatus {
        entitled: false,
        source: LocalAiEntitlementSource::Missing,
        reason: Some("Local AI requires a premium license.".to_string()),
    }
}

pub fn ensure_entitled() -> Result<LocalAiEntitlementStatus, String> {
    let status = entitlement_status();

    if status.entitled {
        Ok(status)
    } else {
        Err(status
            .reason
            .clone()
            .unwrap_or_else(|| "Local AI requires a premium license.".to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn development_stub_allows_local_ai_when_enabled() {
        let status = development_entitlement_status(true);

        assert!(status.entitled);
        assert_eq!(status.source, LocalAiEntitlementSource::DevelopmentStub);
    }

    #[test]
    fn development_stub_can_report_missing_entitlement() {
        let status = development_entitlement_status(false);

        assert!(!status.entitled);
        assert_eq!(status.source, LocalAiEntitlementSource::Missing);
    }
}
