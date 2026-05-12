import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { FileUploader } from "../FileUploader";

describe("FileUploader", () => {
  const defaultProps = {
    onFileUploaded: vi.fn(),
    onUpload: vi.fn(),
    loading: false,
    error: null,
  };

  it("renders drop zone with instructions", () => {
    renderWithProviders(<FileUploader {...defaultProps} />);

    expect(
      screen.getByText("Drag and drop your file here, or click to browse")
    ).toBeInTheDocument();
  });

  it("shows accepted file types", () => {
    renderWithProviders(<FileUploader {...defaultProps} />);

    expect(
      screen.getByText(/Accepted formats: CSV, XLSX, XLS/)
    ).toBeInTheDocument();
  });

  it("shows file size limit text", () => {
    renderWithProviders(<FileUploader {...defaultProps} />);

    expect(screen.getByText(/max 10MB/)).toBeInTheDocument();
  });

  it("shows loading state when uploading", () => {
    renderWithProviders(<FileUploader {...defaultProps} loading={true} />);

    expect(
      screen.getByText("Uploading and analyzing file...")
    ).toBeInTheDocument();
  });

  it("shows error message when error prop is set", () => {
    renderWithProviders(
      <FileUploader {...defaultProps} error="Upload failed: invalid file" />
    );

    expect(
      screen.getByText("Upload failed: invalid file")
    ).toBeInTheDocument();
  });
});
