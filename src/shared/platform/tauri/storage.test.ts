import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTauriStateStorage } from "./storage";

type StoreMock = {
  fileName: string;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
};

const storeMocks = vi.hoisted(() => [] as StoreMock[]);

vi.mock("@tauri-apps/plugin-store", () => ({
  LazyStore: class {
    readonly fileName: string;
    readonly get = vi.fn();
    readonly set = vi.fn();
    readonly delete = vi.fn();
    readonly save = vi.fn();

    constructor(fileName: string) {
      this.fileName = fileName;
      storeMocks.push(this);
    }
  },
}));

describe("createTauriStateStorage", () => {
  beforeEach(() => {
    storeMocks.splice(0);
  });

  it("reads missing values as null", async () => {
    const storage = createTauriStateStorage("workspace.json");
    storeMocks[0].get.mockResolvedValueOnce(undefined);

    await expect(storage.getItem("tabs")).resolves.toBeNull();

    expect(storeMocks[0].fileName).toBe("workspace.json");
    expect(storeMocks[0].get).toHaveBeenCalledWith("tabs");
  });

  it("saves after writing state", async () => {
    const storage = createTauriStateStorage();

    await storage.setItem("tabs", "[]");

    expect(storeMocks[0].set).toHaveBeenCalledWith("tabs", "[]");
    expect(storeMocks[0].save).toHaveBeenCalledOnce();
  });

  it("saves after removing state", async () => {
    const storage = createTauriStateStorage();

    await storage.removeItem("tabs");

    expect(storeMocks[0].delete).toHaveBeenCalledWith("tabs");
    expect(storeMocks[0].save).toHaveBeenCalledOnce();
  });
});
