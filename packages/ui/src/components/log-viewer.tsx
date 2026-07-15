"use client";
/**
 * ログ/長文ビューア。折り返し・行番号・検索ハイライト・レベル色分け/フィルタに加え、
 * 時系列ミニチャート・正規表現フィルタ・相対時刻・コピー/ダウンロードに対応。
 * @packageDocumentation
 */
import * as React from "react";
import { wrapText } from "@platform/utils";
import { cn } from "../lib/cn.js";
import { Highlight } from "./highlight.js";
import {
  parseLogLines, filterLogLines, countByLevel, bucketByTime, logLinesToText, formatRelativeTime, firstLineIndexAtOrAfter,
  collectFieldKeys, fieldFacets, filterByFields,
  LOG_LEVELS, type LogLevel,
} from "../lib/log.js";

/** {@link LogViewer} の props。 */
export interface LogViewerProps {
  text?: string;
  lines?: string[];
  wrapWidth?: number;
  showLineNumbers?: boolean;
  /** ハイライトする検索語(空白区切りで複数語)。 */
  highlightQuery?: string;
  colorByLevel?: boolean;
  /** レベルトグル・正規表現・コピー/DLのツールバーを表示。 */
  showToolbar?: boolean;
  /** 時系列ミニチャートを表示(タイムスタンプがある場合)。 */
  showTimeline?: boolean;
  /** 相対時刻列を表示。 */
  showRelativeTime?: boolean;
  /** 構造化ログ(JSON/logfmt)として解析し message を表示。 */
  structured?: boolean;
  /** 末尾に自動追尾(lines 変化時に最下部へスクロール)。 */
  follow?: boolean;
  /** 構造化フィールドを列表示する(structured 必須)。 */
  tableFields?: string[];
  /** フィールド値でのファセット絞り込みパネルを表示。 */
  facetFields?: string[];
  /** 相対時刻の基準(既定 Date.now())。 */
  now?: number;
  /** ダウンロード時のファイル名。 */
  downloadFilename?: string;
  height?: number;
  className?: string;
}

const LEVEL_TEXT: Record<LogLevel, string> = { error: "text-red-600", warn: "text-amber-600", info: "text-blue-600", debug: "text-[var(--color-muted)]" };
const LEVEL_BORDER: Record<LogLevel, string> = { error: "border-l-red-400", warn: "border-l-amber-400", info: "border-l-blue-400", debug: "border-l-slate-300" };
const LEVEL_MARK: Record<LogLevel, string> = { error: "bg-red-200 text-red-900", warn: "bg-amber-200 text-amber-900", info: "bg-blue-200 text-blue-900", debug: "bg-yellow-200" };
const LEVEL_BG: Record<LogLevel, string> = { error: "bg-red-400", warn: "bg-amber-400", info: "bg-blue-400", debug: "bg-slate-300" };

