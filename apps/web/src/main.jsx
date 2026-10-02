import { registerOfflineShell } from "./platform/browser/pwa";
import React from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "./auth/AuthProvider";
import { AuthEntry } from "./components/auth/AuthEntry";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <AuthEntry />
    </AuthProvider>
  </React.StrictMode>,
);

registerOfflineShell();
