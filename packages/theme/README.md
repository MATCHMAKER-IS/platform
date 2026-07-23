# @platform/theme

デザインテーマ（スキン）機構。WordPress のテーマのように、色・フォント・角丸・余白・影を 1 セットにした「スキン」を切り替えられます。明暗（light/dark）とは直交し、後からテーマを追加できる拡張性を持ちます。React 非依存の純ロジックです（UI 連携は `@platform/ui` の `SkinProvider` / `SkinSelector`）。

## 考え方

- **スキン** = デザイントークン（色・タイポ・角丸・余白・影）のまとまり。1 つのスキンが light / dark 両方のトークンを持ちます。
- **明暗と直交**: 「コーポレート」スキンの light と dark、のように組み合わせられます。
- **CSS 変数で表現**: `--color-primary`、`--radius` などに展開し、`data-skin` / `data-theme` 属性で切り替えます。
- **拡張可能**: レジストリに `register()` するだけで独自スキンを追加できます。

## 標準スキン

`builtInThemes` に 4 種を用意しています。

- `default`（スタンダード）— 青基調の標準業務テーマ
- `corporate`（コーポレート）— 紺とグレーで信頼感、角丸控えめ
- `soft`（やわらか）— ベージュと暖色、丸みと余白多め
- `high-contrast`（ハイコントラスト）— 白黒中心、視認性最優先

## 使い方

### レジストリを作る

```ts
import { createThemeRegistry, builtInThemes } from "@platform/theme";

const registry = createThemeRegistry({ themes: builtInThemes });
```

### 独自スキンを追加する（拡張）

```ts
registry.register({
  id: "my-brand",
  name: "自社ブランド",
  shape: { fontFamily: "'Noto Sans JP', sans-serif", radius: 10, spacing: 8, elevation: 2 },
  modes: {
    light: { bg: "#fff", fg: "#111", muted: "#666", surface: "#fafafa", border: "#e0e0e0", primary: "#e60033", primaryFg: "#fff", accent: "#0088cc", success: "#2e7d32", warning: "#ed6c02", danger: "#d32f2f" },
    dark:  { /* ... */ },
  },
});
```

### CSS を生成する

全スキン × 2 モードを 1 枚の `<style>` に入れておけば、属性の切り替えだけで即座に見た目が変わります（再取得・再描画不要）。

```ts
import { buildThemeStylesheet } from "@platform/theme";

const css = buildThemeStylesheet(registry.list());
// <style>{css}</style> を head に。要素に data-skin="corporate" data-theme="dark" を立てるだけ。
```

### 要素に直接適用する

```ts
import { applySkin } from "@platform/theme";

applySkin(registry.resolve("soft"), "dark", document.documentElement);
```

## React 連携（@platform/ui）

通常は `AppSkin` をアプリの `layout.tsx` に置くだけです。レジストリを自分で作る必要はありません：

```tsx
import { AppSkin, SkinSelector } from "@platform/ui";

<AppSkin>
  <SkinSelector variant="grid" />
  {/* 子孫は useSkin() で現在のスキンと setSkin を取得 */}
</AppSkin>
```

組織のカスタムテーマを足す場合。`Theme` はプレーンデータなので **Server Component から渡せます**：

```tsx
<AppSkin themes={[...builtInThemes, ...customThemes]} defaultSkinId="soft" />
```

> **レジストリを `layout.tsx` で作って渡さないこと。** `createThemeRegistry()` の戻り値は
> 関数の塊で、RSC のシリアライズを通れません（`next build` で全ページが落ちます）。
> `AppSkin` が client 側で組み立てます。

低レベルの `SkinProvider` を直接使うこともできますが、**client コンポーネントの中でのみ**です：

```tsx
"use client";
<SkinProvider registry={registry} mode={resolvedLightOrDark}>...</SkinProvider>
```

