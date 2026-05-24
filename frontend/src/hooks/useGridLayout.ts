import { useState, useCallback, useMemo } from "react";
import type { Layout, ResponsiveLayouts } from "react-grid-layout";

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480 };
const COLS = { lg: 12, md: 12, sm: 6, xs: 1 };
const ROW_HEIGHT = 30;

export { BREAKPOINTS, COLS, ROW_HEIGHT };

function loadLayouts(key: string): ResponsiveLayouts | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as ResponsiveLayouts;
  } catch {
    // ignore corrupt data
  }
  return null;
}

function saveLayouts(key: string, layouts: ResponsiveLayouts) {
  localStorage.setItem(key, JSON.stringify(layouts));
}

export interface LayoutPreset {
  name: string;
  label: string;
  layouts: ResponsiveLayouts;
}

export function useGridLayout(
  storageKey: string,
  defaultLayouts: ResponsiveLayouts,
  presets: LayoutPreset[],
) {
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(
    () => loadLayouts(storageKey) ?? defaultLayouts,
  );
  const [editing, setEditing] = useState(false);

  const onLayoutChange = useCallback(
    (_layout: Layout, allLayouts: ResponsiveLayouts) => {
      setLayouts(allLayouts);
      saveLayouts(storageKey, allLayouts);
    },
    [storageKey],
  );

  const applyPreset = useCallback(
    (presetName: string) => {
      const preset = presets.find((p) => p.name === presetName);
      if (preset) {
        setLayouts(preset.layouts);
        saveLayouts(storageKey, preset.layouts);
      }
    },
    [storageKey, presets],
  );

  const resetLayout = useCallback(() => {
    setLayouts(defaultLayouts);
    saveLayouts(storageKey, defaultLayouts);
  }, [storageKey, defaultLayouts]);

  return useMemo(
    () => ({
      layouts,
      editing,
      setEditing,
      onLayoutChange,
      applyPreset,
      resetLayout,
      presets,
    }),
    [layouts, editing, onLayoutChange, applyPreset, resetLayout, presets],
  );
}
