import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { History, BarChart2, PlusCircle, Moon, Sun, GitCompareArrows, Keyboard, GraduationCap, X, Sparkles } from "lucide-react";
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

  const isEmberTheme = theme === "warm";

  return (
    <div className="flex min-h-screen w-full bg-background">
      <CommandPalette />
      <ShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Desktop sidebar — Ember warm treatment when warm theme active */}
      <aside
        className={`w-64 flex-col hidden md:flex h-screen sticky top-0 z-10 overflow-hidden ${
          isEmberTheme
            ? "bg-[#78350f] text-[#fef3c7] rounded-r-3xl shadow-xl"
            : "border-r bg-card"
        }`}
      >
        {/* Logo */}
        <div className={`p-7 flex items-center gap-3 ${!isEmberTheme ? "border-b" : ""}`}>
          <Sparkles className={`w-5 h-5 shrink-0 ${isEmberTheme ? "text-[#fcd34d]" : "text-primary"}`} />
          <div>
            <span className={`font-bold text-lg tracking-tight ${isEmberTheme ? "text-white" : "text-foreground"}`}>
              OptiMatch
            </span>
            <p className={`text-[11px] font-medium mt-0 leading-tight ${isEmberTheme ? "text-[#fde68a]" : "text-muted-foreground"}`}>
              AI Career Intelligence
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 space-y-1 mt-1">
          {navItems.map((item) => {
            const active = isActive(location, item.href);
            if (isEmberTheme) {
              return (
                <Link key={item.href} href={item.href} className="block">
                  <div
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-colors cursor-pointer ${
                      active
                        ? "bg-[#92400e] text-white font-semibold"
                        : "text-[#fde68a] hover:bg-[#92400e]/50 font-medium"
                    }`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </div>
                </Link>
              );
            }
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

        {/* Notifications */}
        <div
          className={`px-4 pt-3 flex items-center justify-between ${
            isEmberTheme ? "border-t border-[#92400e]/60" : "border-t"
          }`}
        >
          <span className={`text-xs font-semibold ${isEmberTheme ? "text-[#fde68a]" : "text-muted-foreground"}`}>
            Notifications
          </span>
          <NotificationsPanel />
        </div>

        {/* Bottom controls */}
        <div className="p-4 space-y-2">
          <div className={`text-xs font-semibold px-2 mb-2 ${isEmberTheme ? "text-[#fde68a]" : "text-muted-foreground"}`}>
            Theme
          </div>
          <div className="flex gap-2">
            {themes.map((t) => (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                className={`flex-1 px-2 py-2 rounded-xl text-xs font-medium transition-all ${
                  theme === t.value
                    ? isEmberTheme
                      ? "bg-[#fcd34d] text-[#78350f]"
                      : "bg-primary text-primary-foreground"
                    : isEmberTheme
                      ? "bg-[#92400e]/50 text-[#fde68a] hover:bg-[#92400e]"
                      : "bg-muted text-muted-foreground hover:bg-secondary"
                }`}
                title={t.label}
              >
                {t.emoji}
              </button>
            ))}
          </div>
          <button
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all mt-1 ${
              isEmberTheme
                ? "text-[#fde68a] hover:bg-[#92400e]/50"
                : "text-muted-foreground hover:bg-secondary"
            }`}
            onClick={toggle}
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {isDark ? "Light mode" : "Dark mode"}
          </button>
          <div className="flex items-center gap-2 px-2 pt-1">
            <button
              onClick={() => setShowShortcuts(true)}
              className={`flex items-center gap-2 text-[10px] font-medium hover:opacity-80 transition-opacity ${
                isEmberTheme ? "text-[#fde68a]/60" : "text-muted-foreground/60"
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>⌘K to search · ⌘? shortcuts</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header
          className={`md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-10 ${
            isEmberTheme ? "bg-[#78350f] text-[#fef3c7]" : "border-b bg-card"
          }`}
        >
          <div className={`flex items-center gap-2 font-bold text-base ${isEmberTheme ? "text-white" : "text-primary"}`}>
            <Sparkles className={`w-4 h-4 ${isEmberTheme ? "text-[#fcd34d]" : ""}`} />
            <span>OptiMatch</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationsPanel />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label="Toggle dark mode"
              className={isEmberTheme ? "text-[#fde68a] hover:bg-[#92400e]/50" : ""}
            >
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
