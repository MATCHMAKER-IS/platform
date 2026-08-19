# @platform/guard

API と画面の入口の守り（ログイン確認・権限確認）。

## これは何のためか

**守り忘れを無くす**ためのものです。

「この API は認証が要るか」を**画面ごとに考える**と、
**必ずどこかで忘れます**——そこから入られます。

## 使う前に知っておくこと

| | |
|---|---|
| **`requireSession` は失敗すると例外** | `if` を書き忘れても素通りしません——**これが `getSession` との違い**です |
| **認証が要らない API には印を** | `// public-api:` と理由を書いてください（**検査で見張っています**）——**書き忘れなのか、意図なのか**を区別するためです |
| **画面で隠すのは守りではない** | ボタンを消しても、**API を直接叩かれれば通ります** |
| **`Request` をそのまま渡せます** | 引数を組み替える必要はありません——**組み替えの間違い**を無くすためです |

## よく使うもの

```ts
import { currentSession, requireSession, requireRole } from "@platform/guard";
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

## 未ログインでも見せる画面

`requireSession` は無ければ 401 を投げます。**ログインしていなくても見せる画面**
(公開ページ・ログイン画面そのもの・「ログイン中なら名前を出す」ヘッダ)では
`currentSession` を使ってください。**`null` を返す**だけで例外は投げません。

```ts
import { currentSession } from "@platform/guard";

const me = currentSession(req, session);   // Request をそのまま渡せる
if (me === null) return <LoginButton />;
```

無効・期限切れ・未ログインは**区別せず `null`** です。利用者から見れば同じですし、
区別して伝えると**セッション偽造の手がかり**になります。

## 書き込みの共通ガード

本文サイズ・CSRF(`Origin` 確認)・レート制限を **1 つにまとめてあります**。
3 つとも**書き忘れても動いてしまう**ので、ルートごとに書くと必ず抜けます
——抜けても平常時は何も起きず、**攻撃されて初めて分かります**。

```ts
export async function POST(req: Request) {
  const blocked = await guardWrite(req, { limiter: writeLimiter });
  if (blocked !== null) return blocked;
  // ここから本処理
}
```

`GET` / `HEAD` は素通しします(副作用が無いため)。
`Origin` を送ってこない相手(サーバ間通信)は通します——送られたときだけ見ます。
