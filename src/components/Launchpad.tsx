import React, { useState } from "react";
import { useTranslation } from "react-i18next";

const Launchpad: React.FC = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"prs" | "issues" | "workspaces">("prs");
  return (
    <div className="flex h-full">
      {/* Main list */}
      <div className="flex-1 flex flex-col border-r border-gray-800 bg-gray-900">
        <div className="flex gap-2 px-4 pt-4 pb-2 border-b border-gray-800">
          <button
            className={`px-3 py-1 rounded-t ${
              tab === "prs"
                ? "font-bold border-b-2 border-blue-500 text-blue-400"
                : "text-gray-400"
            }`}
            onClick={() => setTab("prs")}>
            {t("launchpad.pullRequests")}
          </button>
          <button
            className={`px-3 py-1 rounded-t ${
              tab === "issues"
                ? "font-bold border-b-2 border-blue-500 text-blue-400"
                : "text-gray-400"
            }`}
            onClick={() => setTab("issues")}>
            {t("launchpad.issues")}
          </button>
          <button
            className={`px-3 py-1 rounded-t ${
              tab === "workspaces"
                ? "font-bold border-b-2 border-blue-500 text-blue-400"
                : "text-gray-400"
            }`}
            onClick={() => setTab("workspaces")}>
            {t("launchpad.workspaces")}
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {tab === "prs" && <div>{t("launchpad.noPullRequests")}</div>}
          {tab === "issues" && <div>{t("launchpad.noIssues")}</div>}
          {tab === "workspaces" && <div>{t("launchpad.noWorkspaces")}</div>}
        </div>
      </div>
      {/* Details panel */}
      <div className="w-96 bg-gray-950 p-4 border-l border-gray-800">
        <div className="text-gray-400">{t("launchpad.detailsPanel")}</div>
      </div>
    </div>
  );
};

export default Launchpad;
