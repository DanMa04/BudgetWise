import { useState } from "react";
import { Check, ChevronDown, ChevronRight, MessageCircle, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAiAssistantApply } from "@/hooks/useAiAssistant";
import type { AiProposal } from "@/api/aiAssistant";

interface Props {
  proposal: AiProposal;
  summary: string;
  onApplied: () => void;
  onBack: () => void;
  /** Send free-form feedback back to the assistant for a revised proposal. */
  onRequestChanges: (feedback: string) => void;
  /** True while the assistant is processing the feedback turn. */
  changesPending?: boolean;
}

export function AiProposalReview({
  proposal,
  summary,
  onApplied,
  onBack,
  onRequestChanges,
  changesPending = false,
}: Props) {
  const apply = useAiAssistantApply();
  const [openSections, setOpenSections] = useState({
    cats: true,
    goals: true,
    budget: true,
  });
  const [showChangesInput, setShowChangesInput] = useState(false);
  const [changesText, setChangesText] = useState("");

  function handleSendChanges() {
    const trimmed = changesText.trim();
    if (!trimmed || changesPending) return;
    setChangesText("");
    setShowChangesInput(false);
    onRequestChanges(trimmed);
  }

  const proposedCats = Array.isArray(
    (proposal.categorization as { proposed_categories?: unknown[] })
      ?.proposed_categories
  )
    ? ((proposal.categorization as { proposed_categories: Array<{
        name: string;
        color?: string | null;
      }> }).proposed_categories)
    : [];

  const assignmentCount = Array.isArray(
    (proposal.categorization as { assignments?: unknown[] })?.assignments
  )
    ? (proposal.categorization as { assignments: unknown[] }).assignments.length
    : 0;

  const allocationSum =
    proposal.budget?.allocations.reduce((s, a) => s + a.amount, 0) ?? 0;
  const contributionSum =
    proposal.budget?.goal_contributions.reduce(
      (s, c) => s + c.monthly_amount,
      0
    ) ?? 0;
  const income = proposal.budget?.monthly_income ?? 0;
  const leftover = income - allocationSum - contributionSum;

  function handleApply() {
    apply.mutate(proposal, { onSuccess: onApplied });
  }

  function toggle(key: keyof typeof openSections) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-violet-500" />
        <p className="text-sm text-muted-foreground">{summary}</p>
      </div>

      <Section
        title={`Categories (${proposedCats.length}) — ${assignmentCount} transactions`}
        open={openSections.cats}
        onToggle={() => toggle("cats")}
      >
        <ul className="space-y-1">
          {proposedCats.map((c) => (
            <li key={c.name} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: c.color || "#6b7280" }}
              />
              {c.name}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title={`Goals (${proposal.goals.length})`}
        open={openSections.goals}
        onToggle={() => toggle("goals")}
      >
        <ul className="space-y-1.5">
          {proposal.goals.map((g) => (
            <li key={g.name} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: g.color || "#6366F1" }}
              />
              <span className="font-medium">{g.name}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">
                ${g.target_amount.toLocaleString()}
                {g.target_date && ` by ${g.target_date}`}
              </span>
            </li>
          ))}
          {proposal.goals.length === 0 && (
            <li className="text-sm text-muted-foreground">
              No goals proposed.
            </li>
          )}
        </ul>
      </Section>

      <Section
        title={`Zero-based budget — $${income.toLocaleString()}/mo`}
        open={openSections.budget}
        onToggle={() => toggle("budget")}
      >
        {proposal.budget ? (
          <>
            <ul className="space-y-1 text-sm">
              {proposal.budget.allocations.map((a) => (
                <li
                  key={a.category_name}
                  className="flex justify-between tabular-nums"
                >
                  <span>{a.category_name}</span>
                  <span>${a.amount.toLocaleString()}</span>
                </li>
              ))}
              {proposal.budget.goal_contributions.map((c) => (
                <li
                  key={c.goal_name}
                  className="flex justify-between tabular-nums text-indigo-600 dark:text-indigo-400"
                >
                  <span>→ {c.goal_name}</span>
                  <span>${c.monthly_amount.toLocaleString()}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-between border-t pt-2 text-sm font-medium tabular-nums">
              <span>Unallocated</span>
              <span
                className={
                  Math.abs(leftover) < 0.5
                    ? "text-emerald-600"
                    : "text-amber-600"
                }
              >
                ${leftover.toLocaleString()}
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No budget proposed.</p>
        )}
      </Section>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        A save state was created before applying. Categories and transaction
        assignments can be restored from Save States. Goals and budgets created
        here are not in the snapshot — edit or delete them after if needed.
      </div>

      {apply.isError && (
        <p className="text-sm text-destructive">{apply.error.message}</p>
      )}

      {showChangesInput && (
        <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-800 dark:bg-indigo-950/40">
          <p className="text-xs font-medium text-indigo-900 dark:text-indigo-100">
            Tell the assistant what to change. Examples: "lower housing to
            $1,800", "merge groceries and dining into food", "add more
            subcategories under shopping".
          </p>
          <textarea
            value={changesText}
            onChange={(e) => setChangesText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSendChanges();
              }
            }}
            placeholder="What should the assistant adjust?"
            rows={3}
            disabled={changesPending}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowChangesInput(false);
                setChangesText("");
              }}
              disabled={changesPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSendChanges}
              disabled={!changesText.trim() || changesPending}
            >
              {changesPending ? (
                <>
                  <Spinner className="mr-2 h-3.5 w-3.5" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-3.5 w-3.5" />
                  Send changes
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          onClick={onBack}
          disabled={apply.isPending || changesPending}
        >
          Back
        </Button>
        <div className="flex gap-2">
          {!showChangesInput && (
            <Button
              variant="outline"
              onClick={() => setShowChangesInput(true)}
              disabled={apply.isPending || changesPending}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Request changes
            </Button>
          )}
          <Button
            onClick={handleApply}
            disabled={apply.isPending || changesPending}
          >
            {apply.isPending ? (
              <>
                <Spinner className="mr-2 h-3.5 w-3.5" />
                Applying...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Approve & Apply
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-muted/50"
      >
        {open ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        {title}
      </button>
      {open && <div className="border-t px-3 py-2">{children}</div>}
    </div>
  );
}
