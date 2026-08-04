# @platform/zoho

Zoho CRM API(v8)クライアント。Leads / Contacts / Deals などのレコード CRUD。

```ts
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
