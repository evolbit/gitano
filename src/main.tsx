import "@gfazioli/mantine-split-pane/styles.css";
import React from "react";
import ReactDOM from "react-dom/client";
import {
  scheduleWindowConstraintReapply,
  setupPersistedWindowState,
} from "@/app/bootstrap";
import { AppProviders } from "@/app/providers";
import App from "./app";
import "./index.css";

async function bootstrap() {
  await setupPersistedWindowState();

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </React.StrictMode>
  );

  scheduleWindowConstraintReapply();
}

void bootstrap();
