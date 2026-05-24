import { UserMenu } from "@/components/auth/UserMenu";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-white/8 bg-background/60 px-6 backdrop-blur-md">
      <h2 className="text-lg font-semibold md:hidden">BudgetWise</h2>
      <div className="ml-auto flex items-center gap-2">
        <NotificationCenter />
        <UserMenu />
      </div>
    </header>
  );
}
