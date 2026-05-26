// Runs on Kallio settings pages — bridges DOM events from the React app to the extension background.

// Signal to the page that the extension is present
const meta = document.createElement("meta");
meta.setAttribute("name", "kallio-extension");
meta.setAttribute("content", chrome.runtime.id);
document.head.appendChild(meta);

// Connect: React page dispatches this event with { token } when user clicks "Connect"
window.addEventListener("kallio:connect-extension", async (e: Event) => {
  const token = (e as CustomEvent<{ token: string }>).detail?.token;
  if (!token || typeof token !== "string") {
    window.dispatchEvent(
      new CustomEvent("kallio:extension-response", { detail: { success: false } })
    );
    return;
  }
  try {
    await chrome.runtime.sendMessage({ type: "SET_AUTH_TOKEN", payload: { token } });
    window.dispatchEvent(
      new CustomEvent("kallio:extension-response", { detail: { success: true } })
    );
  } catch {
    window.dispatchEvent(
      new CustomEvent("kallio:extension-response", { detail: { success: false } })
    );
  }
});

// Disconnect
window.addEventListener("kallio:disconnect-extension", async () => {
  try {
    await chrome.runtime.sendMessage({ type: "SET_AUTH_TOKEN", payload: { token: null } });
  } finally {
    window.dispatchEvent(
      new CustomEvent("kallio:extension-response", { detail: { success: true } })
    );
  }
});
