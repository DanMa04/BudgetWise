import type {
  BudgetCheckResponse,
  ExtensionSettings,
  ExtensionMessage,
  AuthStatusResponse,
} from "../shared/types";

const SETTINGS_URL = "http://localhost:5173/settings";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function sendMessage<T>(message: ExtensionMessage): Promise<T> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: T) => {
      resolve(response);
    });
  });
}

const notConnectedView = document.getElementById("not-connected-view")!;
const budgetView = document.getElementById("budget-view")!;
const statusDot = document.getElementById("status-dot")!;
const openSettingsBtn = document.getElementById("open-settings-btn")!;
const disconnectBtn = document.getElementById("disconnect-btn")!;
const toggleNotifications = document.getElementById("toggle-notifications") as HTMLInputElement;

function showView(view: "not-connected" | "budget") {
  notConnectedView.style.display = view === "not-connected" ? "block" : "none";
  budgetView.style.display = view === "budget" ? "block" : "none";
  statusDot.className = view === "budget" ? "status-dot connected" : "status-dot";
}

function renderBudgetData(data: BudgetCheckResponse) {
  const remaining = document.getElementById("remaining-amount")!;
  const progressFill = document.getElementById("progress-fill")!;
  const spentLabel = document.getElementById("spent-label")!;
  const budgetLabel = document.getElementById("budget-label")!;
  const budgetList = document.getElementById("budget-list")!;

  remaining.textContent = formatCurrency(data.total_remaining);
  remaining.className =
    "budget-amount " + (data.total_remaining >= 0 ? "positive" : "negative");

  const pct =
    data.total_budgeted > 0
      ? Math.min((data.total_spent / data.total_budgeted) * 100, 100)
      : 0;
  progressFill.style.width = `${pct}%`;
  progressFill.style.background =
    pct >= 90 ? "#ef4444" : pct >= 75 ? "#eab308" : "#22c55e";

  spentLabel.textContent = `${formatCurrency(data.total_spent)} spent`;
  budgetLabel.textContent = `of ${formatCurrency(data.total_budgeted)}`;

  budgetList.innerHTML = data.budgets
    .slice(0, 5)
    .map((b) => {
      const color =
        b.remaining < 0 ? "#ef4444" : b.percentage_used >= 75 ? "#eab308" : "#16a34a";
      return `
        <div class="budget-item">
          <span class="budget-item-name">${b.category_name}</span>
          <span class="budget-item-remaining" style="color:${color}">${formatCurrency(b.remaining)}</span>
        </div>
      `;
    })
    .join("");
}

openSettingsBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: SETTINGS_URL });
  window.close();
});

disconnectBtn.addEventListener("click", async () => {
  await sendMessage({
    type: "SET_AUTH_TOKEN",
    payload: { token: null },
  });
  showView("not-connected");
});

toggleNotifications.addEventListener("change", async () => {
  await sendMessage({
    type: "UPDATE_SETTINGS",
    payload: { notificationsEnabled: toggleNotifications.checked },
  });
});

async function init() {
  const authStatus = await sendMessage<AuthStatusResponse>({
    type: "GET_AUTH_STATUS",
  });

  if (!authStatus?.isAuthenticated) {
    showView("not-connected");
    return;
  }

  showView("budget");

  const settings = await sendMessage<ExtensionSettings>({
    type: "GET_SETTINGS",
  });
  if (settings) {
    toggleNotifications.checked = settings.notificationsEnabled;
  }

  const budgetData = await sendMessage<BudgetCheckResponse>({
    type: "GET_BUDGET_STATUS",
  });

  if (budgetData && !("error" in budgetData)) {
    renderBudgetData(budgetData);
  }
}

init();
