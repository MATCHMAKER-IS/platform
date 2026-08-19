# @platform/http

HTTP の土台（クライアント・ステータス・条件付き要求）。

## これは何のためか

**外部サービスは必ず落ちます。** そのときに
**永久に待つ / 勝手に繰り返す / 何が起きたか分からない**——
この 3 つを防ぐためのものです。

## 使う前に知っておくこと

| | |
|---|---|
| **時間制限は必ず** | 既定は 10 秒です。**無いと永久に待ちます**——利用者は白い画面のまま |
| **`POST` は繰り返さない** | 「作成は成功したが応答が返らなかった」ときに繰り返すと、**同じ請求書が 2 通**できます |
| **429 と 5xx だけ試し直す** | 400 や 401 は**繰り返しても無駄**——相手の混雑を悪化させるだけです |
| **待つときはばらつきを入れる** | 全員が同じ秒数で再開すると、**また一斉に混みます** |

## よく使うもの

```ts
import { makeETag, notModified, createMemoryIdempotencyStore } from "@platform/http";
import { handleRoute } from "@platform/http";
import { validate } from "@platform/validation";

export const POST = handleRoute(async (req) => {
  const parsed = validate(schema, await req.json());
  if (!parsed.ok) throw parsed.error;      // 自動で 400
  return Response.json({ ok: true });
});
```
