import { describe, it, expect } from "vitest";
import { parseCurrencyString, parseCartTotal } from "../src/content/parser";

describe("parseCurrencyString", () => {
  it("parses standard dollar amount", () => {
    expect(parseCurrencyString("$49.99")).toBe(49.99);
  });

  it("parses amount with commas", () => {
    expect(parseCurrencyString("$1,234.56")).toBe(1234.56);
  });

  it("parses amount without dollar sign", () => {
    expect(parseCurrencyString("49.99")).toBe(49.99);
  });

  it("parses amount with spaces", () => {
    expect(parseCurrencyString("  $49.99  ")).toBe(49.99);
  });

  it("parses large amount", () => {
    expect(parseCurrencyString("$12,345,678.90")).toBe(12345678.9);
  });

  it("parses whole number", () => {
    expect(parseCurrencyString("$100")).toBe(100);
  });

  it("returns null for empty string", () => {
    expect(parseCurrencyString("")).toBe(null);
  });

  it("returns null for non-numeric string", () => {
    expect(parseCurrencyString("abc")).toBe(null);
  });

  it("returns null for null-ish input", () => {
    expect(parseCurrencyString(null as unknown as string)).toBe(null);
  });

  it("returns null for negative amounts", () => {
    expect(parseCurrencyString("-$10.00")).toBe(null);
  });

  it("parses zero", () => {
    expect(parseCurrencyString("$0.00")).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    expect(parseCurrencyString("$49.999")).toBe(50);
  });
});

describe("parseCartTotal", () => {
  function createDocWithElement(selector: string, text: string): Document {
    const doc = new DOMParser().parseFromString(
      "<html><body></body></html>",
      "text/html"
    );
    const el = doc.createElement("span");
    el.textContent = text;

    if (selector.startsWith("[")) {
      const match = selector.match(/\[([^=]+)="([^"]+)"\]/);
      if (match) {
        const parent = doc.createElement("div");
        parent.setAttribute(match[1], match[2]);
        parent.appendChild(el);
        doc.body.appendChild(parent);
      }
    } else if (selector.startsWith("#")) {
      const parent = doc.createElement("div");
      parent.id = selector.replace("# ", "").split(" ")[0].replace("#", "");
      const child = doc.createElement("span");
      child.className = selector.includes(".") ? selector.split(".").pop()! : "";
      child.textContent = text;
      parent.appendChild(child);
      doc.body.appendChild(parent);
    } else {
      doc.body.appendChild(el);
    }

    return doc;
  }

  it("returns null total for unknown site", () => {
    const doc = new DOMParser().parseFromString("<html><body></body></html>", "text/html");
    const result = parseCartTotal("ebay", doc);
    expect(result.total).toBe(null);
    expect(result.confidence).toBe(0);
  });

  it("returns null total when no matching selectors found", () => {
    const doc = new DOMParser().parseFromString("<html><body><p>Hello</p></body></html>", "text/html");
    const result = parseCartTotal("amazon", doc);
    expect(result.total).toBe(null);
    expect(result.merchant).toBe("Amazon");
  });

  it("parses Target cart total from data-test attribute", () => {
    const doc = createDocWithElement('[data-test="cart-summary-total"]', "$89.99");
    const result = parseCartTotal("target", doc);
    expect(result.total).toBe(89.99);
    expect(result.merchant).toBe("Target");
    expect(result.confidence).toBe(0.8);
  });

  it("parses Walmart cart total from data-testid attribute", () => {
    const doc = createDocWithElement('[data-testid="subtotal"]', "$129.50");
    const result = parseCartTotal("walmart", doc);
    expect(result.total).toBe(129.5);
    expect(result.merchant).toBe("Walmart");
  });

  it("returns correct site info even on failure", () => {
    const doc = new DOMParser().parseFromString("<html><body></body></html>", "text/html");
    const result = parseCartTotal("target", doc);
    expect(result.site).toBe("target.com");
    expect(result.merchant).toBe("Target");
  });
});
