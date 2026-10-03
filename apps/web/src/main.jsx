import { registerOfflineShell } from "./platform/browser/pwa";
import React from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "./auth/AuthProvider";
import { AuthEntry } from "./components/auth/AuthEntry";
import { LedgerUIProvider } from "./ui/theme";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "./styles.css";
import "./ui/controls.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LedgerUIProvider>
      <AuthProvider>
        <AuthEntry />
      </AuthProvider>
    </LedgerUIProvider>
  </React.StrictMode>,
);

registerOfflineShell();
