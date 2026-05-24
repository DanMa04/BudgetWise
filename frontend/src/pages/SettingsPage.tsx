import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/context/ThemeContext";

export function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account preferences.
        </p>
      </div>

      <div className="rounded-xl border border-white/8 bg-card/65 p-6 backdrop-blur-xl">
        <h2 className="font-semibold">Appearance</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Choose your preferred color scheme.
        </p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm">Dark mode</span>
          <Switch
            checked={theme === "dark"}
            onCheckedChange={(checked) =>
              setTheme(checked ? "dark" : "light")
            }
          />
        </div>
      </div>

      <NotificationPreferences />
    </div>
  );
}
