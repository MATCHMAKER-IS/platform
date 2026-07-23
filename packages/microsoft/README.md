# @platform/microsoft

Microsoft 365 / Entra ID(旧 Azure AD)との連携。OAuth と Microsoft Graph を型付きで扱います。

```ts
import { createMicrosoftTokenManager, createMicrosoftAuthedFetch, createMicrosoftGraphClient } from "@platform/microsoft";

const manager = createMicrosoftTokenManager({
  clientId, clientSecret, tenantId, refreshToken,
  onRefresh: (r) => saveRefreshToken(r.refreshToken),   // 回転するので保存し直す
});
const graph = createMicrosoftGraphClient(createMicrosoftAuthedFetch(manager));

await graph.sendMail({ to: ["taro@example.co.jp"], subject: "月次締め", body: "本日締めです" });
const events = await graph.listEvents({ start: "2026-07-01T00:00:00", end: "2026-07-31T23:59:59" });
```

## 注意する点

| 点 | 内容 |
|---|---|
| **テナントは自社の ID にする** | `common` にすると**他社のアカウントでもログインできる**。社内システムでは必ず自社テナント ID を指定 |
| **リフレッシュトークンは回転する** | 更新時に新しい値が返ることがある。`onRefresh` で保存し直さないと、いずれ失効する |
| **権限は最小限に** | `Mail.Send` と `Mail.ReadWrite` は別物。使う操作の分だけ要求する |
| **管理者の同意が要る場合がある** | 組織全体に関わる権限（`User.Read.All` など）はテナント管理者の承認が必要 |

## 会議調整とファイル保存

```ts
// 複数人の埋まり具合だけを取る（予定の中身は見ない）
const slots = await graph.getSchedule({ emails: ["a@ex.jp", "b@ex.jp"], start, end });

// OneDrive / SharePoint に帳票を置く（4MB まで。超える場合は分割アップロードが必要）
await graph.uploadFile({ path: "月次報告/2026-07.csv", content: csv, contentType: "text/csv" });

// 社員名簿の同期
const users = await graph.listUsers({ filter: "department eq '経理'" });
```

`getSchedule` の結果には `available` が付きます。**権限が無い相手は予定が空で返る**ため、
「空いている」と「見られない」を取り違えないようにしています。

## Graph の使い分け

用意しているのはメール送信・予定・利用者だけです。他の API は `graph.request()` で直接叩けます。
全部を型付きで包まないのは、**包んだ分だけ相手の変更に追随する義務が増える**ためです。
定着してから関数にしてください。

## 疎通の確認

`/connect`（接続チェック）から、いま手元にある資格情報で通るかを確認できます（読み取りのみ）。
