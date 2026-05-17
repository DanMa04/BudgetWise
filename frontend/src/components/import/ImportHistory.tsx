import { useState } from "react";
import { FileUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ImportJob } from "@/types/models";

interface ImportHistoryProps {
  imports: ImportJob[];
  loading: boolean;
  onDelete?: (jobId: string) => void;
  deleting?: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    pending: "bg-yellow-100 text-yellow-800",
    mapping: "bg-blue-100 text-blue-800",
    previewing: "bg-blue-100 text-blue-800",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        styles[status] || "bg-gray-100 text-gray-800"
      )}
    >
      {status}
    </span>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ImportHistory({ imports, loading, onDelete, deleting }: ImportHistoryProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Import History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import History</CardTitle>
      </CardHeader>
      <CardContent>
        {imports.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <FileUp className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No imports yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-3 pr-4 text-left font-medium">Filename</th>
                  <th className="py-3 pr-4 text-left font-medium">Date</th>
                  <th className="py-3 pr-4 text-left font-medium">Status</th>
                  <th className="py-3 pr-4 text-right font-medium">Imported</th>
                  <th className="py-3 pr-4 text-right font-medium">Skipped</th>
                  <th className="py-3 pr-4 text-right font-medium">Errors</th>
                  <th className="py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((job) => (
                  <tr key={job.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{job.filename}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {formatDate(job.created_at)}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="py-3 pr-4 text-right">{job.imported_rows}</td>
                    <td className="py-3 pr-4 text-right">{job.skipped_rows}</td>
                    <td className="py-3 pr-4 text-right">{job.error_rows}</td>
                    <td className="py-3 text-right">
                      {confirmId === job.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={deleting}
                            onClick={() => {
                              onDelete?.(job.id);
                              setConfirmId(null);
                            }}
                          >
                            Confirm
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmId(job.id)}
                          title="Delete import and its transactions"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
