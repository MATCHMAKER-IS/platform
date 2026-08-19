# 0007: ストアの memory / prisma デュアル実装

- 日付: 2026-07-14 / 状態: 採用

## 文脈
オフライン環境でもロジックを検証したい。開発者は DB 無しで即起動したい。テストは高速でありたい。

## 決定
全ストアを同一インターフェースで `createMemoryXxxStore()` と `createPrismaXxxStore(db)` の両実装にし、環境変数 `PERSISTENCE` で切替。Prisma 依存は「最小ポート」(`XxxStoreDb`)で受ける。

## 検討した代替案と見送り理由
- Prisma 一本 + テスト用 SQLite: 方言差と adapter 前提が崩れる。DB 無し起動もできない。

## 影響
実装は2倍だが定型(docs/ai/patterns.md 1章)。スモーク 855 項目が memory 実装で回帰を担保し、Prisma 側は最小ポートの型で整合を担保。

## 追記(2026-08)

**切替の既定を「DB を使う」に変えた。**

当初は「DB 無しで即起動」を優先して**既定をメモリ**にしていたが、次の食い違いが出た。

- `DATABASE_URL` は必須なのに DB を使わない
- `services.ts` が Prisma の生成物を先頭で import しており、**結局 `prisma generate` が必要**だった
- 「シードを入れたのに画面が空」という事故が起きた

また、切替の変数が `CHAT_PERSISTENCE` / `FAQ_PERSISTENCE` /
`CONTRACT_PERSISTENCE` / `TASK_PERSISTENCE` の 4 つに分かれていた。
とくに `CHAT_PERSISTENCE` は**名前と実態が合っておらず**、
チャットと無関係な取引先・通知・監査など **51 のストア**を切り替えていた。

`PERSISTENCE` 1 つに統一し、`PERSISTENCE=memory` のときだけメモリにした。
**二重実装そのものは続ける**(テストが速く、オフラインでロジックを確かめられる利点は変わらない)。
