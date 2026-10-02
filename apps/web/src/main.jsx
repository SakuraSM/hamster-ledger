import { registerOfflineShell } from "./platform/browser/pwa";
import React from "react";
import { createRoot } from "react-dom/client";
import { LockedApp } from "./components/LockedApp.tsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LockedApp />
  </React.StrictMode>,
);

registerOfflineShell();
