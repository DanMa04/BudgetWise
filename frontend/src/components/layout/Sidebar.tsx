import { cn } from "@/lib/utils";
import { useSidebar } from "@/context/SidebarContext";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileUp,
  FolderTree,
  Home,
  Landmark,
  Settings,
  Target,
  Wallet,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", icon: Home, label: "Dashboard" },
  { to: "/transactions", icon: CreditCard, label: "Transactions" },
  { to: "/budgets", icon: Wallet, label: "Budgets" },
  { to: "/goals", icon: Target, label: "Goals" },
  { to: "/accounts", icon: Landmark, label: "Accounts" },
  { to: "/import", icon: FileUp, label: "Import" },
  { to: "/reports", icon: BarChart3, label: "Reports" },
  { to: "/categories", icon: FolderTree, label: "Categories" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const { isCollapsed, toggle } = useSidebar();

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 transition-all duration-300",
        "bg-sidebar/70 backdrop-blur-xl border-r border-white/8",
        isCollapsed ? "w-14" : "w-64",
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-white/8 shrink-0",
          isCollapsed ? "justify-center px-2" : "px-6",
        )}
      >
        {!isCollapsed && (
          <h1 className="text-xl font-bold tracking-tight">Kallio</h1>
        )}
      </div>

      {/* Nav */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="flex flex-1 flex-col gap-1 p-2 overflow-hidden"
      >
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={isCollapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isCollapsed && "justify-center px-0",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50",
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="shrink-0 border-t border-white/8 p-2">
        <button
          onClick={toggle}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex w-full items-center rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50",
            isCollapsed && "justify-center px-0",
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span className="ml-3 truncate">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
