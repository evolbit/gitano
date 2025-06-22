import { useState } from "react";
import { FileChange } from "../types/git";
import { IconCircleDot, IconMinus, IconPlus, IconQuestionMark } from "./icons";

interface FileListItemProps {
  file: FileChange;
}

const FileListItem = ({ file }: FileListItemProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const getStatusIcon = () => {
    switch (file.status) {
      case "added":
        return (
          <IconPlus
            size={16}
            className="text-green-500"
          />
        );
      case "deleted":
        return (
          <IconMinus
            size={16}
            className="text-red-500"
          />
        );
      case "modified":
        return (
          <IconCircleDot
            size={16}
            className="text-yellow-500"
          />
        );
      default:
        return (
          <IconQuestionMark
            size={16}
            className="text-gray-500"
          />
        );
    }
  };

  return (
    <li
      className="flex justify-between items-center p-1 hover:bg-zinc-800/50 rounded"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}>
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-mono">{file.path}</span>
        </div>
        {isHovered && (
          <div className="flex items-center gap-2 ml-6 text-xs text-zinc-400">
            <span className="text-green-500">+{file.insertions}</span>
            <span className="text-red-500">-{file.deletions}</span>
          </div>
        )}
      </div>
    </li>
  );
};

export default FileListItem;
