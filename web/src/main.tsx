import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import "./styles/learning-base.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/components.css";
import "./styles/pages.css";
import "./styles/dialogs.css";
import "./styles/responsive.css";
import "./styles/refinements.css";
import "./styles/learning.css";
import "./styles/ui.css";
import "./styles/home.css";
import "./styles/refresh.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
