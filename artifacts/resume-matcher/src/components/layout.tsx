import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, History, BarChart2, PlusCircle, Moon, Sun, GitCompareArrows, Keyboard, GraduationCap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { useTheme, type ThemeVariant } from "@/hooks/use-theme";
import { CommandPalette } from "@/components/command-palette";
import { NotificationsPanel } from "@/components/notifications-panel";

const navItems = [
  { href: "/", label: "New Analysis", icon: PlusCircle },
  { href: "/history", label: "History", icon: History },
  { href: "/stats", label: "Stats", icon: BarChart2 },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
  { href: "/skills", label: "Skills", icon: GraduationCap },
];

const themes: { value: ThemeVariant; label: string; emoji: string }[] = [
  { value: "warm", label: "Warm", emoji: "🔥" },
  { value: "formal", label: "Formal", emoji: "💼" },
  { value: "minimal", label: "Minimal", emoji: "⚪" },
];

const SHORTCUTS = [
  { keys: ["⌘", "K"], description: "Open command palette" },
  { keys: ["⌘", "?"], description: "Show keyboard shortcuts" },
  { keys: ["G", "H"], description: "Go to History" },
  { keys: ["G", "S"], description: "Go to Stats" },
  { keys: ["G", "C"], description: "Go to Compare" },
  { keys: ["G", "L"], description: "Go to Skills" },
  { keys: ["Esc"], description: "Close dialogs" },
];

function isActive(location: string, href: string) {
  if (href === "/") return location === "/" || location.startsWith("/analysis/");
  return location === href || location.startsWith(href + "/");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-card border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2.5">
          {SHORTCUTS.map((shortcut, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">{shortcut.description}</span>
              <div className="flex items-center gap-1 shrink-0">
                {shortcut.keys.map((key, j) => (
                  <kbd
                    key={j}
                    className="px-2 py-0.5 text-xs font-mono bg-muted border rounded shadow-sm"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-5 text-center">Press Esc or click outside to close</p>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { isDark, toggle } = useDarkMode();
  const { theme, setTheme } = useTheme();
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    let gBuffer = "";
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (isInput) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "?") {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }

      if (e.key === "g" || e.key === "G") {
        gBuffer = "g";
        setTimeout(() => { gBuffer = ""; }, 1000);
        return;
      }

      if (gBuffer === "g") {
        gBuffer = "";
        switch (e.key.toLowerCase()) {
          case "h": setLocation("/history"); break;
          case "s": setLocation("/stats"); break;
          case "c": setLocation("/compare"); break;
          case "l": setLocation("/skills"); break;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setLocation]);

  return (
    <div className="flex min-h-screen w-full bg-muted/30">
      <CommandPalette />
      <ShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Desktop sidebar */}
      <aside className="w-64 border-r bg-card flex-col hidden md:flex">
        <div className="p-6 border-b">
          <div className="flex items-center gap-2 font-bold text-lg text-primary tracking-tight">
            <LayoutDashboard className="w-5 h-5" />
            <span>OptiMatch</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-medium">AI Career Intelligence</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const active = isActive(location, item.href);
            return (
              <Link key={item.href} href={item.href} className="block">
                <Button
                  variant={active ? "secondary" : "ghost"}
                  className={`w-full justify-start ${active ? "bg-secondary font-semibold" : "text-muted-foreground font-medium"}`}
                >
                  <item.icon className="w-4 h-4 mr-3" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>
        <div className="px-4 pt-3 border-t flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Notifications</span>
          <NotificationsPanel />
        </div>
        <div className="p-4 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground px-2 mb-2">Theme</div>
          <div className="flex gap-2">
            {themes.map((t) => (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                className={`flex-1 px-2 py-2 rounded text-xs font-medium transition-all ${
                  theme === t.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-secondary"
                }`}
                title={t.label}
              >
                {t.emoji}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground font-medium mt-2"
            onClick={toggle}
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun className="w-4 h-4 mr-3" /> : <Moon className="w-4 h-4 mr-3" />}
            {isDark ? "Light mode" : "Dark mode"}
          </Button>
          <div className="flex items-center gap-2 px-2 pt-1">
            <button
              onClick={() => setShowShortcuts(true)}
              className="flex items-center gap-2 text-[10px] text-muted-foreground/60 font-medium hover:text-muted-foreground transition-colors"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>⌘K to search · ⌘? shortcuts</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card sticky top-0 z-10">
          <div className="flex items-center gap-2 font-bold text-base text-primary">
            <LayoutDashboard className="w-4 h-4" />
            <span>OptiMatch</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationsPanel />
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle dark mode">
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 overflow-auto pb-20 md:pb-8">
          <div className="max-w-5xl mx-auto h-full">
            {children}
          </div>
        </div>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t z-20 flex">
          {navItems.map((item) => {
            const active = isActive(location, item.href);
            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <div
                  className={`flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${active ? "stroke-[2.5]" : ""}`} />
                  <span className={`text-[9px] font-medium ${active ? "font-semibold" : ""}`}>
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
