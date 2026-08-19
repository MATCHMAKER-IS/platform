/**
 * **ブラウザ / Edge からも使える部分**だけをまとめた入口。
 *
 * 束ねた入口（`index.ts`）は TOTP・パスワード再設定・バックアップコードのために **`node:` を使います**。
 * 画面から入口を取ると**使っていない部分まで載り**、
 * `next build` が `UnhandledSchemeError` で落ちます（2026-08）。
 *
 * ここにあるのは**依存を持たない処理だけ**なので、どこからでも呼べます。
 * `ratelimit` / `cron` / `net` の `./browser` と同じ形です。
 *
 * @packageDocumentation
 */
export * from "./rbac";
export * from "./hierarchy";
