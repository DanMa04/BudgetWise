import { useAuth } from "@/hooks/useAuth";
import { UserButton } from "@clerk/clerk-react";

export function UserMenu() {
  const { displayName } = useAuth();

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted-foreground md:inline">
        {displayName}
      </span>
      <UserButton afterSignOutUrl="/" />
    </div>
  );
}
