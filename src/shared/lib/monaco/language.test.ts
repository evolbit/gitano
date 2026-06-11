import { describe, expect, it } from "vitest";
import {
  inferMonacoLanguage,
  MONACO_PLAINTEXT_LANGUAGE,
} from "./language";

describe("inferMonacoLanguage", () => {
  it("maps common source extensions to Monaco language ids", () => {
    expect(inferMonacoLanguage("src/app.tsx")).toBe("typescript");
    expect(inferMonacoLanguage("scripts/run.sh")).toBe("shell");
    expect(inferMonacoLanguage("src/main.rs")).toBe("rust");
    expect(inferMonacoLanguage("Dockerfile")).toBe("dockerfile");
  });

  it("falls back to plaintext for unknown files", () => {
    expect(inferMonacoLanguage("Cargo.lock")).toBe(MONACO_PLAINTEXT_LANGUAGE);
    expect(inferMonacoLanguage("README")).toBe(MONACO_PLAINTEXT_LANGUAGE);
  });
});
