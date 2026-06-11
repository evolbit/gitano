import { describe, expect, it, vi } from "vitest";
import { registerMonacoThemes } from "./register-monaco-themes";
import { DEFAULT_MONACO_THEME } from "./theme-names";
import type { MonacoApi } from "./types";

describe("registerMonacoThemes", () => {
  it("registers the default Ayu Dark editor theme", () => {
    const defineTheme = vi.fn();
    const monaco = {
      editor: {
        defineTheme,
      },
    } as unknown as MonacoApi;

    registerMonacoThemes(monaco);

    expect(defineTheme).toHaveBeenCalledWith(
      DEFAULT_MONACO_THEME,
      expect.objectContaining({
        base: "vs-dark",
        colors: expect.objectContaining({
          "editor.background": "#0B0E14",
        }),
      }),
    );
  });
});
