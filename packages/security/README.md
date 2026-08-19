# @platform/security

セキュリティの守り（CSP・埋め込み制御・再送防止・入力の無害化）。

## これは何のためか

**攻撃は「うっかり」から入ります。**
利用者が貼った HTML、外部サイトからの埋め込み、同じ要求の再送——
**どれも悪意なく起きて、悪意ある人に使われます**。

## 使う前に知っておくこと

| | |
|---|---|
| **`unsafe-inline` は本番で必ず `false`** | 開発時に許すのは構いませんが、**本番で残すと CSP の意味がありません** |
| **`'self'` は nonce を使うと無視されます** | 両方書いても効きません——**どちらか一方**にしてください |
| **埋め込みの許可は最小に** | `sanitizeEmbed` と CSP を**揃えて**ください。片方だけ緩いと**そこから入られます** |
| **再送防止の期限は短すぎない** | 短いと**同じ要求を 2 回通します**（`createMemoryReplayStore`） |
| **入力の無害化は「表示前」に** | 保存時に消すと、**元が何だったか分からなくなります** |

## よく使うもの

```ts
import { createCsrf, assertCsrf, CSRF_COOKIE } from "@platform/security";
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
