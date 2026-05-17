export async function writeClipboardText(text: string): Promise<void> {
  let clipboardError: unknown;

  try {
    const clipboard = getNavigatorClipboard();

    if (clipboard?.writeText) {
      await clipboard.writeText(text);
      return;
    }
  } catch (error) {
    clipboardError = error;
  }

  if (copyTextWithTextarea(text)) {
    return;
  }

  if (clipboardError instanceof Error) {
    throw clipboardError;
  }

  throw new Error("Clipboard write is not available in this context.");
}

export async function writeClipboardTextFromPromise(
  textPromise: Promise<string>,
): Promise<void> {
  let clipboardItemWrite: Promise<void> | null = null;
  let clipboardItemError: unknown;

  try {
    clipboardItemWrite = startClipboardItemWrite(textPromise);
  } catch (error) {
    clipboardItemError = error;
  }

  if (clipboardItemWrite) {
    try {
      await Promise.all([clipboardItemWrite, textPromise.then(() => undefined)]);
      return;
    } catch (error) {
      clipboardItemError = error;
    }
  }

  const text = await textPromise;

  try {
    await writeClipboardText(text);
  } catch (error) {
    throw error instanceof Error
      ? error
      : clipboardItemError instanceof Error
        ? clipboardItemError
        : error;
  }
}

function getNavigatorClipboard(): Clipboard | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  return navigator.clipboard ?? null;
}

function startClipboardItemWrite(
  textPromise: Promise<string>,
): Promise<void> | null {
  const clipboard = getNavigatorClipboard();

  if (!clipboard?.write || typeof ClipboardItem === "undefined") {
    return null;
  }

  const textBlobPromise = textPromise.then(
    (text) => new Blob([text], { type: "text/plain" }),
  );

  return clipboard.write([
    new ClipboardItem({
      "text/plain": textBlobPromise,
    }),
  ]);
}

function copyTextWithTextarea(text: string): boolean {
  if (
    typeof document === "undefined" ||
    !document.body ||
    typeof document.execCommand !== "function"
  ) {
    return false;
  }

  const activeElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.cssText =
    "position:fixed;top:-1000px;left:-1000px;opacity:0;pointer-events:none;";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    activeElement?.focus();
  }
}
