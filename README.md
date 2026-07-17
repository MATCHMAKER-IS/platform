# ①規約の文書化 + ②検査の追加（4 ファイル）

**コードの変更はありません。`pnpm install` 不要、`pnpm build` にも影響しません。**

```powershell
node tools/check-app-rules.mjs          # 要約 1 行
node tools/check-app-rules.mjs --ui     # 116 ファイルの一覧(多い順 = 着手順)
node tools/preflight.mjs                # すべて緑のまま
```

## 調査結果 — 私が持ち込んだ問題ではありませんでした

**116 ファイル・666 箇所**が生タグを使っています。

| | ファイル数 |
|---|---|
| `apps/internal-app` | **81** |
| `demos/showcase` | 30（うち私が作った 19） |
| その他アプリ | 5 |

内訳: `<button>` 330 / `<input>` 250 / `<select>` 62 / `<textarea>` 21。

**そして `CLAUDE.md` にも `patterns.md` にも「UI 部品は基盤を使う」という規約が
ありませんでした。** つまりこれは規約違反ではなく、**規約が存在しない**状態です。

私は `patterns.md` の「既存の同型コードを 1 つ開いて真似る」に従い、
既存（生タグ）を真似ていました。**ルールが無ければ、AI も人も同じことをします。**

## ① 規約の文書化

### `CLAUDE.md`

「apps に書かない(基盤にある)」の表に **UI 部品**を追加し、専用の節を新設：

```
### UI 部品は `@platform/ui` を使う

❌ <button className="rounded bg-neutral-900 px-3 py-1.5">保存</button>
✅ <Button>保存</Button>
```

**理由も書きました**（これが無いと守られません）：

- **サイズが揃わない** — 基盤で `h-10`→`h-9` にしたのに、生タグの画面だけ大きいまま（実際に起きた）
- **スキンが効かない** — `bg-neutral-900` は固定色。11 スキンを用意した意味が消える
- **1 箇所で直せない** — フォーカスリングやアクセシビリティの修正が全アプリへの一括修正になる

### `docs/ai/patterns.md`

**冒頭に警告 + 0 節（最初に読む）**を新設：

> ⚠️ **ただし UI だけは既存を真似ないこと。**
> 既存コードの多くが生タグを Tailwind 直書きで使っている(移行中)。**真似ると同じ負債が増える。**

用途 → 部品の対応表も載せました（`Button` / `Input` / `Select` / `NumberInput` /
`DatePicker` / `Combobox` / `TagInput` ほか）。

**ここが AI（Claude Code / Cursor）が読む定型集なので、実質こちらが効きます。**

## ② 検査

`check-app-rules.mjs` の「検出するもの」に **4 番目**として追加。

```
⚠️  生タグ(<button>/<input>/<select>/<textarea>)を 116 ファイル・666 箇所で使っています
    → @platform/ui を使ってください(CLAUDE.md「UI 部品は @platform/ui を使う」)
    一覧: node tools/check-app-rules.mjs --ui
```

### 既定は要約 1 行

**116 行を毎回出すと、他の検査の警告が埋もれて誰も読まなくなります。**
既定は要約、詳細は `--ui`。一覧は**箇所数の多い順**なので、着手順がそのまま分かります。

```
apps/internal-app/src/app/cms/cms-client.tsx: <button> 16 / <input> 9 / <select> 3 / <textarea> 1
apps/equipment-app/src/app/equipment-client.tsx: <button> 11 / <input> 8
...
```

### `warn` にした理由

666 箇所を今すぐ直すのは無理なので、**`error` にすると `preflight` が常時赤**になり、
他の本物のエラーが埋もれます。移行が終わったら `error` に上げてください。

## ★ smoke が正しく壊れました

`check-app-rules` に warn を足した瞬間、smoke の
`ok("...侵していない", r.issues.length === 0)` が赤くなりました。**正しい検知です。**

期待を緩めるだけでは検査が骨抜きになるので、こう直しました：

- `error` のみで判定（warn は「移行中」なので許す）
- **代わりに「生タグ検査が機能しているか」を新しく検査**
  （件数と `--ui` の案内が出るか。**「warn が 0 か」ではなく「検査が生きているか」を見る**）
- **規約の文書化そのものも検査**（`CLAUDE.md` と `patterns.md` に理由まで書かれているか）

検査だけあってドキュメントに無いと、**誰も理由を知らないまま赤くなる**ので。

`error`（`nodemailer` の直接 import 等）は**今も止まる**ことを確認済みです。

## 検証状況

| 検査 | 結果 |
|---|---|
| `smoke` | ✅ **1247 passed, 0 failed** |
| `preflight` | ✅ すべて緑 |
| error が今も止まるか（骨抜き防止） | ✅ 確認済み |
| `check-docs-links` / `check-docs-duplication` | ✅ |
| `gen-all` | ✅ |

## 次（③）について

一覧の**多い順から、1〜2 ファイルずつ**です。`demos/showcase` の私の 19 ファイルから始めるのが安全です
（私が作った負債で、見た目が変わっても影響が小さい）。

**`apps/internal-app` の 81 ファイルは別件**として計画を立ててください。本番の業務アプリで、
`<input type="file">` 8 箇所 / `range` 2 箇所は**基盤に受け皿がありません**（`FileInput` / `RangeInput` が無い）。
機械的に置換すると壊れるので、基盤側に部品を足す判断が先です。
