import { useState, useEffect } from "react";

export type ThemeVariant = "warm" | "formal" | "minimal";

export function useTheme() {
  const [theme, setTheme] = useState<ThemeVariant>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("resume-theme") as ThemeVariant) || "warm";
    }
    return "warm";
  });

  useEffect(() => {
    localStorage.setItem("resume-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return { theme, setTheme };
}
