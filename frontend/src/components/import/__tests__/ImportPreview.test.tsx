import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { ImportPreview } from "../ImportPreview";
import type { ImportPreviewResponse } from "@/types/models";

const mockPreview: ImportPreviewResponse = {
  rows: [
    {
      date: "2026-01-15",
      amount: -42.5,
      description: "Grocery Store",
      category: "Groceries",
      notes: null,
      warnings: [],
      is_duplicate: false,
    },
    {
      date: "2026-01-16",
      amount: -15.0,
      description: "Coffee Shop",
      category: "Dining",
      notes: null,
      warnings: ["Amount seems unusually low"],
      is_duplicate: false,
    },
    {
      date: "2026-01-17",
      amount: -200.0,
      description: "Electric Bill",
      category: "Utilities",
      notes: null,
      warnings: [],
      is_duplicate: true,
    },
  ],
  total_rows: 3,
  warnings: [],
};

describe("ImportPreview", () => {
  const defaultProps = {
    preview: mockPreview,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    loading: false,
  };

  it("renders preview table with correct columns", () => {
    renderWithProviders(<ImportPreview {...defaultProps} />);

    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders transaction rows", () => {
    renderWithProviders(<ImportPreview {...defaultProps} />);

    expect(screen.getByText("Grocery Store")).toBeInTheDocument();
    expect(screen.getByText("Coffee Shop")).toBeInTheDocument();
    expect(screen.getByText("Electric Bill")).toBeInTheDocument();
  });

  it("shows duplicate badge on duplicate rows", () => {
    renderWithProviders(<ImportPreview {...defaultProps} />);

    expect(screen.getByText("Duplicate")).toBeInTheDocument();
  });

  it("shows warning indicators on rows with warnings", () => {
    renderWithProviders(<ImportPreview {...defaultProps} />);

    expect(screen.getByText("1 warning")).toBeInTheDocument();
  });

  it("displays summary counts", () => {
    renderWithProviders(<ImportPreview {...defaultProps} />);

    // 3 total - 1 duplicate = 2 ready to import
    const readyText = screen.getByText(/rows ready to import/);
    expect(readyText).toBeInTheDocument();
    // Check that "2" appears as a bold strong element in the ready count
    expect(readyText.querySelector("strong")?.textContent).toBe("2");

    const dupText = screen.getByText(/duplicates will be skipped/);
    expect(dupText).toBeInTheDocument();
    expect(dupText.querySelector("strong")?.textContent).toBe("1");
  });

  it("shows import button with correct count", () => {
    renderWithProviders(<ImportPreview {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: "Import 2 Transactions" })
    ).toBeInTheDocument();
  });

  it("shows cancel button", () => {
    renderWithProviders(<ImportPreview {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: "Cancel" })
    ).toBeInTheDocument();
  });
});
