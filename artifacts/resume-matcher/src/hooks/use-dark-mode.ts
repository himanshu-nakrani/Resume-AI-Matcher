import { useState, useEffect } from "react";

const STORAGE_KEY = "optimatch-dark-mode";

function getInitial(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === "true";
  } catch {
    /* SSR / storage disabled */
  }
  // No stored preference — default to dark.
  return true;
}

export function useDarkMode() {
  const [isDark, setIsDark] = useState(getInitial);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem(STORAGE_KEY, String(isDark));
    } catch {
      /* ignore */
    }
  }, [isDark]);

  return { isDark, toggle: () => setIsDark((d) => !d) };
}
