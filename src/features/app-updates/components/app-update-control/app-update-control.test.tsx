import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppUpdateControl } from "./app-update-control";

const updaterMocks = vi.hoisted(() => ({
  checkForAppUpdate: vi.fn(),
  installAppUpdate: vi.fn(),
  relaunchApp: vi.fn(),
}));

vi.mock("@/shared/platform/tauri/updater", () => updaterMocks);

function renderControl() {
  return render(
    <MantineProvider>
      <AppUpdateControl />
    </MantineProvider>,
  );
}

describe("AppUpdateControl", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    updaterMocks.checkForAppUpdate.mockReset();
    updaterMocks.installAppUpdate.mockReset();
    updaterMocks.relaunchApp.mockReset();
  });

  it("checks for updates from the menu", async () => {
    updaterMocks.checkForAppUpdate.mockResolvedValueOnce(null);
    const user = userEvent.setup();
    renderControl();

    await user.click(screen.getByRole("button", { name: /open app update menu/i }));
    await user.click(await screen.findByRole("button", { name: "Check" }));

    expect(await screen.findByText("Gitano is up to date.")).toBeInTheDocument();
    expect(updaterMocks.checkForAppUpdate).toHaveBeenCalledOnce();
  });

  it("requires an explicit install action before downloading", async () => {
    updaterMocks.checkForAppUpdate.mockResolvedValueOnce({
      version: "0.2.0",
      currentVersion: "0.1.0",
      date: null,
      body: null,
    });
    updaterMocks.installAppUpdate.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderControl();

    await user.click(screen.getByRole("button", { name: /open app update menu/i }));
    await user.click(await screen.findByRole("button", { name: "Check" }));

    expect(await screen.findByText("Version 0.2.0 is available.")).toBeInTheDocument();
    expect(updaterMocks.installAppUpdate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Install" }));

    expect(await screen.findByText("Update installed. Restart Gitano to finish.")).toBeInTheDocument();
    expect(updaterMocks.installAppUpdate).toHaveBeenCalledOnce();
  });
});
