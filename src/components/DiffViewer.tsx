import React from "react";
import { useTranslation } from "react-i18next";

const DiffViewer: React.FC = () => {
  const { t } = useTranslation();
  // Mock diff
  return (
    <div className="p-4 bg-gray-900 h-full flex-1 overflow-auto">
      <div className="font-bold mb-2">{t("diffViewer.title")}</div>
      <pre className="bg-gray-800 p-2 rounded text-xs overflow-x-auto">
        - const a = 1; + const a = 2;
      </pre>
    </div>
  );
};

export default DiffViewer;
