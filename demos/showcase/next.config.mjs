import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  // Turbopack にこのディレクトリが root だと教える。
  //
  // 【なぜ必要か】
  // モノレポでは Turbopack が pnpm-workspace.yaml を見つけて **リポジトリのルートを root と誤認**する。
  // すると cwd(demos/showcase)と root(platform/)がずれ、**node_modules も相対 import も
  // 解決できない**(実際に Amplify で Module not found が 103 件出た)。
  // ローカルの dev では起きず、`next build` で初めて出る。
  turbopack: {
    root: __dirname,
  },

  // transpilePackages は package.json の @platform/* 依存と一致させる。
  // 手で並べると必ず漏れる(実際 task/contract/faq/blog/security/utils/cron が漏れていた)ので、
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
