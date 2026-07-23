"use client";
/**
 * ソースの差分表示（Git のように + を緑、- をピンクで見せる）。
 *
 * 変更を人に見せる場面は多い——リビジョンの比較、承認前の確認、
 * 移行前後の対比。**何が変わったかを目で追える**ことが重要なので、
 * 行の追加・削除を色と記号の両方で示す。
 *
 * 差分の計算は基盤（@platform/cms の diffLines）に任せる。
 * LCS ベースなので、行の挿入があっても後続がずれない。
 */
import * as React from "react";
import { diffLines, type DiffLine } from "@platform/cms";

/** 表示の設定。 */
export interface CodeDiffProps {
  /** 変更前。 */
  before: string;
  /** 変更後。 */
  after: string;
  /** 左右に並べる（既定は 1 列に混ぜる）。 */
  split?: boolean;
  /** 変更のない行を省略する（長いファイル向け）。 */
  collapseUnchanged?: boolean;
  /** 省略しないで残す前後の行数（既定 2）。 */
  context?: number;
}

const mono: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12.5,
  lineHeight: 1.7,
  whiteSpace: "pre",
};

/** 行の背景と文字色。状態色なのでテーマによらず意味を固定する。 */
const ROW: Record<DiffLine["type"], React.CSSProperties> = {
  add: { background: "color-mix(in srgb, #16a34a 14%, transparent)" },
  del: { background: "color-mix(in srgb, #dc2626 12%, transparent)" },
  same: {},
};

const MARK: Record<DiffLine["type"], string> = { add: "+", del: "-", same: " " };

/** 変更のない行が続く箇所を「…」にまとめる。 */
function collapse(lines: DiffLine[], context: number): (DiffLine | { type: "gap"; count: number })[] {
  const keep = new Set<number>();
  lines.forEach((l, i) => {
    if (l.type === "same") return;
    for (let j = i - context; j <= i + context; j += 1) if (j >= 0 && j < lines.length) keep.add(j);
  });
  const out: (DiffLine | { type: "gap"; count: number })[] = [];
  let gap = 0;
  lines.forEach((l, i) => {
    if (keep.has(i)) {
      if (gap > 0) { out.push({ type: "gap", count: gap }); gap = 0; }
      out.push(l);
    } else {
      gap += 1;
    }
  });
  if (gap > 0) out.push({ type: "gap", count: gap });
  return out;
}

/**
 * 差分を 1 列で見せる（追加と削除を混ぜて並べる）。
 * 変更が少ないときはこちらが読みやすい。
 */
export function CodeDiff({ before, after, split, collapseUnchanged, context = 2 }: CodeDiffProps) {
  const lines = React.useMemo(() => diffLines(before, after), [before, after]);
  const added = lines.filter((l) => l.type === "add").length;
  const removed = lines.filter((l) => l.type === "del").length;

  const rows = React.useMemo(
    () => (collapseUnchanged ? collapse(lines, context) : lines),
    [lines, collapseUnchanged, context],
  );

  const frame: React.CSSProperties = {
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)",
    overflow: "hidden",
    background: "var(--color-surface)",
  };

  const header = (
    <div style={{
      display: "flex", gap: 12, alignItems: "center",
      padding: "6px 12px", borderBottom: "1px solid var(--color-border)",
      fontSize: 11.5, color: "var(--color-muted)",
    }}>
      <span style={{ color: "#16a34a" }}>+{added}</span>
      <span style={{ color: "#dc2626" }}>−{removed}</span>
      <span>{lines.length} 行を比較</span>
    </div>
  );

  if (split) {
    // 左右に並べる。行の対応を保つため、片側にしか無い行は空欄で埋める
    const left: (DiffLine | null)[] = [];
    const right: (DiffLine | null)[] = [];
    for (const l of lines) {
      if (l.type === "same") { left.push(l); right.push(l); }
      else if (l.type === "del") { left.push(l); right.push(null); }
      else { left.push(null); right.push(l); }
    }
    return (
      <div style={frame}>
        {header}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", overflowX: "auto" }}>
          {[left, right].map((side, si) => (
            <div key={si} style={{ borderRight: si === 0 ? "1px solid var(--color-border)" : undefined }}>
              <div style={{ padding: "4px 10px", fontSize: 11, color: "var(--color-muted)", borderBottom: "1px solid var(--color-border)" }}>
                {si === 0 ? "変更前" : "変更後"}
              </div>
              {side.map((l, i) => (
                <div key={i} style={{ ...mono, ...(l ? ROW[l.type] : { background: "var(--color-subtle)" }), padding: "0 10px", minHeight: "1.7em" }}>
                  {l ? `${MARK[l.type]} ${l.text}` : ""}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={frame}>
      {header}
      <div style={{ overflowX: "auto" }}>
        {rows.map((r, i) =>
          "count" in r ? (
            <div key={i} style={{ ...mono, padding: "2px 10px", color: "var(--color-muted)", background: "var(--color-subtle)" }}>
              … 変更のない {r.count} 行
            </div>
          ) : (
            <div key={i} style={{ ...mono, ...ROW[r.type], padding: "0 10px" }}>
              <span style={{ userSelect: "none", opacity: 0.6, marginRight: 6 }}>{MARK[r.type]}</span>
              {r.text}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
