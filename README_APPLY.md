# 基盤 全体 ZIP — /import-history 拡充 + nav の誤りを一斉修正

```powershell
git diff --stat                                                   # ★飛ばさない
git rm -f packages/ui/src/tokens.css                              # 残っていれば
git rm -f demos/showcase/src/lib/theme-registry.ts
git rm -f demos/showcase/src/app/apps/portal/portal-client.tsx
git rm -r demos/showcase/src/app/board

pnpm install     # ★@platform/barcode(新規) + qrcode / bwip-js
git add pnpm-lock.yaml demos/showcase/package.json package.json packages/barcode

pnpm gen:all
cd demos\showcase; pnpm build
```

---

## ★ 3 回目にして、やっと網羅的に測れました

前回まで**「nav の宣言」しか見ておらず、API や `examples/` を見ていませんでした**。
今回は**画面 + API + server + examples の全部**を突き合わせ、**14 件**の食い違いを検出しました。

## `/import-history` を拡充（64 行 → 371 行）

**nav は「CSV取り込み→検証→部分保存→ロールバック」と書いていたのに、
実物は履歴テーブルを表示するだけ**でした。`importer` も `csv` も 1 行も使っていません。

### 追加した内容

| | |
|---|---|
| **① CSV を貼る** | `parseCsv(csv, { header: true })`。**戻り値が union** なので呼び出し側で絞る |
| **② 検証** | **エラー行に「なぜダメか」が残る**。1 行に複数の理由も出る |
| **③ 適用** | **`partial` の既定は false**（1 行でもエラーなら全体中止）/ `dryRun` で DB を触らず検証 |
| ④ 履歴と取消 | 権限つきロールバック（既存） |

### 実際に走らせて確認しました

```
validateRows: 全4行 / 有効2 / エラー2 / allValid: false
   ★行2: 日付が空です
   ★行3: 金額が数値ではありません(abc)

runImport:
  既定(partial:false)   適用0件 / committed:false   ← 1行でもエラーなら全体中止
  partial:true          適用2件 / committed:true
  dryRun:true           適用0件 / committed:false   ← apply() が呼ばれない
```

**「40 行中 37 行だけ入った」は、現場が何を直せばいいか分からなくなります。**
どちらが正しいかは業務によるので、**基盤は選べるようにするだけ**——決めるのはアプリです。

## nav の誤りを 6 件修正

**実物を読んで、使っていないパッケージを外しました**：

| ページ | 外した | 理由 |
|---|---|---|
| `/calendar` | `booking` | 実物は `datetime` + `ui` |
| `/receipt` | `confidence` | 実物は `ocr` + `report` |
| `/device` | `mobile` | 実物は `device` + `ui`（`mobile` は実機が要る） |
| `/invoice` | `invoice` | 実物は `report` + `print` + `ui` |
| `/data-console` | — | **`examples/` に実体があった**（私が見ていなかった） |

### ★ 検査が私のやりすぎを 2 回止めました

```
❌ searchDemos: パッケージ名/日本語/@platform付きで引ける
```

**`/invoice` から `tax` を外したら落ちました**——`report` が内部で `tax` を使うので、
**nav に書くのは妥当**でした。同じ理由で `/files` の `storage` も戻しています
（`upload` が内部で使用）。

**「画面が直接 import していない = 書いてはいけない」ではない**と分かりました。
残る 5 件（`/dashboard-grid` の `csv`、`/ws` の `realtime`、`/theme` の `color` 等）は
**すべて「部品や基盤が内部で使う」正常なケース**です。

## 検証状況

| 検査 | 結果 |
|---|---|
| **API をプローブで tsc 検証** | ✅ `parseCsv` の union を発見 → 修正 |
| **実際に走らせて挙動を確認** | ✅ partial / dryRun の違い |
| `check-build-ready`（P: 未宣言パッケージ） | ✅ **私の配線漏れを検出** → 修正 |
| `check-app-rules --ui`（生タグ） | ✅ **0** |
| `smoke` | ✅ **1318 passed, 0 failed** |
| `preflight` | ✅ すべて緑 |
| **`pnpm build`** | ❌ 未検証 |

## 拡充は、本当にこれで終わりです

**「nav に書いてあるのに、どこでも使っていない」は 0 件**になりました。
残る 5 件は内部使用で正常です。

**残る課題は生タグ置き換え（115 ファイル・665 箇所）だけ**です。
