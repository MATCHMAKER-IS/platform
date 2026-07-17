# 見積・発注のデモ 2 ページ + 基盤のバグ修正（差分のみ）

リポジトリのルートに上書き展開してください。

## ★ プローブが基盤の本物のバグを見つけました

ページを書く前に API をプローブで tsc へ通したところ、**私のコードではなく
`quote` / `purchase` パッケージ自身**が落ちました：

```
packages/purchase/src/purchase-order.ts(5,68): TS2305:
  Module '"@platform/invoice"' has no exported member 'Rounding'.
packages/quote/src/quote.ts(5,96): TS2305: 同上
```

`@platform/invoice` のバレルは `@platform/tax` から
`isValidInvoiceNumber` / `normalizeInvoiceNumber` **しか再 export していません**。
`Rounding` は tax の型なので invoice を素通りしません。
なのに quote / purchase は `from "@platform/invoice"` でそれを取ろうとしていました。

**`quote` / `purchase` を showcase に足した瞬間にビルドが壊れます。**
これまで Next のビルドに含まれていなかったので、潜伏していました（`rag` の `CHUNK_STORE` と同じ構図）。

### 修正

```diff
- export { isValidInvoiceNumber, normalizeInvoiceNumber } from "@platform/tax";
+ export { isValidInvoiceNumber, normalizeInvoiceNumber, type Rounding, type TaxRate, type TaxSummary } from "@platform/tax";
```

`invoice` を入口にする利用者（quote / purchase）が「税計算の設定」を書けるよう、
引数に必要な型を通します。

## 再発防止: 検査 N

**検査 K は「戻り値の型」しか見ないので、今回の形（引数の型・任意の named import）は素通り**しました。
そこで検査 N を追加しました。

```
❌ [N] packages/quote/src/quote.ts: @platform/invoice は "Rounding" を export していない
       — TS2305 になる。実装元から再 export するか、実装元パッケージから直接 import すること
```

パッケージ間の `import { X } from "@platform/y"` を全走査し、
相手のバレルに X が無ければ落とします。

**一度に 8 件の誤検知を出しました**（`export type { X } from`、`export async function` を
正規表現が拾えていなかった）。修正して、本物の 2 件だけを捕まえ、誤検知 0 になることを確認済みです。

## 追加した 2 ページ

| | 見せているもの |
|---|---|
| `/quote` | 有効期限・**受注/失注は期限を過ぎても上書きされない**・**請求書へ変換すると金額が必ず一致する** |
| `/purchase` | 発注書の金額・**分納**・発注残・**過剰入荷の検知** |

### `/quote` の見どころ

**「請求書へ変換」ボタン**が主役です。変換後に

```
見積合計 ¥2,398,000   請求合計 ¥2,398,000   ○ 完全に一致
```

と出ます。`@platform/quote` のコメントは
**「税計算は @platform/invoice に委譲（請求書と同じ計算にする）」**と明記していて、
それがそのまま画面で確認できます。**同じ計算を 2 回書いていないから一致する**わけです。

状態を「受注」にして今日を有効期限より後にすると、**期限切れにならない**のも確認できます
（受注/失注は明示操作なので上書きしない）。この区別を各アプリで書くと必ず間違います。

### `/purchase` の見どころ

**「+5」を押しすぎると過剰入荷になり、行が赤くなります。**
頼んだ数より多く届くのは現場では普通に起きることで、検収で気づかず支払う事故を防ぐ部分です。

入荷は「記録の積み重ね」で持つので、いつ何が何個届いたかが後から追えます
（`/dencho` の証跡にそのまま使えます）。

## これで 1 本に繋がりました

```
/quote(見積) → /purchase(発注) → /invoice-builder(請求) → /tax(消費税) → /dencho(電帳法保存)
                                        ↑
                    quote / purchase / invoice すべてが @platform/tax を通る
```

## 検証状況

| 検査 | 結果 |
|---|---|
| **API をプローブで tsc 検証** | ✅ **基盤のバグを 2 件発見 → 修正 → 0 件** |
| 検査 N が本物を捕まえる / 誤検知しない | ✅ 両方確認 |
| `node tools/check-showcase-deps.mjs` | ✅ 60 パッケージ / 102 ファイル |
| `node tools/check-build-ready.mjs`（J/K/L/M/N） | ✅ |
| `node tools/preflight.mjs` | ✅ すべて緑 |
| **`pnpm build`** | ❌ **未検証**（`@types/react` が無く .tsx を型検査できません） |

デモ件数: 53 → **55**（基盤デモ 39 → 41）。

## 進捗

```
デモ有り: 48 → 52 → 56 → 58 → 60 / 107
業務ドメイン: 7/23 → 15/23
```
