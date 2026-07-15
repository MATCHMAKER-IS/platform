# 外部ソースの取り込み判断記録

社内 GitHub の既存リポジトリから、基盤に取り込める汎用部品を精査した記録。**重複機能は取り込まない**方針。判断の再現性のために残す。

## 対象

| リポジトリ | 性質 |
|---|---|
| Company-wide-data | 業務データ + 一回性の分析スクリプト(feedback/survey 分析の js/py・財務/市場分析 md) |
| zoho-emergency-backup | Zoho CRM の一括編集/バックアップツール(React + Amplify + 大容量 CSV import/export) |

## 取り込んだもの(1件)

### CSV ストリーミング/チャンク処理 → `@platform/csv`
- 出典: zoho-emergency-backup `src/lib/csv.ts`(500MB〜1GB 級 CSV をメモリ全展開せず処理)
- 既存の `@platform/csv` は**同期の `parseCsv(text)` のみ**でストリーミングが無かった → **重複せず補完**
- 取り込み方針: 元は `File` + Papaparse(ブラウザ専用)依存だったため、**環境非依存に一般化**して追加:
  - `streamCsvLines(source, options, onChunk)`: `AsyncIterable<string>`(ファイル/ネットワーク)をチャンク処理。メモリは最大 chunkSize 行のみ
  - `parseCsvChunks(text, options, onChunk)`: テキスト全体(埋め込み改行対応)を下流処理向けにチャンク化
- Papaparse/File/S3 への依存は持ち込まない(基盤の依存ゼロ方針を維持)。スモークで回帰込み検証済み

## 取り込まなかったもの(重複・固有依存のため)

| 候補 | 判断 | 理由 |
|---|---|---|
| zoho `lib/storage.ts` | 見送り | Amplify Storage(S3)に密結合。基盤は `@platform/storage` の adapter で吸収する設計 |
| zoho `lib/db.ts` | 見送り | Dexie(IndexedDB)固有。基盤のストア抽象と役割重複 |
| zoho `retryFailedEdits` / `resumeDeletions` | 見送り | アプリ DB(externalId/importBatch)に固有。汎用リトライは `@platform/jobs`(attempts/backoff)・`@platform/saga` が既にカバー |
| zoho `importService` / `deleteService` | 見送り | Zoho モジュール構成に固有。検証は `@platform/importer`(validateRows/ImportResult)が既にカバー |
| zoho `features/form` / `features/grid`(React) | 見送り | AG Grid・Amplify Data に密結合のアプリ UI。汎用 UI は `@platform/ui`/`form`/`report` |
| zoho `amplify/`(backend/auth/data) | 参考のみ | 基盤の AWS 方針(docs/ops/DEPLOY_AWS.md)と重複。既存 amplify.yml で足りる |
| Company-wide `analyze_*.js` / `*.py` | 見送り | 特定データセット用の一回性スクリプト。再利用可能な部品ではない |
| Company-wide 各種 md/xlsx | 対象外 | 業務データ・分析成果物(コードではない) |

## 参考: zoho-emergency-backup から学べた設計(取り込みではなく知見)

- 大容量 CSV は「ヘッダ先読み → チャンク処理 → 進捗コールバック」が定石(→ streamCsvLines に反映)
- 削除/編集の**冪等な再開**(タブが閉じても続行)は良い設計。基盤では `@platform/saga`(補償付き)+ `@platform/jobs`(attempts/backoff)で同等を実現できる
- Amplify Data(GraphQL)+ S3 + Cognito の構成は、基盤の AWS 方針(Amplify 中心)と整合。将来アプリ化する際の実例として `docs/ops/DEPLOY_AWS.md` から参照する余地あり

---

## 第2回取り込み(group-board / yojitsu / nano-banana-chat-ui)

| リポジトリ | 性質 |
|---|---|
| group-board | 従業員マスタ + 権限プロビジョニング(Cognito / OIDC / WebAuthn) |
| yojitsu(旧 GROUP BOARD) | freee 連携の予実管理(予算・見込・実績)+ MCP over HTTP |
| nano-banana-chat-ui | AI 画像編集チャット(React + Lambda + Gemini 画像生成) |

