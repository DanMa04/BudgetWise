import { describe, it, expect } from "vitest";
import { detectCheckoutPage, isCheckoutUrl } from "../content/detector";

describe("isCheckoutUrl", () => {
  it("matches /cart", () => {
    expect(isCheckoutUrl("https://www.amazon.com/cart")).toBe(true);
  });

  it("matches /checkout", () => {
    expect(isCheckoutUrl("https://www.amazon.com/checkout/review")).toBe(true);
  });

  it("matches /basket", () => {
    expect(isCheckoutUrl("https://shop.example.com/basket")).toBe(true);
  });

  it("matches /bag", () => {
    expect(isCheckoutUrl("https://shop.example.com/bag")).toBe(true);
  });

  it("matches /payment", () => {
    expect(isCheckoutUrl("https://shop.example.com/payment")).toBe(true);
  });

  it("matches /order-review", () => {
    expect(isCheckoutUrl("https://shop.example.com/order-review")).toBe(true);
  });

  it("matches /order-summary", () => {
    expect(isCheckoutUrl("https://shop.example.com/order-summary")).toBe(true);
  });

  it("matches /purchase", () => {
    expect(isCheckoutUrl("https://shop.example.com/purchase")).toBe(true);
  });

  it("matches on any domain (generalized)", () => {
    expect(isCheckoutUrl("https://www.google.com/checkout")).toBe(true);
  });

  it("does not match homepage", () => {
    expect(isCheckoutUrl("https://www.amazon.com/")).toBe(false);
  });

  it("does not match product page", () => {
    expect(isCheckoutUrl("https://www.amazon.com/dp/B09V3KXJPB")).toBe(false);
  });

  it("does not match search results", () => {
    expect(isCheckoutUrl("https://www.amazon.com/s?k=headphones")).toBe(false);
  });

  it("handles URL with query parameters", () => {
    expect(isCheckoutUrl("https://www.amazon.com/cart?ref=nav_cart")).toBe(true);
  });

  it("handles URL with fragment", () => {
    expect(isCheckoutUrl("https://www.target.com/checkout#step2")).toBe(true);
  });

  it("returns false for invalid URLs", () => {
    expect(isCheckoutUrl("not-a-url")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isCheckoutUrl("")).toBe(false);
  });
});

describe("detectCheckoutPage", () => {
  it("returns isCheckout true for checkout URLs", () => {
    const result = detectCheckoutPage("https://www.amazon.com/cart");
    expect(result.isCheckout).toBe(true);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("returns isCheckout false for non-checkout URLs", () => {
    const result = detectCheckoutPage("https://www.amazon.com/dp/B09V3KXJPB");
    expect(result.isCheckout).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it("works for any retailer, not just Amazon/Target/Walmart", () => {
    expect(detectCheckoutPage("https://shop.allbirds.com/checkout").isCheckout).toBe(true);
    expect(detectCheckoutPage("https://www.wayfair.com/cart").isCheckout).toBe(true);
    expect(detectCheckoutPage("https://www.etsy.com/basket").isCheckout).toBe(true);
  });
});
