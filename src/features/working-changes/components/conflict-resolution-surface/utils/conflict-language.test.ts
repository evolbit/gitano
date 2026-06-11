import { describe, expect, it } from "vitest";
import { inferConflictEditorLanguage } from "./conflict-language";

describe("inferConflictEditorLanguage", () => {
  it("maps common source extensions to Monaco language ids", () => {
    expect(inferConflictEditorLanguage("src/app.tsx")).toBe("typescript");
    expect(inferConflictEditorLanguage("scripts/run.sh")).toBe("shell");
    expect(inferConflictEditorLanguage("Cargo.toml")).toBe("toml");
  });
});
