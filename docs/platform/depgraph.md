# パッケージ依存グラフ(自動生成）

> 再生成: `node tools/gen-depgraph.mjs`。手で編集しない。

## カテゴリ間の依存

各カテゴリのパッケージが、他カテゴリのパッケージを何本 import しているか（数字は本数）。

```mermaid
flowchart LR
  CAI__["AI基盤"]
  CUI___["UI・表現"]
  C_________["コンテンツ・サイト"]
  C______["セキュリティ"]
  C___["データ"]
  C_________["メディア・デバイス"]
  C________["基礎(型・共通)"]
  C__SaaS__["外部SaaS連携"]
  C______["業務ドメイン"]
  C_____["認証・認可"]
  C__["通信"]
  C_________["非同期・フロー制御"]
  C_________ -->|7| C________
  C__SaaS__ -->|7| C________
  CUI___ -->|6| C________
  C__SaaS__ -->|6| C__
  C__ -->|6| C________
  C______ -->|5| C________
  C___ -->|5| C________
  CUI___ -->|5| C_________
  C_________ -->|4| C________
  C______ -->|4| C________
  CAI__ -->|2| C________
  C_____ -->|2| C________
  C______ -->|2| C_____
  C________ -->|2| C___
  C______ -->|1| C__
  C_________ -->|1| C________
  CAI__ -->|1| C___
  C_____ -->|1| C______
  C________ -->|1| C_____
  CUI___ -->|1| C___
  CUI___ -->|1| C__
  C_________ -->|1| C___
```

## よく使われる基盤パッケージ(被依存トップ12)

| パッケージ | 被依存数 |
|---|---|
| `@platform/core` | 50 |
| `@platform/integrations` | 7 |
| `@platform/tax` | 2 |
| `@platform/cache` | 2 |
| `@platform/auth` | 2 |
| `@platform/datetime` | 2 |
| `@platform/bluetooth` | 2 |
| `@platform/invoice` | 2 |
| `@platform/storage` | 2 |
| `@platform/fsm` | 1 |
| `@platform/board` | 1 |
| `@platform/site` | 1 |

## 依存が多いパッケージ(依存元トップ12)

| パッケージ | 依存数 |
|---|---|
| `@platform/ui` | 12 |
| `@platform/guard` | 4 |
| `@platform/testing` | 3 |
| `@platform/address` | 2 |
| `@platform/cms` | 2 |
| `@platform/db` | 2 |
| `@platform/ekyc` | 2 |
| `@platform/freee` | 2 |
| `@platform/google` | 2 |
| `@platform/invoice` | 2 |
| `@platform/line` | 2 |
| `@platform/paypal` | 2 |
