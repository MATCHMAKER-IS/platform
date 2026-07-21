# UI 生タグ移行プレイブック

`apps/**`・`demos/**` に残る生タグ(`<button>` / `<input>` / `<select>` / `<textarea>`)を
`@platform/ui` の共通部品へ置き換えるための手順書。**規約は CLAUDE.md「UI 部品は @platform/ui を使う」**。

> なぜやるか(再掲): サイズが揃わない / スキン(11 種)が効かない / 1 箇所で直せない、の 3 点。
> 生タグは `var(--color-*)` に追従しないため、テーマ切り替えで色が変わらない画面が残る。

## 現状(このファイルの起点)

- 検出: `node tools/check-app-rules.mjs`(件数) / `--ui`(ファイル別内訳)
- **完了済み**: `apps/crud-template`(コピー元テンプレート) / `apps/equipment-app`
- 残り: `node tools/check-app-rules.mjs` の出力を参照(internal-app と demos/showcase が中心)

## 置き換え表(これだけ覚える)

| 生タグ | 置き換え先 | 注意 |
|---|---|---|
| `<button>` | `Button` | `variant` を選ぶ(下表)。`onClick`/`disabled` はそのまま |
| `<input type="text\|email\|number\|date\|datetime-local…">` | `Input` | 薄いラッパー。`type` 含め属性は透過。**視覚系 className は落とす**(下記) |
| `<input type="checkbox">` | `Checkbox` | `onChange={e=>f(e.target.checked)}` → **`onCheckedChange={v=>f(v===true)}`** |
| `<input type="radio">` | `RadioGroup` + `RadioGroupItem` | グループ単位で組み替える |
| `<input type="range">` | `Slider` | `value={[n]}` / `onValueChange={([v])=>…}`(配列) |
| `<input type="file">` | `FileUpload` | ボタン風。`label` を渡せる |
| `<textarea>` | `Textarea` | 薄いラッパー。属性は透過 |
| `<select>…<option>…` | `Select` | **子 option をやめ `options={[{label,value}]}` に構造変換**(下記) |
| トグル的な on/off | `Switch` | `checked` / `onCheckedChange` |

### Button の variant 選択

| 見た目・役割 | variant | 例 |
|---|---|---|
| 主操作(保存・登録・送信) | `primary`(既定) | `<Button onClick={save}>保存</Button>` |
| 副操作(取消・キャンセル・編集) | `secondary` | `<Button variant="secondary">取消</Button>` |
| 弱い操作・アイコン・リンク風・行内の補助 | `ghost` | `<Button variant="ghost" size="sm">×</Button>` |
| 破壊的操作(削除) | `danger` | `<Button variant="danger">削除</Button>` |

サイズ: 表の行内や密なツールバーは `size="sm"`。既定は `md`。

## つまずきポイント(必読)

### 1. Tailwind 記法では「視覚系 className を落とす」

`cn` は **tailwind-merge(後勝ち)**。旧 className に `border-neutral-300 rounded px-2 py-1 bg-neutral-900` を
残すと、**部品側のテーマ対応クラス(`border-[var(--color-border)]` 等)を上書きしてしまう**。

```tsx
// ❌ 旧クラスを丸ごと残す(テーマが効かない / 高さが変わる)
<Input className="mt-0.5 block w-full rounded border border-neutral-300 px-2 py-1 text-sm" />

// ✅ 視覚系は落とし、位置・余白だけ残す(w-full は Input の既定)
<Input className="mt-0.5" />
```

落とすもの: `border*` `rounded*` `bg-*` `text-<色>` `px-*` `py-*` `h-*` `w-full`(既定) `focus:*`。
残すもの: `mt-*` `mb-*` `flex-1` `self-*` などレイアウト系。

### 2. 色のハードコードは同時に消す

`bg-neutral-900` `text-blue-600` `#666` `#c00` 等をこの機会に `variant` か `var(--color-*)` へ。
`#c00`→`var(--color-danger)`、`#666`→`var(--color-muted)` が目安。

### 3. `<select>` は構造変換

```tsx
// ❌ before
<select value={dept} onChange={(e) => setDept(e.target.value)}>
  <option value="sales">営業</option>
  <option value="dev">開発</option>
</select>

// ✅ after(option を配列へ。placeholder は先頭の未選択肢)
<Select
  value={dept}
  onChange={(e) => setDept(e.target.value)}
  placeholder="部署を選択"
  options={[
    { label: "営業", value: "sales" },
    { label: "開発", value: "dev" },
  ]}
/>
```

`options` を動的生成している場合は `list.map((x) => ({ label: x.name, value: x.id }))` に。

### 4. Checkbox / Slider はイベント名が違う

```tsx
// checkbox
<input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
<Checkbox checked={on} onCheckedChange={(v) => setOn(v === true)} />

// range
<input type="range" min={0} max={100} value={vol} onChange={(e) => setVol(+e.target.value)} />
<Slider min={0} max={100} value={[vol]} onValueChange={([v]) => setVol(v)} />
```

### 5. import と tokens

- `import { Button, Input, Select, Textarea, Checkbox } from "@platform/ui";`(使うものだけ)
- `var(--color-*)` は各アプリ layout の **`<AppSkin>`** が注入する。`tokens.css` の個別 import は不要。

## 1 ファイルの進め方

1. `node tools/check-app-rules.mjs --ui | grep <ファイル>` で対象を確認
2. 生タグを上表どおり置換(視覚系 className を落とす / 色を変数化)
3. `grep -nE "<(button|input|select|textarea)[ >]" <ファイル>` で残ゼロを確認
4. `node tools/check-app-rules.mjs` で全体件数が減ったことを確認
5. `node tools/check-build-ready.mjs`(import 解決・use client)
6. **`pnpm dev:<app>` で画面を目視**(特にテーブル行内のボタン折返し・入力欄幅)
7. `pnpm typecheck`(この環境では不可 → CI/ローカルで)

> オフライン(この環境)では typecheck/build が走らない。**目視と typecheck は必ずローカル or CI で**。
> リンク風ボタン(`text-blue-600 hover:underline`)を `Button variant="ghost"` にすると
> 見た目が変わる箇所がある。密なテーブルでは折返しに注意。

## 完了の定義

- `node tools/check-app-rules.mjs` が **0 ファイル・0 箇所**
- 完了後、CLAUDE.md の当該注記(生タグの残存表)を更新し、
  `check-app-rules` を **警告 → エラー** に昇格(CI で新規の生タグを機械的に止める)
