import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ImportPreviewResponse } from "@/types/models";

interface ImportPreviewProps {
  preview: ImportPreviewResponse;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

export function ImportPreview({
  preview,
  onConfirm,
  onCancel,
  loading,
}: ImportPreviewProps) {
  const duplicateCount = preview.rows.filter((r) => r.is_duplicate).length;
  const warningCount = preview.rows.filter(
    (r) => r.warnings.length > 0
  ).length;
  const readyCount = preview.total_rows - duplicateCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Preview</CardTitle>
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-muted-foreground">
            <strong className="text-foreground">{readyCount}</strong> rows ready
            to import
          </span>
          {duplicateCount > 0 && (
            <span className="text-yellow-600">
              <strong>{duplicateCount}</strong> duplicates will be skipped
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-yellow-600">
              <strong>{warningCount}</strong> rows with warnings
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-3 pr-4 text-left font-medium">Date</th>
                <th className="py-3 pr-4 text-left font-medium">
                  Description
                </th>
                <th className="py-3 pr-4 text-right font-medium">Amount</th>
                <th className="py-3 pr-4 text-left font-medium">Category</th>
                <th className="py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.slice(0, 20).map((row, index) => {
                const hasWarnings = row.warnings.length > 0;

                return (
                  <tr
                    key={index}
                    className={cn(
                      "border-b last:border-0",
                      hasWarnings && "bg-yellow-50",
                      row.is_duplicate && "opacity-60"
                    )}
                  >
                    <td className="py-3 pr-4">{row.date}</td>
                    <td className="py-3 pr-4">{row.description}</td>
                    <td className="py-3 pr-4 text-right font-mono">
                      ${Math.abs(row.amount).toFixed(2)}
                    </td>
                    <td className="py-3 pr-4">
                      {row.category || (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {row.is_duplicate && (
                          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                            Duplicate
                          </span>
                        )}
                        {hasWarnings && (
                          <span
                            title={row.warnings.join("; ")}
                            className="inline-flex items-center gap-1 text-yellow-600"
                          >
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-xs">
                              {row.warnings.length} warning
                              {row.warnings.length > 1 ? "s" : ""}
                            </span>
                          </span>
                        )}
                        {!row.is_duplicate && !hasWarnings && (
                          <span className="text-xs text-green-600">Ready</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {preview.warnings.length > 0 && (
          <div className="mt-4 rounded-md bg-yellow-50 p-3">
            <p className="text-sm font-medium text-yellow-800">Warnings:</p>
            <ul className="mt-1 list-inside list-disc text-sm text-yellow-700">
              {preview.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              `Import ${readyCount} Transactions`
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
