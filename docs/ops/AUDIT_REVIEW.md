# 基盤点検レポート

基盤が大きくなってきた段階での健全性点検の記録。定期的に更新する。

## 点検結果サマリ(良好)

| 観点 | 結果 |
|---|---|
| 循環依存 | なし ✅ |
| 層破り(下位が上位に依存) | なし ✅ |
| README 整備率 | 103/103（100%）✅ |
| ユニットテスト保有 | 89/103（86%）。残りは smoke で検証済み |
| TODO/FIXME/HACK | 0 件 ✅（未完の放置なし） |
| 最大ソース行数 | 606 行（utils/numbers）。分割必須なほどではない |
| スモーク | 975 チェック / 274 セクション |

総合的に健全。ブラックボックス化・属人化を防ぐ仕組み（README・生成物・smoke・advisor）が機能している。

## 見つかった負債と対応

### diffChanges の同名重複（audit / db）→ 対応済み
- `@platform/audit` と `@platform/db` が同名の `diffChanges` / `FieldChange` を持っていた。
- 調査の結果、**真の重複ではなく戻り値の形が違う**（audit=配列 `FieldChange[]`、db=マップ `Record<string, FieldChange>`）ことが判明。
- 対応: 機能を揃える（audit にも `ignore` / `redact` オプションを追加）+ README で使い分けを明記。層違反を避けるため統合はせず、意図的な使い分けとして整理。

## 継続監視する項目（現状は許容）

- **テスト未保有 14 パッケージ**（ai/rag/mcp/rpa/theme 等）: いずれも smoke.mjs で手厚く検証済み。`config` はロジックなし。将来的に `.test.ts` へ移すと二重の保険になる。
- **同名 export 76 組**: 大半は異なるドメインでの自然な同名（`summarize`、`Session` 等）。利用者が迷う場合は README で誘導する。
- **internal-app の route 204 本**: 機能追加が集中している。将来、機能別のアプリ分割を検討する余地。

## 点検の回し方

- `node tools/advisor.mjs dup` — 重複・類似・孤立の検出
- `node tools/check-deps.mjs` — 循環・層破り
- `node tools/platform-report.mjs` — README/テスト保有率・行数・カテゴリ分布
- `pnpm doctor` — 環境の妥当性
