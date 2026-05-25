import type { CartCheckResponse } from "../shared/types";

const OVERLAY_HOST_ID = "kallio-overlay-host";
const BANNER_HOST_ID = "kallio-budget-banner";
const AUTO_DISMISS_DELAY = 5000;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function getWarningStyles(level: "green" | "yellow" | "red") {
  switch (level) {
    case "green":
      return {
        borderColor: "#22c55e",
        bgColor: "#f0fdf4",
        iconColor: "#16a34a",
        icon: "✓",
        headerBg: "#dcfce7",
      };
    case "yellow":
      return {
        borderColor: "#eab308",
        bgColor: "#fefce8",
        iconColor: "#ca8a04",
        icon: "⚠",
        headerBg: "#fef9c3",
      };
    case "red":
      return {
        borderColor: "#ef4444",
        bgColor: "#fef2f2",
        iconColor: "#dc2626",
        icon: "✗",
        headerBg: "#fee2e2",
      };
  }
}

export function createOverlay(response: CartCheckResponse): void {
  removeOverlay();

  const host = document.createElement("div");
  host.id = OVERLAY_HOST_ID;
  host.style.cssText =
    "position:fixed;bottom:20px;right:20px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;";

  const shadow = host.attachShadow({ mode: "closed" });
  const styles = getWarningStyles(response.warning_level);

  const budgetListHtml = response.affected_budgets
    .slice(0, 3)
    .map((b) => {
      const pct = Math.min(b.percentage_used, 100);
      const barColor = pct >= 90 ? "#ef4444" : pct >= 75 ? "#eab308" : "#22c55e";
      return `
      <div style="margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;">
          <span>${b.category_name}</span>
          <span>${formatCurrency(b.remaining)} left</span>
        </div>
        <div style="height:4px;background:#e5e7eb;border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${barColor};border-radius:2px;transition:width 0.3s;"></div>
        </div>
      </div>
    `;
    })
    .join("");

  const template = document.createElement("template");
  template.innerHTML = `
    <style>
      :host { all: initial; }
      .bw-overlay {
        width: 320px;
        border: 2px solid ${styles.borderColor};
        border-radius: 12px;
        background: ${styles.bgColor};
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
        overflow: hidden;
        animation: bw-slide-in 0.3s ease-out;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        color: #1f2937;
        line-height: 1.5;
      }
      @keyframes bw-slide-in {
        from { transform: translateX(120%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes bw-slide-out {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(120%); opacity: 0; }
      }
      .bw-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: ${styles.headerBg};
        border-bottom: 1px solid ${styles.borderColor}33;
      }
      .bw-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        font-size: 15px;
      }
      .bw-icon {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${styles.iconColor};
        color: white;
        font-size: 14px;
        font-weight: bold;
      }
      .bw-close {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 18px;
        color: #6b7280;
        padding: 4px;
        line-height: 1;
        border-radius: 4px;
      }
      .bw-close:hover { background: rgba(0,0,0,0.05); color: #374151; }
      .bw-body { padding: 16px; }
      .bw-message { font-size: 14px; margin-bottom: 12px; color: #374151; }
      .bw-amounts {
        display: flex;
        justify-content: space-between;
        padding: 10px 12px;
        background: white;
        border-radius: 8px;
        margin-bottom: 12px;
        border: 1px solid #e5e7eb;
      }
      .bw-amount-label {
        font-size: 11px;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .bw-amount-value { font-size: 16px; font-weight: 600; }
      .bw-budgets { margin-bottom: 12px; }
      .bw-budgets-title {
        font-size: 12px;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 8px;
      }
      .bw-actions { display: flex; gap: 8px; }
      .bw-btn {
        flex: 1;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        text-align: center;
        text-decoration: none;
        display: inline-block;
      }
      .bw-btn-primary { background: #2563eb; color: white; }
      .bw-btn-primary:hover { background: #1d4ed8; }
      .bw-btn-secondary { background: white; color: #374151; border: 1px solid #d1d5db; }
      .bw-btn-secondary:hover { background: #f9fafb; }
    </style>
    <div class="bw-overlay">
      <div class="bw-header">
        <div class="bw-title">
          <div class="bw-icon">${styles.icon}</div>
          Kallio
        </div>
        <button class="bw-close" aria-label="Dismiss">&times;</button>
      </div>
      <div class="bw-body">
        <div class="bw-message">${response.message}</div>
        <div class="bw-amounts">
          <div>
            <div class="bw-amount-label">Cart Total</div>
            <div class="bw-amount-value">${formatCurrency(response.cart_total)}</div>
          </div>
          <div style="text-align:right;">
            <div class="bw-amount-label">Budget Remaining</div>
            <div class="bw-amount-value" style="color:${styles.iconColor}">${formatCurrency(response.total_remaining)}</div>
          </div>
        </div>
        ${
          response.affected_budgets.length > 0
            ? `
          <div class="bw-budgets">
            <div class="bw-budgets-title">Affected Budgets</div>
            ${budgetListHtml}
          </div>
        `
            : ""
        }
        <div class="bw-actions">
          <a href="http://localhost:5173/budgets" target="_blank" class="bw-btn bw-btn-primary">View Budget</a>
          <button class="bw-btn bw-btn-secondary bw-dismiss">Dismiss</button>
        </div>
      </div>
    </div>
  `;

  shadow.appendChild(template.content.cloneNode(true));

  const closeBtn = shadow.querySelector(".bw-close") as HTMLButtonElement;
  const dismissBtn = shadow.querySelector(".bw-dismiss") as HTMLButtonElement;

  const dismiss = () => {
    const overlay = shadow.querySelector(".bw-overlay") as HTMLElement;
    if (overlay) {
      overlay.style.animation = "bw-slide-out 0.3s ease-in forwards";
      setTimeout(() => removeOverlay(), 300);
    }
  };

  closeBtn?.addEventListener("click", dismiss);
  dismissBtn?.addEventListener("click", dismiss);

  if (response.warning_level === "green") {
    setTimeout(dismiss, AUTO_DISMISS_DELAY);
  }

  document.body.appendChild(host);
}

export function removeOverlay(): void {
  document.getElementById(OVERLAY_HOST_ID)?.remove();
}

export function createBanner(response: CartCheckResponse): void {
  removeBanner();

  const overAmount = Math.abs(response.total_remaining);
  const host = document.createElement("div");
  host.id = BANNER_HOST_ID;
  host.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483646;";

  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      .banner {
        background: #dc2626;
        color: white;
        padding: 10px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      }
      .dismiss {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        padding: 4px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        white-space: nowrap;
        margin-left: 16px;
      }
      .dismiss:hover { background: rgba(255,255,255,0.3); }
    </style>
    <div class="banner">
      <span>⚠ This purchase (${formatCurrency(response.cart_total)}) exceeds your budget — ${formatCurrency(overAmount)} over limit</span>
      <button class="dismiss">Dismiss</button>
    </div>
  `;

  shadow.querySelector(".dismiss")?.addEventListener("click", removeBanner);
  document.body.prepend(host);
}

export function removeBanner(): void {
  document.getElementById(BANNER_HOST_ID)?.remove();
}
