import { Link, useLocation } from "wouter";
import { LayoutDashboard, History, BarChart2, PlusCircle, Moon, Sun, GitCompareArrows, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { useTheme, type ThemeVariant } from "@/hooks/use-theme";
import { CommandPalette } from "@/components/command-palette";

const navItems = [
  { href: "/", label: "New Analysis", icon: PlusCircle },
  { href: "/history", label: "History", icon: History },
  { href: "/stats", label: "Stats", icon: BarChart2 },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
];

const themes: { value: ThemeVariant; label: string; emoji: string }[] = [
  { value: "warm", label: "Warm", emoji: "🔥" },
  { value: "formal", label: "Formal", emoji: "💼" },
  { value: "minimal", label: "Minimal", emoji: "⚪" },
];

function isActive(location: string, href: string) {
  if (href === "/") return location === "/" || location.startsWith("/analysis/");
  return location === href || location.startsWith(href + "/");
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isDark, toggle } = useDarkMode();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex min-h-screen w-full bg-muted/30">
      <CommandPalette />

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
        <div className="p-4 border-t space-y-2">
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
            <Keyboard className="w-3.5 h-3.5 text-muted-foreground/60" />
            <span className="text-[10px] text-muted-foreground/60 font-medium">⌘K to search</span>
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
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle dark mode">
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
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
                  className={`flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${active ? "stroke-[2.5]" : ""}`} />
                  <span className={`text-[10px] font-medium ${active ? "font-semibold" : ""}`}>
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
