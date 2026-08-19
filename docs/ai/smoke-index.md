# smoke のセクション索引（自動生成）

`node tools/gen-smoke-index.mjs` で作り直します。**手で編集しないこと。**

`tools/smoke.mjs` は **24,675 行・534 セクション・約 2,757 件**の検査です。
目的の箇所を探すのに使ってください。

## なぜ 1 ファイルなのか

**依存をインストールせずに実ソースを動かす**のが役目で、そのために
各セクションが自分でスタブを組み立てています（`@platform/core` の最小実装を
その場で書き出す、など）。分割すると **スタブの重複か、共有のための新しい仕組み**が要ります。

分割を考えるのは、**スタブの重複が目に見えて増えた**とき、または
**1 セクションを直すのに周りを読まないと分からない**状態になったときです。

## 一覧

| 行 | セクション | 検査数 |
|---|---|---|
| 299 | validation/japan.ts(実ソース) | 10 |
| 332 | session/salt | 8 |
| 365 | ekyc | 8 |
| 414 | line/webhook | 7 |
| 460 | barcode | 6 |
| 485 | zoom | 9 |
| 515 | input-kind | 7 |
| 540 | validation/transforms.ts(実ソース) | 2 |
| 548 | session/cookie.ts(実ソース) | 3 |
| 559 | security/csrf アルゴリズム | 3 |
| 573 | session 封緘(AES-256-GCM) | 2 |
| 595 | crypto パスワード生成/強度 | 2 |
| 604 | ratelimit 固定ウィンドウ | 1 |
| 614 | db/pagination.ts(実ソース) | 4 |
| 630 | db: seeder / transaction / bulk | 4 |
| 646 | db: 全文検索識別子 / テナント | 7 |
| 667 | db: 監査差分 / クエリキャッシュ(実ソース) | 5 |
| 694 | report / notify / jobs | 4 |
| 719 | print: ESC/POS / pageCss | 4 |
| 732 | receipt chunk / hid | 3 |
| 742 | csv / heatmap color-scale | 4 |
| 754 | charts: candle / band / histogram | 3 |
| 766 | realtime / dashboard layout | 4 |
| 785 | waterfall / gauge / live-buffer | 4 |
| 797 | image geometry | 4 |
| 807 | image: watermark / crop | 5 |
| 819 | image batch | 2 |
| 830 | ocr extraction / progress | 4 |
| 845 | expense flow / field confidence | 2 |
| 856 | receipt batch extract | 1 |
| 864 | monthly / wf-notify / table-query | 4 |
| 877 | xlsx sheets / grid copy | 2 |
| 886 | grid resize/virtual/paste / recipients | 4 |
| 900 | import-validate / col-virtual / recipient-csv | 3 |
| 916 | error-filter / diff / column-prefs | 4 |
| 931 | import summary/history / prefs-store | 3 |
| 945 | partial-save / rollback / presets | 3 |
| 958 | ocr-plus / rollback-perm / preset-default | 9 |
| 994 | tax-breakdown / confidence-tier / ocr-feedback | 3 |
| 1007 | tax-2line / conf-profile / feedback-agg / i18n | 4 |
| 1024 | i18n keys / merge / locale-store | 2 |
| 1035 | i18n namespaced domains | 1 |
| 1045 | report-locale / grid-format | 2 |
| 1057 | invoice-locale / split-catalog | 2 |
| 1068 | statcard i18n format | 3 |
| 1080 | strings util | 15 |
| 1123 | strings util +extra | 7 |
| 1137 | highlightTerms | 3 |
| 1147 | log parse/filter | 4 |
| 1159 | log timeline/regex/relative | 4 |
| 1174 | structured log / jump | 4 |
| 1187 | log facets/fields/stream | 5 |
| 1209 | numbers util | 8 |
| 1224 | numbers series/dist | 5 |
| 1237 | outliers / chart-data | 4 |
| 1252 | candle-data | 8 |
| 1307 | regression / trend | 3 |
| 1317 | input-kind | 8 |
| 1348 | scatter-data | 10 |
| 1396 | correlation | 4 |
| 1406 | regression band | 3 |
| 1418 | decompose / rows->series | 4 |
| 1432 | autocorrelation | 5 |
| 1444 | datetime calendar | 14 |
| 1483 | datetime range/wareki/relative | 5 |
| 1498 | datetime time/duration | 6 |
| 1511 | app: expense aggregation | 2 |
| 1522 | app: expense CSV import | 2 |
| 1533 | app: approval flow | 1 |
| 1544 | app: monthly report | 2 |
| 1555 | app: xlsx export | 1 |
| 1564 | app: prisma mapping | 1 |
| 1575 | app: approval persistence | 2 |
| 1586 | fs utilities | 3 |
| 1603 | app: approval notification | 3 |
| 1623 | mail / phone / sms utils | 7 |
| 1646 | app: import history / audit | 4 |
| 1660 | phone intl / notify channels | 4 |
| 1677 | app: attendance | 5 |
| 1691 | app: attendance monthly | 3 |
| 1706 | app: overtime wf / attendance xlsx | 2 |
| 1717 | phone intl type / line client | 7 |
| 1771 | net utilities + sockets | 5 |
| 1802 | net: ws/sse/poll/udp | 5 |
| 1826 | color / similarity / magic / fsm | 5 |
| 1843 | jp-number / postal / currency / units | 57 |
| 2077 | zoho crm / books | 7 |
| 2155 | zoho desk/inventory/campaigns/projects/people | 6 |
| 2191 | zoho sign/recruit/workdrive/analytics | 5 |
| 2230 | zoho cliq/creator/bookings + desk拡張 | 5 |
| 2269 | multipart / token-refresh / zoho-login | 11 |
| 2348 | slack / notion | 5 |
| 2401 | integrations: extended | 12 |
| 2509 | microsoft (Entra ID / Graph) | 4 |
| 2552 | password migration | 3 |
| 2583 | ui: grid (spreadsheet) | 10 |
| 2632 | ui: table query & selection | 22 |
| 2740 | ui: format & chart data | 7 |
| 2785 | ui: button sizing | 3 |
| 2803 | theme: colored sidebar | 5 |
| 2839 | ui: import validation | 12 |
| 2896 | pwa | 10 |
| 2948 | oidc id token | 10 |
| 2988 | access review | 7 |
| 3034 | password reset | 6 |
| 3072 | rbac / authorization | 15 |
| 3129 | observability | 5 |
| 3150 | dependency boundaries | 1 |
| 3160 | circuit-breaker / outbox | 5 |
| 3184 | cache stampede / swr | 1 |
| 3204 | resilient zoho fetch | 2 |
| 3245 | logger correlation | 3 |
| 3261 | cron reliability | 4 |
| 3287 | api instrumentation (all shapes) | 2 |
| 3327 | notify resilience | 4 |
| 3354 | storage resilience | 3 |
| 3378 | sms/mail resilience | 3 |
| 3408 | search bm25 / redis / ws queue | 4 |
| 3463 | cache redis / db retry / jobs retry | 3 |
| 3499 | cache redis / db tx-retry / jobs | 5 |
| 3564 | reliable expense notifications | 2 |
| 3620 | notify relay scheduler | 2 |
| 3662 | production stores / lifecycle / secrets | 6 |
| 3735 | otlp exporter / alerting | 2 |
| 3764 | feature flags / pii | 15 |
| 3837 | broadcast hub (horizontal scale) | 2 |
| 3859 | error policy / bulkhead / process guards | 24 |
| 4057 | error control: policy / bulkhead / guard / envelope | 16 |
| 4148 | tax / importer / sequence | 8 |
| 4182 | webhook / apikey / zengin | 8 |
| 4227 | utils: function / object / array / async | 7 |
| 4256 | line: builders / webhook / client | 14 |
| 4419 | freee: token / receipts / journal | 4 |
| 4488 | freee: HR / approval / webhook | 4 |
| 4551 | google: oauth / gmail / drive / calendar | 9 |
| 4673 | status-page: templates / gate | 7 |
| 4707 | session: idle timeout / idle timer / login throttle | 11 |
| 4810 | identity: document validation / masking | 5 |
| 4829 | ekyc: status / webhook / client | 6 |
| 4883 | ekyc: client / webhook / status | 4 |
| 4935 | ui: tree / kanban logic | 4 |
| 4950 | ui: schedule layout | 10 |
| 4983 | workflow: routing / delegation / parallel | 6 |
| 5026 | withholding / business documents | 4 |
| 5049 | notify: preferences | 3 |
| 5072 | mail: template / allowlist | 9 |
| 5143 | otp / sms otp message | 13 |
| 5191 | two-factor / webauthn | 6 |
| 5237 | mobile: responsive / network / orientation | 7 |
| 5280 | payroll: worktime / premium / payslip | 18 |
| 5386 | dencho: hash-chain / search / timestamp / retention | 5 |
| 5417 | report: print / pdf-prep | 4 |
| 5445 | form: dynamic fields / steps | 4 |
| 5477 | pii: subject rights (disclosure / erasure) | 7 |
| 5536 | screens: submit-flow / review / list-selection | 3 |
| 5578 | dashboard: shares / donut / goal / funnel / relative-time | 5 |
| 5598 | commerce: cart / favorites / discount / order-summary / inventory | 5 |
| 5652 | blog: slug / excerpt / reading-time / toc / post / feed | 5 |
| 5724 | seo: meta / open-graph / json-ld / robots | 4 |
| 5767 | commerce+: variant / review / order-status / points / shipping | 5 |
| 5799 | blog+: comment / navigation | 2 |
| 5827 | site: blocks / navigation / redirects / announcement | 4 |
| 5862 | seo: visibility (internal noindex / public index) | 3 |
| 5890 | blog: permalink (URL structure) | 2 |
| 5916 | url: parse / domain / query / normalize / validate | 5 |
| 5963 | social: handle / parse / embed / accounts | 4 |
| 6015 | booking: hours / slots / availability / rules / status | 7 |
| 6083 | booking-reminders / social-feed / cast | 4 |
| 6135 | booking-shift / cast-ranking | 2 |
| 6177 | ui: social-login lib | 1 |
| 6190 | ui: login-form validation | 1 |
| 6205 | ui: nav lib (layout) | 1 |
| 6222 | site-breadcrumbFromPath / ui-theme | 2 |
| 6247 | ui: themeInitScript | 1 |
| 6262 | ui: notifications lib | 1 |
| 6279 | ui: command-palette / notification-store | 2 |
| 6312 | ui: clipboard / shortcut | 2 |
| 6339 | ui: clipboard / shortcut | 2 |
| 6366 | form: errors | 1 |
| 6383 | ui: filterNavByPermission (RBAC) | 1 |
| 6399 | invoice (billing) | 1 |
| 6448 | invoice-reconcile / quote | 2 |
| 6496 | invoice-recurring / dunning / purchase | 2 |
| 6547 | inventory | 1 |
| 6572 | accounting / inventory-lot-warehouse | 2 |
| 6615 | accounting-closing / tax-report | 1 |
| 6640 | accounting-export | 1 |
| 6663 | blueprint / expense-journal | 3 |
| 6721 | blueprint-workflow integration | 1 |
| 6768 | audit / report-integration | 2 |
| 6806 | audit-wired expense trail | 1 |
| 6831 | accounting-payroll / department / sync | 1 |
| 6859 | payslip-html / sync-job | 1 |
| 6905 | storage: ファイル操作(コピー・移動・整理) | 9 |
| 7005 | db: 踏み台(bastion)経由の接続 | 6 |
| 7055 | http: ページング | 8 |
| 7110 | cache: タグによる無効化 | 4 |
| 7178 | csv: 取り込み(文字コード・型変換・エラー行) | 7 |
| 7237 | purchase: 三点照合(発注・入荷・請求) | 6 |
| 7294 | quote: 値引き・改訂・粗利 | 8 |
| 7363 | contract: 内部通報(公益通報者保護法) | 5 |
| 7410 | tax: 印紙税(収入印紙) | 6 |
| 7445 | contract: 下請法(下請代金支払遅延等防止法) | 6 |
| 7480 | attendance: 健康診断(労働安全衛生法) | 5 |
| 7525 | attendance: 法定三帳簿(労働者名簿・賃金台帳・出勤簿) | 6 |
| 7567 | attendance: ストレスチェック(労働安全衛生法) | 5 |
| 7612 | depreciation: 償却資産税(固定資産税) | 6 |
| 7646 | attendance: 時間外労働の上限規制(36協定) | 6 |
| 7694 | attendance-import / payslip-batch | 2 |
| 7737 | platform-authz / notify-channels / readiness | 0 |
| 7742 | auth | 3 |
| 7801 | chat / board(実ソース) | 4 |
| 7873 | demos: chat-room(realtime配信) / board-threads | 2 |
| 7908 | chat: 添付 / gateway / メンション通知(実ソース) | 0 |
| 7926 | notify | 5 |
| 7987 | chat: 既読ストア / 掲示板通知 / クライアント制御(実ソース) | 3 |
| 8082 | chat: Prisma store / ルーム / プレゼンス / タイピング(実ソース) | 0 |
| 8101 | realtime | 4 |
| 8200 | chat: 全文検索 / 編集削除 / ダイジェスト(実ソース) | 1 |
| 8230 | notify | 3 |
| 8327 | chat: リアクション / ハイライト / サムネイル(実ソース) | 3 |
| 8416 | chat: ピン・ブックマーク / メンション未読 / リアクション永続化(実ソース) | 4 |
| 8527 | chat: ピン/ブックマーク Prisma 実装(実ソース) | 1 |
| 8583 | platform: 通知センター / ファイル管理 / 監査ログ(実ソース) | 0 |
| 8594 | audit | 5 |
| 8715 | platform: 通知配信設定 / 監査アクション記録(実ソース) | 2 |
| 8796 | platform: 監査ログ CSV エクスポート(実ソース) | 1 |
| 8833 | platform: 監査ログ Prisma 永続化 / 業務操作記録(実ソース) | 1 |
| 8906 | platform: アクセス解析 / 負荷テスト / 監査詳細・ダッシュボード設定(実ソース) | 0 |
| 8915 | analytics | 4 |
| 9007 | platform: HTMLヘルパー / 負荷シナリオ / 監査deepDiff+関連 / 計測ビーコン(実ソース) | 5 |
| 9090 | audit | 6 |
| 9161 | platform: 公開サイト基盤(描画/SEO) + linkify適用(実ソース) | 2 |
| 9253 | platform: sitemap/favicon/embed/banner/copyright/category/share/motion(実ソース) | 0 |
| 9262 | seo | 80 |
| 10348 | platform: 公開サイト ブログ記事/カテゴリ/バナー/横断検索(実ソース) | 1 |
| 10429 | platform: blog関連・前後・タグ / RSS・Atom / CMS記事CRUD(実ソース) | 0 |
| 10440 | seo | 4 |
| 10515 | platform: 予約残り時間 / gallery・embed描画 / プレビュー(実ソース) | 3 |
| 10622 | platform: 固定ページ/お知らせ 管理ストア + プレビューURL(実ソース) | 0 |
| 10633 | cms | 3 |
| 10694 | platform: カテゴリ管理 / タグ一括操作 / 固定ページ反映(実ソース) | 3 |
| 10759 | platform: ダッシュボード集計(summarizePosts/recentPosts) + D&D moveItem(実ソース) | 2 |
| 10807 | platform: 記事フィルタ + 監査 cms.* 抽出(実ソース) | 1 |
| 10844 | audit | 1 |
| 10864 | platform: isPublishAction / リビジョン / 公開申請(実ソース) | 3 |
| 10934 | platform: 記事差分 + 在庫リポジトリ(実ソース) | 2 |
| 11007 | platform: 在庫詳細 + 発注ドラフト + 請求書(実ソース) | 0 |
| 11016 | tax | 4 |
| 11140 | platform: 売掛 + 見積変換 + 発注入荷(実ソース) | 5 |
| 11274 | platform: 繰返請求 + 勤怠 + 会計連携(実ソース) | 0 |
| 11284 | datetime | 3 |
| 11420 | platform: 勤怠承認 + 給与 + freee + PDF(実ソース) | 0 |
| 11430 | core | 4 |
| 11537 | platform: 買掛金 + 源泉徴収 + ダッシュボード(実ソース) | 3 |
| 11614 | platform: 月次決算 + 消費税 + アラート(実ソース) | 0 |
| 11624 | accounting | 3 |
| 11679 | platform: 固定資産 + 予算実績 + 取引先(実ソース) | 4 |
| 11758 | platform: 月次推移 + 取引先カルテ + 減価償却連携(実ソース) | 3 |
| 11833 | platform: 部門別会計 + 資金繰り + 入金記録(実ソース) | 4 |
| 11906 | platform: 取引先残高 + 年次決算 + メール配信(実ソース) | 0 |
| 11916 | core | 3 |
| 11982 | platform: 仕訳帳CSV + 多段承認 + 締めロック(実ソース) | 5 |
| 12087 | platform: 勘定元帳 + CSV I/O + 固定資産処分 + 承認listByType(実ソース) | 0 |
| 12096 | core | 4 |
| 12183 | platform: 受信箱 + 比較決算 + 手動仕訳CSV(実ソース) | 6 |
| 12283 | platform: 科目マスタ + 年次推移 + お問い合わせ + チャットボット(実ソース) | 6 |
| 12360 | platform: チャットボットescalate + ユーザー権限ディレクトリ(実ソース) | 6 |
| 12440 | platform: 管理コンソール(周知/設定/監査集計/権限/ヘルス) | 0 |
| 12448 | auth | 5 |
| 12492 | platform: 結合(E2E) 受注→請求→入金→決算→周知 + 会計年度 | 5 |
| 12560 | platform: 会計年度ヘルパ(fiscal) | 3 |
| 12585 | platform: 監査アラート(異常検知) + 既定税率適用 | 5 |
| 12623 | platform: アンケート + アラート通知(重複抑制/多チャネル) + i18n | 2 |
| 12651 | notify | 3 |
| 12688 | platform: アンケート拡張(対象者/匿名/締切/CSV) + 口コミ + サイン | 7 |
| 12757 | platform: 口コミモデレーション + 未回答リマインド + サイン×承認 | 4 |
| 12810 | platform: 機能アクセス制御 + サイン必須ルール + リマインド締切抽出 | 4 |
| 12849 | platform: action粒度 + 設定変更履歴 + 利用状況 + 送信Webhook | 4 |
| 12891 | platform: saga(補償Tx) + APIキー(サービスアカウント) + PIIマスキング | 0 |
| 12899 | saga | 4 |
| 12953 | platform: secrets + flags + ratelimit | 5 |
| 13021 | platform: APIリファレンス + 統合ステータス + 初期セットアップ | 3 |
| 13058 | platform: ダイジェスト頻度 + 横断全文検索 + 統合バックアップ | 0 |
| 13067 | core | 4 |
| 13114 | platform: 復元 + 検索インデックス永続化 + 監査アーカイブ | 3 |
| 13185 | platform: CSV取込(商品/勘定科目) + 通知テンプレート + ウィジェット拡張 | 3 |
| 13228 | platform: 通知テンプレ上書き + エクスポート予約 + レポート生成 | 3 |
| 13276 | platform: レポート配信スケジュール + ダッシュボードトレンド | 5 |
| 13328 | platform: レポート絞り込み + 配信先解決 + 期間レンジ | 3 |
| 13364 | platform: 支出トレンド + レポートプリセット + 配信ログ | 3 |
| 13407 | platform: 見直し修正(filterLabel / ID採番閉包化) | 2 |
| 13436 | crud-template: 入力検証 + 品目ストア | 2 |
| 13464 | mcp: JSON-RPC/initialize/tools + internal-app ツール8種 | 0 |
| 13469 | mcp | 15 |
| 13574 | ai: AI Gateway + プロバイダ実装 | 83 |
| 14218 | mcp拡張: resources/prompts/書き込み/認可 | 0 |
| 14223 | mcp | 3 |
| 14265 | rag: チャンク/権限継承/embedding/文脈 | 9 |
| 14380 | internal-app: AI Gateway 配線 | 2 |
| 14412 | ai/rag: embedding + VectorIndex | 0 |
| 14427 | rag | 4 |
| 14482 | advisor: find / duplicates | 3 |
| 14499 | csv: streamCsvLines / parseCsvChunks | 3 |
| 14538 | internal-app: RAG サービス配線 | 1 |
| 14588 | mcp: handleHttpMcp / extractBearerToken | 0 |
| 14592 | mcp | 4 |
| 14629 | rag: ソース取り込みヘルパー | 4 |
| 14672 | reference: API Reference 生成 | 1 |
| 14685 | ai: AI Image Gateway | 2 |
| 14728 | erd: gen-erd (Prisma→Mermaid) | 2 |
| 14748 | cron: file lock | 0 |
| 14755 | cron | 4 |
| 14797 | app-map: gen-app-map | 3 |
| 14820 | internal-app: 画像ゲートウェイ配線 | 1 |
| 14851 | rpa: createRpaRunner | 4 |
| 14925 | security: ReplayGuard | 0 |
| 14929 | security | 2 |
| 14958 | internal-app: RPA ランナー配線 | 2 |
| 15010 | depgraph: gen-depgraph | 1 |
| 15022 | utils: replaceByDictionary / buildGlossaryHint | 2 |
| 15047 | scripts: Windows setup 静的検証 | 9 |
| 15107 | internal-app: 辞書補正 → RAG 投入 | 0 |
| 15118 | search | 4 |
| 15169 | os-notify: createOsNotifier | 3 |
| 15214 | internal-app: DB Viewer | 7 |
| 15301 | ui: motion 拡充 | 0 |
| 15309 | ui | 6 |
| 15341 | ci-log-report: CI ログ解析 | 3 |
| 15369 | rag search: 辞書補正の可視化 | 2 |
| 15381 | elearning: gradeQuiz / courseProgress / certificate | 3 |
| 15426 | internal-app: e-learning | 2 |
| 15462 | dictionary-store: 辞書のDB永続化 | 3 |
| 15515 | theme: スキン機構 | 0 |
| 15523 | color | 19 |
| 15648 | internal-app: 辞書 CSV 入出力 + 監査 | 6 |
| 15718 | internal-app: 組織デフォルトテーマ + カスタムテーマ | 0 |
| 15733 | core | 11 |
| 15798 | gen-ref-site: リファレンスサイト | 6 |
| 15829 | tooling: 便利コマンド | 7 |
| 15858 | ui: AppSkin + 全アプリ適用 | 0 |
| 15861 | ui | 4 |
| 15893 | CI: doctor統合 + Pages公開 | 3 |
| 15907 | apps/demos: 最新機能の活用 | 6 |
| 15945 | env: 説明生成 / マスキング / 必須検証 | 6 |
| 16026 | internal-app: serverEnv の環境別挙動 | 6 |
| 16119 | 設定: env 統一 / 残骸検出 / 確認画面 | 5 |
| 16210 | ui | 1 |
| 16220 | docs: アプリ・デモ紹介の数値 | 3 |
| 16258 | AI開発アシスト: カタログMCP / 資料の鮮度 | 15 |
| 16362 | env: 秘密値の強度チェック | 0 |
| 16370 | env | 5 |
| 16409 | 開発ポート / デモ検索 / 設計ルール | 7 |
| 16478 | 基盤の版管理 / 同期 / 構成規約 | 7 |
| 16527 | docs: 導入ガイドの正確さ | 6 |
| 16575 | docs: Git ガイド / 参照の健全性 | 8 |
| 16617 | docs: テンプレート / 索引 / Cursor | 12 |
| 16672 | docs: 役割分担 / オンボーディング / 重複整理 | 10 |
| 16718 | test: 負荷テスト / ガイド / 重複検出 | 13 |
| 16799 | perf: 負荷シナリオ / 基準 / E2E品質 / DevTools | 10 |
| 16866 | ops: ダッシュボード / 障害対応 / デバッグ設定 | 8 |
| 16909 | debug: Platform Debugger | 0 |
| 16914 | debug | 12 |
| 16989 | ops: アラート通知 / Debugバー | 10 |
| 17043 | task: タスク/プロジェクト管理 | 0 |
| 17048 | core | 8 |
| 17111 | rules: apps 側の開発規約 | 14 |
| 17175 | internal-app: タスク管理 | 10 |
| 17255 | docs: TSDoc の網羅性 | 6 |
| 17306 | docs: リファレンスに引数/戻り値を出力 | 9 |
| 17355 | docs: TSDoc 改善 / DB 方針の整合 | 3 |
| 17375 | datetime | 5 |
| 17408 | faq: 社内FAQ | 8 |
| 17458 | contract: 契約管理 | 9 |
| 17523 | internal-app: FAQ 画面 | 10 |
| 17582 | internal-app: 契約画面 | 8 |
| 17646 | demo: workplace-ops(タスク/契約/FAQ の横断) | 6 |
| 17706 | 統合デモサイト | 13 |
| 17806 | ビルド設定: tsconfig がテストを除外しているか | 1 |
| 17828 | パッケージのエントリ: ソース直指しで統一されているか | 2 |
| 17869 | パッケージの index: 名前の重複が無いか | 1 |
| 17904 | React:  | 2 |
| 17965 | web-storage: localStorage / sessionStorage | 13 |
| 18042 | session: 強制ログアウト・締め出し | 12 |
| 18105 | ui/lib: table(検索・ソート・ページング・選択) | 11 |
| 18159 | ui/lib: formatBytes(容量表示) | 5 |
| 18173 | ui/lib: grid(範囲選択・仮想化・TSV) | 13 |
| 18222 | drill: 復元訓練の手順 | 8 |
| 18267 | prisma: 廃止済みオプションを渡していないか | 4 |
| 18347 | docker-compose: 既定で起動するもの / 版の固定 | 6 |
| 18403 | 改行コード: LF に固定されているか | 4 |
| 18442 | JSX: コメントを要素の外に置いていないか | 1 |
| 18480 | package.json: Windows で動かないコマンドを使っていないか | 4 |
| 18536 | 型宣言: .d.ts が /// <reference> されているか | 2 |
| 18598 | eslint: TypeScript を対象にしているか | 8 |
| 18671 | env: 検証エラーが項目名を出すか | 1 |
| 18689 | middleware: Next 16 の proxy.ts が残っていないか | 2 |
| 18745 | db: Prisma クライアントの実体がアプリのものか | 4 |
| 18801 | prisma: 対象アプリの一覧が 3 か所で揃っているか | 1 |
| 18836 | CSP: Next のインライン script を通す nonce があるか | 4 |
| 18886 | Tailwind: @platform/ui を使うアプリに設定があるか | 1 |
| 18952 | seed: 本番で流れない守りがあるか | 15 |
| 19249 | 生成物: 消えたアプリの残骸が無いか | 1 |
| 19287 | 道具: アプリ名を手で並べていないか | 1 |
| 19324 | 正規表現: 破滅的バックトラックが無いか | 1 |
| 19375 | 秘密値: 定数時間で比較しているか | 3 |
| 19429 | 画面: client に対する入口(page.tsx)があるか | 2 |
| 19518 | Button: 選択状態を variant で表しているか | 2 |
| 19599 | ログイン: 総当たりへの備えがあるか | 30 |
| 19722 | ログイン画面: 画面まわりを出していないか | 4 |
| 19762 | React: client に <script> を置いていないか | 1 |
| 19801 | API: 操作の種類を先に確かめているか | 3 |
| 19849 | API: 所有者判定にサーバの記録を使っているか | 10 |
| 19910 | E2E: 設定が実在するアプリを指しているか | 9 |
| 19999 | UI: 存在する variant を指定しているか | 1 |
| 20057 | API: 空のボディで落ちないか | 1 |
| 20089 | db reset: 誤って流れない守りがあるか | 6 |
| 20119 | Service Worker: 開発では登録しないか | 1 |
| 20155 | レイアウト: ナビと本文が別々にスクロールするか | 8 |
| 20193 | XSS: 利用者の入力を HTML として流していないか | 3 |
| 20257 | ファイル: 取り出しの守り | 5 |
| 20281 | 仮実装: 固定値が残っていないか | 3 |
| 20329 | レイアウト: 画面の枠が揃っているか | 7 |
| 20414 | ナビ: 全画面に導線があるか | 2 |
| 20477 | 認可: 書き込みを read 権限で通していないか | 2 |
| 20531 | 同時実行: 二重登録を防いでいるか | 5 |
| 20560 | 日付: JST で判定しているか | 2 |
| 20604 | 金額: 丸めの規則が正しいか | 4 |
| 20636 | 外部連携: 時間を切っているか | 3 |
| 20653 | ファイル: アップロードの守り | 3 |
| 20671 | ログ: 秘密がマスクされるか | 3 |
| 20724 | README: 実在するパスを指しているか | 1 |
| 20768 | 性能: 一覧に件数の上限があるか | 4 |
| 20794 | 配色: 色をハードコードしていないか | 1 |
| 20847 | 操作: キーボードで押せるか | 1 |
| 20885 | エラー表示: 読み込み中で止まらないか | 4 |
| 20933 | 検査自体: 対象が狭すぎないか | 13 |
| 21061 | 復元訓練: 中身まで確かめているか | 12 |
| 21114 | UX: 押下後の反応と確認 | 8 |
| 21192 | UX: 空状態と書きかけ | 2 |
| 21239 | 基盤: 使うと決めた部品を使っているか | 4 |
| 21338 | 雛形: そのまま業務で使える形か | 18 |
| 21457 | 新規アプリ: 作る道具があるか | 9 |
| 21490 | 自動化: 資料の数値を自分で直すか | 6 |
| 21521 | 重複: 同名の実装に使い分けが書いてあるか | 4 |
| 21561 | Markdown: 危ない入力を弾くか | 10 |
| 21634 | 暗号: 実際に暗号化して確かめる | 12 |
| 21717 | 認可: 実際のポリシーで権限を確かめる | 9 |
| 21788 | 会計: 貸借が一致するか | 6 |
| 21845 | 給与: 割増が法定を満たすか | 13 |
| 21884 | 社会保険: 天引きする額が合うか | 14 |
| 21933 | 源泉徴収: 税額表を正しく引くか | 11 |
| 21981 | 埋め込み: iframe を絞っているか | 17 |
| 22078 | Cookie: セッションの属性が揃っているか | 9 |
| 22123 | API: 条件付きリクエストと冪等キー | 28 |
| 22283 | エラー応答: 出すものと隠すもの | 8 |
| 22343 | 一覧: ページングと並び替え | 8 |
| 22404 | Webhook: 署名と時刻を確かめるか | 21 |
| 22525 | SQL: 危ない文を見分けるか | 12 |
| 22596 | DB: 増え続けるテーブルに索引があるか | 10 |
| 22671 | シード: 本番で流れない守りがあるか | 6 |
| 22705 | 保持期間: 増え続ける記録を消すか | 13 |
| 22781 | 横断: 外部への通信がすべて守られているか | 2 |
| 22829 | 宣言と実装: 書いた守りが入っているか | 3 |
| 22911 | 個人情報: 開示・削除請求が画面まで繋がっている | 10 |
| 22955 | 契約: 印紙税が画面まで繋がっている | 6 |
| 22983 | 固定資産: 償却資産税が画面まで繋がっている | 5 |
| 23007 | 買掛: 下請法の確認が画面まで繋がっている | 6 |
| 23036 | メール: 取引先向けの配信停止と誤送信防止 | 9 |
| 23065 | アンケート督促: 通知設定を尊重し、1件ずつ送る | 3 |
| 23082 | チャット: メンション通知に push チャネルを追加 | 4 |
| 23100 | 給与: 明細の一括 PDF 生成 | 7 |
| 23134 | 給与: 社会保険料の自動計算 | 6 |
| 23164 | 予約: リマインダーが push で届く | 4 |
| 23186 | sendback: 文書承認画面にも配線(PromptDialogを使用) | 4 |
| 23211 | sendback: 文書承認画面にも配線(PromptDialog使用) | 3 |
| 23231 | sendback: API層と画面まで配線(勤怠承認は完了・文書承認は次回) | 4 |
| 23256 | 承認ワークフロー: sendback(差し戻し)の機能欠落を修正 | 6 |
| 23280 | 3回目のtypecheck.log: import漏れ・useStateの完全欠落・Prisma7問題 | 8 |
| 23324 | 2回目のtypecheck.log: @types/nodeは推移的依存にも必要だった | 3 |
| 23351 | typecheck.log からの発見: gen-portal-extras・markdown.tsx・@types/node | 6 |
| 23387 | HANDOVERの「残っている確認」3箇所すべてに対応(Blob/BlobPart) | 2 |
| 23414 | packages/line・slack: fetch body の Uint8Array→BodyInit 不一致を修正 | 3 |
| 23439 | packages/mail: 添付content(Uint8Array→Buffer)の型不一致を修正 | 3 |
| 23458 | 運用目線: business-metricsの「0が異常なしか未計測か」を区別 | 3 |
| 23473 | テスト目線: 重大バグを発見したファイルにユニットテストを追加 | 2 |
| 23494 | セキュリティ横断点検: 全249 route.ts の withApiObservability 通過確認 | 2 |
| 23533 | line-console: 認証・死活監視・ガード欠落を発見(累計5+件) | 6 |
| 23579 | 全249 route.ts + lib + 基盤パッケージの一括型検査: 大規模な発見の総括 | 8 |
| 23620 | 全249個のroute.ts一括型検査: 10種の型欠落 + 2つの実バグを発見 | 8 |
| 23672 | CMS公開承認通知: 幽霊ユーザー宛の通知を発見・修正 | 2 |
| 23689 | mailer.sendMail 全点検: 5箇所の配列宛先漏洩を発見 | 2 |
| 23715 | 経費承認通知: decideDelivery を統合(3経路目) | 6 |
| 23737 | 経費承認通知: Outboxの粒度を1宛先=1エントリに再設計 | 3 |
| 23751 | 経費承認通知: Outboxのプロトコルを変えずに1宛先=1エントリへ分解 | 3 |
| 23765 | パッケージ棚卸し: stripe理由明記 + smsのtier昇格漏れを発見 | 2 |
| 23782 | UserRow: passwordSetAt/totpEnabledAt/sessionsRevokedAt を DateTime に移行 | 5 |
| 23798 | AttendanceApprovalRow: submittedAt を DateTime に移行 + 同種の問題を発見 | 4 |
| 23818 | doc-approval-repo: メモリ実装のnullチェック順序と死んだ分岐を修正 | 2 |
| 23841 | DocApprovalRow: submittedAt を DateTime に移行 + submittedBy欠落を発見 | 6 |
| 23860 | as unknown as キャストの全点検: audit-log.ts で2件目の型不整合を発見 | 2 |
| 23880 | ManualJournalRow.date: DateTime に移行 + 型不整合を発見 | 5 |
| 23899 | FeePaymentRow.paidAt: DateTime に移行(baseは意図的に維持) | 4 |
| 23915 | PurchasePaymentRow.paidAt: DateTime に移行 | 3 |
| 23926 | ReportScheduleRow.lastSentAt: DateTime に移行 | 3 |
| 23937 | ExportScheduleRow.lastRunAt: DateTime に移行 | 3 |
| 23950 | MailboxRow.sentAt: DateTime に移行 | 3 |
| 23963 | SecretRow.updatedAt: DateTime に移行 | 3 |
| 23974 | ServiceAccountRow.lastUsedAt: 未接続を解消(markUsed を配線) | 3 |
| 23990 | ServiceAccountRow: createdAt / lastUsedAt を DateTime に移行 | 2 |
| 24000 | WebhookSubscriptionRow.createdAt: DateTime に移行 | 3 |
| 24011 | SignatureRow.signedAt: DateTime に移行 | 3 |
| 24022 | InquiryRow.createdAt: DateTime に移行 | 3 |
| 24033 | LendingRow.lentAt: DateTime に移行(returnedAt は意図的に維持) | 3 |
| 24048 | SurveyResponseRow.submittedAt: DateTime に移行 | 3 |
| 24059 | SurveyRow: closesAt / createdAt を DateTime に移行 | 3 |
| 24072 | ReviewRow.createdAt: DateTime に移行 | 3 |
| 24083 | UserRow.createdAt: DateTime に移行 | 4 |
| 24101 | InvoiceReceiptRow: 日時を DateTime に移行 | 3 |
| 24113 | purchase-orders/receipts: 認可欠落を修正 | 2 |
| 24127 | 予約: DB 化しても二重予約が起きない | 5 |
| 24168 | アップロード: EXIF(撮影情報・位置情報)を除去する | 4 |
| 24189 | RAG: 取り込み前に除外文書を弾く | 2 |
| 24206 | RAG: 検索結果を AI で質問に答える | 4 |
| 24229 | AI ガバナンス: 判断と実行の記録が見える | 7 |
| 24266 | 入力検証: 未検証 API がゼロになった | 5 |
| 24296 | SMS-OTP: TOTP 未設定者の代替 2FA | 11 |
| 24340 | Push: AI 承認キューへの通知 | 7 |
| 24373 | AI 承認キュー: 提案 → 人間承認 → 実行 | 6 |
| 24403 | MCP: HTTP 版が繋がっている | 3 |
| 24422 | 勤怠: 36 協定の上限が画面まで繋がっている | 5 |
| 24447 | 通信: 更新系は submitJson を通す | 4 |
| 24490 | 金額: Int で持ち、入口で整数に絞る | 4 |
| 24524 | 依存: 版が揃っているか | 8 |
