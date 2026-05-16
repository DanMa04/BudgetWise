import { cn } from "@/lib/utils";
import {
  BarChart3,
  CreditCard,
  Home,
  Target,
  Wallet,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const mobileNavItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/transactions", icon: CreditCard, label: "Expenses" },
  { to: "/budgets", icon: Wallet, label: "Budgets" },
  { to: "/goals", icon: Target, label: "Goals" },
  { to: "/reports", icon: BarChart3, label: "Reports" },
];

export function MobileNav() {
  return (
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-50 border-t bg-background md:hidden">
      <div className="flex items-center justify-around py-2">
        {mobileNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 px-2 py-1 text-xs transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
