import React from "react";
import { useTranslation } from "react-i18next";
import DiffViewer from "./DiffViewer";
import FileTree from "./FileTree";

const ChangesPanel: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="flex h-full">
      <FileTree />
      <DiffViewer />
      <div className="w-80 bg-zinc-950 p-4 border-l border-zinc-800 flex flex-col">
        <div className="font-bold mb-2">{t("changesPanel.staging")}</div>
        <div className="flex-1 text-zinc-400">
          {t("changesPanel.noStagedFiles")}
        </div>
        <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          {t("changesPanel.commit")}
        </button>
      </div>
    </div>
  );
};

export default ChangesPanel;
