import { useCallback, useRef, useState } from "react";
import { Upload, File as FileIcon, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AutoDetectResponse } from "@/types/models";

interface FileUploaderProps {
  onFileUploaded: (response: AutoDetectResponse) => void;
  onUpload: (file: File) => void;
  loading: boolean;
  error: string | null;
}

const ACCEPTED_TYPES = [".csv", ".xlsx", ".xls"];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUploader({
  onUpload,
  loading,
  error,
}: FileUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_TYPES.includes(ext)) {
      return `Invalid file type. Accepted formats: ${ACCEPTED_TYPES.join(", ")}`;
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `File size exceeds ${MAX_SIZE_MB}MB limit.`;
    }
    return null;
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      const err = validateFile(file);
      if (err) {
        setValidationError(err);
        setSelectedFile(null);
        return;
      }
      setValidationError(null);
      setSelectedFile(file);
    },
    [validateFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
    setValidationError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const handleUploadClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (selectedFile) {
        onUpload(selectedFile);
      }
    },
    [selectedFile, onUpload]
  );

  return (
    <Card>
      <CardContent>
        <div
          role="button"
          tabIndex={0}
          data-testid="drop-zone"
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors cursor-pointer",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50",
            loading && "pointer-events-none opacity-60"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            if (!selectedFile) inputRef.current?.click();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!selectedFile) inputRef.current?.click();
            }
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={handleInputChange}
            data-testid="file-input"
          />

          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Uploading and analyzing file...
              </p>
            </div>
          ) : selectedFile ? (
            <div className="flex flex-col items-center gap-3">
              <FileIcon className="h-10 w-10 text-primary" />
              <div className="text-center">
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile();
                  }}
                >
                  <X className="h-4 w-4" />
                  Remove
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleUploadClick}
                >
                  <Upload className="h-4 w-4" />
                  Upload
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  Drag and drop your file here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Accepted formats: CSV, XLSX, XLS (max {MAX_SIZE_MB}MB)
                </p>
              </div>
            </div>
          )}
        </div>

        {validationError && (
          <p className="mt-3 text-sm text-destructive">{validationError}</p>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
