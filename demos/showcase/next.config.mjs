import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  // Turbopack の root は **モノレポのルート**にする。
  //
  // 【なぜ showcase 自身ではダメか】
  // pnpm は node_modules をルートに集約し、各パッケージにはシンボリックリンクだけを置く。
  // root を demos/showcase に固定すると、**ルートの node_modules を見なくなり**、
  // `next/package.json` すら見つからない:
  //   「We couldn't find the Next.js package (next/package.json) from
  //     .../demos/showcase/src/app」
  //
  // 【なぜ明示が要るか】
  // 指定しないと Turbopack が root を推測し、cwd とずれて
  // **node_modules も相対 import も解決できない**(Module not found が 103 件出た)。
  //
  // どちらもローカルの dev では起きず、`next build` で初めて出る。
  turbopack: {
    root: path.join(__dirname, "../.."),
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
