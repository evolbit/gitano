import { invokeCommand } from "@/shared/platform/tauri/command";

export const PREMIUM_FEATURE = {
  AI: "ai",
} as const;

export type PremiumFeature =
  (typeof PREMIUM_FEATURE)[keyof typeof PREMIUM_FEATURE];

export type LicensePlan = "free" | "premium";

export type LicenseState =
  | "free"
  | "valid"
  | "missing"
  | "invalid"
  | "expired"
  | "wrongMachine"
  | "validationRequired"
  | "validationFailed"
  | "revoked";

export type LicenseValidationState =
  | "notRequired"
  | "current"
  | "required"
  | "failed";

export type LicenseStatus = {
  plan: LicensePlan;
  state: LicenseState;
  validationState: LicenseValidationState;
  entitledFeatures: PremiumFeature[];
  aiEntitled: boolean;
  licenseId: string | null;
  customerEmail: string | null;
  expiresAtMs: number | null;
  lastValidatedAtMs: number | null;
  validationRequiredAtMs: number | null;
  reason: string | null;
};

export type LicenseImportRequest = {
  path: string;
};

export type LicenseRefreshRequest = {
  force: boolean;
};

export function getLicenseStatus() {
  return invokeCommand<LicenseStatus>("license_get_status");
}

export function importLicenseFile(request: LicenseImportRequest) {
  return invokeCommand<LicenseStatus>("license_import_file", { request });
}

export function refreshLicenseValidation(request: LicenseRefreshRequest) {
  return invokeCommand<LicenseStatus>("license_refresh_validation", {
    request,
  });
}
