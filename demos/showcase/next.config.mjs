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
    "@platform/apikey",
    "@platform/ai",
    "@platform/auth",
    "@platform/audit",
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
    "@platform/currency",
    "@platform/datetime",
    "@platform/dencho",
    "@platform/depreciation",
    "@platform/device",
    "@platform/faq",
    "@platform/form",
    "@platform/freee",
    "@platform/google",
    "@platform/guard",
    "@platform/hid",
    "@platform/http",
    "@platform/i18n",
    "@platform/image",
    "@platform/invoice",
    "@platform/inventory",
    "@platform/loadtest",
    "@platform/mcp",
    "@platform/mail",
    "@platform/notify",
    "@platform/observability",
    "@platform/ocr",
    "@platform/payroll",
    "@platform/pdf",
    "@platform/phone",
    "@platform/pii",
    "@platform/print",
    "@platform/purchase",
    "@platform/rag",
    "@platform/ratelimit",
    "@platform/quote",
    "@platform/realtime",
    "@platform/report",
    "@platform/search",
    "@platform/security",
    "@platform/sequence",
    "@platform/seo",
    "@platform/session",
    "@platform/social",
    "@platform/storage",
    "@platform/task",
    "@platform/tax",
    "@platform/theme",
    "@platform/ui",
    "@platform/units",
    "@platform/upload",
    "@platform/utils",
    "@platform/validation",
    "@platform/workflow",
    "@platform/xlsx",
    "@platform/zoho",
    "@platform/zengin",
  ],
};
