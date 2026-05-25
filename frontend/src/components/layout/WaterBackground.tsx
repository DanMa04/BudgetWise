const BLOBS = [
  // Large top-left — primary blue glow
  {
    width: "65vw", height: "48vw",
    top: "-12%", left: "-15%",
    color: "oklch(0.52 0.16 215 / 0.22)",
    blur: 100,
    animation: "water-blob-1 38s ease-in-out infinite",
    delay: "0s",
  },
  // Medium top-right — teal accent
  {
    width: "50vw", height: "62vw",
    top: "5%", right: "-12%",
    color: "oklch(0.48 0.14 195 / 0.18)",
    blur: 85,
    animation: "water-blob-2 29s ease-in-out infinite",
    delay: "-13s",
  },
  // Wide bottom — deep blue anchor
  {
    width: "78vw", height: "42vw",
    bottom: "-8%", left: "8%",
    color: "oklch(0.42 0.11 240 / 0.20)",
    blur: 115,
    animation: "water-blob-3 44s ease-in-out infinite",
    delay: "-24s",
  },
  // Center roaming blob — adds depth as it drifts across cards
  {
    width: "42vw", height: "48vw",
    top: "30%", left: "28%",
    color: "oklch(0.50 0.13 220 / 0.14)",
    blur: 80,
    animation: "water-blob-1 33s ease-in-out infinite",
    delay: "-7s",
  },
  // Small bottom-left — teal whisper
  {
    width: "38vw", height: "52vw",
    bottom: "8%", left: "-8%",
    color: "oklch(0.46 0.12 205 / 0.13)",
    blur: 90,
    animation: "water-blob-2 26s ease-in-out infinite",
    delay: "-19s",
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
          className="absolute will-change-transform"
          style={{
            width: b.width,
            height: b.height,
            top: "top" in b ? b.top : undefined,
            bottom: "bottom" in b ? b.bottom : undefined,
            left: "left" in b ? b.left : undefined,
            right: "right" in b ? b.right : undefined,
            background: `radial-gradient(ellipse, ${b.color} 0%, transparent 68%)`,
            filter: `blur(${b.blur}px)`,
            animation: b.animation,
            animationDelay: b.delay,
          }}
        />
      ))}
    </div>
  );
}
