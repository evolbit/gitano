import React from "react";
import { useTranslation } from "react-i18next";

const CommitDetailsPanel: React.FC = () => {
  const { t } = useTranslation();
  // Mock data
  const commit = {
    hash: "abc1234",
    author: "John Doe",
    date: "2024-06-10",
    message: "Initial commit",
    files: ["src/App.tsx", "src/index.css"],
  };
  return (
    <div className="p-4 bg-zinc-950 h-full border-l border-zinc-800">
      <div className="font-bold text-lg mb-2">{t("commitDetails.title")}</div>
      <div className="mb-1">
        {t("commitDetails.hash")}:{" "}
        <span className="text-blue-400">{commit.hash}</span>
      </div>
      <div className="mb-1">
        {t("commitDetails.author")}: {commit.author}
      </div>
      <div className="mb-1">
        {t("commitDetails.date")}: {commit.date}
      </div>
      <div className="mb-2">
        {t("commitDetails.message")}: {commit.message}
      </div>
      <div className="font-semibold mb-1">
        {t("commitDetails.filesChanged")}:
      </div>
      <ul className="text-sm text-zinc-400 list-disc ml-5">
        {commit.files.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </div>
  );
};

export default CommitDetailsPanel;
