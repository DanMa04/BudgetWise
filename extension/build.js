import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync, existsSync } from "fs";

const isWatch = process.argv.includes("--watch");

mkdirSync("dist", { recursive: true });
mkdirSync("icons", { recursive: true });

copyFileSync("src/styles/content.css", "dist/content.css");

// Generate placeholder icons using canvas (skipped gracefully if not available)
async function generateIcons() {
  try {
    const { createCanvas } = await import("canvas");
    for (const size of [16, 32, 48, 128]) {
      const path = `icons/icon${size}.png`;
      if (existsSync(path)) continue;
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      const r = size * 0.15;
      ctx.moveTo(r, 0);
      ctx.arcTo(size, 0, size, size, r);
      ctx.arcTo(size, size, 0, size, r);
      ctx.arcTo(0, size, 0, 0, r);
      ctx.arcTo(0, 0, size, 0, r);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.floor(size * 0.58)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("K", size / 2, size / 2 + size * 0.03);
      const fs = await import("fs");
      fs.writeFileSync(path, canvas.toBuffer("image/png"));
    }
    console.log("Icons generated.");
  } catch {
    console.log("canvas package not found — skipping icon generation.");
  }
}

await generateIcons();

const buildOptions = {
  entryPoints: {
    background: "src/background/service-worker.ts",
    content: "src/content/content.ts",
    popup: "src/popup/popup.ts",
    "settings-bridge": "src/content/settings-bridge.ts",
  },
  bundle: true,
  outdir: "dist",
  format: "esm",
  target: "es2022",
  sourcemap: true,
  minify: !isWatch,
};

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await esbuild.build(buildOptions);
  console.log("Build complete.");
}
