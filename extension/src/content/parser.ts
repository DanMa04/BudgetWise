export interface ParseResult {
  total: number | null;
  merchant: string;
  site: string;
  confidence: number;
}

interface SiteSelectors {
  site: string;
  merchant: string;
  selectors: string[];
}

const SITE_SELECTOR_MAP: Record<string, SiteSelectors> = {
  amazon: {
    site: "amazon.com",
    merchant: "Amazon",
    selectors: [
      "#sc-subtotal-amount-activecart .sc-price",
      ".grand-total-price",
      "#subtotals-marketplace-table .a-color-price",
      "#sc-subtotal-amount-activecart",
      ".a-price .a-offscreen",
      "#subtotal-amount .a-price-whole",
    ],
  },
  target: {
    site: "target.com",
    merchant: "Target",
    selectors: [
      '[data-test="cart-summary-total"] span',
      '[data-test="order-summary-total"] span',
      ".styles__PriceTotalWrapper span",
      '[data-test="cart-subtotal"] span',
    ],
  },
  walmart: {
    site: "walmart.com",
    merchant: "Walmart",
    selectors: [
      '[data-testid="subtotal"] span',
      '[data-testid="cart-grand-total"] span',
      ".cart-summary-price span",
      '[data-automation="cart-summary-total"] span',
      ".price-characteristic",
    ],
  },
};

export function parseCurrencyString(text: string): number | null {
  if (!text || typeof text !== "string") {
    return null;
  }

  // Trim whitespace
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }

  // Remove currency symbols, whitespace, and non-numeric characters except . and ,
  const cleaned = trimmed.replace(/[^0-9.,\-]/g, "");

  if (cleaned.length === 0) {
    return null;
  }

  // Handle comma as thousands separator (1,234.56)
  // Remove commas that appear to be thousands separators
  const normalized = cleaned.replace(/,(\d{3})/g, "$1");

  // If there's still a comma, it might be a decimal separator (European format)
  // For US-centric sites, we treat remaining commas as decimal points
  const finalString = normalized.replace(",", ".");

  const value = parseFloat(finalString);

  if (isNaN(value) || value < 0) {
    return null;
  }

  // Round to 2 decimal places
  return Math.round(value * 100) / 100;
}

export function parseCartTotal(site: string, doc: Document): ParseResult {
  const config = SITE_SELECTOR_MAP[site];

  if (!config) {
    return {
      total: null,
      merchant: "Unknown",
      site: site,
      confidence: 0,
    };
  }

  for (const selector of config.selectors) {
    try {
      const elements = doc.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent;
        if (text) {
          const total = parseCurrencyString(text);
          if (total !== null && total > 0) {
            return {
              total,
              merchant: config.merchant,
              site: config.site,
              confidence: 0.8,
            };
          }
        }
      }
    } catch {
      // Selector might be invalid in some contexts, continue
    }
  }

  return {
    total: null,
    merchant: config.merchant,
    site: config.site,
    confidence: 0,
  };
}
