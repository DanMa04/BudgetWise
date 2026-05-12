import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { ColumnMapper } from "../ColumnMapper";

const mockHeaders = ["Date", "Amount", "Memo", "Type"];
const mockSampleRows = [
  { Date: "2026-01-15", Amount: "42.50", Memo: "Grocery Store", Type: "debit" },
  { Date: "2026-01-16", Amount: "15.00", Memo: "Coffee Shop", Type: "debit" },
  { Date: "2026-01-17", Amount: "200.00", Memo: "Paycheck", Type: "credit" },
];
const mockSuggestedMapping: Record<string, string> = {
  Date: "date",
  Amount: "amount",
  Memo: "description",
  Type: "skip",
};

describe("ColumnMapper", () => {
  const defaultProps = {
    headers: mockHeaders,
    sampleRows: mockSampleRows,
    suggestedMapping: mockSuggestedMapping,
    onMappingConfirmed: vi.fn(),
    loading: false,
  };

  it("renders all column headers", () => {
    renderWithProviders(<ColumnMapper {...defaultProps} />);

    // Each header should appear as a table cell with font-medium class
    for (const header of mockHeaders) {
      const cells = screen.getAllByText(header);
      // At least one should be a <td> (the file column cell)
      const tdCell = cells.find((el) => el.tagName === "TD");
      expect(tdCell).toBeTruthy();
    }
  });

  it("pre-selects suggested mappings", () => {
    renderWithProviders(<ColumnMapper {...defaultProps} />);

    const dateSelect = screen.getByTestId(
      "mapping-select-Date"
    ) as HTMLSelectElement;
    expect(dateSelect.value).toBe("date");

    const amountSelect = screen.getByTestId(
      "mapping-select-Amount"
    ) as HTMLSelectElement;
    expect(amountSelect.value).toBe("amount");

    const memoSelect = screen.getByTestId(
      "mapping-select-Memo"
    ) as HTMLSelectElement;
    expect(memoSelect.value).toBe("description");
  });

  it("shows sample values for each column", () => {
    renderWithProviders(<ColumnMapper {...defaultProps} />);

    expect(screen.getByText(/42\.50/)).toBeInTheDocument();
    expect(screen.getByText(/Grocery Store/)).toBeInTheDocument();
  });

  it("shows suggested badges for auto-detected mappings", () => {
    renderWithProviders(<ColumnMapper {...defaultProps} />);

    const suggestedBadges = screen.getAllByText("Suggested");
    // Date, Amount, Memo are suggested (not Type since it maps to "skip")
    expect(suggestedBadges).toHaveLength(3);
  });

  it("shows confirm mapping button", () => {
    renderWithProviders(<ColumnMapper {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: "Confirm Mapping" })
    ).toBeInTheDocument();
  });
});
