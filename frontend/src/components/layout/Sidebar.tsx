import { cn } from "@/lib/utils";
import {
  BarChart3,
  CreditCard,
  FileUp,
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
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:block">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold tracking-tight">BudgetWise</h1>
      </div>
      <nav role="navigation" aria-label="Main navigation" className="flex flex-col gap-1 p-4">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
