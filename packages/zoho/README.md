# @platform/zoho

Zoho の 19 サービス（CRM / Books / Desk / People / Expense / Vault ほか）。

## これは何のためか

**Zoho は「日本の中小企業が実際に使っている」**ものです。
CRM も会計も人事も 1 社で揃うので、**社内システムとの連携が要ります**。

## 使う前に知っておくこと

| | |
|---|---|
| **`ZOHO_DC` を間違えると 401** | 「認証情報が違う」と見えますが、**実際は別のデータセンターを叩いています**。**日本なら `jp`** を必ず明示してください |
| **リフレッシュトークンは 1 度しか表示されません** | 控え忘れると**やり直し**です |
| **日付を `slice(0, 10)` で切らない** | Zoho は**タイムゾーン付きで返します**——切ると**1 日ずれます** |
| **全件取得は上限で打ち切られます** | **黙って欠ける**ので、件数を数えて知らせるようにしてあります |
| **Vault は別格** | 秘密を扱うので、**ログに出さない・保存しない・権限を最小に**（README を必ず読んでください） |

## よく使うもの

```ts
import { createZohoCrmClient, createZohoBooksClient } from "@platform/zoho";
import { createZohoCrmClient } from "@platform/zoho";
const zoho = createZohoCrmClient({ apiDomain: "https://www.zohoapis.jp", accessToken });
const leads = await zoho.getRecords("Leads", { fields: ["Last_Name", "Email"], perPage: 50 });
```

- 認証ヘッダは Bearer ではなく `Zoho-oauthtoken`。
- ベース URL はトークン応答の `api_domain`(データセンター別)を使います。
- OAuth トークンの取得・更新・DC 判定はアプリ側で行います。

## サービス別のサブパス

Zoho は 15 サービスを扱うため、**サービスごとにサブパスへ分けてあります**。
バレル(`@platform/zoho`)からは各クライアントの生成関数だけを出しており、
レコード型やページング型などの細かい型は**サブパスにしかありません**。

```ts
import { createZohoCrmClient } from "@platform/zoho/crm";
import type { CrmRecord, CrmPageInfo } from "@platform/zoho/crm";
```

| サブパス | 内容 |
|---|---|
| `@platform/zoho/core` | データセンター判定・OAuth・共通クライアント(**まずここ**) |
| `@platform/zoho/crm` | CRM(v8)。Leads / Contacts / Deals |
| `@platform/zoho/books` | Books(v3)。会計 |
| `@platform/zoho/desk` | Desk(v1)。問い合わせ |
| `@platform/zoho/inventory` | Inventory(v1)。在庫 |
| `@platform/zoho/campaigns` | Campaigns(v1.1)。メール配信 |
| `@platform/zoho/projects` | Projects。案件管理 |
| `@platform/zoho/people` | People。人事 |
| `@platform/zoho/sign` | Sign。電子署名 |
| `@platform/zoho/recruit` | Recruit。採用 |
| `@platform/zoho/workdrive` | WorkDrive。ファイル |
| `@platform/zoho/analytics` | Analytics。BI |
| `@platform/zoho/cliq` | Cliq。チャット |
| `@platform/zoho/creator` | Creator。内製アプリ |
| `@platform/zoho/bookings` | Bookings。予約 |

**サービスを 1 つしか使わないなら、そのサブパスだけを import してください。**
バレルは 15 サービス分のクライアントを引き込みます。

## ログイン後のセッション

**`@platform/session` の `createAuthSession` を使ってください。**
Zoho・Google・Microsoft のどれでログインしても、
**クッキーに載せる情報はほぼ同じ**なので共通にしてあります。

```ts
import { createAuthSession } from "@platform/session";
import { currentSession } from "@platform/guard";

const session = createAuthSession({ secret: env.SESSION_SECRET });

// コールバック
res.headers.set("set-cookie", session.write({
  subject: info.zuid,        // **メールではなく zuid で紐づける**
  provider: "zoho",
  email: info.email,
  roles: await rolesOf(info.zuid),
}));

// 各リクエスト
const me = currentSession(req, session);
```

**メールアドレスで人を紐づけないでください。** 姓の変更・部署異動で変わり、
**退職者のアドレスが再利用される**と別人が入ります。

**鍵はアプリごとに分けてください。** 同じ鍵を使うと、
**一方のアプリのクッキーが他方でも通ります**。

## 一覧の全件取得

**ページングを自前で回さないでください。** Zoho の既定は 200 件/ページなので、
**201 件目から静かに落ちます**——件数が少ないうちは正しく動くため気づけません。

```ts
const leads = await crm.getAllRecords("Leads", { fields: ["Last_Name"] });
const invoices = await books.listAll("/invoices", { status: "unpaid" });
```

上限は 50 ページ(最大 10,000 件)です。**設定ミスで全期間を引くと、
相手の API 上限を使い切ってその日は他の連携も動かなくなります**。

`desk` / `people` / `projects` は**オフセット方式しか無く**、
取得中にレコードが増減すると重複・欠落が起きます。
**一括同期は業務時間外に**回すか、**取得後に ID で重複を除いて**ください。
