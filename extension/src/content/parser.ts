export interface ParseResult {
  total: number | null;
  merchant: string;
  site: string;
  confidence: number;
}

export function parseCurrencyString(text: string): number | null {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed.length) return null;
  const cleaned = trimmed.replace(/[^0-9.,\-]/g, "");
  if (!cleaned.length) return null;
  const normalized = cleaned.replace(/,(\d{3})/g, "$1");
  const finalString = normalized.replace(",", ".");
  const value = parseFloat(finalString);
  if (isNaN(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

function extractMerchant(doc: Document): string {
  return (
    (doc.querySelector('meta[property="og:site_name"]') as HTMLMetaElement)?.content ||
    (doc.querySelector('meta[name="application-name"]') as HTMLMetaElement)?.content ||
    doc.title.split(/\s*[-|–·]\s*/)[0].trim() ||
    location.hostname.replace(/^www\./, "").split(".")[0]
  );
}

// Strategy 0: Fast CSS selectors for known sites + widely-used patterns.
// These are checked first because they're O(1) vs the O(n) DOM walk.
const FAST_SELECTORS = [
  // Amazon — active cart subtotal
  "#sc-subtotal-amount-activecart",
  "#sc-subtotal-label-activecart ~ span",
  // Best Buy (modern cart, post-2025 redesign)
  "span.price-block__inline.justify-end",
  '[data-testid="cartSubtotalValue"]',
  '[data-testid="summary-subtotal-value"]',
  // Target
  '[data-test="cartSummary-cartTotal"]',
  // Walmart
  '[data-testid="cart-price-subtotal"]',
  // Shopify (various themes)
  ".cart__subtotal .money",
  ".cart-subtotal__price",
  ".order-summary__subtotal-price",
  ".totals__subtotal-value",
  // WooCommerce
  ".cart-collaterals .cart_totals .order-total td",
  ".woocommerce-Price-amount",
  // Generic data attributes used by many React/Vue shops
  '[data-testid="order-summary-subtotal"]',
  '[data-automation-id*="cartTotal"]',
  '[data-automation-id*="subtotal"]',
];

function parseFastSelectors(doc: Document): number | null {
  for (const sel of FAST_SELECTORS) {
    try {
      // Prefer the LAST match — for repeated price classes (Best Buy, Shopify),
      // the bottom row of the summary panel is the grand total.
      const matches = doc.querySelectorAll(sel);
      if (!matches.length) continue;
      const el = matches[matches.length - 1];
      if (!el.textContent) continue;
      const v = parseCurrencyString(el.textContent);
      if (v !== null && v > 0) return v;
    } catch {
      // invalid selector in this browser, skip
    }
  }
  return null;
}

// Strategy 1: JSON-LD structured data
function parseJsonLd(doc: Document): number | null {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent ?? "{}");
      // Only use cart-level total fields — offers.price / data.price are product prices
      const candidates = [
        data?.totalPaymentDue?.price,
        data?.totalPaymentDue?.["@value"],
      ];
      for (const c of candidates) {
        if (c != null) {
          const v = parseFloat(String(c));
          if (!isNaN(v) && v > 0) return Math.round(v * 100) / 100;
        }
      }
    } catch {
      // malformed JSON-LD, skip
    }
  }
  return null;
}

// Strategy 2: Next.js / Redux global state
function parseGlobalState(): number | null {
  const TOTAL_KEYS = [
    "orderTotal", "cartTotal", "grandTotal", "totalPrice", "total",
    "subtotal", "subTotal", "cartSubtotal", "estimatedTotal", "checkoutTotal",
  ];

  function walkObject(obj: unknown, depth: number): number | null {
    if (depth > 6 || obj == null || typeof obj !== "object") return null;
    for (const key of Object.keys(obj as object)) {
      const val = (obj as Record<string, unknown>)[key];
      if (TOTAL_KEYS.includes(key) && (typeof val === "number" || typeof val === "string")) {
        const v = parseFloat(String(val));
        if (!isNaN(v) && v > 0) return Math.round(v * 100) / 100;
      }
      const nested = walkObject(val, depth + 1);
      if (nested !== null) return nested;
    }
    return null;
  }

  try {
    const nextData = (window as unknown as Record<string, unknown>).__NEXT_DATA__;
    if (nextData) {
      const result = walkObject((nextData as Record<string, unknown>).props, 0);
      if (result !== null) return result;
    }
  } catch {
    // no __NEXT_DATA__
  }
  return null;
}

// Strategy 3: DOM label-proximity heuristic
//
// Matches labels like:
//   "Subtotal"  "Subtotal (3 items):"  "Order Total:"  "Grand Total"
//   "Estimated Total"  "Cart Total"  "Total"
//
// Then looks for a dollar-amount in the sibling / parent elements.
function parseDomHeuristic(doc: Document): number | null {
  // Word-boundary match — no strict ^ $ so "Subtotal (3 items):" still matches
  const TOTAL_LABEL = /\b(subtotal|sub[- ]total|cart\s+total|order\s+total|estimated\s+total|grand\s+total|total)\b/i;
  const PRICE_RE = /\$\s*[\d,]+(\.\d{1,2})?/;

  const candidates: number[] = [];

  // Limit to common text-bearing tags to avoid scanning every node
  const elements = doc.querySelectorAll(
    "span, td, th, dt, p, label, div, strong, b, h1, h2, h3, h4, li"
  );

  for (const el of elements) {
    const rawText = (el.textContent ?? "").trim();

    // Short text only — label elements are brief
    if (!rawText || rawText.length > 80) continue;

    // If this element already contains a price it's a combined label+price cell;
    // skip it as a label and let the sibling search find it as a price instead.
    if (PRICE_RE.test(rawText)) continue;

    // Normalise: strip parentheticals "(3 items)" and trailing colons
    const normText = rawText
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .replace(/[:\s]+$/, "")
      .trim();

    if (!TOTAL_LABEL.test(normText)) continue;

    // Search for a price in nearby DOM positions
    const searchTargets: (Element | null)[] = [
      el.nextElementSibling,
      el.parentElement?.nextElementSibling ?? null,
      el.parentElement?.querySelector('[class*="price" i], [class*="amount" i], [class*="value" i]') ?? null,
      el.parentElement,
    ];

    for (const target of searchTargets) {
      if (!target || target === el) continue;
      const targetText = target.textContent ?? "";
      const match = targetText.match(PRICE_RE);
      if (match) {
        const v = parseCurrencyString(match[0]);
        if (v !== null && v > 0) candidates.push(v);
      }
    }
  }

  // Prefer the largest value (grand total > subtotal when both are present)
  return candidates.length > 0 ? Math.max(...candidates) : null;
}

export function parseCartTotal(doc: Document): ParseResult {
  const merchant = extractMerchant(doc);
  const site = location.hostname;

  // Try fastest strategies first
  const fastTotal = parseFastSelectors(doc);
  if (fastTotal !== null) {
    return { total: fastTotal, merchant, site, confidence: 0.92 };
  }

  const jsonLdTotal = parseJsonLd(doc);
  if (jsonLdTotal !== null) {
    return { total: jsonLdTotal, merchant, site, confidence: 0.95 };
  }

  const stateTotal = parseGlobalState();
  if (stateTotal !== null) {
    return { total: stateTotal, merchant, site, confidence: 0.85 };
  }

  const domTotal = parseDomHeuristic(doc);
  if (domTotal !== null) {
    return { total: domTotal, merchant, site, confidence: 0.7 };
  }

  return { total: null, merchant, site, confidence: 0 };
}
