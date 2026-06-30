import { Link, useLocation } from "wouter";
import { LayoutDashboard, FilePlus2, CalendarDays, Settings } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/requests/new", label: "New Request", icon: FilePlus2 },
    { href: "/meetings", label: "Meetings", icon: CalendarDays },
    { href: "/admin", label: "Admin Config", icon: Settings },
  ];

  return (
    <div className="flex min-h-[100dvh] w-full bg-background">
      <aside className="w-64 border-r border-border bg-card flex flex-col hidden md:flex">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">
            PWR
          </div>
          <span className="font-semibold text-foreground tracking-tight">Risk Coordinator</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                  location === item.href || (location.startsWith("/requests") && item.href.includes("new") && location === "/requests/new") || (location.startsWith("/requests") && !item.href.includes("new") && item.href === "/")
                    ? "bg-primary text-primary-foreground font-medium shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span className="text-sm">{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-border bg-card flex items-center px-6 md:hidden">
           <span className="font-semibold text-foreground">PWR Risk Coordinator</span>
        </header>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
