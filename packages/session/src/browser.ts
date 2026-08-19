/**
 * **ブラウザ / Edge からも使える部分**だけをまとめた入口。
 *
 * 束ねた入口（`index.ts`）は OAuth の challenge 生成のために **`node:` を使います**。
 * 画面から入口を取ると**使っていない部分まで載り**、
 * `next build` が `UnhandledSchemeError` で落ちます（2026-08）。
 *
 * ここにあるのは**依存を持たない処理だけ**なので、どこからでも呼べます。
 * `ratelimit` / `cron` / `net` の `./browser` と同じ形です。
 *
 * @packageDocumentation
 */
export { createLoginThrottle, createMemoryThrottleStore, type ThrottleCheck } from "./login-throttle";
export { stepUpRequired, markAuthenticated, sessionMaxAge, createStepUp } from "./step-up";
export { createLoginAudit, summarizeLoginEvent, type LoginAuditEvent } from "./login-audit";
export { serializeCookie } from "./cookie";
