import { Badge } from "@/components/ui/badge";

interface ConfidenceBadgeProps {
  confidence: number | null;
  source: string | null;
}

export function ConfidenceBadge({ confidence, source }: ConfidenceBadgeProps) {
  if (source === "manual") {
    return null;
  }

  if (source === "rule") {
    return (
      <Badge
        className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100"
        title="Auto-categorized by rule"
      >
        Rule
      </Badge>
    );
  }

  if (source === "import") {
    return (
      <Badge
        className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100"
        title="Categorized from import file"
      >
        Import
      </Badge>
    );
  }

  if (source === "subscription") {
    return (
      <Badge
        className="bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
        title="Detected as recurring subscription"
      >
        Recurring
      </Badge>
    );
  }

  if (source === "ml" && confidence !== null && confidence >= 0.8) {
    return (
      <Badge
        className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100"
        title={`Auto-categorized by AI with ${Math.round(confidence * 100)}% confidence`}
      >
        AI
      </Badge>
    );
  }

  if (source === "ml" && confidence !== null && confidence >= 0.6) {
    return (
      <Badge
        className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100"
        title={`Auto-categorized by AI with ${Math.round(confidence * 100)}% confidence`}
      >
        AI?
      </Badge>
    );
  }

  return (
    <Badge
      variant="destructive"
      className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100"
      title="Uncategorized transaction"
    >
      Uncategorized
    </Badge>
  );
}
