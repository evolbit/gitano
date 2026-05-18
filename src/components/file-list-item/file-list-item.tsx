import { getFileName, getParentPath } from "@/shared/lib/path";
import {
  IconCopy,
  IconExchange,
  IconMinus,
  IconPencil,
  IconPlus,
  IconPoint,
  IconQuestionMark,
} from "../icons";
import { FileListItemProps } from "./types";

const FileListItem = ({ file }: FileListItemProps) => {
  const getStatusIcon = () => {
    // If this is a new file (added with 0 insertions/deletions), show a question mark
    if (
      file.status.toLowerCase() === "added" &&
      file.insertions === 0 &&
      file.deletions === 0
    ) {
      return (
        <IconQuestionMark
          size={14}
          className="h-3.5 w-3.5 flex-shrink-0 text-yellow-500"
        />
      );
    }

    switch (file.status.toLowerCase()) {
      case "added":
        return (
          <IconPlus
            size={14}
            className="h-3.5 w-3.5 flex-shrink-0 text-lime-400"
          />
        );
      case "deleted":
        return (
          <IconMinus
            size={14}
            className="h-3.5 w-3.5 flex-shrink-0 text-red-500"
          />
        );
      case "modified":
        return (
          <IconPoint
            size={14}
            className="h-3.5 w-3.5 flex-shrink-0 text-yellow-500"
          />
        );
      case "renamed":
        return (
          <IconPencil
            size={14}
            className="h-3.5 w-3.5 flex-shrink-0 text-blue-500"
          />
        );
      case "copied":
        return (
          <IconCopy
            size={14}
            className="h-3.5 w-3.5 flex-shrink-0 text-purple-500"
          />
        );
      case "typeChanged":
        return (
          <IconExchange
            size={14}
            className="h-3.5 w-3.5 flex-shrink-0 text-orange-500"
          />
        );
      default:
        return (
          <IconQuestionMark
            size={14}
            className="h-3.5 w-3.5 flex-shrink-0 text-gray-500"
          />
        );
    }
  };

  return (
    <div className="flex min-w-0 flex-1 items-center rounded p-0.5">
      {getStatusIcon()}
      <span className="ml-1.5 min-w-0 flex-1 truncate whitespace-nowrap text-zinc-100">
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
        <span className="ml-2 flex w-12 items-end justify-between gap-1.5 text-xs text-zinc-400">
          <span className="block w-1/2 text-right text-lime-400">
            +{file.insertions}
          </span>
          <span className="block w-1/2 text-right text-red-500">
            -{file.deletions}
          </span>
        </span>
      )}
    </div>
  );
};

export default FileListItem;
