import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTagsPanelQueryClient,
  getTagsPanelMocks,
  localTagRef,
  matchingLocalTagRef,
  matchingOriginTagRef,
  mockRepositoryState,
  originTagRef,
  resetTagsPanelWorkspaceStore,
  renderWithTagsQueryClient,
} from "./tags-panel-test-setup";
import { TagsPanel } from "./tags-panel";

const mocks = getTagsPanelMocks();

describe("TagsPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    resetTagsPanelWorkspaceStore();
  });

  it("shows blocking loading before the first local tag load", async () => {
    mocks.getLocalTagRefs.mockImplementation(() => new Promise(() => undefined));
    mocks.getOriginTagRefs.mockResolvedValue([]);
    mockRepositoryState();

    renderWithTagsQueryClient(<TagsPanel repoPath="/first-tag-load-repo" />);

    expect(await screen.findByText("Loading")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Refreshing tags" }),
    ).toBeInTheDocument();
  });

  it("keeps cached tags visible on tab re-entry while the query is fresh", async () => {
    const repoPath = "/cached-tag-reentry-repo";
    const queryClient = createTagsPanelQueryClient();
    mocks.getLocalTagRefs.mockResolvedValue([localTagRef("cached-tag")]);
    mocks.getOriginTagRefs.mockResolvedValue([]);
    mockRepositoryState();

    const firstRender = renderWithTagsQueryClient(
      <TagsPanel repoPath={repoPath} />,
      queryClient,
    );

    expect(await screen.findByText("cached-tag")).toBeInTheDocument();
    firstRender.unmount();

    mocks.getLocalTagRefs.mockImplementation(() => new Promise(() => undefined));

    renderWithTagsQueryClient(<TagsPanel repoPath={repoPath} />, queryClient);

    expect(screen.getByText("cached-tag")).toBeInTheDocument();
    expect(screen.queryByText("Loading")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("progressbar", { name: "Refreshing tags" }),
    ).not.toBeInTheDocument();
  });

  it("shows local tags before origin tags finish loading", async () => {
    mocks.getLocalTagRefs.mockResolvedValue([localTagRef("local-first")]);
    mocks.getOriginTagRefs.mockImplementation(() => new Promise(() => undefined));
    mockRepositoryState();
    mocks.searchTagCommits.mockResolvedValue([]);

    renderWithTagsQueryClient(<TagsPanel repoPath="/repo" />);

    expect(await screen.findByText("local-first")).toBeInTheDocument();
    expect(screen.getByTitle("Remote tag state unknown")).toBeInTheDocument();
    expect(screen.queryByText("Loading")).not.toBeInTheDocument();
  });

  it("loads tags and filters visible tag rows", async () => {
    mocks.getLocalTagRefs.mockResolvedValue([matchingLocalTagRef("v1.0.0")]);
    mocks.getOriginTagRefs.mockResolvedValue([
      matchingOriginTagRef("v1.0.0"),
      originTagRef("release/next"),
    ]);
    mockRepositoryState();
    mocks.searchTagCommits.mockResolvedValue([]);

    renderWithTagsQueryClient(<TagsPanel repoPath="/repo" />);

    expect(await screen.findByText("v1.0.0")).toBeInTheDocument();
    expect(await screen.findAllByTitle("Local tag")).not.toHaveLength(0);
    expect(await screen.findAllByTitle("Remote tag")).not.toHaveLength(0);

    fireEvent.change(screen.getByPlaceholderText("Search tags..."), {
      target: { value: "release" },
    });

    expect(screen.queryByText("v1.0.0")).not.toBeInTheDocument();
    expect(screen.getByText("release")).toBeInTheDocument();
  });

  it("filters tags by persisted local and remote toggles", async () => {
    mocks.getLocalTagRefs.mockResolvedValue([
      matchingLocalTagRef("both"),
      localTagRef("local-only"),
    ]);
    mocks.getOriginTagRefs.mockResolvedValue([
      matchingOriginTagRef("both"),
      originTagRef("origin-only"),
    ]);
    mockRepositoryState();

    renderWithTagsQueryClient(<TagsPanel repoPath="/repo" />);

    expect(await screen.findByText("both")).toBeInTheDocument();
    expect(screen.getByText("local-only")).toBeInTheDocument();
    expect(screen.getByText("origin-only")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Local tags" }));

    expect(screen.getByRole("button", { name: "Local tags" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.queryByText("local-only")).not.toBeInTheDocument();
    expect(screen.getByText("both")).toBeInTheDocument();
    expect(screen.getByText("origin-only")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remote tags" }));

    expect(screen.getByRole("button", { name: "Remote tags" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("origin-only")).toBeInTheDocument();
  });

  it("creates a tag for the selected commit from the add panel", async () => {
    mocks.getLocalTagRefs.mockResolvedValue([]);
    mocks.getOriginTagRefs.mockResolvedValue([]);
    mockRepositoryState();
    mocks.searchTagCommits.mockResolvedValue([
      {
        sha: "abcdef123456",
        shortSha: "abcdef1",
        message: "Release commit",
        author: "Ada",
        date: 0,
      },
    ]);
    mocks.createTag.mockResolvedValue(undefined);

    renderWithTagsQueryClient(<TagsPanel repoPath="/repo" />);

    fireEvent.click(screen.getByRole("button", { name: "Add tag" }));
    fireEvent.change(screen.getByPlaceholderText("v1.0.0"), {
      target: { value: "v2.0.0" },
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create tag" })).toBeEnabled(),
    );
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

  it("renders local and origin tag presence icons", async () => {
    mocks.getLocalTagRefs.mockResolvedValue([
      matchingLocalTagRef("both"),
      localTagRef("local-only"),
      localTagRef("drifted"),
    ]);
    mocks.getOriginTagRefs.mockResolvedValue([
      matchingOriginTagRef("both"),
      originTagRef("origin-only"),
      originTagRef("drifted"),
    ]);
    mockRepositoryState();

    renderWithTagsQueryClient(<TagsPanel repoPath="/repo" />);

    expect(await screen.findByText("both")).toBeInTheDocument();
    expect(screen.getAllByTitle("Local tag").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("Remote tag").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("No local tag").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("No remote tag").length).toBeGreaterThan(0);
    expect(screen.getByTitle("Local tag differs from remote")).toBeInTheDocument();
    expect(screen.getByTitle("Remote tag differs from local")).toBeInTheDocument();
  });

  it("marks local tags unknown when origin tags cannot load", async () => {
    mocks.getLocalTagRefs.mockResolvedValue([localTagRef("offline")]);
    mocks.getOriginTagRefs.mockRejectedValue("offline");
    mockRepositoryState();

    renderWithTagsQueryClient(<TagsPanel repoPath="/repo" />);

    expect(await screen.findByText("offline")).toBeInTheDocument();
    expect(screen.getByTitle("Remote tag state unknown")).toBeInTheDocument();
    expect(screen.getByText(/Origin tags unavailable/)).toBeInTheDocument();
  });
});
