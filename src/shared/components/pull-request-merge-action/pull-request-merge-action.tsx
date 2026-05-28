import { Menu } from "@mantine/core";
import type { PullRequestMergeMethod } from "@/shared/api/integrations";
import {
  IconCheck,
  IconChevronDown,
} from "@/shared/components/icons/icons";
import type { MergeMethodOption } from "@/shared/lib/pull-requests/merge-methods";
import { mergeMethodLabel } from "@/shared/lib/pull-requests/merge-methods";

type PullRequestMergeActionProps = {
  mergeMethods: MergeMethodOption[];
  mergeOptionsLoading: boolean;
  selectedMergeMethod: PullRequestMergeMethod;
  onMergeMethodChange: (method: PullRequestMergeMethod) => void;
  onMerge: () => void;
};

export function PullRequestMergeAction({
  mergeMethods,
  mergeOptionsLoading,
  selectedMergeMethod,
  onMergeMethodChange,
  onMerge,
}: PullRequestMergeActionProps) {
  const selectedMergeMethodEnabled = mergeMethods.some(
    (option) => option.method === selectedMergeMethod,
  );
  const mergeDisabled =
    mergeOptionsLoading ||
    mergeMethods.length === 0 ||
    !selectedMergeMethodEnabled;

  return (
    <div className="flex h-8 shrink-0 overflow-hidden rounded border border-lime-500/40 bg-lime-500/15 text-xs font-semibold text-lime-100">
      <button
        type="button"
        className="px-3 transition-colors hover:bg-lime-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={mergeDisabled}
        title={
          mergeDisabled
            ? "Repository merge methods are not available."
            : mergeMethodLabel(selectedMergeMethod)
        }
        onClick={onMerge}
      >
        Merge
      </button>
      <Menu
        shadow="lg"
        width={330}
        position="bottom-end"
        withinPortal
        zIndex={10050}
      >
        <Menu.Target>
          <button
            type="button"
            aria-label="Choose merge method"
            className="flex w-8 items-center justify-center border-l border-lime-500/40 transition-colors hover:bg-lime-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={mergeDisabled}
          >
            <IconChevronDown size={14} />
          </button>
        </Menu.Target>
        <Menu.Dropdown className="overflow-hidden rounded border border-zinc-700 bg-zinc-900 p-0 text-zinc-100 shadow-xl">
          {mergeMethods.map((option) => (
            <Menu.Item
              key={option.method}
              className="border-b border-border last:border-b-0 data-[hovered]:bg-blue-500/20"
              onClick={() => onMergeMethodChange(option.method)}
            >
              <div className="flex gap-3 py-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-zinc-200">
                  {selectedMergeMethod === option.method ? (
                    <IconCheck size={16} />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-zinc-100">
                    {option.label}
                  </span>
                  <span className="mt-1 block whitespace-normal text-xs leading-5 text-zinc-300">
                    {option.description}
                  </span>
                </span>
              </div>
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}
