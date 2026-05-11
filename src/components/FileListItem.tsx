import { useState } from "react";
import { FileChange } from "../types/git";
import { getFileName, getParentPath } from "./utils/path";
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

  const getStatusIcon = () => {
    // If this is a new file (added with 0 insertions/deletions), show a question mark
    if (
      file.status.toLowerCase() === "added" &&
      file.insertions === 0 &&
      file.deletions === 0
    ) {
      return (
        <IconQuestionMark
          size={16}
          className="text-yellow-500 w-4 h-4 flex-shrink-0"
        />
      );
    }

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
    <div
      className="flex items-center p-1 rounded min-w-0 flex-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}>
      {getStatusIcon()}
      <span className="ml-2 flex-1 min-w-0 truncate text-zinc-100 whitespace-nowrap">
        {(() => {
          const dir = getParentPath(file.path);
          const name = getFileName(file.path);

          if (!dir) {
            return <span className="truncate">{file.path}</span>;
          }

          return (
            <>
              <span className="truncate text-zinc-400">{`${dir}/`}</span>
              <span className="text-zinc-100 flex-shrink-0">{name}</span>
            </>
          );
        })()}
      </span>
      {/* Show numbers only if this is not a new file */}
      {!(
        file.status.toLowerCase() === "added" &&
        file.insertions === 0 &&
        file.deletions === 0
      ) && (
        <span className="flex items-end gap-2 justify-between w-14 ml-3 text-xs text-zinc-400">
          <span className="text-green-500 w-1/2 text-right block">
            +{file.insertions}
          </span>
          <span className="text-red-500 w-1/2 text-right block">
            -{file.deletions}
          </span>
        </span>
      )}
    </div>
  );
};

export default FileListItem;
