import { useState, useCallback } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ColumnMapperProps {
  headers: string[];
  sampleRows: Record<string, string>[];
  suggestedMapping: Record<string, string>;
  onMappingConfirmed: (mapping: Record<string, string>) => void;
  loading: boolean;
}

const TARGET_FIELDS = [
  { value: "skip", label: "Skip" },
  { value: "date", label: "Date" },
  { value: "amount", label: "Amount" },
  { value: "description", label: "Description" },
  { value: "category", label: "Category" },
  { value: "notes", label: "Notes" },
];

const REQUIRED_FIELDS = ["date", "amount", "description"];

export function ColumnMapper({
  headers,
  sampleRows,
  suggestedMapping,
  onMappingConfirmed,
  loading,
}: ColumnMapperProps) {
  const [mapping, setMapping] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const header of headers) {
      initial[header] = suggestedMapping[header] || "skip";
    }
    return initial;
  });

  const handleMappingChange = useCallback(
    (header: string, value: string) => {
      setMapping((prev) => ({ ...prev, [header]: value }));
    },
    []
  );

  const mappedFields = Object.values(mapping);
  const missingRequired = REQUIRED_FIELDS.filter(
    (field) => !mappedFields.includes(field)
  );

  const handleConfirm = useCallback(() => {
    if (missingRequired.length > 0) return;
    onMappingConfirmed(mapping);
  }, [mapping, missingRequired, onMappingConfirmed]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Map Columns</CardTitle>
        <p className="text-sm text-muted-foreground">
          Match each column from your file to the corresponding field. Required
          fields: Date, Amount, Description.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-3 pr-4 text-left font-medium">
                  File Column
                </th>
                <th className="py-3 pr-4 text-left font-medium">
                  Sample Values
                </th>
                <th className="py-3 text-left font-medium">Map To</th>
              </tr>
            </thead>
            <tbody>
              {headers.map((header) => {
                const isSuggested =
                  suggestedMapping[header] &&
                  mapping[header] === suggestedMapping[header] &&
                  mapping[header] !== "skip";

                return (
                  <tr key={header} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{header}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {sampleRows
                        .slice(0, 3)
                        .map((row) => row[header])
                        .filter(Boolean)
                        .join(", ")}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Select
                          value={mapping[header]}
                          onChange={(e) =>
                            handleMappingChange(header, e.target.value)
                          }
                          className={cn(
                            "w-40",
                            isSuggested && "border-green-500"
                          )}
                          data-testid={`mapping-select-${header}`}
                        >
                          {TARGET_FIELDS.map((field) => (
                            <option key={field.value} value={field.value}>
                              {field.label}
                            </option>
                          ))}
                        </Select>
                        {isSuggested && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            <Check className="h-3 w-3" />
                            Suggested
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {missingRequired.length > 0 && (
          <p className="mt-4 text-sm text-destructive">
            Missing required fields:{" "}
            {missingRequired
              .map((f) => f.charAt(0).toUpperCase() + f.slice(1))
              .join(", ")}
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleConfirm}
            disabled={missingRequired.length > 0 || loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Confirming...
              </>
            ) : (
              "Confirm Mapping"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
