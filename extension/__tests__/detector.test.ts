import { describe, it, expect } from "vitest";
import { detectCheckoutPage } from "../src/content/detector";

describe("detectCheckoutPage", () => {
  describe("Amazon", () => {
    it("detects /gp/buy/ checkout URL", () => {
      const result = detectCheckoutPage("https://www.amazon.com/gp/buy/spc/handlers/display.html");
      expect(result.isCheckout).toBe(true);
      expect(result.site).toBe("amazon");
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it("detects /checkout/ URL", () => {
      const result = detectCheckoutPage("https://www.amazon.com/checkout/review");
      expect(result.isCheckout).toBe(true);
      expect(result.site).toBe("amazon");
    });

    it("detects /cart URL", () => {
      const result = detectCheckoutPage("https://www.amazon.com/cart");
      expect(result.isCheckout).toBe(true);
      expect(result.site).toBe("amazon");
    });

    it("does not detect Amazon homepage", () => {
      const result = detectCheckoutPage("https://www.amazon.com/");
      expect(result.isCheckout).toBe(false);
    });

    it("does not detect Amazon product page", () => {
      const result = detectCheckoutPage("https://www.amazon.com/dp/B09V3KXJPB");
      expect(result.isCheckout).toBe(false);
    });
  });

  describe("Target", () => {
    it("detects /checkout URL", () => {
      const result = detectCheckoutPage("https://www.target.com/checkout");
      expect(result.isCheckout).toBe(true);
      expect(result.site).toBe("target");
    });

    it("detects /cart URL", () => {
      const result = detectCheckoutPage("https://www.target.com/cart");
      expect(result.isCheckout).toBe(true);
      expect(result.site).toBe("target");
    });

    it("does not detect Target homepage", () => {
      const result = detectCheckoutPage("https://www.target.com/");
      expect(result.isCheckout).toBe(false);
    });
  });

  describe("Walmart", () => {
    it("detects /checkout URL", () => {
      const result = detectCheckoutPage("https://www.walmart.com/checkout");
      expect(result.isCheckout).toBe(true);
      expect(result.site).toBe("walmart");
    });

    it("detects /cart URL", () => {
      const result = detectCheckoutPage("https://www.walmart.com/cart");
      expect(result.isCheckout).toBe(true);
      expect(result.site).toBe("walmart");
    });

    it("does not detect Walmart homepage", () => {
      const result = detectCheckoutPage("https://www.walmart.com/");
      expect(result.isCheckout).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("handles URL with query parameters", () => {
      const result = detectCheckoutPage("https://www.amazon.com/cart?ref=nav_cart");
      expect(result.isCheckout).toBe(true);
      expect(result.site).toBe("amazon");
    });

    it("handles URL with fragment", () => {
      const result = detectCheckoutPage("https://www.target.com/checkout#step2");
      expect(result.isCheckout).toBe(true);
      expect(result.site).toBe("target");
    });

    it("returns false for non-shopping sites", () => {
      const result = detectCheckoutPage("https://www.google.com/checkout");
      expect(result.isCheckout).toBe(false);
      expect(result.site).toBe(null);
    });

    it("returns false for invalid URLs", () => {
      const result = detectCheckoutPage("not-a-url");
      expect(result.isCheckout).toBe(false);
    });

    it("returns false for empty string", () => {
      const result = detectCheckoutPage("");
      expect(result.isCheckout).toBe(false);
    });
  });
});
