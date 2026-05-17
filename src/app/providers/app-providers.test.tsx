import { render, screen } from "@testing-library/react";
import { useTranslation } from "react-i18next";
import { describe, expect, it } from "vitest";
import { AppProviders } from "./app-providers";

function TranslatedChild() {
  const { t } = useTranslation();
  return <span>{t("tabs.branches")}</span>;
}

describe("AppProviders", () => {
  it("provides app translation context to children", () => {
    render(
      <AppProviders>
        <TranslatedChild />
      </AppProviders>,
    );

    expect(screen.getByText("Branches")).toBeInTheDocument();
  });
});
