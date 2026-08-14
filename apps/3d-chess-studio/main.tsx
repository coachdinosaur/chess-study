import { createRoot } from "react-dom/client";
import ChessStudio from "./app/ChessStudio";
import "./app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("The static application root is missing.");
}

createRoot(root).render(<ChessStudio />);
