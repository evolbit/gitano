import "@gfazioli/mantine-split-pane/styles.css";
import {
  LogicalPosition,
  LogicalSize,
  PhysicalPosition,
  PhysicalSize,
  getCurrentWindow,
} from "@tauri-apps/api/window";
import { MantineProvider } from "@mantine/core";
import i18n from "i18next";
import React from "react";
import ReactDOM from "react-dom/client";
import { I18nextProvider, initReactI18next } from "react-i18next";
import App from "./App";
import { REPO_LAYOUT } from "./constants/layout";
import "./index.css";
import {
  rehydrateWorkspaceUiStore,
  useWorkspaceUiStore,
} from "./store/workspaceUi";

i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        tabs: {
          launchpad: "Launchpad",
          branches: "Branches",
          commits: "Commits",
          changes: "Changes",
          settings: "Settings",
        },
        launchpad: {
          pullRequests: "Pull Requests",
          issues: "Issues",
          workspaces: "Workspaces",
          noPullRequests: "No pull requests found.",
          noIssues: "No issues found.",
          noWorkspaces: "No workspaces found.",
          detailsPanel: "Select a PR, issue or workspace to see details.",
        },
        commitDetails: {
          title: "Commit Details",
          hash: "Hash",
          author: "Author",
          date: "Date",
          message: "Message",
          filesChanged: "Files Changed",
        },
        fileTree: {
          title: "Files",
        },
        diffViewer: {
          title: "Diff Viewer",
        },
        changesPanel: {
          staging: "Staging Area",
          noStagedFiles: "No files staged for commit.",
          commit: "Commit",
        },
      },
    },
  },
});

async function applyWindowConstraints() {
  try {
    const currentWindow = getCurrentWindow();
    const minSize = new LogicalSize(
      REPO_LAYOUT.window.minWidth,
      REPO_LAYOUT.window.minHeight
    );
    const persistedBounds = useWorkspaceUiStore.getState().window;
    const width = Math.max(persistedBounds.width, REPO_LAYOUT.window.minWidth);
    const height = Math.max(
      persistedBounds.height,
      REPO_LAYOUT.window.minHeight
    );

    await currentWindow.setMinSize(minSize);
    await currentWindow.setSizeConstraints({
      minWidth: REPO_LAYOUT.window.minWidth,
      minHeight: REPO_LAYOUT.window.minHeight,
    });
    await currentWindow.setSize(new LogicalSize(width, height));

    if (
      persistedBounds.x !== undefined &&
      persistedBounds.y !== undefined
    ) {
      await currentWindow.setPosition(
        new LogicalPosition(persistedBounds.x, persistedBounds.y)
      );
    }

    // TODO: Window bounds are persisted correctly but still not restoring reliably
    // at startup on the desktop shell. Revisit with runtime instrumentation around
    // Tauri startup/window lifecycle and move the restore to the right post-init hook.
  } catch (error) {
    console.warn("Failed to apply window constraints", error);
  }
}

async function persistCurrentWindowBounds() {
  try {
    const currentWindow = getCurrentWindow();

    if (await currentWindow.isMaximized()) {
      return;
    }

    const scaleFactor = await currentWindow.scaleFactor();
    const size = (await currentWindow.innerSize()).toLogical(scaleFactor);
    const position = (await currentWindow.outerPosition()).toLogical(scaleFactor);

    useWorkspaceUiStore.getState().setWindowBounds({
      width: size.width,
      height: size.height,
      x: position.x,
      y: position.y,
    });
  } catch (error) {
    console.warn("Failed to persist window bounds", error);
  }
}

async function setupWindowPersistence() {
  const currentWindow = getCurrentWindow();

  await Promise.all([
    currentWindow.onResized(({ payload }) => {
      const size = payload as PhysicalSize;
      if (size.width > 0 && size.height > 0) {
        void persistCurrentWindowBounds();
      }
    }),
    currentWindow.onMoved(({ payload }) => {
      const position = payload as PhysicalPosition;
      if (position.x !== undefined && position.y !== undefined) {
        void persistCurrentWindowBounds();
      }
    }),
  ]);

  window.addEventListener("beforeunload", () => {
    void persistCurrentWindowBounds();
  });
}

async function bootstrap() {
  await rehydrateWorkspaceUiStore();
  await applyWindowConstraints();
  await setupWindowPersistence();

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <MantineProvider defaultColorScheme="dark">
        <I18nextProvider i18n={i18n}>
          <App />
        </I18nextProvider>
      </MantineProvider>
    </React.StrictMode>
  );

  window.requestAnimationFrame(() => {
    void applyWindowConstraints();

    window.setTimeout(() => {
      void applyWindowConstraints();
    }, 150);
  });
}

void bootstrap();
