/**
 * アプリデモの冒頭に出す説明。
 *
 * 「これは実物なのか、見本なのか」を**その場で**分かるようにする。
 * トップページの説明は、個別ページを直接開いた人には見えない。
 */
import * as React from "react";

/** {@link AppDemoNote} の props。 */
export interface AppDemoNoteProps {
  /**
   * `apps/` にある実物の名前。
   * 指定すると「実物の再現」、省略すると「見本」として説明が変わる。
   */
  source?: string;
  /** 実物での使われ方(一言)。 */
  usedFor?: string;
}

/**
 * アプリデモであることと、実物との関係を示す。
 *
 * @example
 * ```tsx
 * <AppDemoNote source="apps/internal-app" usedFor="経費・勤怠・請求などの社内業務" />
 * <AppDemoNote />   // apps/ に実物が無い見本
 * ```
 */
export function AppDemoNote({ source, usedFor }: AppDemoNoteProps) {
  return (
    <div
      style={{
        display: "flex", gap: 8, alignItems: "flex-start",
        padding: "10px 12px", marginBottom: 16,
        border: "1px solid var(--color-border)", borderRadius: "var(--radius)",
        background: "var(--color-subtle)",
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1.4 }}>{source ? "🏢" : "💡"}</span>
      <p style={{ fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.9, margin: 0 }}>
        {source ? (
          <>
            これは<strong>アプリデモ</strong>です。実物は <code>{source}</code> にあり、
            ここでは<strong>DB なしで動くようモックデータに置き換えて再現</strong>しています。
            {usedFor ? <>（実物では{usedFor}を扱います）</> : null}
            <br />
            <strong>コードは実物とは別物</strong>です。画面の見え方と作りを掴むためのもので、
            実装を写すときは実物の方を見てください。
          </>
        ) : (
          <>
            これは<strong>アプリデモ</strong>です。この画面は <code>apps/</code> に実物がなく、
            <strong>「こういう画面も作れる」を示す見本</strong>です。
            基盤の部品だけで、どこまで作れるかを確かめる場でもあります。
          </>
        )}
      </p>
    </div>
  );
}
