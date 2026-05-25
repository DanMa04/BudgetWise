export interface DetectionResult {
  isCheckout: boolean;
  confidence: number;
}

const CHECKOUT_PATH =
  /\/(checkout|cart|basket|bag|order[-_]?(review|summary|confirm)|payment|purchase)/i;

export function isCheckoutUrl(url: string): boolean {
  try {
    return CHECKOUT_PATH.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export function detectCheckoutPage(url: string): DetectionResult {
  const isCheckout = isCheckoutUrl(url);
  return { isCheckout, confidence: isCheckout ? 0.8 : 0 };
}