### 取り込んだもの: MCP over HTTP → `@platform/mcp`
- 出典: yojitsu `src/lib/mcp/` + `app/api/mcp/route.ts`(Streamable HTTP・stateless・Bearer 認証・RFC 9728)
- 基盤 MCP は **stdio 専用**でリモート接続の受け口が無かった → **重複せず補完**
- 取り込み方針: yojitsu は公式 `@modelcontextprotocol/sdk` 依存だったが、基盤の依存ゼロ方針に沿って**薄いアダプタを自作**。`handleMcpMessage`(純関数)を Web 標準 Request/Response に橋渡しする `handleHttpMcp` と `extractBearerToken` を追加。トークンの保存方式は規定せず検証関数を注入(Prisma/McpToken 等のアプリ固有部分は持ち込まない)。RFC 9728 の WWW-Authenticate まで対応。8 項目スモークで検証。

### 取り込まなかったもの(重複・固有依存)

| 候補 | 判断 | 理由 |
|---|---|---|
| yojitsu `freee.ts` / freee-sync 系 | 見送り | 既存 `@platform/freee`(client/hr/token/webhook)で充足。OAuth・同期は重複 |
| yojitsu `pl-categories` / `org-utils` / `bonus` 等 | 見送り | 予実管理・賞与の**業務ロジック**。アプリ側の責務 |
| yojitsu `mcp/token.ts`(トークン検証) | 見送り | Prisma の McpToken テーブルに固有。基盤は `handleHttpMcp` の authenticate 注入で吸収 |
| yojitsu OAuth 2.1 サーバ(authorize/token/register) | 見送り | NextAuth・アプリ DB に密結合。基盤は `@platform/auth`/`apikey` + RFC 9728 対応で下地は提供 |
| group-board `cognito-webauthn.ts`(パスキー) | 見送り | Cognito API(X-Amz-Target)に密結合。汎用 WebAuthn には Cognito 非依存の再設計が必要(将来候補) |
| group-board `cognito-auth` / `*-oidc` / `*-session` | 見送り | Cognito / OIDC プロバイダ固有。基盤は `@platform/auth`/`session` でカバー |
| group-board `repo/*`(employees/roles 等) | 見送り | 従業員マスタの**業務スキーマ**。アプリ側 |
| group-board / yojitsu の shadcn UI(button/dialog 等) | 見送り | 既存 `@platform/ui`(shadcn 慣習)と重複 |
| nano-banana `lambda/index.mjs`(Gemini 画像生成) | 見送り | Gemini API・Lambda・S3 に固有。基盤は `@platform/ai`(Gateway)にプロバイダを足す設計。画像生成の抽象は将来候補 |
| nano-banana `ui/`(Vite SPA) | 見送り | 特定アプリの UI |

### 知見(取り込みではなく設計参考)
- yojitsu の「MCP 書き込みは必ず履歴(AmountRowChange)経由 → 全操作を戻せる」は良い設計。基盤では `@platform/audit`(auditActions)+ 書き込み MCP ツールの監査記録(既実装)で同等を実現済み。
- yojitsu の MCP スコープ 3 種(read / write / revert)は、基盤の `McpToolDef.scopes` + `authorizeTool` でそのまま表現できる。
- 画像生成 AI は将来 `@platform/ai` に `AiImageProvider`(Gemini/DALL·E 等)を足す余地。今回は見送り(壁打ちでも「将来的な画像生成AI対応」と位置づけ)。

---

## 第3回精査(cliq-ai-bot / mediaprep / it_desk)— 取り込みなし

3リポジトリを精査した結果、**基盤に取り込む新規の汎用部品はなし**(すべて重複・言語違い・ブラウザ専用依存・空リポジトリ)。判断の記録:

| リポジトリ | 性質 | 判断 |
|---|---|---|
| cliq-ai-bot | Zoho Cliq AI ボット | 実体なし(README/git 設定のみ・3ファイル)。取り込み対象なし |
| mediaprep | 入会写真・動画処理(端末上 Canvas / ffmpeg.wasm) | 全て**ブラウザ専用**。取り込み候補を精査したが下記理由で見送り |
| it_desk | IT ヘルプデスク(React フロント + **Python/FastAPI** バックエンド) | フロントの汎用候補は既存と重複、バックエンドは言語違い |

### 個別の見送り理由

