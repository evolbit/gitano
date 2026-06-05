import type { ChangesExplorerFile } from "@/shared/lib/tree/changes-explorer-tree";
import { ChangeType } from "@/shared/types/git";
import {
  IconCopy,
  IconExchange,
  IconGitMerge,
  IconMinus,
  IconPencil,
  IconPlus,
  IconPoint,
  IconQuestionMark,
} from "@/shared/components/icons/icons";
import { isUntrackedFile } from "../../utils";

function StatusSquare({
  colorClass,
  children,
}: {
  colorClass: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-[3px] border ${colorClass}`}
    >
      {children}
    </span>
  );
}

export function ChangesExplorerStatusIcon({ file }: { file: ChangesExplorerFile }) {
  if (isUntrackedFile(file)) {
    return (
      <StatusSquare colorClass="border-lime-400 text-lime-400">
        <IconPlus size={10} />
      </StatusSquare>
    );
  }

  switch (file.status) {
    case ChangeType.Conflicted:
      return (
        <StatusSquare colorClass="border-amber-400 text-amber-400">
          <IconGitMerge size={10} />
        </StatusSquare>
      );
    case ChangeType.Added:
      return (
        <StatusSquare colorClass="border-lime-400 text-lime-400">
          <IconPlus size={10} />
        </StatusSquare>
      );
    case ChangeType.Deleted:
      return (
        <StatusSquare colorClass="border-red-500 text-red-500">
          <IconMinus size={10} />
        </StatusSquare>
      );
    case ChangeType.Modified:
      return (
        <StatusSquare colorClass="border-yellow-500 text-yellow-500">
          <IconPoint size={10} />
        </StatusSquare>
      );
    case ChangeType.Renamed:
      return (
        <StatusSquare colorClass="border-blue-500 text-blue-500">
          <IconPencil size={10} />
        </StatusSquare>
      );
    case ChangeType.Copied:
      return (
        <StatusSquare colorClass="border-purple-500 text-purple-500">
          <IconCopy size={10} />
        </StatusSquare>
      );
    case ChangeType.TypeChanged:
      return (
        <StatusSquare colorClass="border-orange-500 text-orange-500">
          <IconExchange size={10} />
        </StatusSquare>
      );
    default:
      return (
        <StatusSquare colorClass="border-zinc-500 text-zinc-500">
          <IconQuestionMark size={10} />
        </StatusSquare>
      );
  }
}
