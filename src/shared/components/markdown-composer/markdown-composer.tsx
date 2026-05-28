import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  IconArrowBackUp,
  IconAt,
  IconBlockquote,
  IconBold,
  IconCode,
  IconHeading,
  IconItalic,
  IconLink,
  IconList,
  IconListCheck,
  IconListNumbers,
  IconMoodSmile,
  IconPaperclip,
} from "@/shared/components/icons/icons";
import {
  applyMarkdownToolbarAction,
  type MarkdownToolbarAction,
} from "@/shared/lib/markdown/markdown-transforms";
import { MarkdownRenderer } from "@/shared/components/markdown-renderer/markdown-renderer";

type MarkdownComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
};

const EMOJI_OPTIONS = ["👍", "👀", "🚀", "❤️", "🎉", "✅"];

export function MarkdownComposer({
  value,
  onChange,
  onSave,
  onCancel,
  saveLabel,
  placeholder = "Leave a comment",
  autoFocus = false,
  disabled = false,
}: MarkdownComposerProps) {
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyAction = useCallback(
    (action: MarkdownToolbarAction) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const next = applyMarkdownToolbarAction(
        {
          value,
          selectionStart: textarea.selectionStart,
          selectionEnd: textarea.selectionEnd,
        },
        action,
      );

      onChange(next.value);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(next.selectionStart, next.selectionEnd);
      });
    },
    [onChange, value],
  );

  const canSave = !disabled && value.trim().length > 0;

  return (
    <div className="overflow-hidden rounded border border-border bg-background">
      <div className="flex min-w-0 items-center justify-between border-b border-border bg-background-emphasis">
        <div className="flex items-center">
          <button
            type="button"
            className={`border-r border-border px-3 py-2 text-sm font-medium ${
              mode === "write"
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMode("write")}
          >
            Write
          </button>
          <button
            type="button"
            className={`border-r border-border px-3 py-2 text-sm font-medium ${
              mode === "preview"
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMode("preview")}
          >
            Preview
          </button>
        </div>

        <div className="flex items-center gap-0.5 px-2">
          <ToolbarButton
            label="Heading"
            onClick={() => applyAction({ type: "heading" })}
          >
            <IconHeading size={17} />
          </ToolbarButton>
          <ToolbarButton
            label="Bold"
            onClick={() => applyAction({ type: "bold" })}
          >
            <IconBold size={17} />
          </ToolbarButton>
          <ToolbarButton
            label="Italic"
            onClick={() => applyAction({ type: "italic" })}
          >
            <IconItalic size={17} />
          </ToolbarButton>
          <ToolbarButton
            label="Quote"
            onClick={() => applyAction({ type: "quote" })}
          >
            <IconBlockquote size={17} />
          </ToolbarButton>
          <ToolbarButton
            label="Code"
            onClick={() => applyAction({ type: "inlineCode" })}
          >
            <IconCode size={17} />
          </ToolbarButton>
          <ToolbarButton
            label="Link"
            onClick={() => applyAction({ type: "link" })}
          >
            <IconLink size={17} />
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            label="Ordered list"
            onClick={() => applyAction({ type: "orderedList" })}
          >
            <IconListNumbers size={17} />
          </ToolbarButton>
          <ToolbarButton
            label="Bullet list"
            onClick={() => applyAction({ type: "bulletList" })}
          >
            <IconList size={17} />
          </ToolbarButton>
          <ToolbarButton
            label="Task list"
            onClick={() => applyAction({ type: "taskList" })}
          >
            <IconListCheck size={17} />
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            label="Attach placeholder"
            onClick={() => applyAction({ type: "attachment" })}
          >
            <IconPaperclip size={17} />
          </ToolbarButton>
          <ToolbarButton
            label="Mention"
            onClick={() => applyAction({ type: "mention" })}
          >
            <IconAt size={17} />
          </ToolbarButton>
          <div className="relative">
            <ToolbarButton
              label="Emoji"
              onClick={() => setEmojiOpen((current) => !current)}
            >
              <IconMoodSmile size={17} />
            </ToolbarButton>
            {emojiOpen ? (
              <div className="absolute right-0 top-8 z-20 flex gap-1 rounded border border-border bg-background-emphasis p-1 shadow-lg">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded text-base hover:bg-zinc-800"
                    onClick={() => {
                      applyAction({ type: "emoji", emoji });
                      setEmojiOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <ToolbarButton
            label="Undo"
            onClick={() => {
              const textarea = textareaRef.current;
              if (!textarea) return;
              textarea.focus();
              document.execCommand("undo");
              onChange(textarea.value);
            }}
          >
            <IconArrowBackUp size={17} />
          </ToolbarButton>
        </div>
      </div>

      {mode === "write" ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-28 w-full resize-y bg-background p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
        />
      ) : (
        <div className="min-h-28 border-b border-border bg-background p-3">
          <MarkdownRenderer markdown={value} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background-emphasis px-3 py-2">
        <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-muted-foreground">
          <span>Markdown is supported</span>
          <span className="h-4 w-px bg-border" />
          <span>Paste, drop, or click to add files</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-foreground"
            onClick={onCancel}
            disabled={disabled}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onSave}
            disabled={!canSave}
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-foreground"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