| 候補 | 判断 | 理由 |
|---|---|---|
| mediaprep `exif.ts`(EXIF 読み取り・撮影日抽出) | 見送り | `exifr`(ブラウザライブラリ)+ `File` 型に依存。基盤の依存ゼロ方針に反する。EXIF が要るなら `@platform/image`(sharp・サーバ側)側で対応する |
| mediaprep `resize.ts` / `exposure.ts` / `brushBlur.ts` / `dateStamp.ts` 等 | 見送り | Canvas / pica / ブラウザ専用。基盤の `@platform/image`(sharp)・`@platform/media` と領域が重なり、かつ環境依存 |
| mediaprep `downloads.ts`(File System Access API) | 見送り | ブラウザ API(FileSystemDirectoryHandle)専用。基盤 `@platform/csv` の downloadCsv 等で必要分はカバー |
| mediaprep `groupboard/*`(session/auth/permissions) | 見送り | GROUP BOARD 認証固有。基盤 `@platform/auth`/`session` でカバー |
| **it_desk `useWebSocket.ts`(再接続付き WS)** | 見送り | **既存 `@platform/realtime` と完全重複**。基盤は `createReconnectingWebSocket` + `backoffDelay`(指数バックオフ)+ イベント購読を既に提供(しかも React 非依存でテスト可能)。it_desk 版は React hook + シングルトンでアプリ固有 |
| it_desk `utils/api.ts` / `tasks.ts` | 見送り | タスク色・ステータス等のアプリ固有ロジック |
| it_desk backend(`ai_service.py` ほか) | 見送り | **Python/FastAPI**(基盤は Node/TS で言語不一致)。かつ triage / embedding / モデル別料金 / AI 利用ログの概念は**既存 `@platform/ai`(pricing/cost/logStore/Embedder)が既にカバー** |

### 知見(取り込みではなく設計の裏付け)
- it_desk バックエンドが独自に持っていた「モデル別料金表・AI 利用ログ・埋め込みでのナレッジ/類似チケット検索・triage(自動分類)」は、まさに基盤が `@platform/ai`(AI Gateway + Embedder)と `@platform/rag`(権限継承検索)で汎用化した領域と一致。**個別アプリが毎回再実装している共通処理を基盤が引き取る**という方針(壁打ちの AI Gateway 構想)の正しさを裏づける実例。
- it_desk の WS 再接続が既存 realtime と重複していたことは、基盤の網羅性が上がってきた良い兆候(新規アプリの共通処理が基盤で既に賄える)。

---

## 第4回取り込み(marketing_analytics_system / membership-extender / shift-app)

| リポジトリ | 性質 |
|---|---|
| marketing_analytics_system | GA4 を自然言語で問い合わせるチャット分析(OpenAI Function Calling) |
| membership-extender | 会員延長・ポイント付与の RPA(Playwright)+ freee 同期・VPS 常駐 |
| shift-app | シフト・座席管理(Next.js) |

### 取り込んだもの: ファイルベースのプロセス間ロック → `@platform/cron`
- 出典: membership-extender `src/chromium-lock.ts`(同一 VPS で複数 RPA が Chromium を同時起動しないよう直列化)
- 既存の `@platform/cron` は **Redis/メモリの分散ロック(TTL ベース)**は持つが、**単一ホストでの PID 死活監視付きファイルロック**は無かった → **重複せず補完**
- 取り込み方針: winston / Chromium 固有部分を排し汎用化。`tryAcquireFileLock` / `releaseFileLock` / `acquireFileLock`(待機付き・タイムアウト例外)/ `createFileLockStore`(既存 `LockStore` I/F に適合)。PID 死活・stale 時刻での自動回収、自 PID のロックだけ解放、を維持。10 項目スモーク(実 FS)で検証。用途: 単一ホスト = ファイルロック、複数インスタンス = Redis ロック、と使い分け。

### 取り込まなかったもの(重複・固有依存)

