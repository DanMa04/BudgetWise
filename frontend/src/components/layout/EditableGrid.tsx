import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import {
  ResponsiveGridLayout,
  useContainerWidth,
} from "react-grid-layout";
import type { Layout, ResponsiveLayouts } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {
  BREAKPOINTS,
  COLS,
  ROW_HEIGHT,
  type LayoutPreset,
} from "@/hooks/useGridLayout";

interface EditableGridProps {
  layouts: ResponsiveLayouts;
  editing: boolean;
  setEditing: (v: boolean) => void;
  onLayoutChange: (layout: Layout, allLayouts: ResponsiveLayouts) => void;
  applyPreset: (name: string) => void;
  resetLayout: () => void;
  presets: LayoutPreset[];
  children: ReactNode;
}

export function EditableGrid({
  layouts,
  editing,
  setEditing,
  onLayoutChange,
  applyPreset,
  resetLayout,
  presets,
  children,
}: EditableGridProps) {
  const { width, containerRef, mounted } = useContainerWidth();

  return (
    <div ref={containerRef}>
      <EditToolbar
        editing={editing}
        setEditing={setEditing}
        applyPreset={applyPreset}
        resetLayout={resetLayout}
        presets={presets}
        containerRef={containerRef}
      />
      {mounted && (
        <div className={editing ? "editable-grid-active" : ""}>
          <ResponsiveGridLayout
            width={width}
            layouts={layouts}
            breakpoints={BREAKPOINTS}
            cols={COLS}
            rowHeight={ROW_HEIGHT}
            dragConfig={{
              enabled: editing,
              handle: ".grid-drag-handle",
            }}
            resizeConfig={{
              enabled: editing,
              handles: ["s", "e", "se"],
            }}
            onLayoutChange={onLayoutChange}
            margin={[16, 16] as const}
            containerPadding={[0, 0] as const}
          >
            {children}
          </ResponsiveGridLayout>
        </div>
      )}
    </div>
  );
}

function EditToolbar({
  editing,
  setEditing,
  applyPreset,
  resetLayout,
  presets,
  containerRef,
}: {
  editing: boolean;
  setEditing: (v: boolean) => void;
  applyPreset: (name: string) => void;
  resetLayout: () => void;
  presets: LayoutPreset[];
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const [showPresets, setShowPresets] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPresets) return;
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowPresets(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPresets]);

  useEffect(() => {
    if (!editing) return;
    const container = containerRef.current;
    if (!container) return;
    container.classList.add("grid-editing-outline");
    return () => container.classList.remove("grid-editing-outline");
  }, [editing, containerRef]);

  return (
    <div className="mb-4 flex items-center gap-2">
      <button
        onClick={() => setEditing(!editing)}
        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
          editing
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input bg-background text-foreground hover:bg-muted"
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="7" height="7" x="3" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="3" rx="1" />
          <rect width="7" height="7" x="3" y="14" rx="1" />
          <rect width="7" height="7" x="14" y="14" rx="1" />
        </svg>
        {editing ? "Done Editing" : "Edit Layout"}
      </button>

      {editing && (
        <>
          {presets.length > 0 && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowPresets(!showPresets)}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
                </svg>
                Presets
              </button>
              {showPresets && (
                <div className="absolute top-full left-0 z-50 mt-1 min-w-[160px] rounded-md border bg-background p-1 shadow-md">
                  {presets.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => {
                        applyPreset(preset.name);
                        setShowPresets(false);
                      }}
                      className="w-full rounded-sm px-3 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={resetLayout}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Reset
          </button>
        </>
      )}
    </div>
  );
}
