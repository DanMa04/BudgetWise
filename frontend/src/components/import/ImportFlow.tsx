import { useCallback, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileUploader } from "@/components/import/FileUploader";
import { ColumnMapper } from "@/components/import/ColumnMapper";
import { ImportPreview } from "@/components/import/ImportPreview";
import {
  useConfirmImport,
  useGetPreview,
  useSubmitMapping,
  useUploadFile,
} from "@/hooks/useImport";
import { cn } from "@/lib/utils";
import type {
  AutoDetectResponse,
  ImportJob,
  ImportPreviewResponse,
} from "@/types/models";

const STEPS = [
  { number: 1, label: "Upload" },
  { number: 2, label: "Map Columns" },
  { number: 3, label: "Preview" },
  { number: 4, label: "Complete" },
];

interface Props {
  onComplete?: (job: ImportJob) => void;
  onCancel?: () => void;
  compact?: boolean;
}

export function ImportFlow({ onComplete, onCancel, compact = false }: Props) {
  const [currentStep, setCurrentStep] = useState(1);
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploadResponse, setUploadResponse] =
    useState<AutoDetectResponse | null>(null);
  const [previewData, setPreviewData] =
    useState<ImportPreviewResponse | null>(null);
  const [completedJob, setCompletedJob] = useState<ImportJob | null>(null);

  const uploadMutation = useUploadFile();
  const mappingMutation = useSubmitMapping();
  const previewMutation = useGetPreview();
  const confirmMutation = useConfirmImport();

  const handleUpload = useCallback(
    (file: File) => {
      uploadMutation.mutate(file, {
        onSuccess: (response) => {
          setJobId(response.job_id);
          setUploadResponse(response);
          setCurrentStep(2);
        },
      });
    },
    [uploadMutation]
  );

  const handleMappingConfirmed = useCallback(
    (mapping: Record<string, string>) => {
      if (!jobId) return;
      mappingMutation.mutate(
        { jobId, mapping },
        {
          onSuccess: (result) => {
            if (result.valid) {
              previewMutation.mutate(jobId, {
                onSuccess: (preview) => {
                  setPreviewData(preview);
                  setCurrentStep(3);
                },
              });
            }
          },
        }
      );
    },
    [jobId, mappingMutation, previewMutation]
  );

  const handleConfirmImport = useCallback(() => {
    if (!jobId) return;
    confirmMutation.mutate(jobId, {
      onSuccess: (job) => {
        setCompletedJob(job);
        setCurrentStep(4);
        onComplete?.(job);
      },
    });
  }, [jobId, confirmMutation, onComplete]);

  const handleBackToUpload = useCallback(() => {
    setCurrentStep(1);
    setJobId(null);
    setUploadResponse(null);
    setPreviewData(null);
    uploadMutation.reset();
    mappingMutation.reset();
    previewMutation.reset();
  }, [uploadMutation, mappingMutation, previewMutation]);

  const handleBackToMapping = useCallback(() => {
    setCurrentStep(2);
    setPreviewData(null);
    previewMutation.reset();
  }, [previewMutation]);

  const handleReset = useCallback(() => {
    setCurrentStep(1);
    setJobId(null);
    setUploadResponse(null);
    setPreviewData(null);
    setCompletedJob(null);
    uploadMutation.reset();
    mappingMutation.reset();
    previewMutation.reset();
    confirmMutation.reset();
  }, [uploadMutation, mappingMutation, previewMutation, confirmMutation]);

  return (
    <div className={cn("space-y-6", compact && "space-y-4")}>
      <StepIndicator currentStep={currentStep} compact={compact} />

      {currentStep === 1 && (
        <FileUploader
          onFileUploaded={() => {}}
          onUpload={handleUpload}
          loading={uploadMutation.isPending}
          error={uploadMutation.error ? uploadMutation.error.message : null}
        />
      )}

      {currentStep === 2 && uploadResponse && (
        <ColumnMapper
          headers={uploadResponse.headers}
          sampleRows={uploadResponse.sample_rows}
          suggestedMapping={uploadResponse.suggested_mapping}
          onMappingConfirmed={handleMappingConfirmed}
          onBack={handleBackToUpload}
          loading={mappingMutation.isPending || previewMutation.isPending}
        />
      )}

      {currentStep === 3 && previewData && (
        <ImportPreview
          preview={previewData}
          onConfirm={handleConfirmImport}
          onCancel={onCancel ?? handleReset}
          onBack={handleBackToMapping}
          loading={confirmMutation.isPending}
        />
      )}

      {currentStep === 4 && completedJob && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <div>
              <h2 className="text-lg font-semibold">Import complete</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Your transactions have been imported.
              </p>
            </div>
            <div className="flex gap-6 text-sm">
              <Stat
                label="Imported"
                value={completedJob.imported_rows}
                color="text-green-600"
              />
              <Stat
                label="Skipped"
                value={completedJob.skipped_rows}
                color="text-yellow-600"
              />
              <Stat
                label="Errors"
                value={completedJob.error_rows}
                color="text-red-600"
              />
            </div>
            <Button variant="outline" onClick={handleReset} className="mt-2">
              Import another file
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <p className={cn("text-2xl font-bold", color)}>{value}</p>
      <p className="text-muted-foreground">{label}</p>
    </div>
  );
}

function StepIndicator({
  currentStep,
  compact,
}: {
  currentStep: number;
  compact: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {STEPS.map((step, index) => (
        <div key={step.number} className="flex items-center">
          <div
            className={cn(
              "flex items-center justify-center rounded-full text-xs font-medium",
              compact ? "h-6 w-6" : "h-8 w-8 text-sm",
              currentStep === step.number
                ? "bg-primary text-primary-foreground"
                : currentStep > step.number
                  ? "bg-green-100 text-green-700"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {currentStep > step.number ? (
              <CheckCircle2 className={compact ? "h-3.5 w-3.5" : "h-5 w-5"} />
            ) : (
              step.number
            )}
          </div>
          <span
            className={cn(
              "ml-2 font-medium",
              compact ? "text-xs" : "text-sm",
              currentStep === step.number
                ? "text-foreground"
                : "text-muted-foreground"
            )}
          >
            {step.label}
          </span>
          {index < STEPS.length - 1 && (
            <div
              className={cn(
                "mx-2 h-px",
                compact ? "w-6" : "w-12 mx-4",
                currentStep > step.number ? "bg-green-300" : "bg-muted"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