| 候補 | 判断 | 理由 |
|---|---|---|
| marketing `usage-tracker.ts`(トークン/コスト集計) | 見送り | 既存 `@platform/ai`(logStore/totals・pricing)と重複 |
| marketing `function-definitions.ts` | 見送り | GA4 固有の Function Calling 定義。アプリ固有 |
| marketing `ga4-client.ts` | 見送り | GA4 Data API 固有クライアント。基盤の汎用連携(http/integrations)で足り、GA4 専用は業務側 |
| marketing `openai/client.ts` / `system-prompt.ts` | 見送り | 既存 `@platform/ai`(Gateway・プロバイダ)でカバー |
| membership `notifier.ts`(Cliq 通知) | 見送り | 既存 `@platform/notify` と重複 |
| membership `logger.ts`(winston) | 見送り | 既存 `@platform/logger` と重複 |
| membership `freee-sync.ts` / `point-adder.ts` / `extender.ts` / `selectors.ts` | 見送り | freee は `@platform/freee` で充足。ポイント付与・会員延長・DOM セレクタは業務/サイト固有 RPA |
| shift-app `types/index.ts` ほか業務ロジック | 見送り | シフト・座席の業務スキーマ。アプリ固有 |
| 各アプリの NextAuth / Zoho provider / route | 見送り | 既存 `@platform/auth`/`session`/`zoho` でカバー |

### 知見(取り込みではなく設計参考)
- membership-extender は「RPA を最後の手段とし、freee は API 連携」という構成で、壁打ちの優先順位(**API > MCP > RPA**)と一致。基盤としては RPA そのものは持たず、RPA を安全に回すための共通部品(今回のファイルロック・既存の jobs/saga/audit)を提供する、という切り分けが妥当と再確認。
- marketing の「自然言語 → Function Calling → データ取得 → チャート」は、基盤の `@platform/ai`(Gateway)+ `@platform/mcp`(tools)+ チャート(ui/report)で組み立てられる構成。個別アプリが OpenAI を直叩きしている部分こそ Gateway に寄せる対象。

---

## 第5回精査(ai-portal-demo / interview-recorder-server / interview-recorder-appliance / aetara-lp)— 取り込みなし

4リポジトリを精査した結果、**基盤に取り込む新規の汎用部品はなし**(すべて重複・言語違い・インフラ密結合・独自ロジックなし)。判断の記録:

| リポジトリ | 性質 | 判断 |
|---|---|---|
| ai-portal-demo | AI 活用事例ポータルの MCP サーバー(**Python 63** / Django API 薄クライアント) | 言語違い。MCP tool/scope 設計は参考になるが、基盤 `@platform/mcp`(stdio+HTTP+スコープ認可)で既にカバー |
| interview-recorder-server | 面接録音サーバー(**TS/Next.js** + Vercel Blob + Neon + Prisma) | TS だが各機能はインフラ密結合・アプリ固有。汎用部品は既存でカバー(下表) |
| interview-recorder-appliance | 面接録音装置(**Python 15** / sounddevice) | 言語違い・ハード固有。送信キュー設計は参考だが基盤 jobs/upload でカバー |
| aetara-lp | 会員クラブ LP(**tsx 24** / マルチページ + 問い合わせフォーム) | 独自ロジックなし(フォームは HTML 標準の required/type=email のみ)。既存 seo/site/ui/form でカバー |

### 個別の見送り理由

| 候補 | 判断 | 理由 |
|---|---|---|
| server `lib/blob.ts`(チャンク保存) | 見送り | `@vercel/blob` 密結合。基盤は `@platform/storage`(adapter)で吸収する設計 |
| server `api/interview/chunks`(チャンク受信) | 見送り | Vercel Blob + Prisma + next 固有。sha256 整合性検証・zod 検証・audit は既存 `node:crypto`/`@platform/validation`/`@platform/audit` でカバー |
| server `api/interview/finalize`(冪等終了通知) | 見送り | Prisma upsert + next `after` のアプリ固有。冪等・バックグラウンド処理は `@platform/jobs`/`saga` でカバー |
| server `lib/openai.ts`(文字起こし/要約) | 見送り | 既存 `@platform/ai`(Gateway)でカバー |
| server `lib/auth.ts`(Bearer 検証) | 見送り | 既存 `@platform/apikey`(extractBearer/verify)・`@platform/mcp`(extractBearerToken)でカバー |
| appliance `uploader.py`(送信キュー・再送) | 見送り | **Python 言語違い**。指数バックオフ再送・未完了分の再開・退避は基盤 `@platform/jobs`(attempts/backoff)+ `@platform/upload` でカバー |
| appliance `crypto.py`(ローカル暗号化) | 見送り | Python 言語違い。基盤 `@platform/crypto`(createFieldCipher 等)でカバー |
| ai-portal-demo `mcp-server/*.py`(MCP tools) | 見送り | **Python 言語違い**。基盤 `@platform/mcp`(stdio + HTTP + resources/prompts + スコープ認可)で既にカバー |
| aetara-lp `ContactForm.tsx` / `lib/utils.ts` | 見送り | 独自バリデーションなし(HTML 標準)。`lib/utils.ts` は clsx/tailwind-merge の cn ヘルパのみ(既存 `@platform/ui` に同等) |

