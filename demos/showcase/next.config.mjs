import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  // Turbopack の root はモノレポのルート。
  // 指定しないと root を推測して cwd とずれ、node_modules を解決できない。
  // pnpm は node_modules をルートに集約するので、ここを指す必要がある。
  turbopack: {
    root: path.join(__dirname, "../.."),
  },

  // 基盤パッケージは **ソースを直接読む**(package.json の main が src/index.ts)。
  // ここに列挙したものが TS のままバンドルされる。
  //
  // package.json の @platform/* 依存と一致させること。手で並べると必ず漏れるので、
  // tools/check-showcase-deps.mjs で機械的に検査する。
  transpilePackages: [
    "@platform/accounting",
    "@platform/address",
    "@platform/auth",
    "@platform/blog",
    "@platform/blueprint",
    "@platform/bluetooth",
    "@platform/board",
    "@platform/booking",
    "@platform/cast",
    "@platform/chat",
    "@platform/contract",
    "@platform/core",
    "@platform/cron",
    "@platform/crypto",
    "@platform/csv",
    "@platform/datetime",
    "@platform/device",
    "@platform/faq",
    "@platform/form",
    "@platform/freee",
    "@platform/guard",
    "@platform/hid",
    "@platform/http",
    "@platform/i18n",
    "@platform/image",
    "@platform/loadtest",
    "@platform/mail",
    "@platform/notify",
    "@platform/ocr",
    "@platform/payroll",
    "@platform/pdf",
    "@platform/print",
    "@platform/ratelimit",
    "@platform/realtime",
    "@platform/report",
    "@platform/security",
    "@platform/seo",
    "@platform/session",
    "@platform/social",
    "@platform/storage",
    "@platform/task",
    "@platform/theme",
    "@platform/ui",
    "@platform/upload",
    "@platform/utils",
    "@platform/validation",
    "@platform/workflow",
    "@platform/xlsx",
  ],
};
