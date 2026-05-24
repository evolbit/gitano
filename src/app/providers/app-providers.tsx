import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { MantineProvider } from "@mantine/core";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { appI18n } from "./i18n";
import { appTheme } from "./theme";

type AppProvidersProps = {
  children: ReactNode;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider
        theme={appTheme}
        defaultColorScheme="dark">
        <I18nextProvider i18n={appI18n}>{children}</I18nextProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}
