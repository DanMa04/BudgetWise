const LIGHT_BLOBS = [
  // Large top-left — warm gold to amber
  {
    width: "68vw", height: "50vw",
    top: "-10%", left: "-12%",
    colors: ["oklch(0.88 0.10 80 / 0.28)", "oklch(0.86 0.08 65 / 0.18)"],
    blur: 100,
    animation: "blob-drift-1 34s ease-in-out 0s infinite, blob-morph-1 11s ease-in-out -2s infinite",
  },
  // Medium top-right — sage to forest green
  {
    width: "52vw", height: "64vw",
    top: "4%", right: "-10%",
    colors: ["oklch(0.76 0.10 148 / 0.22)", "oklch(0.74 0.09 162 / 0.14)"],
    blur: 88,
    animation: "blob-drift-2 40s ease-in-out -13s infinite, blob-morph-2 13s ease-in-out -5s infinite",
  },
  // Wide bottom — warm honey to gold
  {
    width: "80vw", height: "44vw",
    bottom: "-6%", left: "8%",
    colors: ["oklch(0.87 0.09 75 / 0.22)", "oklch(0.85 0.07 84 / 0.14)"],
    blur: 118,
    animation: "blob-drift-3 44s ease-in-out -20s infinite, blob-morph-3 15s ease-in-out -8s infinite",
  },
  // Center roaming — parchment to muted sage
  {
    width: "44vw", height: "52vw",
    top: "30%", left: "29%",
    colors: ["oklch(0.82 0.08 140 / 0.14)", "oklch(0.85 0.05 88 / 0.10)"],
    blur: 84,
    animation: "blob-drift-4 38s ease-in-out -7s infinite, blob-morph-2 12s ease-in-out -6s infinite",
  },
  // Small bottom-left — soft green to gold
  {
    width: "40vw", height: "54vw",
    bottom: "6%", left: "-7%",
    colors: ["oklch(0.83 0.08 132 / 0.18)", "oklch(0.86 0.09 78 / 0.13)"],
    blur: 94,
    animation: "blob-drift-5 30s ease-in-out -18s infinite, blob-morph-1 10s ease-in-out -4s infinite",
  },
] as const;

const DARK_BLOBS = [
  // Large top-left — pink to lavender
  {
    width: "65vw", height: "48vw",
    top: "-12%", left: "-15%",
    colors: ["oklch(0.76 0.13 340 / 0.20)", "oklch(0.74 0.11 280 / 0.14)"],
    blur: 100,
    animation: "blob-drift-1 36s ease-in-out 0s infinite, blob-morph-1 9s ease-in-out -2s infinite",
  },
  // Medium top-right — teal to sky
  {
    width: "50vw", height: "62vw",
    top: "5%", right: "-12%",
    colors: ["oklch(0.75 0.12 195 / 0.18)", "oklch(0.77 0.11 225 / 0.13)"],
    blur: 85,
    animation: "blob-drift-2 42s ease-in-out -15s infinite, blob-morph-2 11s ease-in-out -5s infinite",
  },
  // Wide bottom — blue to violet
  {
    width: "78vw", height: "42vw",
    bottom: "-8%", left: "8%",
    colors: ["oklch(0.72 0.12 240 / 0.18)", "oklch(0.71 0.13 270 / 0.14)"],
    blur: 115,
    animation: "blob-drift-3 46s ease-in-out -22s infinite, blob-morph-3 13s ease-in-out -8s infinite",
  },
  // Center roaming — indigo to rose
  {
    width: "42vw", height: "48vw",
    top: "30%", left: "28%",
    colors: ["oklch(0.73 0.13 255 / 0.13)", "oklch(0.76 0.12 10 / 0.10)"],
    blur: 80,
    animation: "blob-drift-4 40s ease-in-out -9s infinite, blob-morph-2 10s ease-in-out -7s infinite",
  },
  // Small bottom-left — mint to teal
  {
    width: "38vw", height: "52vw",
    bottom: "8%", left: "-8%",
    colors: ["oklch(0.77 0.11 165 / 0.14)", "oklch(0.75 0.12 195 / 0.11)"],
    blur: 90,
    animation: "blob-drift-5 32s ease-in-out -12s infinite, blob-morph-1 8s ease-in-out -4s infinite",
  },
] as const;

type Blob = {
  width: string; height: string;
  colors: readonly [string, string];
  blur: number; animation: string;
  top?: string; bottom?: string; left?: string; right?: string;
};

function BlobSet({ blobs }: { blobs: readonly Blob[] }) {
  return (
    <>
      {blobs.map((b, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            width: b.width,
            height: b.height,
            top: "top" in b ? b.top : undefined,
            bottom: "bottom" in b ? b.bottom : undefined,
            left: "left" in b ? b.left : undefined,
            right: "right" in b ? b.right : undefined,
            background: `radial-gradient(ellipse, ${b.colors[0]} 0%, ${b.colors[1]} 45%, transparent 70%)`,
            filter: `blur(${b.blur}px)`,
            animation: b.animation,
            willChange: "transform, border-radius",
          }}
        />
      ))}
    </>
  );
}

export function WaterBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {/* Light mode blobs — warm gold & sage */}
      <div className="absolute inset-0 dark:hidden">
        <BlobSet blobs={LIGHT_BLOBS} />
      </div>
      {/* Dark mode blobs — cool jewel tones */}
      <div className="absolute inset-0 hidden dark:block">
        <BlobSet blobs={DARK_BLOBS} />
      </div>
    </div>
  );
}
