import * as esbuild from "esbuild-wasm/lib/browser.js";
import { mkdirSync, readFileSync, rmSync, writeFileSync, cpSync, existsSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(root, "dist");
const assetDir = join(distDir, "assets");
const wasmPath = require.resolve("esbuild-wasm/esbuild.wasm");

await esbuild.initialize({
  wasmModule: await WebAssembly.compile(readFileSync(wasmPath)),
  worker: false
});

rmSync(distDir, { recursive: true, force: true });
mkdirSync(assetDir, { recursive: true });

const result = await esbuild.build({
  entryPoints: [join(root, "src", "main.tsx")],
  bundle: true,
  format: "esm",
  write: false,
  minify: true,
  sourcemap: false,
  define: {
    "import.meta.env.DEV": "false"
  },
  loader: {
    ".js": "jsx",
    ".jsx": "jsx",
    ".ts": "ts",
    ".tsx": "tsx",
    ".css": "css"
  },
  plugins: [nodeResolvePlugin()]
});

let jsFile = "";
let cssFile = "";

for (const file of result.outputFiles) {
  const ext = extname(file.path);
  if (ext === ".js") {
    jsFile = "assets/main.js";
    writeFileSync(join(distDir, jsFile), file.contents);
  } else if (ext === ".css") {
    cssFile = "assets/main.css";
    writeFileSync(join(distDir, cssFile), file.contents);
  }
}

writeFileSync(
  join(distDir, "index.html"),
  `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#f6f4ef" />
    <title>Live Motion Studio</title>
    ${cssFile ? `<link rel="stylesheet" href="/${cssFile}" />` : ""}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/${jsFile}"></script>
  </body>
</html>
`,
  "utf-8"
);

if (existsSync(join(root, "public", "ffmpeg-core"))) {
  cpSync(join(root, "public", "ffmpeg-core"), join(distDir, "ffmpeg-core"), { recursive: true });
}

function nodeResolvePlugin() {
  return {
    name: "node-resolve",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.kind === "entry-point") {
          return { path: args.path };
        }

        if (args.path.startsWith(".") || args.path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(args.path)) {
          const base = isAbsolute(args.path) ? args.path : join(args.resolveDir, args.path);
          return { path: resolveWithExtension(base) };
        }

        return {
          path: require.resolve(args.path, { paths: [args.resolveDir || root] })
        };
      });

      build.onLoad({ filter: /.*/ }, (args) => {
        const ext = extname(args.path);
        return {
          contents: readFileSync(args.path, "utf-8"),
          loader: loaderForExtension(ext),
          resolveDir: dirname(args.path)
        };
      });
    }
  };
}

function resolveWithExtension(path) {
  if (existsSync(path)) {
    return path;
  }

  for (const ext of [".tsx", ".ts", ".jsx", ".js", ".mjs", ".css", ".json"]) {
    if (existsSync(`${path}${ext}`)) {
      return `${path}${ext}`;
    }
  }

  for (const ext of [".tsx", ".ts", ".jsx", ".js", ".mjs"]) {
    const indexPath = join(path, `index${ext}`);
    if (existsSync(indexPath)) {
      return indexPath;
    }
  }

  throw new Error(`Cannot resolve ${relative(root, path)}`);
}

function loaderForExtension(ext) {
  if (ext === ".tsx") return "tsx";
  if (ext === ".ts") return "ts";
  if (ext === ".jsx" || ext === ".js" || ext === ".mjs") return "jsx";
  if (ext === ".css") return "css";
  if (ext === ".json") return "json";
  return "file";
}
