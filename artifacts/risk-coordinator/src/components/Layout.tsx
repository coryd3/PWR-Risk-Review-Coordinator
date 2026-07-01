import { Link, useLocation } from "wouter";
import { LayoutDashboard, FilePlus2, CalendarDays, BarChart3, Settings, Upload, LogOut } from "lucide-react";
import logoUrl from "@/assets/brand/logo-bmcd-white.svg";
import { useAuthContext, ROLE_LABELS, type Permission } from "@/lib/auth";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  perm: Permission;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, role, logout, can } = useAuthContext();

  const navItems: NavItem[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, perm: "view" },
    { href: "/requests/new", label: "New Request", icon: FilePlus2, perm: "createRequest" },
    { href: "/meetings", label: "Meetings", icon: CalendarDays, perm: "view" },
    { href: "/impact", label: "Impact", icon: BarChart3, perm: "admin" },
    { href: "/import", label: "Import Tracker", icon: Upload, perm: "admin" },
    { href: "/admin", label: "Admin Config", icon: Settings, perm: "admin" },
  ];

  const visibleNavItems = navItems.filter((item) => can(item.perm));

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "Signed in";

  return (
    <div className="flex min-h-[100dvh] w-full bg-background">
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col hidden md:flex">
        <div className="p-6 border-b border-sidebar-border flex flex-col gap-4">
          <img src={logoUrl} alt="Burns & McDonnell" className="w-32 h-auto" />
          <span className="font-semibold text-sidebar-foreground tracking-tight uppercase text-xs opacity-80">PWR Risk Coordinator</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {visibleNavItems.map((item) => (
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
        <div className="p-4 border-t border-sidebar-border">
          <div className="px-2 pb-3">
            <div className="text-sm font-medium text-sidebar-foreground truncate">{displayName}</div>
            {role && (
              <div className="text-xs text-sidebar-foreground/60 mt-0.5">{ROLE_LABELS[role]}</div>
            )}
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 px-4 py-2.5 rounded-full text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 md:hidden">
          <span className="font-semibold text-foreground">PWR Risk Coordinator</span>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </header>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
