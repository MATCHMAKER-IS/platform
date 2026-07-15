# 0007: ストアの memory / prisma デュアル実装

- 日付: 2026-07-14 / 状態: 採用

## 文脈
オフライン環境でもロジックを検証したい。開発者は DB 無しで即起動したい。テストは高速でありたい。

## 決定
全ストアを同一インターフェースで `createMemoryXxxStore()` と `createPrismaXxxStore(db)` の両実装にし、環境変数(PERSISTENCE / CHAT_PERSISTENCE)で切替。Prisma 依存は「最小ポート」(`XxxStoreDb`)で受ける。

## 検討した代替案と見送り理由
- Prisma 一本 + テスト用 SQLite: 方言差と adapter 前提が崩れる。DB 無し起動もできない。

## 影響
実装は2倍だが定型(docs/ai/patterns.md 1章)。スモーク 855 項目が memory 実装で回帰を担保し、Prisma 側は最小ポートの型で整合を担保。
