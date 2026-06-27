import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useListAnalyses } from "@workspace/api-client-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useDarkMode } from "@/hooks/use-dark-mode";
import {
  Sparkles,
  History,
  BarChart2,
  GitCompareArrows,
  Heart,
  Plus,
  LayoutGrid,
  Fingerprint,
  GitBranch,
  Bookmark,
  Bell,
  UserRound,
  Moon,
  Sun,
} from "lucide-react";

type GoEntry = { label: string; path: string; icon: typeof Plus; kbd?: string };

const PAGES: GoEntry[] = [
  { label: "Optimize / New analysis", path: "/", icon: Plus, kbd: "⌘N" },
  { label: "Tracker", path: "/tracker", icon: LayoutGrid, kbd: "⌘T" },
  { label: "Profile", path: "/user", icon: UserRound },
  { label: "History", path: "/history", icon: History, kbd: "G H" },
  { label: "Stats", path: "/stats", icon: BarChart2, kbd: "G S" },
  { label: "Compare", path: "/compare", icon: GitCompareArrows, kbd: "G C" },
  { label: "Brand", path: "/brand", icon: Fingerprint, kbd: "G B" },
  { label: "Versions", path: "/versions", icon: GitBranch },
  { label: "Saved Jobs", path: "/saved-jobs", icon: Bookmark },
  { label: "Search Alerts", path: "/alerts", icon: Bell },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { data: analyses } = useListAnalyses();
  const { isDark, toggle } = useDarkMode();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const go = useCallback(
    (path: string) => {
      setOpen(false);
      setLocation(path);
    },
    [setLocation],
  );

  const favorites = analyses?.filter((a) => a.isFavorite) ?? [];
  const recent = analyses?.slice(0, 5) ?? [];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search analyses or navigate…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Pages">
          {PAGES.map((p) => (
            <CommandItem
              key={p.path}
              onSelect={() => go(p.path)}
              className="group"
            >
              <p.icon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1">{p.label}</span>
              {p.kbd && (
                <kbd className="ml-2 font-mono text-[10px] text-subtle-foreground">
                  {p.kbd}
                </kbd>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        {favorites.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Favorites">
              {favorites.slice(0, 5).map((a) => (
                <CommandItem
                  key={a.id}
                  onSelect={() => go(`/analysis/${a.id}`)}
                >
                  <Heart className="mr-2 h-3.5 w-3.5 fill-destructive text-destructive" />
                  <span className="flex-1 truncate">{a.jobTitle}</span>
                  {a.companyName && (
                    <span className="ml-2 truncate text-[11px] text-muted-foreground">
                      {a.companyName}
                    </span>
                  )}
                  <span className="ml-2 font-mono text-[11px] font-medium tabular-nums">
                    {a.fitScore}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {recent.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent analyses">
              {recent.map((a) => (
                <CommandItem
                  key={a.id}
                  onSelect={() => go(`/analysis/${a.id}`)}
                >
                  <Sparkles className="mr-2 h-3.5 w-3.5 text-accent" />
                  <span className="flex-1 truncate">{a.jobTitle}</span>
                  {a.companyName && (
                    <span className="ml-2 truncate text-[11px] text-muted-foreground">
                      {a.companyName}
                    </span>
                  )}
                  <span className="ml-2 font-mono text-[11px] font-medium tabular-nums">
                    {a.fitScore}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => { setOpen(false); toggle(); }} className="group">
            {isDark ? <Sun className="mr-2 h-3.5 w-3.5" /> : <Moon className="mr-2 h-3.5 w-3.5" />}
            <span className="flex-1">Toggle theme</span>
            <kbd className="ml-2 font-mono text-[10px] text-subtle-foreground">T</kbd>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
