export interface DetectionResult {
  isCheckout: boolean;
  site: "amazon" | "target" | "walmart" | null;
  confidence: number;
}

interface SitePattern {
  site: "amazon" | "target" | "walmart";
  hostPattern: RegExp;
  urlPatterns: RegExp[];
  domSelectors: string[];
}

const SITE_PATTERNS: SitePattern[] = [
  {
    site: "amazon",
    hostPattern: /amazon\.com$/i,
    urlPatterns: [
      /\/gp\/buy\//i,
      /\/checkout\//i,
      /\/gp\/cart/i,
      /\/cart\/?/i,
    ],
    domSelectors: [
      "#sc-buy-box",
      "#subtotals-marketplace-table",
      "#sc-active-cart",
      ".a-box.sc-cart-item",
      "#proceed-to-checkout-container",
    ],
  },
  {
    site: "target",
    hostPattern: /target\.com$/i,
    urlPatterns: [/\/checkout/i, /\/cart/i],
    domSelectors: [
      '[data-test="cart-summary-total"]',
      '[data-test="checkout-summary"]',
      '[data-test="cart-page"]',
      ".styles__PriceTotalWrapper",
    ],
  },
  {
    site: "walmart",
    hostPattern: /walmart\.com$/i,
    urlPatterns: [/\/checkout/i, /\/cart/i],
    domSelectors: [
      '[data-testid="subtotal"]',
      '[data-testid="cart-grand-total"]',
      ".cart-summary-price",
      '[data-automation="cart-summary"]',
    ],
  },
];

export function detectCheckoutPage(
  url: string,
  doc?: Document
): DetectionResult {
  const noMatch: DetectionResult = {
    isCheckout: false,
    site: null,
    confidence: 0,
  };

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return noMatch;
  }

  for (const pattern of SITE_PATTERNS) {
    if (!pattern.hostPattern.test(parsedUrl.hostname)) {
      continue;
    }

    let confidence = 0;

    // Check URL patterns
    const urlMatch = pattern.urlPatterns.some((p) =>
      p.test(parsedUrl.pathname)
    );
    if (urlMatch) {
      confidence += 0.6;
    }

    // Check DOM selectors if document is available
    if (doc) {
      for (const selector of pattern.domSelectors) {
        try {
          if (doc.querySelector(selector)) {
            confidence += 0.15;
          }
        } catch {
          // Invalid selector or DOM error, skip
        }
      }
    }

    // Cap confidence at 1.0
    confidence = Math.min(confidence, 1.0);

    if (confidence > 0) {
      return {
        isCheckout: confidence >= 0.5,
        site: pattern.site,
        confidence,
      };
    }
  }

  return noMatch;
}