`SkinProvider` は選択スキンを localStorage に永続化し、`<html>` に `data-skin` と CSS 変数を適用します。明暗モード（`mode`）は既存の `ThemeProvider` の `resolved` を渡してください。

## デザイントークン

| CSS 変数 | 意味 |
|---|---|
| `--color-bg` / `--color-fg` | ページ背景 / 基本テキスト |
| `--color-muted` | 補助テキスト |
| `--color-surface` / `--color-border` | カード背景 / 枠線 |
| `--color-primary` / `--color-primary-fg` | ブランド主色 / その上のテキスト |
| `--color-accent` | 副次アクセント |
| `--color-success` / `--color-warning` / `--color-danger` | 状態色 |
| `--font-family` / `--font-heading` | 本文 / 見出しフォント |
| `--radius` / `--space` / `--shadow` | 角丸 / 余白基準 / 影 |

> `--space` は以前 `--spacing` でしたが、**Tailwind CSS 4 の予約名と衝突する**ため改名しました。
> Tailwind は `p-4` を `calc(var(--spacing) * 4)` と解決するので、上書きすると全ユーティリティが歪みます。

---

## ブランド色から自動生成（deriveTheme）

主色など数点を指定するだけで、light/dark 両モードの完全なスキンを自動生成できます。カスタムテーマ作成 UI の中核です。

```ts
import { deriveTheme } from "@platform/theme";

const brand = deriveTheme({
  id: "acme",
  name: "ACME",
  primary: "#e60033",      // 必須。ブランド主色
  accent: "#0088cc",       // 省略可（主色から自動生成）
  base: "warm",            // "light" | "warm" | "cool"（背景の系統）
  shape: { radius: 12 },   // 省略可
});
registry.register(brand);  // すぐ使える
```

`primaryFg`（ボタン文字色）は主色に対して読みやすい黒/白を自動選択し、状態色（success/warning/danger）は視認性の良い固定色を使います。生成結果は `checkTheme` でコントラストを確認できます。

## 保存・持ち運び（検証と JSON 入出力）

外部から来たテーマ（DB・ファイル・API）は、そのまま信用せず検証してから使います。

```ts
import { validateTheme, parseTheme, themesToJson, themesFromJson } from "@platform/theme";

validateTheme(unknown);   // 問題の一覧を返す（空なら妥当）。例外は投げない
parseTheme(unknown);      // 妥当なら Theme、不正なら VALIDATION エラー

const json = themesToJson(registry.list());  // 書き出し（{version, themes}）
const themes = themesFromJson(json);         // 読み込み（束・単体・素の配列に対応）
```

検証は id の形式・name の有無・shape の範囲（radius/spacing 0〜100、elevation 0〜3）・全 11 トークンが色として妥当かを見ます。色は hex / rgb() / hsl() / キーワードを許容します。

## スキンの作り方（拡張ガイド）

新しいスキンを追加する手順です。既存スキンをコピーして色を変えるのが最速です。

### 1. スキンを定義する

`Theme` は「モードに依存しない特性（`shape`）」と「light / dark それぞれの色（`modes`）」で構成されます。

```ts
import type { Theme } from "@platform/theme";

export const oceanTheme: Theme = {
  id: "ocean",              // 英数字・ハイフンのみ。data-skin 属性・保存キーになる
  name: "オーシャン",        // 画面に出る表示名
  description: "海を思わせる青緑のテーマ。",
  shape: {
    fontFamily: "'Noto Sans JP', system-ui, sans-serif",
    headingFontFamily: "'Noto Serif JP', serif", // 省略可(本文フォントを流用)
    radius: 10,      // 角丸(px)
    spacing: 8,      // 余白の基準(px)
    elevation: 2,    // 影の強さ 0〜3
  },
  modes: {
    light: {
      bg: "#f0f9fa", fg: "#0f2a30", muted: "#5a7a80",
      surface: "#ffffff", border: "#cfe6ea",
      primary: "#0e7c86", primaryFg: "#ffffff", accent: "#2563eb",
      success: "#0d9488", warning: "#ca8a04", danger: "#dc2626",
    },
    dark: {
      bg: "#08191c", fg: "#d5eaee", muted: "#7fa0a6",
      surface: "#0f262a", border: "#1f3f45",
      primary: "#2dd4bf", primaryFg: "#08191c", accent: "#60a5fa",
      success: "#2dd4bf", warning: "#38bdf8", danger: "#fb7185",
    },
  },
};
```

