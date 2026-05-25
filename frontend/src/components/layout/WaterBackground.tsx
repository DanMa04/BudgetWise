const BLOBS = [
  // Large top-left — pink to lavender
  {
    width: "65vw", height: "48vw",
    top: "-12%", left: "-15%",
    colors: ["oklch(0.76 0.13 340 / 0.20)", "oklch(0.74 0.11 280 / 0.14)"],
    blur: 100,
    animation: "water-blob-1 14s ease-in-out 0s infinite, blob-morph-1 9s ease-in-out -2s infinite",
  },
  // Medium top-right — teal to sky
  {
    width: "50vw", height: "62vw",
    top: "5%", right: "-12%",
    colors: ["oklch(0.75 0.12 195 / 0.18)", "oklch(0.77 0.11 225 / 0.13)"],
    blur: 85,
    animation: "water-blob-2 16s ease-in-out -6s infinite, blob-morph-2 11s ease-in-out -5s infinite",
  },
  // Wide bottom — blue to violet
  {
    width: "78vw", height: "42vw",
    bottom: "-8%", left: "8%",
    colors: ["oklch(0.72 0.12 240 / 0.18)", "oklch(0.71 0.13 270 / 0.14)"],
    blur: 115,
    animation: "water-blob-3 18s ease-in-out -11s infinite, blob-morph-3 13s ease-in-out -8s infinite",
  },
  // Center roaming — indigo to rose
  {
    width: "42vw", height: "48vw",
    top: "30%", left: "28%",
    colors: ["oklch(0.73 0.13 255 / 0.13)", "oklch(0.76 0.12 10 / 0.10)"],
    blur: 80,
    animation: "water-blob-1 15s ease-in-out -3s infinite, blob-morph-2 10s ease-in-out -7s infinite",
  },
  // Small bottom-left — mint to teal
  {
    width: "38vw", height: "52vw",
    bottom: "8%", left: "-8%",
    colors: ["oklch(0.77 0.11 165 / 0.14)", "oklch(0.75 0.12 195 / 0.11)"],
    blur: 90,
    animation: "water-blob-2 13s ease-in-out -9s infinite, blob-morph-1 8s ease-in-out -4s infinite",
  },
] as const;

export function WaterBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden opacity-0 transition-opacity duration-1000 dark:opacity-100"
      style={{ zIndex: 0 }}
    >
      {BLOBS.map((b, i) => (
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
    </div>
  );
}
