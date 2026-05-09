import "@gfazioli/mantine-split-pane/styles.css";
import { LogicalSize, getCurrentWindow } from "@tauri-apps/api/window";
import { MantineProvider } from "@mantine/core";
import i18n from "i18next";
import React from "react";
import ReactDOM from "react-dom/client";
import { I18nextProvider, initReactI18next } from "react-i18next";
import App from "./App";
import { REPO_LAYOUT } from "./constants/layout";
import "./index.css";

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
    const minSize = new LogicalSize(
      REPO_LAYOUT.window.minWidth,
      REPO_LAYOUT.window.minHeight
    );

    await getCurrentWindow().setMinSize(minSize);
    await getCurrentWindow().setSizeConstraints({
      minWidth: REPO_LAYOUT.window.minWidth,
      minHeight: REPO_LAYOUT.window.minHeight,
    });
    await getCurrentWindow().setSize(
      new LogicalSize(REPO_LAYOUT.window.width, REPO_LAYOUT.window.height)
    );
  } catch (error) {
    console.warn("Failed to apply window constraints", error);
  }
}

async function bootstrap() {
  await applyWindowConstraints();

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <MantineProvider defaultColorScheme="dark">
        <I18nextProvider i18n={i18n}>
          <App />
        </I18nextProvider>
      </MantineProvider>
    </React.StrictMode>
  );
}

void bootstrap();
