import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useNotificationPreferences,
  useUpsertPreference,
} from "@/hooks/useNotifications";
import type { NotificationPreference } from "@/types/models";

interface NotificationTypeRow {
  type: string;
  label: string;
  threshold?: number;
}

const notificationTypes: NotificationTypeRow[] = [
  { type: "budget_warning", label: "Budget Warning (80%)", threshold: 80 },
  { type: "budget_warning_90", label: "Budget Warning (90%)", threshold: 90 },
  { type: "budget_exceeded", label: "Budget Exceeded (100%)", threshold: 100 },
  { type: "pace_alert", label: "Pace Alert" },
  { type: "goal_milestone", label: "Goal Milestone" },
  { type: "weekly_summary", label: "Weekly Summary" },
];

const channels = [
  { key: "in_app", label: "In-App", enabled: true },
  { key: "push", label: "Push", enabled: false },
  { key: "email", label: "Email", enabled: false },
] as const;

function findPreference(
  preferences: NotificationPreference[],
  type: string,
  channel: string
): NotificationPreference | undefined {
  return preferences.find(
    (p) => p.notification_type === type && p.channel === channel
  );
}

export function NotificationPreferences() {
  const { data: preferences } = useNotificationPreferences();
  const upsert = useUpsertPreference();

  const prefs = preferences ?? [];

  function handleToggle(
    type: string,
    channel: string,
    currentEnabled: boolean,
    threshold?: number
  ) {
    upsert.mutate({
      notification_type: type,
      channel,
      enabled: !currentEnabled,
      threshold: threshold ?? null,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-3 pr-4 text-sm font-medium text-muted-foreground">
                  Notification Type
                </th>
                {channels.map((ch) => (
                  <th
                    key={ch.key}
                    className="pb-3 text-center text-sm font-medium text-muted-foreground"
                  >
                    {ch.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {notificationTypes.map((row) => (
                <tr key={row.type}>
                  <td className="py-3 pr-4 text-sm">{row.label}</td>
                  {channels.map((ch) => {
                    const pref = findPreference(prefs, row.type, ch.key);
                    const isEnabled = pref?.enabled ?? false;

                    if (!ch.enabled) {
                      return (
                        <td key={ch.key} className="py-3 text-center">
                          <span className="text-xs text-muted-foreground">
                            Coming soon
                          </span>
                        </td>
                      );
                    }

                    return (
                      <td key={ch.key} className="py-3 text-center">
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() =>
                            handleToggle(
                              row.type,
                              ch.key,
                              isEnabled,
                              row.threshold
                            )
                          }
                          aria-label={`${row.label} ${ch.label}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
