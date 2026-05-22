import { useState, useCallback } from "react";

function load(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    // ignore corrupt data
  }
  return new Set();
}

function save(key: string, set: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

export function useDismissedSet(storageKey: string) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => load(storageKey));

  const dismiss = useCallback(
    (id: string) => {
      setDismissed((prev) => {
        const next = new Set(prev).add(id);
        save(storageKey, next);
        return next;
      });
    },
    [storageKey]
  );

  return { dismissed, dismiss };
}
