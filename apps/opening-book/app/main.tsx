import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CatalanApp from "./CatalanApp";
import "./globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("The opening book could not find its page root.");
}

createRoot(root).render(
  <StrictMode>
    <CatalanApp />
  </StrictMode>,
);
