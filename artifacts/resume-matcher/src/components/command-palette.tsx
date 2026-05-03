import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useListAnalyses } from "@workspace/api-client-react";
import { ScoreCircle } from "@/components/score-circle";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Sparkles,
  History,
  BarChart2,
  GitCompareArrows,
  Heart,
  Plus,
} from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { data: analyses } = useListAnalyses();

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
    [setLocation]
  );

  const favorites = analyses?.filter((a) => a.isFavorite) ?? [];
  const recent = analyses?.slice(0, 5) ?? [];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search analyses, navigate pages..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Pages">
          <CommandItem onSelect={() => go("/")}>
            <Plus className="w-4 h-4 mr-2" />
            New Analysis
          </CommandItem>
          <CommandItem onSelect={() => go("/history")}>
            <History className="w-4 h-4 mr-2" />
            History
          </CommandItem>
          <CommandItem onSelect={() => go("/stats")}>
            <BarChart2 className="w-4 h-4 mr-2" />
            Stats
          </CommandItem>
          <CommandItem onSelect={() => go("/compare")}>
            <GitCompareArrows className="w-4 h-4 mr-2" />
            Compare Analyses
          </CommandItem>
        </CommandGroup>

        {favorites.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Favorites">
              {favorites.slice(0, 5).map((a) => (
                <CommandItem key={a.id} onSelect={() => go(`/analysis/${a.id}`)}>
                  <Heart className="w-4 h-4 mr-2 text-pink-500 fill-pink-500" />
                  <span className="flex-1 truncate">{a.jobTitle}</span>
                  {a.companyName && (
                    <span className="text-xs text-muted-foreground ml-2 truncate">
                      {a.companyName}
                    </span>
                  )}
                  <span className="ml-2 text-xs font-semibold tabular-nums">
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
            <CommandGroup heading="Recent Analyses">
              {recent.map((a) => (
                <CommandItem key={a.id} onSelect={() => go(`/analysis/${a.id}`)}>
                  <Sparkles className="w-4 h-4 mr-2 text-primary" />
                  <span className="flex-1 truncate">{a.jobTitle}</span>
                  {a.companyName && (
                    <span className="text-xs text-muted-foreground ml-2 truncate">
                      {a.companyName}
                    </span>
                  )}
                  <span className="ml-2 text-xs font-semibold tabular-nums">
                    {a.fitScore}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
