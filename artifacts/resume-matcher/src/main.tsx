import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

document.documentElement.removeAttribute("data-theme");
try {
  localStorage.removeItem("resume-theme");
} catch {
  /* ignore */
}

createRoot(document.getElementById("root")!).render(<App />);
