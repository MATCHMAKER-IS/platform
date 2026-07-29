"use client";
/**
 * 「次に見るもの」の案内。
 *
 * 63 のデモがあっても、**関連が示されないと 1 つ見て終わる**。
 * 実際、デモ同士のリンクはほとんど無く、
 * 「これを見た人が次に見たいもの」に辿り着けなかった。
 *
 * 関連は 2 つの手がかりで決める:
 *   1. **同じ基盤を使っている**（実装で繋がる）
 *   2. **同じ分類にある**（用途で繋がる）
 *
 * 手で紐づけを書かないのは、デモが増えるたびに古くなるため。
 * `nav.ts` の情報から毎回計算する。
 */
import * as React from "react";
import { usePathname } from "next/navigation";
import { PLATFORM_DEMOS } from "../lib/nav";

/**
 * ほとんどの画面が使う基盤。関連の判断から外す。
 * これを数えると「どの画面とも関連がある」ことになり、案内の役に立たない。
 */
const COMMON = ["ui", "core", "utils", "theme"];

/** {@link NextDemos} の props。 */
export interface NextDemosProps {
  /** いま見ている画面の URL（省略すると今のパスを使う）。 */
  current?: string;
  /** 出す件数（既定 4）。 */
  limit?: number;
}

/**
 * 同じ基盤・同じ分類のデモを、関連の強い順に返す。
 *
 * @param current いま見ている画面
 * @param limit   件数
 * @returns 関連するデモ
 */
function relatedTo(current: string, limit: number) {
  const me = PLATFORM_DEMOS.find((d) => d.href === current);
  if (!me) return [];

  return PLATFORM_DEMOS
    .filter((d) => d.href !== current)
    .map((d) => {
      // ほとんどの画面が使う基盤(ui など)は、共有していても「関連」にならない。
      // これを数えると、ログイン画面の関連にグラフが出るような結果になる。
      const shared = d.packages.filter((p) => me.packages.includes(p) && !COMMON.includes(p)).length;
      // 同じ分類なら用途が近い。基盤より分類を重く見る
      const sameGroup = d.group === me.group ? 4 : 0;
      return { demo: d, score: shared * 3 + sameGroup };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.demo);
}

/**
 * 画面の下に置く「次に見るもの」。
 *
 * @example
 * ```tsx
 * <NextDemos current="/attendance" />
 * ```
 */
export function NextDemos({ current, limit = 4 }: NextDemosProps) {
  const pathname = usePathname();
  const href = current ?? pathname;
  const items = React.useMemo(() => relatedTo(href, limit), [href, limit]);
  if (items.length === 0) return null;

  return (
    <section style={{ marginTop: 20 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>次に見るもの</div>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {items.map((d) => (
          <a
            key={d.href}
            href={d.href}
            style={{
              display: "block",
              padding: "10px 12px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius)",
              background: "var(--color-surface)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 3 }}>{d.title}</div>
            <div style={{ fontSize: 11, color: "var(--color-muted)", lineHeight: 1.7 }}>
              {d.desc.length > 46 ? `${d.desc.slice(0, 46)}…` : d.desc}
            </div>
          </a>
        ))}
      </div>
      <p style={{ fontSize: 11, color: "var(--color-muted)", margin: "8px 0 0" }}>
        同じ基盤を使っている・同じ分類にあるデモを出しています。<strong>⌘K</strong> で全体を検索できます。
      </p>
    </section>
  );
}
