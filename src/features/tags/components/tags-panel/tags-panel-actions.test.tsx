import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_EVENTS } from "@/shared/config/events";
import {
  getTagsPanelMocks,
  listenForWindowEvent,
  localTagRef,
  matchingLocalTagRef,
  matchingOriginTagRef,
  mockRepositoryState,
  originTagRef,
  renderWithTagsQueryClient,
} from "./tags-panel-test-setup";
import { TagsPanel } from "./tags-panel";

const mocks = getTagsPanelMocks();

describe("TagsPanel actions", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("pushes a local-only tag from the context menu without placeholder actions", async () => {
    mocks.getLocalTagRefs.mockResolvedValue([localTagRef("v1.0.0")]);
    mocks.getOriginTagRefs.mockResolvedValue([]);
    mockRepositoryState();
    mocks.pushTag.mockResolvedValue(undefined);

    renderWithTagsQueryClient(<TagsPanel repoPath="/repo" />);

    fireEvent.contextMenu(await screen.findByText("v1.0.0"));

    expect(screen.queryByText("Solo")).not.toBeInTheDocument();
    expect(screen.queryByText("Hide")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Push tag to origin"));

    await waitFor(() => {
      expect(mocks.pushTag).toHaveBeenCalledWith("/repo", "v1.0.0");
    });
  });

  it("renames a local tag after debounced origin validation passes", async () => {
    mocks.getLocalTagRefs.mockResolvedValue([localTagRef("v1.0.0")]);
    mocks.getOriginTagRefs.mockResolvedValue([]);
    mockRepositoryState();
    mocks.checkTagNameAvailability.mockResolvedValue({
      validName: true,
      localExists: false,
      originExists: false,
      originAvailable: true,
      originError: null,
    });
    mocks.renameTag.mockResolvedValue(undefined);

    renderWithTagsQueryClient(<TagsPanel repoPath="/repo" />);

    fireEvent.contextMenu(await screen.findByText("v1.0.0"));
    fireEvent.click(screen.getByText("Rename tag..."));
    fireEvent.change(screen.getByLabelText("New tag name"), {
      target: { value: "v1.0.1" },
    });

    await waitFor(() => {
      expect(mocks.checkTagNameAvailability).toHaveBeenCalledWith("/repo", "v1.0.1");
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Rename locally" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Rename locally" }));

    await waitFor(() => {
      expect(mocks.renameTag).toHaveBeenCalledWith("/repo", "v1.0.0", "v1.0.1");
    });
  });

  it("allows case-only local renames when validation reports no exact duplicate", async () => {
    const commitsRefresh = listenForWindowEvent(APP_EVENTS.commitsRefresh);
    mocks.getLocalTagRefs.mockResolvedValue([localTagRef("Refactor-final-v1")]);
    mocks.getOriginTagRefs.mockResolvedValue([]);
    mockRepositoryState();
    mocks.checkTagNameAvailability.mockResolvedValue({
      validName: true,
      localExists: false,
      originExists: false,
      originAvailable: true,
      originError: null,
    });
    mocks.renameTag.mockResolvedValue(undefined);

    try {
      renderWithTagsQueryClient(<TagsPanel repoPath="/repo" />);

      fireEvent.contextMenu(await screen.findByText("Refactor-final-v1"));
      fireEvent.click(screen.getByText("Rename tag..."));
      fireEvent.change(screen.getByLabelText("New tag name"), {
        target: { value: "refactor-final-v1" },
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Rename locally" })).toBeEnabled();
      });
      fireEvent.click(screen.getByRole("button", { name: "Rename locally" }));

      await waitFor(() => {
        expect(mocks.renameTag).toHaveBeenCalledWith(
          "/repo",
          "Refactor-final-v1",
          "refactor-final-v1",
        );
      });
      await waitFor(() => expect(commitsRefresh.listener).toHaveBeenCalled());
    } finally {
      commitsRefresh.cleanup();
    }
  });

  it("blocks local rename when the new name exists on origin", async () => {
    mocks.getLocalTagRefs.mockResolvedValue([localTagRef("v1.0.0")]);
    mocks.getOriginTagRefs.mockResolvedValue([]);
    mockRepositoryState();
    mocks.checkTagNameAvailability.mockResolvedValue({
      validName: true,
      localExists: false,
      originExists: true,
      originAvailable: true,
      originError: null,
    });

    renderWithTagsQueryClient(<TagsPanel repoPath="/repo" />);

    fireEvent.contextMenu(await screen.findByText("v1.0.0"));
    fireEvent.click(screen.getByText("Rename tag..."));
    fireEvent.change(screen.getByLabelText("New tag name"), {
      target: { value: "v1.0.1" },
    });

    expect(await screen.findByText(/already exists on origin/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename locally" })).toBeDisabled();
  });

  it("shows delete-from-origin only when origin has the tag", async () => {
    mocks.getLocalTagRefs.mockResolvedValue([matchingLocalTagRef("v1.0.0")]);
    mocks.getOriginTagRefs.mockResolvedValue([matchingOriginTagRef("v1.0.0")]);
    mockRepositoryState();
    mocks.deleteTag.mockResolvedValue(undefined);

    renderWithTagsQueryClient(<TagsPanel repoPath="/repo" />);

    fireEvent.contextMenu(await screen.findByText("v1.0.0"));
    fireEvent.click(screen.getByText("Delete tag..."));

    expect(screen.getByLabelText(/Delete from origin too/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Delete from origin too/));
    fireEvent.click(screen.getByRole("button", { name: "Delete from origin" }));

    await waitFor(() => {
      expect(mocks.deleteTag).toHaveBeenCalledWith("/repo", "v1.0.0", {
        deleteLocal: true,
        deleteOrigin: true,
      });
    });
  });

  it("removes a deleted local tag immediately without showing panel loading", async () => {
    const commitsRefresh = listenForWindowEvent(APP_EVENTS.commitsRefresh);
    mocks.getLocalTagRefs
      .mockResolvedValueOnce([localTagRef("v1.0.0")])
      .mockImplementation(() => new Promise(() => undefined));
    mocks.getOriginTagRefs.mockResolvedValue([]);
    mockRepositoryState();
    mocks.deleteTag.mockResolvedValue(undefined);

    try {
      renderWithTagsQueryClient(<TagsPanel repoPath="/repo" />);

      fireEvent.contextMenu(await screen.findByText("v1.0.0"));
      fireEvent.click(screen.getByText("Delete tag..."));
      fireEvent.click(screen.getByRole("button", { name: "Delete locally" }));

      await waitFor(() => {
        expect(mocks.deleteTag).toHaveBeenCalledWith("/repo", "v1.0.0", {
          deleteLocal: true,
          deleteOrigin: false,
        });
      });

      expect(screen.queryByText("v1.0.0")).not.toBeInTheDocument();
      expect(screen.queryByText("Loading")).not.toBeInTheDocument();
      await waitFor(() => expect(commitsRefresh.listener).toHaveBeenCalled());
    } finally {
      commitsRefresh.cleanup();
    }
  });

  it("deletes origin-only tags from origin", async () => {
    mocks.getLocalTagRefs.mockResolvedValue([]);
    mocks.getOriginTagRefs.mockResolvedValue([originTagRef("v1.0.0")]);
    mockRepositoryState();
    mocks.deleteTag.mockResolvedValue(undefined);

    renderWithTagsQueryClient(<TagsPanel repoPath="/repo" />);

    fireEvent.contextMenu(await screen.findByText("v1.0.0"));
    fireEvent.click(screen.getByText("Delete tag..."));

    expect(screen.queryByLabelText(/Delete from origin too/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete from origin" }));

    await waitFor(() => {
      expect(mocks.deleteTag).toHaveBeenCalledWith("/repo", "v1.0.0", {
        deleteLocal: false,
        deleteOrigin: true,
      });
    });
  });
});