### 2. レジストリに登録する

アプリの `theme-registry.ts`（`createThemeRegistry` を作っている場所）で追加します。

```ts
import { createThemeRegistry, builtInThemes } from "@platform/theme";
import { oceanTheme } from "./my-themes.js";

export const themeRegistry = createThemeRegistry({ themes: builtInThemes });
themeRegistry.register(oceanTheme); // 標準スキンに加えて自社スキンを足す
```

これだけで、テーマセレクタに「オーシャン」が並び、選ぶと全体に適用されます（全体適用している場合）。

### 3. アクセシビリティを確認する

追加したら、コントラストが基準を満たすか検査します。

```ts
import { checkTheme, findContrastIssues } from "@platform/theme";

console.log(checkTheme(oceanTheme));            // light/dark のコントラスト一覧
console.log(findContrastIssues([oceanTheme]));  // AA 未達のペアだけ抽出
```

**色選びの目安（WCAG AA）**:

- `fg`（本文）と `bg`（背景）: コントラスト比 **4.5 以上**（必須）
- `primaryFg`（ボタン文字）と `primary`（ボタン背景）: **4.5 以上**（必須）
- `muted`（補助テキスト）と `bg`: できれば 4.5 以上（デザイン優先で下回る場合は、重要情報に muted を使わない）

コントラストが足りないときは、`@platform/color` の `darken` / `lighten` で主色を調整するか、`primaryFg` を白⇔濃色で切り替えると通しやすくなります。

### トークンの意味（色の役割）

| トークン | 役割 | 使いどころ |
|---|---|---|
| `bg` / `fg` | 背景 / 本文文字 | ページ全体 |
| `muted` | 補助文字 | キャプション・注釈 |
| `surface` / `border` | パネル背景 / 枠線 | カード・入力欄 |
| `primary` / `primaryFg` | 主色 / その上の文字 | 主ボタン・リンク・強調 |
| `accent` | 副アクセント | タグ・補助的な強調 |
| `success` / `warning` / `danger` | 状態色 | 成功・注意・エラー表示 |

### 命名のコツ

- `id` は短く一意に（`ocean`、`spring-2026` など）。
- `name` は利用者に伝わる日本語で（「オーシャン」「春の新色」）。
- 季節限定・イベント用テーマも同じ仕組みで足せます。不要になったら配列から外すだけです。

## 横の案内(サイドバー)に色を付ける

テーマに次の 4 項目を足すと、案内だけ濃い色にできます。**省略すれば従来どおり**（`surface` と同じ）です。

```ts
modes: {
  light: {
    …,
    sidebarBg: "#1e293b", sidebarFg: "#e2e8f0",
    sidebarActiveBg: "#334155", sidebarActiveFg: "#ffffff",
  },
}
```

組み込みでは **ネイビーサイド / フォレストサイド / ワインサイド** の 3 つが対応しています。

| 気をつけること | 内容 |
|---|---|
| **背景だけ濃くしない** | `sidebarFg` を必ず一緒に決める。文字が読めなくなる |
| **暗いモードも決める** | 明るいモードの色をそのまま使うと眩しい |
| **選択中の色も要る** | 濃い背景に固定色（白系）を重ねると、選択中だけ浮いて読めない |
| コントラストを確認 | `checkTheme()` が AA 基準を判定する。組み込み 14 テーマはすべて適合 |

`Sidebar` と `NavMenu` はこの変数を見るので、**アプリ側のコード変更は不要**です。
