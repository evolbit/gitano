import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export const appI18n = i18n.createInstance();

void appI18n.use(initReactI18next).init({
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
