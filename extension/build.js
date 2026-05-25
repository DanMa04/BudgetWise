import * as esbuild from "esbuild";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";

const isWatch = process.argv.includes("--watch");
const browser = process.argv.find((a) => a.startsWith("--browser="))?.split("=")[1] ?? "chrome";

if (!["chrome", "firefox"].includes(browser)) {
  console.error(`Unknown browser: ${browser}. Use --browser=chrome or --browser=firefox`);
  process.exit(1);
}

const isFirefox = browser === "firefox";
const jsOutDir = isFirefox ? "dist-firefox" : "dist";

mkdirSync(jsOutDir, { recursive: true });

// --- Icons ---
await generateIcons();

// --- Firefox: build self-contained flat directory ---
if (isFirefox) {
  // Patch manifest: strip "dist/" prefixes, add gecko metadata
  const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));

  manifest.background.service_worker = "background.js";
  manifest.content_scripts = manifest.content_scripts.map((cs) => ({
    ...cs,
    js: cs.js?.map((f) => f.replace(/^dist\//, "")),
    css: cs.css?.map((f) => f.replace(/^dist\//, "")),
  }));
  manifest.browser_specific_settings = {
    gecko: {
      id: "{kallio-extension@kallio.app}",
      strict_min_version: "109.0",
    },
  };

  writeFileSync(`${jsOutDir}/manifest.json`, JSON.stringify(manifest, null, 2));

  // popup.html: fix script reference from "dist/popup.js" → "popup.js"
  const popupHtml = readFileSync("popup.html", "utf8").replace(
    'src="dist/popup.js"',
    'src="popup.js"'
  );
  writeFileSync(`${jsOutDir}/popup.html`, popupHtml);

  copyFileSync("popup.css", `${jsOutDir}/popup.css`);
  copyFileSync("src/styles/content.css", `${jsOutDir}/content.css`);
  mkdirSync(`${jsOutDir}/icons`, { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    const src = `icons/icon${size}.png`;
    if (existsSync(src)) copyFileSync(src, `${jsOutDir}/icons/icon${size}.png`);
  }
} else {
  copyFileSync("src/styles/content.css", "dist/content.css");
}

// --- esbuild ---
const buildOptions = {
  entryPoints: {
    background: "src/background/service-worker.ts",
    content: "src/content/content.ts",
    popup: "src/popup/popup.ts",
    "settings-bridge": "src/content/settings-bridge.ts",
  },
  bundle: true,
  outdir: jsOutDir,
  format: "esm",
  target: "es2022",
  sourcemap: true,
  minify: !isWatch,
};

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log(`Watching for changes (${browser})…`);
} else {
  await esbuild.build(buildOptions);
  console.log(`Build complete → ${jsOutDir}/ (${browser})`);
}

// ---------------------------------------------------------------------------

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
    // canvas package not installed — icons must already exist
  }
}
