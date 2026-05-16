import type {
  BudgetCheckResponse,
  ExtensionSettings,
  ExtensionMessage,
  AuthStatusResponse,
} from "../shared/types";

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

const loginView = document.getElementById("login-view")!;
const budgetView = document.getElementById("budget-view")!;
const statusDot = document.getElementById("status-dot")!;
const connectBtn = document.getElementById("connect-btn")!;
const disconnectBtn = document.getElementById("disconnect-btn")!;
const apiUrlInput = document.getElementById("api-url") as HTMLInputElement;
const authTokenInput = document.getElementById("auth-token") as HTMLInputElement;

function showView(view: "login" | "budget") {
  loginView.style.display = view === "login" ? "block" : "none";
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
        b.remaining < 0
          ? "#ef4444"
          : b.percentage_used >= 75
            ? "#eab308"
            : "#16a34a";
      return `
        <div class="budget-item">
          <span class="budget-item-name">${b.category_name}</span>
          <span class="budget-item-remaining" style="color:${color}">${formatCurrency(b.remaining)}</span>
        </div>
      `;
    })
    .join("");
}

function applySiteToggles(settings: ExtensionSettings) {
  const amazon = document.getElementById("toggle-amazon") as HTMLInputElement;
  const target = document.getElementById("toggle-target") as HTMLInputElement;
  const walmart = document.getElementById("toggle-walmart") as HTMLInputElement;

  amazon.checked = settings.enabledSites.amazon;
  target.checked = settings.enabledSites.target;
  walmart.checked = settings.enabledSites.walmart;

  const updateSite = (site: "amazon" | "target" | "walmart", enabled: boolean) => {
    sendMessage({
      type: "UPDATE_SETTINGS",
      payload: {
        enabledSites: { ...settings.enabledSites, [site]: enabled },
      },
    });
    settings.enabledSites[site] = enabled;
  };

  amazon.addEventListener("change", () => updateSite("amazon", amazon.checked));
  target.addEventListener("change", () => updateSite("target", target.checked));
  walmart.addEventListener("change", () => updateSite("walmart", walmart.checked));
}

connectBtn.addEventListener("click", async () => {
  const token = authTokenInput.value.trim();
  const apiUrl = apiUrlInput.value.trim();

  if (!token) return;

  await sendMessage({
    type: "UPDATE_SETTINGS",
    payload: { apiUrl, authToken: token },
  });

  await init();
});

disconnectBtn.addEventListener("click", async () => {
  await sendMessage({
    type: "UPDATE_SETTINGS",
    payload: { authToken: null, cachedBudgetData: null, lastBudgetFetch: 0 },
  });
  showView("login");
});

async function init() {
  const authStatus = await sendMessage<AuthStatusResponse>({
    type: "GET_AUTH_STATUS",
  });

  if (!authStatus?.isAuthenticated) {
    showView("login");
    if (authStatus?.apiUrl) {
      apiUrlInput.value = authStatus.apiUrl;
    }
    return;
  }

  showView("budget");

  const settings = await sendMessage<ExtensionSettings>({
    type: "GET_SETTINGS",
  });
  if (settings) {
    applySiteToggles(settings);
  }

  const budgetData = await sendMessage<BudgetCheckResponse>({
    type: "GET_BUDGET_STATUS",
  });

  if (budgetData && !("error" in budgetData)) {
    renderBudgetData(budgetData);
  }
}

init();
