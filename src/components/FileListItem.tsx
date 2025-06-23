import { useState } from "react";
import { FileChange } from "../types/git";
import {
  IconCopy,
  IconExchange,
  IconMinus,
  IconPencil,
  IconPlus,
  IconPoint,
  IconQuestionMark,
} from "./icons";

interface FileListItemProps {
  file: FileChange;
}

const FileListItem = ({ file }: FileListItemProps) => {
  const [isHovered, setIsHovered] = useState(false);

  console.log("File status:", file.status);

  const getStatusIcon = () => {
    switch (file.status.toLowerCase()) {
      case "added":
        return (
          <IconPlus
            size={16}
            className="text-green-500 w-4 h-4 flex-shrink-0"
          />
        );
      case "deleted":
        return (
          <IconMinus
            size={16}
            className="text-red-500 w-4 h-4 flex-shrink-0"
          />
        );
      case "modified":
        return (
          <IconPoint
            size={16}
            className="text-yellow-500 w-4 h-4 flex-shrink-0"
          />
        );
      case "renamed":
        return (
          <IconPencil
            size={16}
            className="text-blue-500 w-4 h-4 flex-shrink-0"
          />
        );
      case "copied":
        return (
          <IconCopy
            size={16}
            className="text-purple-500 w-4 h-4 flex-shrink-0"
          />
        );
      case "typeChanged":
        return (
          <IconExchange
            size={16}
            className="text-orange-500 w-4 h-4 flex-shrink-0"
          />
        );
      default:
        return (
          <IconQuestionMark
            size={16}
            className="text-gray-500 w-4 h-4 flex-shrink-0"
          />
        );
    }
  };

  return (
    <li
      className="flex items-center p-1 hover:bg-zinc-800/50 rounded"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {getStatusIcon()}
        {(() => {
          const lastSlash = file.path.lastIndexOf("/");
          if (lastSlash === -1) {
            return <span className="truncate">{file.path}</span>;
          }
          const dir = file.path.substring(0, lastSlash + 1);
          const name = file.path.substring(lastSlash + 1);
          return (
            <div
              className="flex items-baseline min-w-0"
              title={file.path}>
              <span className="truncate text-zinc-400">{dir}</span>
              <span className="flex-shrink-0 text-zinc-100">{name}</span>
            </div>
          );
        })()}
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-400 ml-4 min-w-[56px] justify-end">
        <span className="text-green-500">+{file.insertions}</span>
        <span className="text-red-500">-{file.deletions}</span>
      </div>
    </li>
  );
};

export default FileListItem;
