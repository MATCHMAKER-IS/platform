# @platform/session

セッション・クッキー処理の共通部品。

## クッキー
```ts
import { parseCookies, serializeCookie, clearCookie } from "@platform/session";
const cookies = parseCookies(req.headers.get("cookie"));
const setCookie = serializeCookie("theme", "dark", { maxAge: 3600, sameSite: "Lax" });
```

## ステートレス封緘クッキーセッション(サーバに状態を持たない)
```ts
import { createSession } from "@platform/session";
const session = createSession<{ userId: string }>({ secret: env.SESSION_SECRET });
// ログイン時
res.headers.set("set-cookie", session.write({ userId }));
// 各リクエスト
const s = session.read(req.headers.get("cookie")); // { userId } | null
// ログアウト
res.headers.set("set-cookie", session.destroy());
```

## ストア型セッション(失効可能・大きめデータ向き)
```ts
import { createServerSession } from "@platform/session";
const session = createServerSession<{ userId: string; roles: string[] }>({ store });
const { setCookie } = await session.create({ userId, roles });
const data = await session.read(req.headers.get("cookie"));
await session.destroy(req.headers.get("cookie")); // サーバ側で失効
```

`store` は `get/set/delete` を持つ任意の実装(`@platform/cache` の Store も構造的に適合)。
封緘は AES-256-GCM(`@platform/crypto`)。改ざん・期限切れ・鍵不一致は自動で無効化されます。

## 無操作タイムアウト(自動ログアウト)

**既定は無効(無操作でもログアウトしません)。** `idleTimeoutSec` を設定すると、最後の活動から
その秒数を超えたセッションを失効扱いにします。絶対期限(`maxAgeSec`)は活動しても延長されません。

```ts
const session = createSession<{ userId: string }>({
  secret: env.SESSION_SECRET,
  maxAgeSec: 60 * 60 * 8,   // 絶対上限 8 時間
  idleTimeoutSec: 30 * 60,  // 無操作 30 分でログアウト(未設定なら無効)
});

// 各リクエスト: 読めなければログアウト
const s = session.read(cookie);
if (!s) return redirectToLogin();
// 活動があったので無操作タイマーをスライド(絶対期限は保持)
const refreshed = session.refresh(cookie);  // 有効なら新しい Set-Cookie / 失効なら null
```

### クライアント側の自動ログアウト UX(`@platform/session/idle-timer`)
サーバ失効だけだと利用者は次の操作まで気づけないため、ブラウザ側でも無操作を監視します。
crypto を含まない軽量サブパスなのでクライアントに安全にバンドルできます。

```ts
import { createIdleTimer, bindActivityListeners } from "@platform/session/idle-timer";
const timer = createIdleTimer({
  timeoutMs: 30 * 60_000, warnBeforeMs: 60_000,
  onWarn: (msLeft) => showCountdown(msLeft),  // ログアウト1分前に警告
  onIdle: () => logout(),                     // 自動ログアウト
});
timer.start();
const unbind = bindActivityListeners(timer);  // mousemove/keydown/scroll/visibilitychange を監視
```
React 配線例(警告モーダル + カウントダウン)は `apps/internal-app` の `IdleLogout` を参照。

## ログイン試行の抑制(ブルートフォース対策)
識別子(メール/IP)ごとに失敗回数を数え、閾値超過で一定時間ロックします。段階的バックオフ対応。

```ts
import { createLoginThrottle } from "@platform/session";
const throttle = createLoginThrottle({ maxFails: 5, windowMs: 15*60_000, lockMs: 15*60_000, progressive: true, store });

const gate = await throttle.check(email);
if (!gate.allowed) return tooManyAttempts(gate.retryAfterMs);
if (await authFailed) { await throttle.recordFailure(email); }
else { await throttle.recordSuccess(email); }  // 成功でカウントクリア
```

## セッション固定攻撃対策(ID 再生成)
ログイン成功・権限昇格の直後にセッション ID を作り直します(ストア型)。
```ts
const re = await session.regenerate(cookie);        // 旧IDは失効、新IDのSet-Cookie
if (re) res.headers.set("set-cookie", re.setCookie);
```

## 全端末ログアウト(ユーザー単位失効)
`create(data, { userId })` でユーザー索引を持たせると、まとめて失効できます。
```ts
await session.create(data, { userId });             // 端末ごとに作成
const count = await session.destroyAllForUser(userId); // 全端末ログアウト
const ids = await session.listUserSessions(userId);    // 端末管理UI用
```
パスワード変更・不正アクセス検知時の「他のすべてのデバイスからログアウト」に使えます。

## 重要操作の再認証(step-up)+ Remember-me
```ts
import { createStepUp, sessionMaxAge } from "@platform/session";
const stepUp = createStepUp({ freshnessSec: 300 });  // 直近5分の認証なら再認証不要
if (stepUp.required(session.authAt)) return promptReauth();
// 再認証成功時: session.authAt = stepUp.stamp();

// Remember-me: 「ログイン状態を保持」で有効期間を切替
const maxAge = sessionMaxAge(rememberChecked, { defaultMaxAgeSec: 8*3600, rememberMaxAgeSec: 30*86400 });
```

## ログイン監査の標準化
ログイン/ログアウト/失敗/ロック/再認証を共通スキーマで記録します(出力先は注入)。
```ts
import { createLoginAudit } from "@platform/session";
const audit = createLoginAudit({ record: (e) => db.auditLog.create({ data: e }) });
await audit.loginSuccess({ subject: email, ip, method: "oidc" });
await audit.loginFailure({ subject: email, ip, reason: "wrong_password" });
await audit.allSessionsRevoked({ subject: email });
```
サンプルアプリ(`apps/internal-app`)は Zoho ログインのコールバック/ログアウトに配線済みです。

