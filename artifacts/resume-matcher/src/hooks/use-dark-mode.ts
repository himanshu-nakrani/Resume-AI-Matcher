import { useSyncExternalStore } from "react";

const STORAGE_KEY = "optimatch-dark-mode";

function readStored(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === "true";
  } catch {
    /* SSR / storage disabled */
  }
  // No stored preference — default to dark.
  return true;
}

// Module-level singleton so every consumer sees the same value and re-renders
// when any other consumer toggles the theme.
const listeners = new Set<() => void>();
let current = readStored();

function applyToDOM(value: boolean): void {
  const root = document.documentElement;
  if (value) root.classList.add("dark");
  else root.classList.remove("dark");
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* ignore */
  }
}

function setDark(next: boolean): void {
  if (next === current) return;
  current = next;
  applyToDOM(next);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  return current;
}

// SSR-safe snapshot — used by useSyncExternalStore during server render.
function getServerSnapshot(): boolean {
  return true;
}

export function useDarkMode(): { isDark: boolean; toggle: () => void } {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { isDark, toggle: () => setDark(!current) };
}
