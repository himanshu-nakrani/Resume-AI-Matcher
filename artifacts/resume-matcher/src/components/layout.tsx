import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  History,
  BarChart2,
  PlusCircle,
  Moon,
  Sun,
  GitCompareArrows,
  Keyboard,
  X,
  LayoutGrid,
  Fingerprint,
  GitBranch,
  UserRound,
  Bookmark,
  Bell,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { CommandPalette } from "@/components/command-palette";
import { NotificationsPanel } from "@/components/notifications-panel";
import { PageTransition } from "@/components/page-transition";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof PlusCircle;
  kbd?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Core",
    items: [
      { href: "/", label: "Optimize", icon: PlusCircle, kbd: "⌘N" },
      { href: "/tracker", label: "Tracker", icon: LayoutGrid, kbd: "⌘T" },
      { href: "/user", label: "Profile", icon: UserRound },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/history", label: "History", icon: History, kbd: "G H" },
      { href: "/stats", label: "Stats", icon: BarChart2, kbd: "G S" },
      { href: "/compare", label: "Compare", icon: GitCompareArrows, kbd: "G C" },
      { href: "/brand", label: "Brand", icon: Fingerprint, kbd: "G B" },
    ],
  },
  {
    label: "Jobs",
    items: [
      { href: "/versions", label: "Versions", icon: GitBranch },
      { href: "/saved-jobs", label: "Saved Jobs", icon: Bookmark },
      { href: "/alerts", label: "Alerts", icon: Bell },
    ],
  },
];

const mobileNavItems: NavItem[] = [
  { href: "/", label: "Optimize", icon: PlusCircle },
  { href: "/tracker", label: "Tracker", icon: LayoutGrid },
  { href: "/user", label: "Profile", icon: UserRound },
  { href: "/history", label: "History", icon: History },
];

const mobileMoreItems: NavItem[] = [
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
  { href: "/brand", label: "Brand", icon: Fingerprint },
  { href: "/versions", label: "Versions", icon: GitBranch },
  { href: "/saved-jobs", label: "Saved Jobs", icon: Bookmark },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/stats", label: "Stats", icon: BarChart2 },
];

const SHORTCUTS = [
  { keys: ["\u2318", "K"], description: "Open command palette" },
  { keys: ["\u2318", "?"], description: "Show keyboard shortcuts" },
  { keys: ["\u2318", "N"], description: "New analysis" },
  { keys: ["\u2318", "\\"], description: "Toggle sidebar" },
  { keys: ["G", "H"], description: "Go to History" },
  { keys: ["G", "S"], description: "Go to Stats" },
  { keys: ["G", "C"], description: "Go to Compare" },
  { keys: ["G", "B"], description: "Go to Brand" },
  { keys: ["T"], description: "Toggle theme" },
  { keys: ["J", "K"], description: "Move down/up in lists" },
  { keys: ["Esc"], description: "Close dialogs" },
];

function isActive(location: string, href: string) {
  if (href === "/") return location === "/" || location.startsWith("/analysis/");
  return location === href || location.startsWith(`${href}/`);
}

