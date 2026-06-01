use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use ring::signature::{UnparsedPublicKey, ED25519};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub const PREMIUM_AI_FEATURE: PremiumFeature = PremiumFeature::Ai;
const LICENSE_FILE_NAME: &str = "license.json";
const LICENSE_VALIDATION_GRACE_MS: i64 = 14 * 24 * 60 * 60 * 1000;
const CLOCK_ROLLBACK_TOLERANCE_MS: i64 = 10 * 60 * 1000;
const LICENSE_REQUIRED_REASON: &str = "AI features require a valid Gitano license.";
const DEV_AI_ENTITLEMENT_ENV: &str = "GITANO_DEV_AI_ENTITLEMENT";
const CURRENT_PUBLIC_KEY_ID: &str = "gitano-license-key-2026-01";
const CURRENT_PUBLIC_KEY_B64: &str = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum PremiumFeature {
    Ai,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LicensePlan {
    Free,
    Premium,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LicenseState {
    Free,
    Valid,
    Missing,
    Invalid,
    Expired,
    WrongMachine,
    ValidationRequired,
    ValidationFailed,
    Revoked,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LicenseValidationState {
    NotRequired,
    Current,
    Required,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LicenseStatus {
    pub plan: LicensePlan,
    pub state: LicenseState,
    pub validation_state: LicenseValidationState,
    pub entitled_features: Vec<PremiumFeature>,
    pub ai_entitled: bool,
    pub license_id: Option<String>,
    pub customer_email: Option<String>,
    pub expires_at_ms: Option<i64>,
    pub last_validated_at_ms: Option<i64>,
    pub validation_required_at_ms: Option<i64>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LicenseEnvelope {
    pub version: u16,
    pub key_id: String,
    pub payload: LicensePayload,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LicensePayload {
    pub license_id: String,
    pub customer_email: Option<String>,
    pub plan: LicensePlan,
    pub features: Vec<PremiumFeature>,
    pub machine_fingerprint: String,
    pub issued_at_ms: i64,
    pub expires_at_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct StoredLicense {
    envelope: LicenseEnvelope,
    last_validated_at_ms: i64,
    last_seen_at_ms: i64,
    revoked_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LicenseImportRequest {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LicenseRefreshRequest {
    pub force: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct LicenseValidationRequest {
    license: LicenseEnvelope,
    license_id: String,
    machine_fingerprint: String,
    last_validated_at_ms: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct LicenseValidationResponse {
    valid: bool,
    reason: Option<String>,
    license: Option<LicenseEnvelope>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum LicenseValidationError {
    Rejected(String),
    Failed(String),
}

impl LicenseValidationError {
    fn into_message(self) -> String {
        match self {
            LicenseValidationError::Rejected(message) | LicenseValidationError::Failed(message) => {
                message
            }
        }
    }
}

#[tauri::command]
pub fn license_get_status() -> LicenseStatus {
    license_status()
}

#[tauri::command]
pub async fn license_import_file(request: LicenseImportRequest) -> Result<LicenseStatus, String> {
    let contents = fs::read_to_string(&request.path)
        .map_err(|error| format!("Could not read license file {}: {}", request.path, error))?;
    import_license_contents(&contents).await
}

#[tauri::command]
pub async fn license_refresh_validation(
    request: LicenseRefreshRequest,
) -> Result<LicenseStatus, String> {
    refresh_license_validation(request.force).await
}

pub fn license_status() -> LicenseStatus {
    if development_ai_entitlement_enabled() {
        return development_status();
    }

    match load_stored_license() {
        Ok(Some(stored)) => status_for_stored_license(&stored, now_ms()),
        Ok(None) => missing_status(),
        Err(error) => invalid_status(error),
    }
}

pub fn ensure_feature_entitled(feature: PremiumFeature) -> Result<LicenseStatus, String> {
    if development_ai_entitlement_enabled() {
        return Ok(development_status());
    }

    let status = license_status();
    if status.entitled_features.contains(&feature) {
        Ok(status)
    } else {
        Err(status
            .reason
            .clone()
            .unwrap_or_else(|| LICENSE_REQUIRED_REASON.to_string()))
    }
}

pub fn machine_fingerprint() -> String {
    machine_fingerprint_from_parts(&machine_fingerprint_parts())
}

pub async fn import_license_contents(contents: &str) -> Result<LicenseStatus, String> {
    let envelope: LicenseEnvelope = serde_json::from_str(contents)
        .map_err(|error| format!("License file is not valid JSON: {}", error))?;
    let now_ms = now_ms();
    let stored = validate_license_with_server(envelope, None, now_ms)
        .await
        .map_err(LicenseValidationError::into_message)?;
    save_stored_license(&stored)?;
    Ok(status_for_stored_license(&stored, now_ms))
}

async fn validate_license_with_server(
    envelope: LicenseEnvelope,
    last_validated_at_ms: Option<i64>,
    now_ms: i64,
) -> Result<StoredLicense, LicenseValidationError> {
    let response = request_license_validation(&envelope, last_validated_at_ms).await?;

    if !response.valid {
        return Err(LicenseValidationError::Rejected(
            response
                .reason
                .unwrap_or_else(|| LICENSE_REQUIRED_REASON.to_string()),
        ));
    }

    let envelope = response.license.ok_or_else(|| {
        LicenseValidationError::Failed(
            "License validation server did not return a signed entitlement.".to_string(),
        )
    })?;
    verify_license_envelope(&envelope, &machine_fingerprint(), now_ms)
        .map_err(LicenseValidationError::Failed)?;
    let stored = StoredLicense {
        envelope,
        last_validated_at_ms: now_ms,
        last_seen_at_ms: now_ms,
        revoked_reason: None,
    };
    Ok(stored)
}

async fn refresh_license_validation(force: bool) -> Result<LicenseStatus, String> {
    let Some(stored) = load_stored_license()? else {
        return Ok(missing_status());
    };
    let now = now_ms();
    verify_license_envelope(&stored.envelope, &machine_fingerprint(), now)?;
    if !force && validation_is_current(stored.last_validated_at_ms, now) {
        return Ok(status_for_stored_license(&stored, now));
    }

    let refreshed = validate_license_with_server(
        stored.envelope.clone(),
        Some(stored.last_validated_at_ms),
        now,
    )
    .await;

    let refreshed = match refreshed {
        Ok(refreshed) => refreshed,
        Err(LicenseValidationError::Rejected(error)) => {
            let revoked = StoredLicense {
                revoked_reason: Some(error),
                ..stored
            };
            save_stored_license(&revoked)?;
            return Ok(status_for_stored_license(&revoked, now));
        }
        Err(LicenseValidationError::Failed(error)) => return Err(error),
    };
    save_stored_license(&refreshed)?;
    Ok(status_for_stored_license(&refreshed, now))
}

async fn request_license_validation(
    envelope: &LicenseEnvelope,
    last_validated_at_ms: Option<i64>,
) -> Result<LicenseValidationResponse, LicenseValidationError> {
    let endpoint = license_validation_url().map_err(LicenseValidationError::Failed)?;
    let request = build_license_validation_request(envelope, last_validated_at_ms);
    reqwest::Client::new()
        .post(endpoint)
        .json(&request)
        .send()
        .await
        .map_err(|error| {
            LicenseValidationError::Failed(format!("License validation failed: {}", error))
        })?
        .error_for_status()
        .map_err(|error| {
            LicenseValidationError::Failed(format!("License validation failed: {}", error))
        })?
        .json()
        .await
        .map_err(|error| {
            LicenseValidationError::Failed(format!(
                "License validation response was invalid: {}",
                error
            ))
        })
}

fn license_validation_url() -> Result<String, String> {
    std::env::var("GITANO_LICENSE_VALIDATION_URL")
        .map_err(|_| "License validation server is not configured.".to_string())
}

fn build_license_validation_request(
    envelope: &LicenseEnvelope,
    last_validated_at_ms: Option<i64>,
) -> LicenseValidationRequest {
    LicenseValidationRequest {
        license: envelope.clone(),
        license_id: envelope.payload.license_id.clone(),
        machine_fingerprint: machine_fingerprint(),
        last_validated_at_ms,
    }
}

fn status_for_stored_license(stored: &StoredLicense, now_ms: i64) -> LicenseStatus {
    if let Some(reason) = &stored.revoked_reason {
        return LicenseStatus {
            plan: LicensePlan::Free,
            state: LicenseState::Revoked,
            validation_state: LicenseValidationState::Failed,
            entitled_features: Vec::new(),
            ai_entitled: false,
            license_id: Some(stored.envelope.payload.license_id.clone()),
            customer_email: stored.envelope.payload.customer_email.clone(),
            expires_at_ms: Some(stored.envelope.payload.expires_at_ms),
            last_validated_at_ms: Some(stored.last_validated_at_ms),
            validation_required_at_ms: Some(validation_required_at_ms(stored.last_validated_at_ms)),
            reason: Some(reason.clone()),
        };
    }

    if let Err(reason) = verify_license_envelope(&stored.envelope, &machine_fingerprint(), now_ms) {
        let state = if reason.contains("expired") {
            LicenseState::Expired
        } else if reason.contains("machine") {
            LicenseState::WrongMachine
        } else {
            LicenseState::Invalid
        };
        return LicenseStatus {
            plan: LicensePlan::Free,
            state,
            validation_state: LicenseValidationState::Failed,
            entitled_features: Vec::new(),
            ai_entitled: false,
            license_id: Some(stored.envelope.payload.license_id.clone()),
            customer_email: stored.envelope.payload.customer_email.clone(),
            expires_at_ms: Some(stored.envelope.payload.expires_at_ms),
            last_validated_at_ms: Some(stored.last_validated_at_ms),
            validation_required_at_ms: Some(validation_required_at_ms(stored.last_validated_at_ms)),
            reason: Some(reason),
        };
    }

    if stored.last_seen_at_ms > now_ms + CLOCK_ROLLBACK_TOLERANCE_MS {
        return LicenseStatus {
            plan: LicensePlan::Free,
            state: LicenseState::Invalid,
            validation_state: LicenseValidationState::Failed,
            entitled_features: Vec::new(),
            ai_entitled: false,
            license_id: Some(stored.envelope.payload.license_id.clone()),
            customer_email: stored.envelope.payload.customer_email.clone(),
            expires_at_ms: Some(stored.envelope.payload.expires_at_ms),
            last_validated_at_ms: Some(stored.last_validated_at_ms),
            validation_required_at_ms: Some(validation_required_at_ms(stored.last_validated_at_ms)),
            reason: Some(
                "System clock appears to have moved backward. Refresh license validation."
                    .to_string(),
            ),
        };
    }

    let validation_required_at_ms = validation_required_at_ms(stored.last_validated_at_ms);
    if now_ms > validation_required_at_ms {
        return LicenseStatus {
            plan: LicensePlan::Free,
            state: LicenseState::ValidationRequired,
            validation_state: LicenseValidationState::Required,
            entitled_features: Vec::new(),
            ai_entitled: false,
            license_id: Some(stored.envelope.payload.license_id.clone()),
            customer_email: stored.envelope.payload.customer_email.clone(),
            expires_at_ms: Some(stored.envelope.payload.expires_at_ms),
            last_validated_at_ms: Some(stored.last_validated_at_ms),
            validation_required_at_ms: Some(validation_required_at_ms),
            reason: Some(
                "License validation refresh is required before AI features can be used."
                    .to_string(),
            ),
        };
    }

    let entitled_features = if stored.envelope.payload.plan == LicensePlan::Premium {
        stored.envelope.payload.features.clone()
    } else {
        Vec::new()
    };
    let ai_entitled = entitled_features.contains(&PremiumFeature::Ai);
    LicenseStatus {
        plan: stored.envelope.payload.plan.clone(),
        state: LicenseState::Valid,
        validation_state: LicenseValidationState::Current,
        entitled_features,
        ai_entitled,
        license_id: Some(stored.envelope.payload.license_id.clone()),
        customer_email: stored.envelope.payload.customer_email.clone(),
        expires_at_ms: Some(stored.envelope.payload.expires_at_ms),
        last_validated_at_ms: Some(stored.last_validated_at_ms),
        validation_required_at_ms: Some(validation_required_at_ms),
        reason: if ai_entitled {
            None
        } else {
            Some(LICENSE_REQUIRED_REASON.to_string())
        },
    }
}

fn verify_license_envelope(
    envelope: &LicenseEnvelope,
    expected_machine_fingerprint: &str,
    now_ms: i64,
) -> Result<(), String> {
    if envelope.version != 1 {
        return Err("Unsupported license file version.".to_string());
    }
    if envelope.payload.machine_fingerprint != expected_machine_fingerprint {
        return Err("This license is assigned to another machine.".to_string());
    }
    if envelope.payload.expires_at_ms <= now_ms {
        return Err("This license has expired.".to_string());
    }
    verify_signature(envelope)
}

fn verify_signature(envelope: &LicenseEnvelope) -> Result<(), String> {
    let public_key = public_key_for_id(&envelope.key_id)
        .ok_or_else(|| "License key id is not trusted by this version of Gitano.".to_string())?;
    let signature = BASE64
        .decode(envelope.signature.as_bytes())
        .map_err(|_| "License signature is not valid base64.".to_string())?;
    let payload = canonical_payload_bytes(&envelope.payload)?;
    UnparsedPublicKey::new(&ED25519, public_key)
        .verify(&payload, &signature)
        .map_err(|_| "License signature is invalid.".to_string())
}

fn public_key_for_id(key_id: &str) -> Option<Vec<u8>> {
    #[cfg(test)]
    if let Ok(public_key) = std::env::var("GITANO_LICENSE_TEST_PUBLIC_KEY") {
        if key_id == CURRENT_PUBLIC_KEY_ID {
            return BASE64.decode(public_key).ok();
        }
    }

    match key_id {
        CURRENT_PUBLIC_KEY_ID => BASE64.decode(CURRENT_PUBLIC_KEY_B64).ok(),
        _ => None,
    }
}

fn canonical_payload_bytes(payload: &LicensePayload) -> Result<Vec<u8>, String> {
    serde_json::to_vec(payload).map_err(|error| error.to_string())
}

fn license_data_dir() -> PathBuf {
    if let Ok(path) = std::env::var("GITANO_LICENSE_HOME") {
        return PathBuf::from(path);
    }
    if let Ok(path) = std::env::var("GITANO_LOCAL_AI_HOME") {
        return Path::new(&path).join("license");
    }
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    Path::new(&home).join(".gitano").join("license")
}

fn license_path() -> PathBuf {
    license_data_dir().join(LICENSE_FILE_NAME)
}

fn load_stored_license() -> Result<Option<StoredLicense>, String> {
    let path = license_path();
    let Ok(contents) = fs::read_to_string(path) else {
        return Ok(None);
    };
    serde_json::from_str(&contents)
        .map(Some)
        .map_err(|error| format!("Stored license is invalid: {}", error))
}

fn save_stored_license(stored: &StoredLicense) -> Result<(), String> {
    let path = license_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let contents = serde_json::to_string_pretty(stored).map_err(|error| error.to_string())?;
    fs::write(path, contents).map_err(|error| error.to_string())
}

fn missing_status() -> LicenseStatus {
    LicenseStatus {
        plan: LicensePlan::Free,
        state: LicenseState::Missing,
        validation_state: LicenseValidationState::NotRequired,
        entitled_features: Vec::new(),
        ai_entitled: false,
        license_id: None,
        customer_email: None,
        expires_at_ms: None,
        last_validated_at_ms: None,
        validation_required_at_ms: None,
        reason: Some(LICENSE_REQUIRED_REASON.to_string()),
    }
}

fn invalid_status(reason: String) -> LicenseStatus {
    LicenseStatus {
        plan: LicensePlan::Free,
        state: LicenseState::Invalid,
        validation_state: LicenseValidationState::Failed,
        entitled_features: Vec::new(),
        ai_entitled: false,
        license_id: None,
        customer_email: None,
        expires_at_ms: None,
        last_validated_at_ms: None,
        validation_required_at_ms: None,
        reason: Some(reason),
    }
}

fn development_status() -> LicenseStatus {
    LicenseStatus {
        plan: LicensePlan::Premium,
        state: LicenseState::Valid,
        validation_state: LicenseValidationState::Current,
        entitled_features: vec![PremiumFeature::Ai],
        ai_entitled: true,
        license_id: Some("development".to_string()),
        customer_email: None,
        expires_at_ms: None,
        last_validated_at_ms: Some(now_ms()),
        validation_required_at_ms: None,
        reason: Some("Development AI entitlement is enabled.".to_string()),
    }
}

fn development_ai_entitlement_enabled() -> bool {
    // TODO(licensing): remove this debug-only bypass before production distribution.
    #[cfg(debug_assertions)]
    {
        return std::env::var(DEV_AI_ENTITLEMENT_ENV)
            .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
            .unwrap_or(false);
    }

    #[cfg(not(debug_assertions))]
    {
        false
    }
}

fn validation_required_at_ms(last_validated_at_ms: i64) -> i64 {
    last_validated_at_ms + LICENSE_VALIDATION_GRACE_MS
}

fn validation_is_current(last_validated_at_ms: i64, now_ms: i64) -> bool {
    now_ms <= validation_required_at_ms(last_validated_at_ms)
}

fn machine_fingerprint_parts() -> Vec<String> {
    vec![
        std::env::consts::OS.to_string(),
        std::env::consts::ARCH.to_string(),
        std::env::var("COMPUTERNAME").unwrap_or_default(),
        std::env::var("HOSTNAME").unwrap_or_default(),
        std::env::var("USER")
            .or_else(|_| std::env::var("USERNAME"))
            .unwrap_or_default(),
    ]
}

fn machine_fingerprint_from_parts(parts: &[String]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"gitano-license-machine-v1");
    for part in parts {
        hasher.update([0]);
        hasher.update(part.trim().to_lowercase().as_bytes());
    }
    format!("sha256:{:x}", hasher.finalize())
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use ring::rand::SystemRandom;
    use ring::signature::{Ed25519KeyPair, KeyPair};
    use tempfile::tempdir;

    struct EnvGuard {
        previous_license_home: Option<std::ffi::OsString>,
        previous_public_key: Option<std::ffi::OsString>,
        previous_dev_entitlement: Option<std::ffi::OsString>,
    }

    impl EnvGuard {
        fn set_license_home(path: &Path) -> Self {
            let previous_license_home = std::env::var_os("GITANO_LICENSE_HOME");
            let previous_public_key = std::env::var_os("GITANO_LICENSE_TEST_PUBLIC_KEY");
            let previous_dev_entitlement = std::env::var_os(DEV_AI_ENTITLEMENT_ENV);
            std::env::set_var("GITANO_LICENSE_HOME", path);
            Self {
                previous_license_home,
                previous_public_key,
                previous_dev_entitlement,
            }
        }
    }

    impl Drop for EnvGuard {
        fn drop(&mut self) {
            match &self.previous_license_home {
                Some(value) => std::env::set_var("GITANO_LICENSE_HOME", value),
                None => std::env::remove_var("GITANO_LICENSE_HOME"),
            }
            match &self.previous_public_key {
                Some(value) => std::env::set_var("GITANO_LICENSE_TEST_PUBLIC_KEY", value),
                None => std::env::remove_var("GITANO_LICENSE_TEST_PUBLIC_KEY"),
            }
            match &self.previous_dev_entitlement {
                Some(value) => std::env::set_var(DEV_AI_ENTITLEMENT_ENV, value),
                None => std::env::remove_var(DEV_AI_ENTITLEMENT_ENV),
            }
        }
    }

    fn test_key_pair() -> Ed25519KeyPair {
        let rng = SystemRandom::new();
        let pkcs8 = Ed25519KeyPair::generate_pkcs8(&rng).expect("generate key");
        Ed25519KeyPair::from_pkcs8(pkcs8.as_ref()).expect("key pair")
    }

    fn signed_envelope(
        key_pair: &Ed25519KeyPair,
        machine_fingerprint: &str,
        expires_at_ms: i64,
    ) -> LicenseEnvelope {
        let payload = LicensePayload {
            license_id: "lic_test".to_string(),
            customer_email: Some("user@example.com".to_string()),
            plan: LicensePlan::Premium,
            features: vec![PremiumFeature::Ai],
            machine_fingerprint: machine_fingerprint.to_string(),
            issued_at_ms: 1,
            expires_at_ms,
        };
        let signature = key_pair.sign(&canonical_payload_bytes(&payload).expect("payload"));
        LicenseEnvelope {
            version: 1,
            key_id: CURRENT_PUBLIC_KEY_ID.to_string(),
            payload,
            signature: BASE64.encode(signature.as_ref()),
        }
    }

    fn set_test_public_key(key_pair: &Ed25519KeyPair) {
        std::env::set_var(
            "GITANO_LICENSE_TEST_PUBLIC_KEY",
            BASE64.encode(key_pair.public_key().as_ref()),
        );
    }

    fn verify_test_envelope(
        envelope: &LicenseEnvelope,
        public_key: &[u8],
        expected_machine: &str,
        now_ms: i64,
    ) -> Result<(), String> {
        if envelope.payload.machine_fingerprint != expected_machine {
            return Err("This license is assigned to another machine.".to_string());
        }
        if envelope.payload.expires_at_ms <= now_ms {
            return Err("This license has expired.".to_string());
        }
        let signature = BASE64.decode(envelope.signature.as_bytes()).unwrap();
        UnparsedPublicKey::new(&ED25519, public_key)
            .verify(
                &canonical_payload_bytes(&envelope.payload).expect("payload"),
                &signature,
            )
            .map_err(|_| "License signature is invalid.".to_string())
    }

    #[test]
    fn verifies_valid_license_signature() {
        let key_pair = test_key_pair();
        let envelope = signed_envelope(&key_pair, "sha256:test", 10_000);

        assert!(verify_test_envelope(
            &envelope,
            key_pair.public_key().as_ref(),
            "sha256:test",
            1_000
        )
        .is_ok());
    }

    #[test]
    fn rejects_modified_payload_signature() {
        let key_pair = test_key_pair();
        let mut envelope = signed_envelope(&key_pair, "sha256:test", 10_000);
        envelope.payload.features.clear();

        let error = verify_test_envelope(
            &envelope,
            key_pair.public_key().as_ref(),
            "sha256:test",
            1_000,
        )
        .expect_err("modified payload should fail");

        assert!(error.contains("signature"));
    }

    #[test]
    fn rejects_wrong_machine() {
        let key_pair = test_key_pair();
        let envelope = signed_envelope(&key_pair, "sha256:test", 10_000);

        let error = verify_test_envelope(
            &envelope,
            key_pair.public_key().as_ref(),
            "sha256:other",
            1_000,
        )
        .expect_err("wrong machine should fail");

        assert!(error.contains("another machine"));
    }

    #[test]
    fn rejects_expired_license() {
        let key_pair = test_key_pair();
        let envelope = signed_envelope(&key_pair, "sha256:test", 10_000);

        let error = verify_test_envelope(
            &envelope,
            key_pair.public_key().as_ref(),
            "sha256:test",
            10_001,
        )
        .expect_err("expired license should fail");

        assert!(error.contains("expired"));
    }

    #[test]
    fn reports_stale_validation_as_locked() {
        let _lock = crate::ai::local_ai_env_lock().lock().unwrap();
        let key_pair = test_key_pair();
        set_test_public_key(&key_pair);
        let stored = StoredLicense {
            envelope: signed_envelope(&key_pair, &machine_fingerprint(), 10_000_000_000),
            last_validated_at_ms: 1,
            last_seen_at_ms: 1,
            revoked_reason: None,
        };

        let status = status_for_stored_license(
            &stored,
            1 + LICENSE_VALIDATION_GRACE_MS + CLOCK_ROLLBACK_TOLERANCE_MS,
        );

        assert_eq!(status.state, LicenseState::ValidationRequired);
        assert!(!status.ai_entitled);
    }

    #[test]
    fn reports_clock_rollback_as_locked() {
        let _lock = crate::ai::local_ai_env_lock().lock().unwrap();
        let key_pair = test_key_pair();
        set_test_public_key(&key_pair);
        let stored = StoredLicense {
            envelope: signed_envelope(&key_pair, &machine_fingerprint(), 100_000_000),
            last_validated_at_ms: 10_000,
            last_seen_at_ms: 1_000_000,
            revoked_reason: None,
        };

        let status = status_for_stored_license(&stored, 1_000);

        assert_eq!(status.state, LicenseState::Invalid);
        assert!(!status.ai_entitled);
    }

    #[test]
    fn preserves_previous_license_when_import_fails() {
        let _lock = crate::ai::local_ai_env_lock().lock().unwrap();
        let temp_dir = tempdir().expect("temp dir");
        let _guard = EnvGuard::set_license_home(temp_dir.path());
        let existing = StoredLicense {
            envelope: LicenseEnvelope {
                version: 1,
                key_id: "unknown".to_string(),
                payload: LicensePayload {
                    license_id: "existing".to_string(),
                    customer_email: None,
                    plan: LicensePlan::Premium,
                    features: vec![PremiumFeature::Ai],
                    machine_fingerprint: machine_fingerprint(),
                    issued_at_ms: 1,
                    expires_at_ms: 100_000,
                },
                signature: "invalid".to_string(),
            },
            last_validated_at_ms: 1,
            last_seen_at_ms: 1,
            revoked_reason: None,
        };
        save_stored_license(&existing).expect("save existing");

        let error = tauri::async_runtime::block_on(import_license_contents("{"))
            .expect_err("invalid import should fail");
        let stored = load_stored_license()
            .expect("load stored")
            .expect("stored license");

        assert!(error.contains("valid JSON"));
        assert_eq!(stored.envelope.payload.license_id, "existing");
    }

    #[test]
    fn validation_request_includes_license_and_machine_fingerprint() {
        let key_pair = test_key_pair();
        let envelope = signed_envelope(&key_pair, "sha256:test", 10_000);

        let request = build_license_validation_request(&envelope, Some(7));

        assert_eq!(request.license_id, envelope.payload.license_id);
        assert_eq!(request.license, envelope);
        assert_eq!(request.machine_fingerprint, machine_fingerprint());
        assert_eq!(request.last_validated_at_ms, Some(7));
    }

    #[test]
    fn debug_dev_entitlement_unlocks_ai_without_license() {
        let _lock = crate::ai::local_ai_env_lock().lock().unwrap();
        let temp_dir = tempdir().expect("temp dir");
        let _guard = EnvGuard::set_license_home(temp_dir.path());
        std::env::set_var(DEV_AI_ENTITLEMENT_ENV, "1");

        let status = license_status();

        assert_eq!(status.plan, LicensePlan::Premium);
        assert!(status.ai_entitled);
        assert_eq!(status.license_id.as_deref(), Some("development"));
    }

    #[test]
    fn machine_fingerprint_is_stable_for_parts() {
        let parts = vec![
            "macos".to_string(),
            "arm64".to_string(),
            "Alice".to_string(),
        ];

        assert_eq!(
            machine_fingerprint_from_parts(&parts),
            machine_fingerprint_from_parts(&parts)
        );
    }
}
