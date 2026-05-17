import { useState, useCallback } from "react";
import { CheckCircle2, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileUploader } from "@/components/import/FileUploader";
import { ColumnMapper } from "@/components/import/ColumnMapper";
import { ImportPreview } from "@/components/import/ImportPreview";
import { ImportHistory } from "@/components/import/ImportHistory";
import {
  useImportHistory,
  useUploadFile,
  useSubmitMapping,
  useGetPreview,
  useConfirmImport,
  useDeleteImport,
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

function StepIndicator({
  currentStep,
}: {
  currentStep: number;
}) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, index) => (
        <div key={step.number} className="flex items-center">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
              currentStep === step.number
                ? "bg-primary text-primary-foreground"
                : currentStep > step.number
                  ? "bg-green-100 text-green-700"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {currentStep > step.number ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              step.number
            )}
          </div>
          <span
            className={cn(
              "ml-2 text-sm font-medium",
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
                "mx-4 h-px w-12",
                currentStep > step.number ? "bg-green-300" : "bg-muted"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function MobileRestriction() {
  return (
    <Card className="md:hidden">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <Monitor className="h-12 w-12 text-muted-foreground" />
        <div>
          <p className="font-medium">Import is available on desktop</p>
          <p className="text-sm text-muted-foreground mt-1">
            Please use a larger screen to import files.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ImportPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploadResponse, setUploadResponse] =
    useState<AutoDetectResponse | null>(null);
  const [previewData, setPreviewData] =
    useState<ImportPreviewResponse | null>(null);
  const [completedJob, setCompletedJob] = useState<ImportJob | null>(null);

  const { data: importHistory = [], isLoading: historyLoading } =
    useImportHistory();
  const uploadMutation = useUploadFile();
  const mappingMutation = useSubmitMapping();
  const previewMutation = useGetPreview();
  const confirmMutation = useConfirmImport();
  const deleteMutation = useDeleteImport();

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleFileUploaded = useCallback((_response: AutoDetectResponse) => {
    // Handled by handleUpload onSuccess
  }, []);

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
      },
    });
  }, [jobId, confirmMutation]);

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

  const handleCancel = useCallback(() => {
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

  const handleStartNew = useCallback(() => {
    handleCancel();
  }, [handleCancel]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Transactions</h1>
        <p className="text-muted-foreground">
          Import transactions from CSV or Excel files.
        </p>
      </div>

      {/* Mobile restriction */}
      <MobileRestriction />

      {/* Desktop import flow */}
      <div className="hidden md:block space-y-6">
        <StepIndicator currentStep={currentStep} />

        {currentStep === 1 && (
          <FileUploader
            onFileUploaded={handleFileUploaded}
            onUpload={handleUpload}
            loading={uploadMutation.isPending}
            error={
              uploadMutation.error
                ? uploadMutation.error.message
                : null
            }
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
            onCancel={handleCancel}
            onBack={handleBackToMapping}
            loading={confirmMutation.isPending}
          />
        )}

        {currentStep === 4 && completedJob && (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <div>
                <h2 className="text-xl font-semibold">Import Complete</h2>
                <p className="text-muted-foreground mt-1">
                  Your transactions have been imported successfully.
                </p>
              </div>
              <div className="flex gap-6 text-sm">
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {completedJob.imported_rows}
                  </p>
                  <p className="text-muted-foreground">Imported</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">
                    {completedJob.skipped_rows}
                  </p>
                  <p className="text-muted-foreground">Skipped</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">
                    {completedJob.error_rows}
                  </p>
                  <p className="text-muted-foreground">Errors</p>
                </div>
              </div>
              <Button onClick={handleStartNew} className="mt-4">
                Import Another File
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Import History (always visible) */}
      <ImportHistory
        imports={importHistory}
        loading={historyLoading}
        onDelete={(jobId) => deleteMutation.mutate(jobId)}
        deleting={deleteMutation.isPending}
      />
    </div>
  );
}