function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Keyboard shortcuts</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="space-y-3">
          {SHORTCUTS.map((shortcut, i) => (
            <li key={i} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">{shortcut.description}</span>
              <div className="flex shrink-0 items-center gap-1">
                {shortcut.keys.map((key, j) => (
                  <kbd
                    key={j}
                    className="rounded border border-border bg-muted px-2 py-0.5 text-[11px] font-mono font-medium text-muted-foreground"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-center text-xs text-muted-foreground">Press Esc or click outside to close</p>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { isDark, toggle } = useDarkMode();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    let gBuffer = "";
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (isInput) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "?") {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        setLocation("/");
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setSidebarCollapsed((v) => !v);
        return;
      }

      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        toggle();
        return;
      }

      if (e.key === "g" || e.key === "G") {
        gBuffer = "g";
        setTimeout(() => {
          gBuffer = "";
        }, 1000);
        return;
      }

      if (gBuffer === "g") {
        gBuffer = "";
        switch (e.key.toLowerCase()) {
          case "h":
            setLocation("/history");
            break;
          case "b":
            setLocation("/brand");
            break;
          case "s":
            setLocation("/stats");
            break;
          case "c":
            setLocation("/compare");
            break;
          default:
            break;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setLocation]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <CommandPalette />
      <ShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />

      <aside
  className={cn(
    "sticky top-0 z-20 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex transition-[width] duration-[var(--duration)]",
    sidebarCollapsed ? "w-[52px]" : "w-[180px]",
  )}
>
  <div className="px-3 py-4">
    <Link href="/" className="group flex items-center gap-2 outline-none ring-sidebar-ring focus-visible:ring-2 rounded px-2 py-1 transition-colors">
      <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-foreground text-background">
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
        </svg>
      </div>
      {!sidebarCollapsed && (
        <span className="truncate text-[12.5px] font-semibold tracking-[-0.01em]">OptiMatch</span>
      )}
    </Link>
  </div>

  <nav className="flex flex-1 flex-col overflow-y-auto px-2 pb-3" aria-label="Main">
    {navGroups.map((group, groupIdx) => (
      <div key={group.label}>
        {!sidebarCollapsed && (
          <div
            className={cn(
              "px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle-foreground",
              groupIdx === 0 && "pt-1",
            )}
          >
            {group.label}
          </div>
        )}
        <div className="flex flex-col">
          {group.items.map((item) => {
            const active = isActive(location, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex h-8 items-center gap-2.5 rounded-[5px] px-2 text-[12.5px] transition-colors",
                  active
                    ? "bg-surface-2 text-foreground"
                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                  sidebarCollapsed && "justify-center",
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {!sidebarCollapsed && (
                  <>
                    <span className="truncate">{item.label}</span>
                    {item.kbd && (
                      <kbd className="ml-auto hidden text-[9.5px] font-mono text-subtle-foreground group-hover:inline">
                        {item.kbd}
                      </kbd>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    ))}
  </nav>

  <div className="flex items-center gap-1 border-t border-sidebar-border px-2 py-2">
    <NotificationsPanel triggerClassName="text-muted-foreground hover:bg-surface-2 hover:text-foreground" />
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </Button>
    <button
      type="button"
      onClick={() => setShowShortcuts(true)}
      className="ml-auto inline-flex h-7 items-center gap-1 rounded-[5px] px-2 text-[10px] text-subtle-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
      aria-label="Keyboard shortcuts"
    >
      <Keyboard className="h-3 w-3" />
      {!sidebarCollapsed && <span>⌘?</span>}
    </button>
  </div>
</aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 py-3 md:hidden">
          <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            OptiMatch
          </Link>
          <div className="flex items-center gap-1">
            <NotificationsPanel />
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle color mode">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        <main className="flex-1 pb-20 md:pb-0">
          <div className="mx-auto h-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>

        <nav
          className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
          aria-label="Mobile"
        >
          {mobileNavItems.map((item) => {
            const active = isActive(location, item.href);
            return (
              <Link key={item.href} href={item.href} className="min-w-0 flex-1">
                <div
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                    active ? "text-foreground font-semibold" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="truncate px-0.5">{item.label}</span>
                </div>
              </Link>
            );
          })}
          <Sheet>
            <SheetTrigger asChild>
              <button type="button" className="min-w-0 flex-1">
                <div
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                    mobileMoreItems.some((item) => isActive(location, item.href))
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground",
                  )}
                >
                  <MoreHorizontal className="h-5 w-5" />
                  <span className="truncate px-0.5">More</span>
                </div>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-xl">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <nav className="grid gap-1 py-4">
                {mobileMoreItems.map((item) => {
                  const active = isActive(location, item.href);
                  return (
                    <Link key={item.href} href={item.href} className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      active ? "bg-muted text-foreground" : "text-foreground hover:bg-muted",
                    )}>
                      <item.icon className="h-5 w-5 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
        </nav>
      </div>
    </div>
  );
}
