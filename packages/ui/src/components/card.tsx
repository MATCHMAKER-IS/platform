/**
 * 共通 Card。見出し・本文・フッターを持つカード。CardGrid でカード表示(グリッド)にできる。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/**
 * カード(囲み枠)。
 *
 * **関係のある情報をひとまとまりに見せる**ためのもの。
 * `CardHeader` / `CardTitle` / `CardContent` / `CardFooter` を組み合わせて使う。
 *
 * ダッシュボードのタイルには `DashboardWidget` があり、そちらは枠と見出しを
 * 自前で描く。**両方を重ねると枠が二重になる**ので、どちらかにする。
 *
 * ---
 * **背景トークンが設計意図と食い違っている(2026-08 に発見・未決)。**
 *
 * ここは `--color-bg`(本文と同じ白)を使っているが、`tokens.css` の
 * `--color-surface` には「**面(サイドナビ・カード・パネル)の背景**。
 * 本文の背景より一段沈ませる」と明記されている。つまり
 * **トークンが想定する用途と、この部品の実装が一致していない**。
 *
 * 結果として、アプリ側は `Card` を使わずに囲み枠を手書きしている:
 *
 * | | 件数 |
 * |---|---|
 * | `<Card>` を描画しているファイル | **4** |
 * | `const box: React.CSSProperties = {…}` を自作しているファイル | **59**(うち 49 が完全に同一) |
 *
 * **自作している 59 ファイルはすべて `@platform/ui` を import しているのに、
 * `Card` を 1 つも使っていない。** 部品を知らなかったのではなく、
 * 見た目が要件に合わなかったと考えるのが自然(自作側はいずれも
 * `--color-surface` を選んでいる)。
 *
 * **色の差は明暗とも約 4%**(明: `#ffffff` → `#f5f6f6` / 暗: `rgb(15,23,42)` → `rgb(24,32,50)`)。
 * 2026-08 に実測したところ、**見た目は大きく変わらない**ことが分かった
 * ——「全画面の見た目が変わるので目視が要る」と書いていたが、**負担は小さい**。
 *
 * 実測(2026-08):
 *   - 基盤の部品: `--color-bg` 45 ファイル / `--color-surface` 8 ファイル
 *   - アプリの画面: `--color-surface` 126 ファイル
 *     (うち **83 ファイルが完全に同一の `const box`** を自作している)
 *
 * **2026-08 に `--color-surface` へ寄せた**(この実装)。トークンの説明どおりになり、
 * 自作の `box` と同じ背景になった。
 *
 * **`const box` の 83 ファイルを機械的に `<Card>` へ置き換えるのは見送った。**
 * 試したところ、`<div style={box}>` → `<Card>` の置換で**閉じタグが `</div>` のまま残り、
 * 構造が壊れた**——開始と終了が対応しているかは、入れ子を追わないと判定できない。
 * さらに `Card` には `shadow-sm` があるので、**83 画面すべてに影が付く**という
 * 別の変更が混ざる。置き換えるなら 1 画面ずつ目視で確認すること。
 *
 * **背景が揃った時点で、混在の問題(同じ画面に沈んだ面と沈まない面)は解消している。**
 * 置き換えは「同じものを 2 通りで書かない」ための整理であって、急ぐ必要はない。
 *
 * @example
 * ```tsx
 * <Card>
 *   <CardHeader>
 *     <CardTitle>今月の請求</CardTitle>
 *     <CardDescription>2026 年 7 月分</CardDescription>
 *   </CardHeader>
 *   <CardContent>…明細…</CardContent>
 *   <CardFooter><Button>PDF を出す</Button></CardFooter>
 * </Card>
 * ```
 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // **面(カード・パネル)の背景は `--color-surface`。**
  // トークンの説明「本文の背景より一段沈ませる」に従う。
  // 2026-08 まで `--color-bg` を使っており、**同じ画面で自作の `box`(surface)と
  // 混在**していた。色の差は明暗とも約 4% なので見た目は大きく変わらない。
  //
  // **入力欄・ボタン・浮くもの(ドロップダウン等)は `--color-bg` のまま**にすること
  // ——入力欄が沈むと面と同化して境界が消え、浮くものは影で表現する必要がある。
  return <div className={cn("rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] shadow-sm", className)} {...props} />;
}
/** カード見出し領域。 */
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 p-4", className)} {...props} />;
}
/** カードタイトル。 */
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold leading-tight", className)} {...props} />;
}
/** カード説明文。 */
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-[var(--color-muted)]", className)} {...props} />;
}
/** カード本文。 */
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-0", className)} {...props} />;
}
/** カードフッター。 */
export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-2 p-4 pt-0", className)} {...props} />;
}

/** {@link CardGrid} の props。 */
export interface CardGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** カード最小幅(px)。これを下回らない範囲で自動的に列数が決まる。既定 260。 */
  minWidth?: number;
  /** カード間の間隔(px)。既定 16。 */
  gap?: number;
}
/** カードを敷き詰めるレスポンシブグリッド(カード表示)。 */
export function CardGrid({ minWidth = 260, gap = 16, className, style, ...props }: CardGridProps) {
  return (
    <div
      className={cn("grid", className)}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`, gap, ...style }}
      {...props}
    />
  );
}
