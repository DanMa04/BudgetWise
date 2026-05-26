import { Link } from "react-router-dom";

export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12 space-y-8 text-sm leading-relaxed">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-muted-foreground">Last updated: {new Date().getFullYear()}</p>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">What we collect</h2>
        <p className="text-muted-foreground">
          Kallio stores the financial data you provide: account balances, transaction history,
          budgets, savings goals, and spending categories. Your email address and display name
          are stored for authentication purposes. If you use the browser extension, only your
          cart total and merchant name are sent to our servers — we never read or store the
          full content of any web page you visit.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">Why we collect it</h2>
        <p className="text-muted-foreground">
          Your data is used solely to provide Kallio's budgeting and spending-alert features.
          We do not sell, share, or use your data for advertising.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">Third-party processors</h2>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>
            <strong>Clerk</strong> — handles account creation, sign-in, and identity management.
            Clerk processes your email address and is GDPR-compliant with a Data Processing
            Agreement available at clerk.com.
          </li>
          <li>
            <strong>Plaid</strong> (if connected) — facilitates read-only access to your bank
            account data. Plaid is SOC 2 Type II certified and GDPR-compliant.
          </li>
          <li>
            <strong>Cloud infrastructure</strong> — your data is stored in encrypted databases
            on our cloud provider. Data is stored in the region closest to you.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">Data retention</h2>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>In-app notification history is automatically deleted after 90 days.</li>
          <li>Browser extension auth tokens are purged 30 days after expiry.</li>
          <li>All other data is retained until you delete your account.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">Your rights</h2>
        <p className="text-muted-foreground">
          Under GDPR and similar regulations you have the right to access, export, and
          permanently delete the data Kallio holds about you. You can exercise these rights
          directly from your{" "}
          <Link to="/settings" className="underline underline-offset-2 hover:text-foreground">
            Settings
          </Link>{" "}
          page without contacting us.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">Contact</h2>
        <p className="text-muted-foreground">
          Questions about this policy or data requests that cannot be handled through the
          app can be directed to{" "}
          <a
            href="mailto:privacy@kallio.app"
            className="underline underline-offset-2 hover:text-foreground"
          >
            privacy@kallio.app
          </a>
          .
        </p>
      </section>
    </div>
  );
}
