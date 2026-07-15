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
