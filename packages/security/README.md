# @platform/security

Web セキュリティの共通部品。

- `securityHeaders(options)` … CSP / HSTS / X-Frame-Options 等のヘッダ(helmet 相当)
- `sanitize(html)` / `stripHtml(html)` … HTML サニタイズ(XSS・インジェクション対策)
- `createCsrf({ secret })` … CSRF トークンの発行/検証(署名付き double-submit、ステートレス)

```ts
// Next middleware でヘッダを付与
import { securityHeaders } from "@platform/security";
const headers = securityHeaders();

// ユーザー入力HTMLの安全化(表示・PDF差し込み前に)
import { sanitize } from "@platform/security";
const safe = sanitize(userHtml);
```

## リプレイ防止(ワンタイム値)

使用済みトークン(JWT の `jti`)・nonce・冪等キーの**再利用を拒否**します(社内 universe-club の jti 再利用拒否ストアを一般化)。ストアを注入でき、単一インスタンスはメモリ、本番は Redis 等に差し替えられます。

```ts
import { createReplayGuard } from "@platform/security";
const guard = createReplayGuard();
// JWT 検証後:
if (!(await guard.markUsedIfNew(payload.jti, payload.exp))) {
  return new Response("token replay", { status: 401 });
}
```

`markUsedIfNew` は初見なら `true`(処理続行)、再利用なら `false`(拒否)。TTL とクロックスキューは調整可能です。
