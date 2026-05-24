import React from "react";
import { useTranslation } from "react-i18next";

const FileTree: React.FC = () => {
  const { t } = useTranslation();
  // Mock data
  const files = [
    {
      name: "src",
      type: "folder",
      children: [
        { name: "App.tsx", type: "file" },
        { name: "index.css", type: "file" },
      ],
    },
    { name: "package.json", type: "file" },
  ];
  return (
    <div className="p-4 bg-gray-950 h-full border-r border-gray-800 w-64">
      <div className="font-bold mb-2">{t("fileTree.title")}</div>
      <ul className="text-sm text-gray-400">
        {files.map((f) =>
          f.type === "folder" ? (
            <li
              key={f.name}
              className="mb-1">
              <span className="font-semibold">📁 {f.name}</span>
              <ul className="ml-4">
                {f.children?.map((child) => (
                  <li key={child.name}>📄 {child.name}</li>
                ))}
              </ul>
            </li>
          ) : (
            <li key={f.name}>📄 {f.name}</li>
          )
        )}
      </ul>
    </div>
  );
};

export default FileTree;
