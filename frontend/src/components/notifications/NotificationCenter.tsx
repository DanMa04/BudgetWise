import { useState } from "react";
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  Trophy,
  BarChart3,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useNotifications, useUnreadCount, useMarkRead, useMarkAllRead } from "@/hooks/useNotifications";
import { formatTimeAgo } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { NotificationLog } from "@/types/models";

const typeConfig: Record<string, { icon: typeof Bell; color: string }> = {
  budget_warning: { icon: AlertTriangle, color: "text-yellow-500" },
  budget_exceeded: { icon: AlertCircle, color: "text-red-500" },
  pace_alert: { icon: TrendingUp, color: "text-orange-500" },
  goal_milestone: { icon: Trophy, color: "text-green-500" },
  weekly_summary: { icon: BarChart3, color: "text-blue-500" },
};

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: NotificationLog;
  onMarkRead: (id: string) => void;
}) {
  const config = typeConfig[notification.notification_type] ?? {
    icon: Bell,
    color: "text-muted-foreground",
  };
  const Icon = config.icon;

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent",
        !notification.is_read && "bg-accent/50"
      )}
      onClick={() => {
        if (!notification.is_read) {
          onMarkRead(notification.id);
        }
      }}
    >
      <div className={cn("mt-0.5 shrink-0", config.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn("text-sm", !notification.is_read && "font-semibold")}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {notification.message}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatTimeAgo(notification.sent_at)}
        </p>
      </div>
    </button>
  );
}

export function NotificationCenter() {
  const [page] = useState(1);
  const { data: notifications } = useNotifications(page, 20);
  const { data: unreadData } = useUnreadCount();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const unreadCount = unreadData?.count ?? 0;
  const items = notifications?.items ?? [];

  return (
    <Popover>
      <PopoverTrigger
        className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-xs text-muted-foreground"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {items.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={(id) => markRead.mutate(id)}
                />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
