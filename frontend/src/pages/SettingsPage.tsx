import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/context/ThemeContext";
import { useExtensionConnection } from "@/hooks/useExtensionConnection";

function ExtensionCard() {
  const { extensionPresent, isConnected, expiresAt, isLoading, connect, disconnect } =
    useExtensionConnection();

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="rounded-xl border border-white/8 bg-card/65 p-6 backdrop-blur-xl">
      <h2 className="font-semibold">Browser Extension</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Get real-time budget warnings while shopping online.
      </p>

      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Checking connection…</p>
      ) : !extensionPresent ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            Install the Kallio extension, then return here to connect.
          </p>
          <a
            href="https://chromewebstore.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Install Extension
          </a>
        </div>
      ) : isConnected ? (
        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-sm font-medium">Connected</span>
            </div>
            {expiresLabel && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Token expires {expiresLabel}
              </p>
            )}
          </div>
          <button
            onClick={disconnect}
            className="rounded-md border border-destructive/50 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <button
            onClick={connect}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Connect Extension
          </button>
        </div>
      )}
    </div>
  );
}

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

      <ExtensionCard />

      <NotificationPreferences />
    </div>
  );
}
