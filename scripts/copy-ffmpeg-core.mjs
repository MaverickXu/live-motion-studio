import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(root);
const sourceDir = join(projectRoot, "node_modules", "@ffmpeg", "core-mt", "dist", "esm");
const targetDir = join(projectRoot, "public", "ffmpeg-core");

if (!existsSync(sourceDir)) {
  console.warn("[postinstall] @ffmpeg/core-mt not found yet; skipping asset copy.");
  process.exit(0);
}

mkdirSync(targetDir, { recursive: true });

for (const fileName of readdirSync(sourceDir)) {
  if (fileName.startsWith("ffmpeg-core")) {
    copyFileSync(join(sourceDir, fileName), join(targetDir, fileName));
  }
}

console.log("[postinstall] copied ffmpeg.wasm core assets to public/ffmpeg-core");
