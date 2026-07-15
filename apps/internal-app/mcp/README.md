# internal-app MCP サーバ

社内基盤のデータを **MCP(Model Context Protocol)** で Claude Desktop / Claude Code に公開する stdio サーバです。「未払の請求を一覧して」「在庫で発注が必要なものは?」「Zoho で山田さんのリードを探して」のような自然言語操作ができるようになります。

## 起動

```bash
pnpm install                     # 初回のみ
pnpm --filter internal-app mcp   # stdio で待ち受け(Claude 側から起動される想定)
```

## Claude Desktop への接続

`claude_desktop_config.example.json` の `/ABSOLUTE/PATH/TO/platform` を実パスに置き換え、Claude Desktop の設定ファイル(macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`)へマージして再起動します。

## ツール一覧

| ツール | 内容 |
|---|---|
| `invoice_list` | 請求一覧(status / limit で絞り込み) |
| `invoice_get` | 請求1件を番号で取得 |
| `partner_list` | 取引先一覧(kind で絞り込み) |
| `inventory_status` | 在庫状況(onlyReorder=true で要発注のみ) |
| `report_sales_csv` | 売上レポート(取引先別)を CSV で返す |
| `audit_recent` | 監査ログの直近エントリ |
| `zoho_search_records` | Zoho CRM 検索(module + word / criteria / email) |
| `zoho_get_record` | Zoho CRM レコード1件取得(module + id) |
| `invoice_record_payment` ✍ | 入金記録(書き込み・要 `MCP_ENABLE_WRITES=1`・監査記録) |
| `invoice_cancel` ✍ | 請求取消(破壊的・要 `MCP_ENABLE_WRITES=1`・監査記録) |

✍ = 書き込み系。既定は**無効**(読み取り専用で起動)。`MCP_ENABLE_WRITES=1` で登録される。

## リソース(resources)

参照専用データを resources として公開:

| URI | 内容 |
|---|---|
| `platform://invoices/summary` | 請求件数と状態別集計 |
| `platform://inventory/reorder` | 要発注リスト |

## プロンプト(prompts)

定型プロンプトを prompts として公開:

| 名前 | 用途 |
|---|---|
| `overdue_followup` | 未入金請求の催促メール文面(引数: partner / number / amount) |
| `inventory_reorder_review` | 要発注リストのレビュー |

## 書き込みと認可(安全設計)

- 書き込みツールは既定で**登録されない**。`MCP_ENABLE_WRITES=1` を明示した時だけ有効。
- 実行はすべて**監査ログ**(auditActions.record)に残る。
- ツールにスコープ(`invoice:write`)を付与し、`MCP_API_KEY_SCOPES` で許可スコープを絞れる(既定は read+write 相当。読み取り専用にするなら `MCP_API_KEY_SCOPES=invoice:read`)。
- stdio は「起動できる人=使える人」なので、最終ゲートは環境変数。**リモート公開する場合は API キー認可(authorizeTool)と組み合わせる**設計にしてある。

## Zoho ツールの有効化

Zoho API Console の **Self Client** で発行した認証情報を環境変数に設定します: `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` / `ZOHO_REFRESH_TOKEN`(+ 必要なら `ZOHO_DC`、既定 jp)。起動時に `refreshAccessToken`(@platform/zoho)でアクセストークンを取得し、`createResilientZohoFetch`(サーキットブレーカー+バルクヘッド+タイムアウト)経由で CRM v8 を呼びます。未設定でもサーバは起動し、zoho_* は設定ガイドを返します。

## セキュリティ上の注意

- stdio サーバに**認証はありません**(起動できる人=使える人)。ローカル実行専用とし、リモート公開しないでください。
- 公開しているのは**読み取り系のみ**(作成・更新・削除ツールは意図的に未提供)。書き込みを足す場合は監査ログ(auditActions)記録とセットで。

## 検証

プロトコル(initialize / tools/list / tools/call / isError / stdio 往復)とツール(絞り込み・整形・Zoho 未設定/失敗時の応答)は `pnpm smoke` で回帰検証されています。実クライアント接続の確認は pnpm install 可能な環境で行ってください。
