/** @type {import('next').NextConfig} */
export default {
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

// ────────────────────────────────────────────────
// 【Turbopack を使わない理由】
//
// `next build`(Next.js 16 の既定は Turbopack)がモノレポで動かなかった。
// root の指定を 3 通り試したが、どれも失敗した:
//
//   1. 未指定           → Module not found が 103 件(node_modules も相対 import も解決できない)
//   2. root: __dirname  → 「We couldn't find the Next.js package (next/package.json)
//                          from .../demos/showcase/src/app」
//                          (pnpm は node_modules をルートに集約するので、showcase を
//                           root にすると next すら見つからない)
//   3. root: ../..      → 1 と同じく 103 件
//
// pnpm の isolated な node_modules 構造と Turbopack の root 解決が噛み合っていない。
// **package.json の build に `--no-turbopack` を付けて webpack でビルドする**。
//
// webpack は枯れており、モノレポでの実績が豊富。デモサイトなのでビルド時間の差は誤差。
// Turbopack の設定が分かったら戻す(そのときはローカルで `pnpm --filter showcase-demo build`
// が通ることを確認してから)。
// ────────────────────────────────────────────────
