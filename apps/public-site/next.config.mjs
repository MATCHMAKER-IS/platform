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
  reactStrictMode: true,
  // **Next 15 の `next build` は webpack。** monorepo では基点を明示しないと
  // 推測に頼り、**必要なファイルが成果物に入らない**ことがある
  // (Amplify の compute で「Module not found」になる形で出る)。
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // turbopack は Next 15 では **`next dev --turbopack` を付けたときだけ**使う。
  // 付けない既定では無視されるので、置いておいても害はない
  turbopack: { root: path.join(__dirname, "../..") },
  transpilePackages,
};
