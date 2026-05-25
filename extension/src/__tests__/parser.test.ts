import { describe, it, expect } from "vitest";
import { parseCurrencyString, parseCartTotal } from "../content/parser";

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
  function makeDoc(html: string): Document {
    return new DOMParser().parseFromString(
      `<html><head></head><body>${html}</body></html>`,
      "text/html"
    );
  }

  it("returns null total for empty document", () => {
    const doc = makeDoc("");
    const result = parseCartTotal(doc);
    expect(result.total).toBe(null);
    expect(result.confidence).toBe(0);
  });

  it("parses total from JSON-LD structured data (strategy 1)", () => {
    const doc = makeDoc(`
      <script type="application/ld+json">
        {"@type":"Order","totalPaymentDue":{"price":"89.99"}}
      </script>
    `);
    const result = parseCartTotal(doc);
    expect(result.total).toBe(89.99);
    expect(result.confidence).toBe(0.95);
  });

  it("ignores JSON-LD offers.price (product price, not cart total)", () => {
    const doc = makeDoc(`
      <script type="application/ld+json">
        {"@type":"Product","offers":{"price":"49.99"}}
      </script>
    `);
    // offers.price is a product field — should not be treated as cart total
    const result = parseCartTotal(doc);
    expect(result.total).toBe(null);
  });

  it("skips malformed JSON-LD and falls through", () => {
    const doc = makeDoc(`
      <script type="application/ld+json">not valid json</script>
    `);
    const result = parseCartTotal(doc);
    // should not throw, just fall through to other strategies
    expect(result.total).toBe(null);
  });

  it("parses total from DOM label proximity heuristic (strategy 3)", () => {
    const doc = makeDoc(`
      <div>
        <span>Order Total</span>
        <span>$129.50</span>
      </div>
    `);
    const result = parseCartTotal(doc);
    expect(result.total).toBe(129.5);
    expect(result.confidence).toBe(0.7);
  });

  it("prefers grand total over subtotal", () => {
    // The heuristic takes the largest value near a 'total' label
    const doc = makeDoc(`
      <div><span>Subtotal</span><span>$80.00</span></div>
      <div><span>Order Total</span><span>$95.00</span></div>
    `);
    const result = parseCartTotal(doc);
    expect(result.total).toBe(95.0);
  });

  it("extracts merchant from og:site_name meta tag", () => {
    const doc = makeDoc(`
      <meta property="og:site_name" content="Acme Shop">
      <script type="application/ld+json">{"offers":{"price":"50"}}</script>
    `);
    // Insert meta into head
    const meta = doc.createElement("meta");
    meta.setAttribute("property", "og:site_name");
    meta.setAttribute("content", "Acme Shop");
    doc.head.appendChild(meta);

    const result = parseCartTotal(doc);
    expect(result.merchant).toBe("Acme Shop");
  });

  it("always returns site and merchant fields", () => {
    const doc = makeDoc("");
    const result = parseCartTotal(doc);
    expect(typeof result.merchant).toBe("string");
    expect(typeof result.site).toBe("string");
    expect(typeof result.confidence).toBe("number");
  });
});
