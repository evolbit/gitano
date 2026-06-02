import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLicenseStatus,
  importLicenseFile,
  refreshLicenseValidation,
  type LicenseStatus,
} from "@/shared/api/license";
import { openLicenseFileDialog } from "@/shared/platform/tauri/dialog";
import { LicenseWindow } from "./license-window";

vi.mock("@/shared/api/license", () => ({
  getLicenseStatus: vi.fn(),
  importLicenseFile: vi.fn(),
  refreshLicenseValidation: vi.fn(),
}));

vi.mock("@/shared/platform/tauri/dialog", () => ({
  openLicenseFileDialog: vi.fn(),
}));

const apiMocks = vi.mocked({
  getLicenseStatus,
  importLicenseFile,
  refreshLicenseValidation,
  openLicenseFileDialog,
});

function licenseStatus(overrides: Partial<LicenseStatus> = {}): LicenseStatus {
  return {
    plan: "free",
    state: "missing",
    validationState: "notRequired",
    entitledFeatures: [],
    aiEntitled: false,
    licenseId: null,
    customerEmail: null,
    expiresAtMs: null,
    lastValidatedAtMs: null,
    validationRequiredAtMs: null,
    reason: "AI features require a valid Gitano license.",
    ...overrides,
  };
}

describe("LicenseWindow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getLicenseStatus.mockResolvedValue(licenseStatus());
  });

  afterEach(() => {
    cleanup();
  });

  it("loads and renders missing license status", async () => {
    render(<LicenseWindow open onClose={vi.fn()} />);

    expect(await screen.findByText("Free")).toBeInTheDocument();
    expect(screen.getByText("AI features require a valid Gitano license.")).toBeInTheDocument();
  });

  it("imports a selected license file", async () => {
    apiMocks.openLicenseFileDialog.mockResolvedValue("/tmp/license.gitano-license");
    apiMocks.importLicenseFile.mockResolvedValue(
      licenseStatus({
        plan: "premium",
        state: "valid",
        validationState: "current",
        entitledFeatures: ["ai"],
        aiEntitled: true,
        licenseId: "lic_123",
        reason: null,
      }),
    );

    render(<LicenseWindow open onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Import file" }));

    await waitFor(() => {
      expect(apiMocks.importLicenseFile).toHaveBeenCalledWith({
        path: "/tmp/license.gitano-license",
      });
    });
    expect(await screen.findByText("Premium")).toBeInTheDocument();
    expect(screen.getByText("lic_123")).toBeInTheDocument();
  });

  it("shows import errors without clearing status", async () => {
    apiMocks.openLicenseFileDialog.mockResolvedValue("/tmp/bad.gitano-license");
    apiMocks.importLicenseFile.mockRejectedValue(new Error("License signature is invalid."));

    render(<LicenseWindow open onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Import file" }));

    expect(await screen.findByText("License signature is invalid.")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
  });

  it("refreshes validation for imported licenses", async () => {
    apiMocks.getLicenseStatus.mockResolvedValue(
      licenseStatus({ licenseId: "lic_123", state: "validationRequired" }),
    );
    apiMocks.refreshLicenseValidation.mockResolvedValue(
      licenseStatus({
        plan: "premium",
        state: "valid",
        validationState: "current",
        entitledFeatures: ["ai"],
        aiEntitled: true,
        licenseId: "lic_123",
        reason: null,
      }),
    );

    render(<LicenseWindow open onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(apiMocks.refreshLicenseValidation).toHaveBeenCalledWith({ force: true });
    });
    expect(await screen.findByText("Premium")).toBeInTheDocument();
  });
});
