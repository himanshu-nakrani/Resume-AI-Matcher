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
  ServerCog,
} from "lucide-react";
import {
  getGetSystemStatusQueryKey,
  useGetSystemStatus,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { CommandPalette } from "@/components/command-palette";
import { NotificationsPanel } from "@/components/notifications-panel";
import { PageTransition } from "@/components/page-transition";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function routeBreadcrumb(location: string): {
  group: string | null;
  label: string;
} {
  const ROUTE_INDEX: Record<string, { group: string | null; label: string }> = {
    "/": { group: "Core", label: "Optimize" },
    "/tracker": { group: "Core", label: "Tracker" },
    "/board": { group: "Core", label: "Tracker" },
    "/user": { group: "Core", label: "Profile" },
    "/history": { group: "Insights", label: "History" },
    "/stats": { group: "Insights", label: "Stats" },
    "/compare": { group: "Insights", label: "Compare" },
    "/brand": { group: "Insights", label: "Brand" },
    "/versions": { group: "Jobs", label: "Versions" },
    "/saved-jobs": { group: "Jobs", label: "Saved Jobs" },
    "/alerts": { group: "Jobs", label: "Alerts" },
  };
  if (ROUTE_INDEX[location]) return ROUTE_INDEX[location];
  if (location.startsWith("/analysis/"))
    return { group: "Insights", label: "Analysis" };
  return { group: null, label: "" };
}

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
      {
        href: "/compare",
        label: "Compare",
        icon: GitCompareArrows,
        kbd: "G C",
      },
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

type ServiceStatusView = {
  key: "ai" | "jobSearch" | "pdfExport";
  configured: boolean;
  label: string;
  detail: string;
};

type SystemStatusView = {
  state: "operational" | "degraded" | "offline" | "checking";
  services: ServiceStatusView[];
  malformed: boolean;
};

const DEFAULT_SERVICES: ServiceStatusView[] = [
  {
    key: "ai",
    configured: false,
    label: "AI",
    detail: "Waiting for API status",
  },
  {
    key: "jobSearch",
    configured: false,
    label: "Job search",
    detail: "Waiting for API status",
  },
  {
    key: "pdfExport",
    configured: false,
    label: "PDF export",
    detail: "Waiting for API status",
  },
];

function cleanText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeServiceStatus(
  key: ServiceStatusView["key"],
  value: unknown,
  fallback: ServiceStatusView,
): ServiceStatusView {
  if (!value || typeof value !== "object") return fallback;
  const service = value as Record<string, unknown>;
  return {
    key,
    configured: service.configured === true,
    label: cleanText(service.label, fallback.label),
    detail: cleanText(service.detail, fallback.detail),
  };
}

function normalizeSystemStatus(value: unknown): SystemStatusView {
  if (!value || typeof value !== "object") {
    return { state: "checking", services: DEFAULT_SERVICES, malformed: true };
  }

  const source = value as Record<string, unknown>;
  const servicesSource =
    source.services && typeof source.services === "object"
      ? (source.services as Record<string, unknown>)
      : {};
  const services = DEFAULT_SERVICES.map((fallback) =>
    normalizeServiceStatus(fallback.key, servicesSource[fallback.key], {
      ...fallback,
      detail: "Status unavailable",
    }),
  );
  const state =
    source.status === "operational" || source.status === "degraded"
      ? source.status
      : services.some((service) => !service.configured)
        ? "degraded"
        : "checking";

  return {
    state,
    services,
    malformed:
      !source.services ||
      typeof source.services !== "object" ||
      services.some((service) => service.detail === "Status unavailable"),
  };
}

function isActive(location: string, href: string) {
  if (href === "/") return location === "/";
  if (href === "/tracker" && location === "/board") return true;
  if (href === "/history" && location.startsWith("/analysis/")) return true;
  return location === href || location.startsWith(`${href}/`);
}

function ShortcutsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
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
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-surface-1 p-5 shadow-lg">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-[13px] font-semibold">Keyboard shortcuts</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <ul className="space-y-2">
          {SHORTCUTS.map((shortcut, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-4 text-[12.5px]"
            >
              <span className="text-muted-foreground">
                {shortcut.description}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                {shortcut.keys.map((key, j) => (
                  <kbd
                    key={j}
                    className="rounded border border-border-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-muted-foreground"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-center text-[10.5px] text-subtle-foreground">
          Press Esc or click outside to close
        </p>
      </div>
    </div>
  );
}

function SystemStatusIndicator({ compact = false }: { compact?: boolean }) {
  const { data, isError, isLoading } = useGetSystemStatus({
    query: {
      queryKey: getGetSystemStatusQueryKey(),
      staleTime: 60_000,
      refetchInterval: 60_000,
      retry: 1,
    },
  });
  const statusView = normalizeSystemStatus(data);
  const services = statusView.services;
  const configuredCount = services.filter(
    (service) => service.configured,
  ).length;
  const totalCount = services.length;
  const state = isError ? "offline" : isLoading ? "checking" : statusView.state;
  const label = isError
    ? "API offline"
    : isLoading
      ? "Checking services"
      : statusView.malformed
        ? "Status partial"
        : `${configuredCount}/${totalCount} services`;
  const dotClass = cn(
    "h-1.5 w-1.5 rounded-full",
    state === "operational" && "bg-accent",
    state === "degraded" && "bg-warning",
    state === "offline" && "bg-destructive",
    state === "checking" && "bg-muted-foreground",
  );
  const iconClass = cn(
    "h-3.5 w-3.5",
    state === "operational" && "text-accent",
    state === "degraded" && "text-warning",
    state === "offline" && "text-destructive",
    state === "checking" && "text-muted-foreground",
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-7 items-center gap-2 rounded-md border border-transparent px-2 text-[11px] text-subtle-foreground transition-colors hover:border-border hover:bg-surface-2 hover:text-foreground",
            compact && "w-7 justify-center px-0",
          )}
          aria-label={`System status: ${label}`}
        >
          {compact ? (
            <ServerCog className={iconClass} />
          ) : (
            <span className={dotClass} aria-hidden />
          )}
          {!compact && <span>{label}</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent align="end" className="w-72 p-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] font-semibold">System status</p>
            <span className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
              {state}
            </span>
          </div>
          {isError ? (
            <p className="text-[12px] leading-5 text-muted-foreground">
              The API status endpoint is not reachable. Check that the backend
              is running.
            </p>
          ) : (
            <div className="space-y-2">
              {statusView.malformed && !isLoading ? (
                <p className="rounded-md border border-warning/25 bg-warning/10 px-2 py-1.5 text-[11px] leading-4 text-muted-foreground">
                  The status response was incomplete, so unavailable services
                  are shown with safe defaults.
                </p>
              ) : null}
              {services.map((service) => (
                <div key={service.key} className="flex gap-2">
                  <span
                    className={cn(
                      "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      service.configured ? "bg-accent" : "bg-warning",
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium">{service.label}</p>
                    <p className="text-[11px] leading-4 text-muted-foreground">
                      {service.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
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
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (isInput) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "?") {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
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
      <ShortcutsModal
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      <aside
        className={cn(
          "sticky top-0 z-20 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-[var(--duration)] md:flex",
          sidebarCollapsed ? "w-[56px]" : "w-[208px]",
        )}
      >
        <div className="px-3 py-4">
          <Link
            href="/"
            className="group flex items-center gap-2 rounded px-2 py-1 outline-none ring-sidebar-ring transition-colors focus-visible:ring-2"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground shadow-sm">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
              </svg>
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <span className="block truncate text-[13px] font-semibold tracking-[-0.01em]">
                  OptiMatch
                </span>
                <span className="block truncate text-[10px] font-medium text-subtle-foreground">
                  Resume intelligence
                </span>
              </div>
            )}
          </Link>
        </div>

        <nav
          className="flex flex-1 flex-col overflow-y-auto px-2 pb-3"
          aria-label="Main"
        >
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
                        "group flex h-8 items-center gap-2.5 rounded-[5px] border border-transparent px-2 text-[12.5px] transition-colors",
                        active
                          ? "border-accent/15 bg-accent/10 text-foreground"
                          : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                        sidebarCollapsed && "justify-center",
                      )}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <item.icon
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          active && "text-accent",
                        )}
                        aria-hidden
                      />
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
          <NotificationsPanel triggerClassName="h-7 w-7 text-muted-foreground hover:bg-surface-2 hover:text-foreground" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            onClick={toggle}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
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
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-surface-1 px-4 py-3 md:hidden">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-foreground"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            OptiMatch
          </Link>
          <div className="flex items-center gap-1">
            <SystemStatusIndicator compact />
            <NotificationsPanel />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label="Toggle color mode"
            >
              {isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </header>

        <header className="sticky top-0 z-40 hidden h-12 items-center justify-between gap-3 border-b border-border bg-background/80 px-6 backdrop-blur-md md:flex">
          <div className="flex min-w-0 items-center gap-2 text-[12.5px]">
            {(() => {
              const bc = routeBreadcrumb(location);
              if (!bc.label) return null;
              return (
                <>
                  {bc.group && (
                    <>
                      <span className="text-subtle-foreground">{bc.group}</span>
                      <span className="text-subtle-foreground">/</span>
                    </>
                  )}
                  <span className="truncate text-foreground">{bc.label}</span>
                </>
              );
            })()}
          </div>
          <div className="flex items-center gap-3" id="topbar-actions">
            <SystemStatusIndicator />
          </div>
        </header>

        <main className="min-w-0 flex-1 pb-20 md:pb-0">
          <div className="mx-auto h-full min-w-0 max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>

        <nav
          className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-border bg-surface-1 pb-[env(safe-area-inset-bottom)] md:hidden"
          aria-label="Mobile"
        >
          {mobileNavItems.map((item) => {
            const active = isActive(location, item.href);
            return (
              <Link key={item.href} href={item.href} className="min-w-0 flex-1">
                <div
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                    active
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground",
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
                    mobileMoreItems.some((item) =>
                      isActive(location, item.href),
                    )
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
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-muted text-foreground"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
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
