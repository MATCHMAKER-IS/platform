# @platform/guard

ルート/ページ保護のガード。セッション・RBAC・レート制限を Route の入口で強制します。
失敗は AppError で投げ、`@platform/http` の `handleRoute` が 401/403/429 に変換します。

```ts
import { handleRoute } from "@platform/http";
import { requireSession, requirePermission, enforceRateLimit } from "@platform/guard";

export const POST = handleRoute(async (req) => {
  await enforceRateLimit(limiter, `ip:${ip}`);         // 429 で弾く
  const user = requireSession(req.headers.get("cookie"), session); // 未ログインは 401
  requirePermission(policy, user, "invoice:delete");   // 権限不足は 403
  // ...本処理
});
```

> ページ保護は Server Component で `requireSession` を使い、失敗時に `next/navigation` の
> `redirect("/login")` に振り替えるのが安全です(封緘セッションは scrypt を使うため
> Edge Middleware では動きません)。
