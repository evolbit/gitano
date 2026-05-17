import { afterEach, describe, expect, it, vi } from "vitest";
import {
  writeClipboardText,
  writeClipboardTextFromPromise,
} from "./clipboard";

const originalClipboard = navigator.clipboard;
const originalExecCommand = document.execCommand;

function setClipboard(clipboard: Partial<Clipboard> | undefined) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: clipboard,
  });
}

function setExecCommand(execCommand: Document["execCommand"] | undefined) {
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: execCommand,
  });
}

describe("writeClipboardText", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    setClipboard(originalClipboard);
    setExecCommand(originalExecCommand);
  });

  it("writes through the async Clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    await writeClipboardText("commit patch");

    expect(writeText).toHaveBeenCalledWith("commit patch");
  });

  it("falls back to a selected textarea when async clipboard writes are denied", async () => {
    const writeText = vi
      .fn()
      .mockRejectedValue(new DOMException("Not allowed", "NotAllowedError"));
    const execCommand = vi.fn(() => true);
    setClipboard({ writeText });
    setExecCommand(execCommand);

    await writeClipboardText("commit patch");

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).not.toBeInTheDocument();
  });

  it("throws when no clipboard write mechanism is available", async () => {
    setClipboard(undefined);
    setExecCommand(undefined);

    await expect(writeClipboardText("commit patch")).rejects.toThrow(
      "Clipboard write is not available in this context.",
    );
  });
});

describe("writeClipboardTextFromPromise", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    setClipboard(originalClipboard);
    setExecCommand(originalExecCommand);
  });

  it("starts a ClipboardItem write before awaiting async text", async () => {
    class TestClipboardItem {
      constructor(
        public readonly items: Record<string, Blob | Promise<Blob>>,
      ) {}
    }

    const write = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ write, writeText } as Partial<Clipboard>);
    vi.stubGlobal("ClipboardItem", TestClipboardItem);

    let resolveText!: (text: string) => void;
    const textPromise = new Promise<string>((resolve) => {
      resolveText = resolve;
    });
    const operation = writeClipboardTextFromPromise(textPromise);

    expect(write).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();

    let settled = false;
    void operation.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    resolveText("commit patch");
    await operation;

    const [items] = write.mock.calls[0];
    const item = items[0] as TestClipboardItem;
    const blob = await item.items["text/plain"];

    expect(await blob.text()).toBe("commit patch");
  });

  it("falls back to writeText when ClipboardItem writes are unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    await writeClipboardTextFromPromise(Promise.resolve("commit patch"));

    expect(writeText).toHaveBeenCalledWith("commit patch");
  });
});
