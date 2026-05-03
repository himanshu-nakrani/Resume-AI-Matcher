import { useState, useEffect } from "react";

export type ThemeVariant = "warm" | "formal" | "minimal";

export function useTheme() {
  const [theme, setTheme] = useState<ThemeVariant>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("resume-theme") as ThemeVariant | null;
      const initial = stored || "warm";
      document.documentElement.setAttribute("data-theme", initial);
      return initial;
    }
    return "warm";
  });

  useEffect(() => {
    localStorage.setItem("resume-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return { theme, setTheme };
}
