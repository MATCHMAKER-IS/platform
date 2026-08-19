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
  // **開発時に副作用のバグを見つける。**
  // 効果を 2 回実行して、後始末を書き忘れた処理を炙り出す
  // (本番の動きは変わらない)。他のアプリと揃える
  reactStrictMode: true,
  output: "standalone",
  // **`standalone` は「必要なファイルだけ」を集める。** その基点がここ。
  // Next 15 の `next build` は webpack で、monorepo では基点を推測するため、
  // 明示しないと**必要なファイルが成果物から漏れます**
  // (Amplify の compute で「Module not found」になる形で出る)。
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Turbopack の root はモノレポのルート(pnpm は node_modules をルートに集約する)。
  // Next 15 では `next dev --turbopack` を付けたときだけ使われる。
  turbopack: { root: path.join(__dirname, "../..") },
  transpilePackages,
};
