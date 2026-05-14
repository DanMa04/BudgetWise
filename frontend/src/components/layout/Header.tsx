import { UserMenu } from "@/components/auth/UserMenu";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <h2 className="text-lg font-semibold md:hidden">BudgetWise</h2>
      <div className="ml-auto flex items-center gap-2">
        <NotificationCenter />
        <UserMenu />
      </div>
    </header>
  );
}
