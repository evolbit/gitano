import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TagsPanel } from "./tags-panel";

vi.mock("@/shared/platform/tauri/storage", () => ({
  tauriStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

const mocks = vi.hoisted(() => ({
  getTags: vi.fn(),
  createTag: vi.fn(),
  searchTagCommits: vi.fn(),
  getRepositoryState: vi.fn(),
  getRemoteUrl: vi.fn(),
  writeClipboardText: vi.fn(),
  writeClipboardTextFromPromise: vi.fn(),
}));

vi.mock("@/shared/api/git/tags", () => ({
  getTags: mocks.getTags,
  createTag: mocks.createTag,
  searchTagCommits: mocks.searchTagCommits,
}));
vi.mock("@/shared/api/repositories", () => ({
  getRepositoryState: mocks.getRepositoryState,
}));
vi.mock("@/shared/api/git/commits", () => ({
  getRemoteUrl: mocks.getRemoteUrl,
}));
vi.mock("@/shared/platform/clipboard", () => ({
  writeClipboardText: mocks.writeClipboardText,
  writeClipboardTextFromPromise: mocks.writeClipboardTextFromPromise,
}));

describe("TagsPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads tags and filters visible tag rows", async () => {
    mocks.getTags.mockResolvedValue(["v1.0.0", "release/next"]);
    mocks.getRepositoryState.mockResolvedValue({
      path: "/repo",
      isValid: true,
      branch: "main",
      headStatus: "normal",
      hasCommits: true,
      isUnborn: false,
      isDetached: false,
    });
    mocks.searchTagCommits.mockResolvedValue([]);

    render(<TagsPanel repoPath="/repo" />);

    expect(await screen.findByText("v1.0.0")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search tags..."), {
      target: { value: "release" },
    });

    expect(screen.queryByText("v1.0.0")).not.toBeInTheDocument();
    expect(screen.getByText("release")).toBeInTheDocument();
  });

  it("creates a tag for the selected commit from the add panel", async () => {
    mocks.getTags.mockResolvedValue([]);
    mocks.getRepositoryState.mockResolvedValue({
      path: "/repo",
      isValid: true,
      branch: "main",
      headStatus: "normal",
      hasCommits: true,
      isUnborn: false,
      isDetached: false,
    });
    mocks.searchTagCommits.mockResolvedValue([
      { sha: "abcdef123456", shortSha: "abcdef1", message: "Release commit", author: "Ada", date: 0 },
    ]);
    mocks.createTag.mockResolvedValue(undefined);

    render(<TagsPanel repoPath="/repo" />);

    fireEvent.click(screen.getByRole("button", { name: "Add tag" }));
    fireEvent.change(screen.getByPlaceholderText("v1.0.0"), {
      target: { value: "v2.0.0" },
    });

    await waitFor(() => expect(screen.getByRole("button", { name: "Create tag" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Create tag" }));

    await waitFor(() => {
      expect(mocks.createTag).toHaveBeenCalledWith(
        "/repo",
        "v2.0.0",
        "abcdef123456",
        false,
        null,
      );
    });
  });
});
