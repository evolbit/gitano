import { describe, expect, it, vi } from "vitest";
import {
  getLicenseStatus,
  importLicenseFile,
  refreshLicenseValidation,
} from "./license";

const invokeCommandMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/platform/tauri/command", () => ({
  invokeCommand: invokeCommandMock,
}));

describe("license API", () => {
  it("gets license status through the backend command", async () => {
    invokeCommandMock.mockResolvedValueOnce({ state: "missing" });

    await getLicenseStatus();

    expect(invokeCommandMock).toHaveBeenCalledWith("license_get_status");
  });

  it("imports a license file through the backend command", async () => {
    invokeCommandMock.mockResolvedValueOnce({ state: "valid" });

    await importLicenseFile({ path: "/tmp/license.gitano-license" });

    expect(invokeCommandMock).toHaveBeenCalledWith("license_import_file", {
      request: { path: "/tmp/license.gitano-license" },
    });
  });

  it("refreshes license validation through the backend command", async () => {
    invokeCommandMock.mockResolvedValueOnce({ state: "valid" });

    await refreshLicenseValidation({ force: true });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "license_refresh_validation",
      {
        request: { force: true },
      },
    );
  });
});
