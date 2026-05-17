import { describe, expect, it } from "vitest";
import { appI18n } from "./i18n";

describe("appI18n", () => {
  it("provides default English interface labels", () => {
    expect(appI18n.t("tabs.launchpad")).toBe("Launchpad");
    expect(appI18n.t("changesPanel.commit")).toBe("Commit");
  });
});
