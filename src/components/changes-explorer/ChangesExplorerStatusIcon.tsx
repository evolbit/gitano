import { ChangesExplorerFile } from "../../utils/changesExplorerTree";
import {
  IconCopy,
  IconExchange,
  IconMinus,
  IconPencil,
  IconPlus,
  IconPoint,
  IconQuestionMark,
} from "../icons";
import { isUntrackedFile } from "./utils";

export function ChangesExplorerStatusIcon({ file }: { file: ChangesExplorerFile }) {
  if (isUntrackedFile(file)) {
    return <IconPlus size={16} className="h-4 w-4 flex-shrink-0 text-lime-400" />;
  }

  switch (file.status) {
    case "added":
      return (
        <IconPlus size={16} className="h-4 w-4 flex-shrink-0 text-green-500" />
      );
    case "deleted":
      return (
        <IconMinus size={16} className="h-4 w-4 flex-shrink-0 text-red-500" />
      );
    case "modified":
      return (
        <IconPoint
          size={16}
          className="h-4 w-4 flex-shrink-0 text-yellow-500"
        />
      );
    case "renamed":
      return (
        <IconPencil
          size={16}
          className="h-4 w-4 flex-shrink-0 text-blue-500"
        />
      );
    case "copied":
      return (
        <IconCopy
          size={16}
          className="h-4 w-4 flex-shrink-0 text-purple-500"
        />
      );
    case "typeChanged":
      return (
        <IconExchange
          size={16}
          className="h-4 w-4 flex-shrink-0 text-orange-500"
        />
      );
    default:
      return (
        <IconQuestionMark
          size={16}
          className="h-4 w-4 flex-shrink-0 text-zinc-500"
        />
      );
  }
}
