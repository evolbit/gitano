import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { vi } from "vitest";

vi.mock("@/shared/platform/tauri/storage", () => ({
  tauriStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

const mocks = vi.hoisted(() => ({
  getTagRefs: vi.fn(),
  getLocalTagRefs: vi.fn(),
  getOriginTagRefs: vi.fn(),
  checkTagNameAvailability: vi.fn(),
  createTag: vi.fn(),
  deleteTag: vi.fn(),
  pushTag: vi.fn(),
  renameTag: vi.fn(),
  searchTagCommits: vi.fn(),
  getRepositoryState: vi.fn(),
  getRemoteUrl: vi.fn(),
  writeClipboardText: vi.fn(),
  writeClipboardTextFromPromise: vi.fn(),
}));

export function getTagsPanelMocks() {
  return mocks;
}

vi.mock("@/shared/api/git/tags", () => ({
  getTagRefs: mocks.getTagRefs,
  getLocalTagRefs: mocks.getLocalTagRefs,
  getOriginTagRefs: mocks.getOriginTagRefs,
  checkTagNameAvailability: mocks.checkTagNameAvailability,
  createTag: mocks.createTag,
  deleteTag: mocks.deleteTag,
  pushTag: mocks.pushTag,
  renameTag: mocks.renameTag,
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

export function tagRef(
  name: string,
  status: "local-origin" | "local" | "origin" | "conflict" | "unknown",
) {
  const hasLocal = status !== "origin";
  const hasOrigin = status === "local-origin" || status === "origin" || status === "conflict";
  const matchingObjectId = `${name}-object`;
  return {
    name,
    localObjectId: hasLocal
      ? status === "local-origin"
        ? matchingObjectId
        : `${name}-local`
      : null,
    originObjectId: hasOrigin
      ? status === "local-origin"
        ? matchingObjectId
        : `${name}-origin`
      : null,
    localTargetId: hasLocal
      ? status === "local-origin"
        ? matchingObjectId
        : `${name}-local-target`
      : null,
    originTargetId: hasOrigin
      ? status === "local-origin"
        ? matchingObjectId
        : `${name}-origin-target`
      : null,
    status,
    isLocalAnnotated: false,
  };
}

export function localTagRef(name: string) {
  const tag = tagRef(name, "local");
  return {
    ...tag,
    status: "local" as const,
  };
}

export function originTagRef(name: string, objectId = `${name}-origin`) {
  return {
    name,
    localObjectId: null,
    originObjectId: objectId,
    localTargetId: null,
    originTargetId: objectId,
    status: "origin" as const,
    isLocalAnnotated: false,
  };
}

export function matchingLocalTagRef(name: string) {
  const tag = tagRef(name, "local-origin");
  return {
    ...tag,
    originObjectId: null,
    originTargetId: null,
    status: "local" as const,
  };
}

export function matchingOriginTagRef(name: string) {
  const tag = tagRef(name, "local-origin");
  return {
    ...tag,
    localObjectId: null,
    localTargetId: null,
    status: "origin" as const,
    isLocalAnnotated: false,
  };
}

export function createTagsPanelQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

export function renderWithTagsQueryClient(
  ui: ReactElement,
  queryClient = createTagsPanelQueryClient(),
) {
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    ),
  };
}

export function mockRepositoryState() {
  mocks.getRepositoryState.mockResolvedValue({
    path: "/repo",
    isValid: true,
    branch: "main",
    headStatus: "normal",
    hasCommits: true,
    isUnborn: false,
    isDetached: false,
  });
}

export function listenForWindowEvent(eventName: string) {
  const listener = vi.fn();
  window.addEventListener(eventName, listener);

  return {
    listener,
    cleanup: () => window.removeEventListener(eventName, listener),
  };
}
