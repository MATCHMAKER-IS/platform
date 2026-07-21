import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkg = require("./package.json");

// transpilePackages は package.json の @platform/* 依存から自動生成する(手書きは必ず漏れる)。
// 基盤は main が src/index.ts(生 TS)を指すため、ここに載らないパッケージを import すると
// next build が落ちる。依存から導出し、tools/check-app-transpile.mjs で検査する。
const transpilePackages = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((d) =>
  d.startsWith("@platform/"),
);

/** @type {import('next').NextConfig} */
export default {
  output: "standalone",
  // Turbopack の root はモノレポのルート(pnpm は node_modules をルートに集約する)。
  turbopack: { root: path.join(__dirname, "../..") },
  transpilePackages,
};
