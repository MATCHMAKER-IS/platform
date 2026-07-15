# @platform/http

HTTP 層の共通規約。`AppError` を HTTP ステータスへ変換し、
Route Handler / Server Action のエラー処理を一箇所に集約します。

```ts
import { handleRoute } from "@platform/http";
import { validate } from "@platform/validation";

export const POST = handleRoute(async (req) => {
  const parsed = validate(schema, await req.json());
  if (!parsed.ok) throw parsed.error;      // 自動で 400
  return Response.json({ ok: true });
});
```
