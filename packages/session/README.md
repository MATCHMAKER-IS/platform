# @platform/session

ログインの状態（セッション・SSO・OAuth）。

## これは何のためか

**「誰でログインしているか」**を保つためのものです。
**「何をしてよいか」は `@platform/auth`** です——**別物です**。

パスワードログインも SSO も**同じ形**で扱います。
分けると、画面ごとに「どちらを見るか」の判断が要り、**必ずどこかで漏れます**。

## 使う前に知っておくこと

| | |
|---|---|
| **`SESSION_SECRET` は 32 文字以上** | 短いと**起動時に止まります**（わざとです） |
| **クッキーは `httpOnly` + `sameSite: lax`** | JavaScript から読めず、他サイトからの遷移では送られません |
| **SSO の `state` を必ず検証** | 飛ばすと、**攻撃者が用意した認可コードを踏まされます**（CSRF） |
| **メモリ実装は再起動で消える** | **100 人が一斉にログアウト**します——デプロイのたびに起きます |
| **失効の仕組みは繋いでいません** | 繋ぐと**全リクエストに 1 往復増えます**。退職者は**最終出社日の終業後に権限を外す**運用で代替しています |

## よく使うもの

```ts
import { createAuthSession, verifyOAuthState } from "@platform/session";
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

**既定は無制限(無操作でもログアウトしません)。** `idleTimeoutSec` を設定すると、最後の活動から
その秒数を超えたセッションを失効扱いにします。絶対期限(`maxAgeSec`)は活動しても延長されません。

**`0` は「無制限」です**(`undefined` と同じ)。管理画面から設定させる場合、入力欄を空にできない
ことが多いので `0` を無制限の入口として受けます。負の秒数は**起動時に例外**にします
(単位の間違いなのか無制限のつもりなのか区別できず、黙って無制限にすると期限が消えるため)。

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


## 強制ログアウト(締め出し)

「今ログインしている人を今すぐ追い出す」ための部品です。退職・異動、乗っ取りの疑い、
権限変更(**古いセッションは古い権限のまま**)、障害時の緊急停止で使います。

```ts
import { createRevocationGate, createMemoryRevocationStore } from "@platform/session";

const gate = createRevocationGate({ store });   // 本番は Redis 等を渡す

// 各リクエスト: 発行時刻を見て失効を判定する
const info = session.inspect(req.headers.get("cookie"));
if (!info) return redirectToLogin();
const d = await gate.check(info.data.userId, info.issuedAt);
if (!d.allowed) return logoutWith(d.reason);

// ログイン処理の冒頭でも見る(**追い出しただけでは再ログインで戻ってくる**)
const canLogin = await gate.checkLogin(userId);
```

| 操作 | 効果 |
|---|---|
| `revokeUser(userId)` | その人の**全端末**のセッションを失効。ログインは可能 |
| `revokeAll()` | **全員**を失効(緊急停止)。**操作した本人も落ちます** |
| `block(userId, { reason, until?, by? })` | 失効 **+ ログイン拒否**。理由は必須 |
| `unblock(userId)` | 締め出しの解除(失効した既存セッションは戻りません) |
| `listBlocked()` | 締め出し中の一覧(理由・操作者・時刻) |

### 仕組み(なぜセッションを消して回らないか)

`createServerSession` なら `destroyAllForUser` で消せますが、**封緘クッキー方式には
サーバ側の記録が無く、消す対象が存在しません**。クッキーは利用者の手元にあり、
こちらから取り上げられません。

そこで「**いつ以降に発行されたセッションなら有効か**」を 1 つの時刻として持ちます。

```
  revoke:user:u42 = 10:00  → u42 の 10:00 より前に発行されたセッションが無効
  revoke:all      = 10:00  → 全員の 10:00 より前に発行されたセッションが無効
```

記録は**利用者 1 人につき 1 件**で、セッションが何個あっても増えません。
どちらのセッション方式にも同じように効きます。

### 注意

- **`createMemoryRevocationStore` は複数台では使えません。** 片方のサーバだけ締め出しが効かず、
  「追い出したはずの人がリロードすると戻ってくる」状態になります。Redis 等へ差し替えてください。
- 失効記録の保持期間(`ttlSec`、既定 400 日)は**セッションの絶対期限より長く**します。
  短いと記録が消えた後に古いセッションが復活します。
- `block` の理由は必須です。理由が残らないと、**後から誰も解除してよいか判断できません**。
- 恒久的なアカウント停止は、利用者マスタ側(アプリ)の責務です。ここは
  「今すぐ止める」ための仕組みで、退職処理そのものではありません
  (`@platform/access-review` の停止手順と対で使ってください)。

## 外部ログイン(OAuth)後のセッション

Zoho・Google・Microsoft のどれでログインしても、**クッキーに載せる形は同じ**です。
`createAuthSession` を使えば、暗号化・有効期限・クッキー属性が揃います。

```ts
const session = createAuthSession({ secret: env.SESSION_SECRET });

const info = await getGoogleUserInfo(accessToken);
if (info.hd !== "example.co.jp") throw new Error("社外のアカウントです");
session.write({
  provider: "google", subject: info.sub, email: info.email ?? "",
  domain: info.hd, roles: rolesOf(info.email),
});
```

**`subject`(恒久 ID)で紐づけてください。** メールは変わります(姓の変更・部署異動)し、
**前の持ち主のアドレスが再利用される**ことがあります
——退職者のアドレスを新入社員に割り当てると、**記録が繋がってしまいます**。

Google は**どのアカウントでもログインできる**ので、社内限定にするなら
`domain`(Google の `hd`)を必ず確かめてください。見ないと**個人の Gmail で入れます**。