/** ログ/長文ビューア。 */
export function LogViewer({
  text, lines, wrapWidth = 0, showLineNumbers = true, highlightQuery,
  colorByLevel = true, showToolbar = false, showTimeline = false, showRelativeTime = false,
  structured = false, follow = false, tableFields, facetFields, now, downloadFilename = "log.txt", height = 320, className,
}: LogViewerProps) {
  const raw = lines ?? (text ?? "").split(/\r?\n/);
  const parsed = React.useMemo(() => parseLogLines(raw, { structured }), [raw, structured]);
  const counts = React.useMemo(() => countByLevel(parsed), [parsed]);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [following, setFollowing] = React.useState(follow);
  const [active, setActive] = React.useState<Set<LogLevel>>(() => new Set(LOG_LEVELS));
  const [regex, setRegex] = React.useState("");
  const [facets, setFacets] = React.useState<Record<string, string[]>>({});
  const toggleFacet = (key: string, val: string) => setFacets((prev) => {
    const cur = prev[key] ?? [];
    const next = cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val];
    return { ...prev, [key]: next };
  });
  const toggle = (lvl: LogLevel) => setActive((prev) => { const n = new Set(prev); if (n.has(lvl)) n.delete(lvl); else n.add(lvl); return n; });

  const filtered = React.useMemo(() => {
    if (!showToolbar) return parsed;
    let base = filterLogLines(parsed, { levels: [...active], regex: regex || undefined }).concat(parsed.filter((p) => p.level == null));
    base = base.sort((a, b) => a.index - b.index).filter((v, i, arr) => arr.indexOf(v) === i);
    return filterByFields(base, facets);
  }, [parsed, active, regex, facets, showToolbar]);

  const buckets = React.useMemo(() => {
    if (!showTimeline) return [];
    const withTs = parsed.filter((p) => p.timestamp != null);
    if (withTs.length < 2) return [];
    const times = withTs.map((p) => p.timestamp!);
    const span = Math.max(1, Math.max(...times) - Math.min(...times));
    const interval = Math.max(1000, Math.ceil(span / 40));
    return bucketByTime(parsed, interval);
  }, [parsed, showTimeline]);
  const maxBucket = Math.max(1, ...buckets.map((b) => b.total));

  const rendered: Array<{ n: number | null; content: string; level: LogLevel | null; ts: number | null }> = [];
  for (const p of filtered) {
    const display = structured && p.message != null ? `${p.level ? `[${p.level}] ` : ""}${p.message}` : p.line;
    const wrapped = wrapWidth > 0 ? wrapText(display, wrapWidth) : [display];
    wrapped.forEach((w, wi) => rendered.push({ n: wi === 0 ? p.index + 1 : null, content: w, level: p.level, ts: wi === 0 ? p.timestamp : null }));
  }

  React.useEffect(() => {
    if (following && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [rendered.length, following]);

  const jumpTo = (ms: number) => {
    const idx = firstLineIndexAtOrAfter(filtered, ms);
    if (idx < 0 || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-line="${idx + 1}"]`) as HTMLElement | null;
    if (el) el.scrollIntoView({ block: "center" });
    setFollowing(false);
  };

  const copy = () => { void navigator.clipboard?.writeText(logLinesToText(filtered)); };
  const download = () => {
    const blob = new Blob([logLinesToText(filtered)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = downloadFilename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn("flex flex-col rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]", className)}>
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-1 border-b border-[var(--color-border)] px-2 py-1.5 text-xs">
          {LOG_LEVELS.map((lvl) => (
            <button key={lvl} type="button" onClick={() => toggle(lvl)}
              className={cn("rounded px-2 py-0.5 font-medium capitalize", active.has(lvl) ? cn("bg-[var(--color-muted)]/15", LEVEL_TEXT[lvl]) : "text-[var(--color-muted)] line-through opacity-60")}>
              {lvl}<span className="ml-1 tabular-nums">{counts[lvl]}</span>
            </button>
          ))}
          <input value={regex} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegex(e.target.value)} placeholder="/regex/"
            className="ml-1 w-28 rounded border border-[var(--color-border)] bg-transparent px-2 py-0.5 font-mono outline-none" />
          <div className="ml-auto flex items-center gap-1">
            <span className="text-[var(--color-muted)]">{rendered.length} 行</span>
            <button type="button" onClick={() => setFollowing((f) => !f)} className={cn("rounded px-2 py-0.5 hover:bg-[var(--color-muted)]/15", following && "text-[var(--color-primary)] font-semibold")}>{following ? "追尾中" : "追尾"}</button>
            <button type="button" onClick={copy} className="rounded px-2 py-0.5 hover:bg-[var(--color-muted)]/15">コピー</button>
            <button type="button" onClick={download} className="rounded px-2 py-0.5 hover:bg-[var(--color-muted)]/15">保存</button>
          </div>
        </div>
      )}

      {facetFields && facetFields.length > 0 && (
        <div className="flex flex-col gap-1 border-b border-[var(--color-border)] px-2 py-1.5 text-xs">
          {facetFields.map((key) => (
            <div key={key} className="flex flex-wrap items-center gap-1">
              <span className="mr-1 font-semibold text-[var(--color-muted)]">{key}:</span>
              {fieldFacets(parsed, key).slice(0, 8).map((f) => {
                const on = (facets[key] ?? []).includes(f.value);
                return (
                  <button key={f.value} type="button" onClick={() => toggleFacet(key, f.value)}
                    className={cn("rounded px-2 py-0.5", on ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)] font-medium" : "bg-[var(--color-muted)]/10")}>
                    {f.value}<span className="ml-1 tabular-nums opacity-70">{f.count}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {showTimeline && buckets.length > 0 && (
        <div className="flex items-end gap-px border-b border-[var(--color-border)] px-2 py-1" style={{ height: 44 }} title="時系列(レベル別件数)">
          {buckets.map((b, i) => (
            <div key={i} onClick={() => jumpTo(b.start)} title={new Date(b.start).toLocaleTimeString()} className="flex flex-1 cursor-pointer flex-col-reverse hover:opacity-70" style={{ height: "100%" }}>
              {LOG_LEVELS.map((lvl) => b.counts[lvl] > 0 && (
                <div key={lvl} className={LEVEL_BG[lvl]} style={{ height: `${(b.counts[lvl] / maxBucket) * 100}%` }} />
              ))}
            </div>
          ))}
        </div>
      )}

      {tableFields && tableFields.length > 0 ? (
        <div ref={scrollRef} className="overflow-auto text-xs" style={{ height }}>
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[var(--color-bg)]">
              <tr className="text-left text-[var(--color-muted)]">
                <th className="px-2 py-1 font-medium">#</th>
                {showRelativeTime && <th className="px-2 py-1 font-medium">time</th>}
                <th className="px-2 py-1 font-medium">level</th>
                {tableFields.map((f) => <th key={f} className="px-2 py-1 font-medium">{f}</th>)}
                <th className="px-2 py-1 font-medium">message</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.index} data-line={p.index + 1} className="border-t border-[var(--color-border)] hover:bg-[var(--color-muted)]/10">
                  <td className="px-2 py-1 align-top text-[var(--color-muted)] tabular-nums">{p.index + 1}</td>
                  {showRelativeTime && <td className="whitespace-nowrap px-2 py-1 align-top text-[var(--color-muted)]">{p.timestamp != null ? formatRelativeTime(p.timestamp, now) : ""}</td>}
                  <td className={cn("px-2 py-1 align-top font-medium capitalize", p.level ? LEVEL_TEXT[p.level] : "")}>{p.level ?? ""}</td>
                  {tableFields.map((f) => <td key={f} className="px-2 py-1 align-top font-mono">{highlightQuery ? <Highlight text={p.fields?.[f] ?? ""} query={highlightQuery} multiWord /> : (p.fields?.[f] ?? "")}</td>)}
                  <td className="px-2 py-1 align-top">{highlightQuery ? <Highlight text={p.message ?? ""} query={highlightQuery} multiWord markClassName={colorByLevel && p.level ? LEVEL_MARK[p.level] : undefined} /> : (p.message ?? "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
      <div ref={scrollRef} className="overflow-auto font-mono text-xs leading-relaxed" style={{ height }}>
        <table className="w-full border-collapse">
          <tbody>
            {rendered.map((r, i) => (
              <tr key={i} data-line={r.n ?? undefined} className="hover:bg-[var(--color-muted)]/10">
                {showLineNumbers && (
                  <td className="select-none whitespace-nowrap border-r border-[var(--color-border)] px-2 text-right align-top text-[var(--color-muted)]">{r.n ?? ""}</td>
                )}
                {showRelativeTime && (
                  <td className="select-none whitespace-nowrap border-r border-[var(--color-border)] px-2 align-top text-[var(--color-muted)]">
                    {r.ts != null ? formatRelativeTime(r.ts, now) : ""}
                  </td>
                )}
                <td className={cn("whitespace-pre-wrap px-3 align-top", colorByLevel && r.level ? cn("border-l-2", LEVEL_BORDER[r.level], LEVEL_TEXT[r.level]) : "border-l-2 border-l-transparent")}>
                  {highlightQuery
                    ? <Highlight text={r.content} query={highlightQuery} multiWord markClassName={colorByLevel && r.level ? LEVEL_MARK[r.level] : undefined} />
                    : (r.content || "\u00a0")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
