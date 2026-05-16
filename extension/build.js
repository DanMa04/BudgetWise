import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync } from "fs";

const isWatch = process.argv.includes("--watch");

mkdirSync("dist", { recursive: true });

copyFileSync("src/styles/content.css", "dist/content.css");

const buildOptions = {
  entryPoints: {
    background: "src/background/service-worker.ts",
    content: "src/content/content.ts",
    popup: "src/popup/popup.ts",
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
