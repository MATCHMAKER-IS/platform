# 基盤ロードマップ(壁打ち 2026-07 統合版)

ChatGPT との壁打ち(AWS 展開方針+社内 AI/DX プラットフォーム構想)を、現状と突き合わせて**公式の方向性**として整理したもの。設計判断の背景は docs/adr/、AWS の具体は docs/ops/DEPLOY_AWS.md。

## 目指す姿(4層)

```
④ ポータル・運用   Platform Portal / Analytics(初版✅) / ADR✅ / 障害支援
③ AI開発支援       テンプレ✅ / Generator / Advisor / AIレビュー / ドキュメント自動生成
② AI利用基盤       AI Gateway✅ / MCP✅ / RAG / Function Calling / Prompt管理
① Web共通基盤      packages 98(認証・DB・帳票・通知・耐障害…)+ apps 4 ✅
```

「AIチャット基盤」ではなく、**AIを利用する基盤+AIアプリを開発・運用する基盤**の統合体(社内 AI/DX プラットフォーム)。

## 構想 → 現状 対応表

状態: ✅済 / 🔶一部 / ⬜未(Phase欄) / 📋計画のみ

| 構想項目 | 状態 | 対応物 / 方針 |
|---|---|---|
| 認証・認可 | ✅ | @platform/auth・session(移植手順 patterns.md 7章) |
| ログ / 監査ログ | ✅ | logger / audit(+auditActions) |
| AI Gateway | ✅ | **@platform/ai**(ルーティング・予算・コスト・ログ・フォールバック。ADR-0010) |
| MCP | ✅ | @platform/mcp(stdio + **HTTP over Streamable**✅)+ internal-app 10ツール(書込含む) |
| Function Calling | 🔶 | MCP tools✅(resources/prompts/書込/認可)。プロバイダ tool use は @platform/ai 拡張(P2) |
| 画像生成AI | 🔶 | @platform/ai 画像Gateway✅ + **internal-app に実例✅**(/ai-image・モック対応)。Gemini等はプロバイダ追加 |
| RAG | 🔶 | **@platform/rag✅**(chunk/権限継承/文脈整形 + embedding実装[hash/OpenAI] + VectorIndex[memory/pgvector])。pgvector実疎通が残 |
| AIチャット / AIエージェント | ⬜P4 | Gateway+RAG 完成後にアプリとして |
| プロンプト管理 / AIコスト管理 | 🔶 | コスト集計は ai の logStore/totals で開始。管理画面は P3 |
| Workflow / Scheduler / ジョブ | ✅ | workflow / cron / jobs |
| Event Bus | ⬜P2 | 新パッケージ候補(webhook/realtime とは別のアプリ内イベント) |
| Notification / File / 共通マスタ | ✅/🔶 | notify・storage/upload・crud-template(マスタ雛形) |
| モニタリング / デバッグ支援 | ✅/🔶 | observability・status-page / エラー解析AIは P3 |
| テスト基盤 / CI/CD | ✅ | testing・smoke855・preflight・全8WF(AIレビュー段は📋P3) |
| セキュリティ / Secrets | ✅ | security・crypto・guard・secrets・pii |
| 開発テンプレート / サンプル | ✅ | crud-template・equipment-app・demos 26本 |
| Generator 群 | 🔶 | tools/scaffold を核に CRUD/API/Test Generator へ拡張(P3) |
| Package Finder / 重複検出 / Advisor | 🔶 | **tools/advisor.mjs✅**(find/dup/report・Portal統合)。GitHub Issue連携・AIレビューが次 |
| AI向け/人向けドキュメント | ✅ | docs/ai 3点+README+API Reference+ER図+画面/API一覧+**依存グラフ✅**(Portal統合) |
| Platform Portal | 🔶 | **最小版✅**(apps/platform-portal・カタログ/ヘルス/ADR)。Reference/Advisor/Issue連携が次 |
| Platform Analytics | 🔶 | **tools/platform-report.mjs 初版✅**(テスト率91%等)。品質スコア化は P3 |
| ADR | ✅ | docs/adr(6本+テンプレ) |
| Feature Flag | ✅ | @platform/flags(既存) |
| Config Center(GUI設定) | 📋 | internal-app の settings を核に横断化 |
| Data Dictionary | 📋 | schema 60+3 モデルの用語辞書。check-schema 拡張で下地 |
| RAG管理画面(/rag) | 🔶 | **internal-app に実装✅**(検索+登録・権限継承の体感)。pgvector化・ソース取込が残 |
| AI初心者支援(Wizard/Prompt Library) | 📋P3 | テンプレ+patterns.md を素材に |

## フェーズ(現状に合わせて再定義)

- **P1 基盤品質** — ほぼ完了。残: CI 実走(docs/ops/CI_FIRST_RUN.md のチェックリスト消化)
- **P2 AI利用基盤** — ai✅ → RAG(権限継承)/ Event Bus / Function Calling / Prompt管理
- **RPA 安全実行** — @platform/rpa✅(ランナー骨格: 直列化/リトライ/冪等/タイムアウト/監査)。本体は持たず枠組みのみ(API>MCP>RPA)
- **P3 AI開発支援** — Portal✅・Advisor✅・PR自動レビュー✅・**Reference Generator✅**(Portal統合)/ Doc Generator(ER図・画面仕様)が残
- **P4 社内AIアプリ** — チャット/FAQ/文書検索/議事録/要約(Gateway・RAG 上に)
- **P5 デモ/公開** — ブラウザから RAG/MCP/Workflow を試せる環境

## 設計原則(壁打ちから採用・CLAUDE.md 開発ルールに反映済み)

1. AI 呼び出しは AI Gateway 経由のみ(直叩き・キー直書き禁止)
2. **RAG=検索 / MCP=操作** の役割分離。自動化の優先順位は **API > MCP > RPA**
3. RAG は利用者権限を継承(管理者権限での全検索をしない)
4. アプリで再実装しない: 認証・権限・AI Gateway・ログ・通知・Workflow・File(基盤を使う)

## AWS 方針(要約)

Amplify(UI+Route Handler)中心+重い処理のみ Lambda、RDS/S3/SES/CloudWatch/Secrets Manager。**モノレポと packages 構成はそのままで載る**(壁打ち結論)。現行本番経路(ConoHa+Docker)は維持し併存 — 詳細と手順: docs/ops/DEPLOY_AWS.md、判断: ADR-0009。
