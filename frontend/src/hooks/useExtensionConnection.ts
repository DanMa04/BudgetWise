import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import {
  createExtensionToken,
  revokeExtensionToken,
  getExtensionTokenStatus,
} from "../api/extension";

function isExtensionInstalled(): boolean {
  return !!document.querySelector('meta[name="kallio-extension"]');
}

export function useExtensionConnection() {
  const { getToken } = useAuth();
  const [extensionPresent, setExtensionPresent] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for extension presence after DOM settles
  useEffect(() => {
    const timer = setTimeout(() => {
      setExtensionPresent(isExtensionInstalled());
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Fetch token status from backend
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = await getToken();
        if (!token) return;
        const status = await getExtensionTokenStatus(token);
        if (!cancelled) {
          setIsConnected(status.is_connected);
          setExpiresAt(status.expires_at);
        }
      } catch {
        // not connected
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [getToken]);

  const connect = useCallback(async () => {
    const clerkToken = await getToken();
    if (!clerkToken) return;
    const { token, expires_at } = await createExtensionToken(clerkToken);

    // Relay token to extension via DOM event bridge
    window.dispatchEvent(
      new CustomEvent("kallio:connect-extension", { detail: { token } })
    );

    // Wait for extension response
    await new Promise<void>((resolve) => {
      const handler = () => {
        window.removeEventListener("kallio:extension-response", handler);
        resolve();
      };
      window.addEventListener("kallio:extension-response", handler, { once: true });
      // Resolve anyway after 2s if extension doesn't respond
      setTimeout(resolve, 2000);
    });

    setIsConnected(true);
    setExpiresAt(expires_at);
  }, [getToken]);

  const disconnect = useCallback(async () => {
    const clerkToken = await getToken();
    if (!clerkToken) return;
    await revokeExtensionToken(clerkToken);

    window.dispatchEvent(new CustomEvent("kallio:disconnect-extension"));

    setIsConnected(false);
    setExpiresAt(null);
  }, [getToken]);

  return {
    extensionPresent,
    isConnected,
    expiresAt,
    isLoading,
    connect,
    disconnect,
  };
}