### 知見(取り込みではなく設計の裏づけ)
- interview-recorder は「アプライアンス(Python・録音/暗号化/再送) → サーバー(TS・受信/文字起こし/要約)」という構成で、**サーバー側の共通処理(認証・整合性検証・AI 要約・監査・冪等終了)がすべて基盤の既存パッケージで表現できる**ことを確認。個別アプリが毎回書いている「Bearer 検証・zod 検証・audit・AI 要約」こそ基盤が引き取る対象。
- ai-portal-demo の MCP サーバーは「DB 直アクセスせず HTTP API を Bearer で叩く薄いクライアント + スコープ別 tool」という設計で、基盤の `@platform/mcp`(handleHttpMcp + authenticate 注入 + authorizeTool)と同じ思想。言語が TS なら取り込み対象になり得たが、Python のため見送り。
- **5 回連続で外部リポジトリを精査し、基盤の網羅性が「新規アプリの共通処理をほぼ吸収できる」水準に達した**ことが確認できた(取り込みは第1〜4回で csv ストリーミング / MCP over HTTP / ファイルロックの3件、以降は重複・言語違いが中心)。

---

## 第6回取り込み(ai-portal-demo〔再〕/ interview-transcribe / call_check / universe-club-event-site)

| リポジトリ | 性質 | 判断 |
|---|---|---|
| ai-portal-demo | AI ポータル MCP サーバー(Python) | 第5回で精査済み・取り込みなし(既存 @platform/mcp でカバー) |
| interview-transcribe | 面接文字起こし POC(TS・音声分割→話者分離→コメント生成) | 音声処理は ffmpeg 依存で見送り(下表) |
| call_check | Twilio 通話録音チェック(**Python**) | 言語違い・Twilio 固有 |
| universe-club-event-site | 会員イベントサイト(TS・会員ポータル) | replay 防止のみ取り込み(下記) |

### 取り込んだもの: リプレイ防止(ワンタイム値ストア)→ `@platform/security`
- 出典: universe-club `lib/jti-store.ts`(JWT の jti 再利用を 401 で拒否)
- 既存 `@platform/security`(csrf/headers/sanitize)・`@platform/auth`/`session` に **replay/nonce/once 防止は無かった** → 重複せず補完
- 取り込み方針: メモリ Map 固定だった実装を**ストア注入式**に一般化。`createReplayGuard`(markUsedIfNew: 初見 true・再利用 false)+ `createMemoryReplayStore` + `ReplayStore` 抽象(本番は Redis/DynamoDB TTL に差し替え)。TTL・クロックスキュー調整可。JWT の jti だけでなく nonce・冪等キーにも使える。6項目スモーク。

### 取り込まなかったもの(重複・固有依存・言語違い)

| 候補 | 判断 | 理由 |
|---|---|---|
| interview-transcribe `split.ts`/`merge.ts`(音声分割) | 見送り | `ffmpeg-static`(バイナリ)依存・音声処理固有。基盤の依存ゼロ方針に反する |
| interview-transcribe `transcribe.ts`/`generate.ts` | 見送り | OpenAI 直叩き。既存 `@platform/ai`(Gateway)でカバー |
| interview-transcribe `glossary.ts`(用語置換) | 見送り | 表記ゆれ辞書はドメイン固有。汎用文字列処理は `@platform/utils`/`i18n` で足りる |
| universe-club `jwt.ts`/`session-crypto.ts` | 見送り | JWT 署名・セッション暗号は既存 `@platform/auth`/`session`/`crypto` でカバー |
| universe-club `aws.ts`/`imageProcessing.ts` | 見送り | AWS SDK・sharp 固有。既存 `@platform/storage`/`image` でカバー |
| universe-club `bookings`/`members`/`events` | 見送り | 予約・会員・イベントの業務ロジック。アプリ固有 |
| call_check `*.py` | 見送り | **Python 言語違い**・Twilio 固有 |

