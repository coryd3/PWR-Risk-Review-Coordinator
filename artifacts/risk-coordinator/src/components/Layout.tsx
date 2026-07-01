import { Link, useLocation } from "wouter";
import { LayoutDashboard, FilePlus2, CalendarDays, BarChart3, Settings } from "lucide-react";
import logoUrl from "@/assets/brand/logo-bmcd-white.svg";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/requests/new", label: "New Request", icon: FilePlus2 },
    { href: "/meetings", label: "Meetings", icon: CalendarDays },
    { href: "/impact", label: "Impact", icon: BarChart3 },
    { href: "/admin", label: "Admin Config", icon: Settings },
  ];

  return (
    <div className="flex min-h-[100dvh] w-full bg-background">
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col hidden md:flex">
        <div className="p-6 border-b border-sidebar-border flex flex-col gap-4">
          <img src={logoUrl} alt="Burns & McDonnell" className="w-32 h-auto" />
          <span className="font-semibold text-sidebar-foreground tracking-tight uppercase text-xs opacity-80">PWR Risk Coordinator</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-4 py-2.5 rounded-full transition-colors cursor-pointer ${
                  location === item.href || (location.startsWith("/requests") && item.href.includes("new") && location === "/requests/new") || (location.startsWith("/requests") && !item.href.includes("new") && item.href === "/")
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
