import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Clean up legacy theme keys from older builds.
document.documentElement.removeAttribute("data-theme");
try {
  localStorage.removeItem("resume-theme");
} catch {
  /* ignore */
}

// Apply theme class synchronously to avoid flash of light mode before the
// React hook (use-dark-mode) mounts. Mirrors the hook's getInitial() logic:
// honor stored preference if present; otherwise default to dark.
try {
  const stored = localStorage.getItem("optimatch-dark-mode");
  const isDark = stored !== null ? stored === "true" : true;
  if (isDark) {
    document.documentElement.classList.add("dark");
  }
} catch {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")!).render(<App />);
