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

// Strategy 1: JSON-LD structured data
function parseJsonLd(doc: Document): number | null {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent ?? "{}");
      const candidates = [
        data?.offers?.price,
        data?.totalPaymentDue?.price,
        data?.price,
        data?.offers?.[0]?.price,
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
  const TOTAL_KEYS = ["orderTotal", "cartTotal", "grandTotal", "totalPrice", "total"];

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
function parseDomHeuristic(doc: Document): number | null {
  const TOTAL_LABEL = /\b(order\s+)?total\b|grand\s+total|estimated\s+total/i;
  const PRICE_PATTERN = /\$\s*\d[\d,]*(\.\d{2})?/;

  const candidates: number[] = [];

  const allElements = doc.querySelectorAll("*");
  for (const el of allElements) {
    if (el.children.length > 0) continue; // leaf nodes only
    const text = el.textContent ?? "";
    if (!TOTAL_LABEL.test(text)) continue;

    const searchTargets: (Element | null)[] = [
      el.nextElementSibling,
      el.parentElement?.nextElementSibling ?? null,
      el.parentElement,
    ];

    for (const target of searchTargets) {
      if (!target) continue;
      const targetText = target.textContent ?? "";
      const match = targetText.match(/\$\s*[\d,]+(\.\d{2})?/);
      if (match) {
        const v = parseCurrencyString(match[0]);
        if (v !== null && v > 0) candidates.push(v);
      }
    }
  }

  // Take the largest value near a "total" label (grand total > subtotal)
  return candidates.length > 0 ? Math.max(...candidates) : null;
}

export function parseCartTotal(doc: Document): ParseResult {
  const merchant = extractMerchant(doc);
  const site = location.hostname;

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