### 知見
- universe-club の「jti-store の API を維持して実装だけ分散ストアに差し替える」という設計コメントは、まさに基盤の注入式設計と同じ思想。取り込みに際してその方針をそのまま `ReplayStore` 抽象として具現化した。
- interview-transcribe は「音声分割 → 文字起こし → AI コメント生成」で、AI 部分は基盤 `@platform/ai`、分割は ffmpeg 依存でアプリ側、という切り分けが妥当。

---

## 第6回精査(call-check / interview-transcribe / universe-club)

| リポジトリ | 性質 |
|---|---|
| call-check | Twilio 通話録音 + CRM 連携(**Python 3**・小規模) |
| interview-transcribe | 面接文字起こし POC(**TS**・音声分割→文字起こし→話者分離→コメント生成) |
| universe-club-event-site | 会員イベントサイト(**TS/tsx**・会員ポータル) |

### 取り込んだもの: 辞書ベースのテキスト正規化 → `@platform/utils`
- 出典: interview-transcribe `poc/lib/glossary.ts`(用語辞書・表記ゆれの機械置換 + LLM ヒント生成)
- 既存 `@platform/utils/strings` は normalizeText/toHalfWidth 等は持つが、**辞書(from→to)一括置換**は無かった → **重複せず補完**
- 取り込み方針: 業務用語(ナイトワーク固有の辞書内容)は持ち込まず、**仕組みだけ汎用化**。`replaceByDictionary`(longest-match 優先・wholeWord 対応)+ `buildGlossaryHint`(用語→LLM ヒント文)。音声認識・OCR の誤変換補正、表記統一に汎用に使える。8項目スモーク。

### 取り込まなかったもの(重複・固有依存)

| 候補 | 判断 | 理由 |
|---|---|---|
| interview-transcribe `split.ts`(音声分割) | 見送り | `ffmpeg-static` + spawn 依存。基盤の依存ゼロ方針。音声処理はアプリ側 |
| interview-transcribe `transcribe.ts` / `generate.ts` | 見送り | OpenAI 文字起こし・生成。既存 `@platform/ai`(Gateway)でカバー |
| interview-transcribe `merge.ts`(チャンク結合) | 見送り | 文字起こし結果のオフセット結合。アプリ固有(汎用性低い) |
| interview-transcribe `glossary.ts` の辞書内容 | 見送り | 業務(ナイトワーク)固有の用語。仕組みのみ取り込み(上記) |
| universe-club `jti-store.ts`(リプレイ防止) | **既取込済** | 第2回で `@platform/security` の createReplayGuard として一般化済み(重複) |
| universe-club `session-crypto.ts` / `jwt.ts` | 見送り | 既存 `@platform/session`/`crypto`/`security` でカバー |
| universe-club `aws.ts` / `bookings*` / `events*` | 見送り | AWS 密結合・予約/イベントの業務ロジック |
| call-check(Twilio + CRM) | 見送り | **Python 言語違い**。通話録音同期は業務固有。CRM は既存 zoho/連携でカバー |

### 知見
- interview-transcribe は「音声→分割→文字起こし→話者分離→用語補正→コメント生成」で、**用語補正(辞書)以外はすべて既存基盤(ai/rag/csv)で組める**ことを確認。辞書の仕組みだけが基盤に無く、今回それを補完した。
- universe-club の jti-store が既に第2回で基盤化されていたことは、**同じ共通処理が複数アプリで再発明されている**ことの実証(基盤が引き取る意義)。

---

## OS連携・DB Viewer の追加(外部ソース非依存の新規機能)

第6回までの外部ソース精査で基盤化の候補は概ね吸収済み。今回の os-notify / DB Viewer は外部リポジトリからの取り込みではなく、運用ニーズ(OS 通知・DB 管理 UI)に応じた新規の基盤機能。

- **os-notify**: Windows/Mac/Linux のデスクトップ通知・音。OS 別コマンド生成を純関数化し spawn 注入でテスト可能に。
- **DB Viewer**: phpMyAdmin 的な DB 管理 UI。安全性(識別子ホワイトリスト・パラメータ化・危険操作の確認)を最優先で設計。
