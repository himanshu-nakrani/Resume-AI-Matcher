import { Link, useLocation } from "wouter";
import { LayoutDashboard, FileText, History, BarChart2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "New Analysis", icon: PlusCircle },
    { href: "/history", label: "History", icon: History },
    { href: "/stats", label: "Stats", icon: BarChart2 },
  ];

  return (
    <div className="flex min-h-screen w-full bg-muted/30">
      <aside className="w-64 border-r bg-card flex flex-col hidden md:flex">
        <div className="p-6 border-b">
          <div className="flex items-center gap-2 font-bold text-lg text-primary tracking-tight">
            <LayoutDashboard className="w-5 h-5" />
            <span>OptiMatch</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-medium">AI Career Intelligence</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="block">
              <Button
                variant={location === item.href || (location.startsWith('/analysis/') && item.href === '/') ? "secondary" : "ghost"}
                className={`w-full justify-start ${location === item.href || (location.startsWith('/analysis/') && item.href === '/') ? 'bg-secondary font-semibold' : 'text-muted-foreground font-medium'}`}
              >
                <item.icon className="w-4 h-4 mr-3" />
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center p-4 border-b bg-card">
          <div className="flex items-center gap-2 font-bold text-lg text-primary">
            <LayoutDashboard className="w-5 h-5" />
            <span>OptiMatch</span>
          </div>
        </header>
        <div className="flex-1 p-4 md:p-8 overflow-auto">
          <div className="max-w-5xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}