/**
 * ログ行の解析(レベル判定・フィルタ)。純ロジック。
 * @packageDocumentation
 */

/** ログレベル。 */
export type LogLevel = "error" | "warn" | "info" | "debug";

/** 重要度の高い順。 */
export const LOG_LEVELS: LogLevel[] = ["error", "warn", "info", "debug"];

const SEVERITY: Record<LogLevel, number> = { error: 4, warn: 3, info: 2, debug: 1 };

function mapToken(token: string): LogLevel {
  const t = token.toUpperCase();
  if (t === "FATAL" || t === "ERROR" || t === "ERR") return "error";
  if (t.startsWith("WARN")) return "warn";
  if (t === "INFO" || t === "NOTICE") return "info";
  return "debug"; // DEBUG / TRACE / VERBOSE
}

/** 行からログレベルを判定する(先頭寄りの大文字トークンを優先)。 */
export function detectLogLevel(line: string): LogLevel | null {
  const upper = line.match(/\b(FATAL|ERROR|ERR|WARNING|WARN|INFO|NOTICE|DEBUG|TRACE|VERBOSE)\b/);
  if (upper) return mapToken(upper[1]!);
  const lower = line.match(/\b(fatal|error|warning|warn|info|notice|debug|trace|verbose)\b/i);
  if (lower) return mapToken(lower[1]!);
  return null;
}

/** 解析済みのログ行。 */
export interface LogLine { index: number; line: string; level: LogLevel | null; timestamp: number | null; message: string | null; fields?: Record<string, string> }

/** 行配列を解析してレベル・時刻(・構造化フィールド)を付与する。 */
export function parseLogLines(lines: string[], options: { structured?: boolean } = {}): LogLine[] {
  return lines.map((line, index) => {
    if (options.structured) {
      const st = parseStructuredLog(line);
      if (st) return { index, line, level: st.level ?? detectLogLevel(line), timestamp: st.timestamp ?? extractTimestamp(line), message: st.message, fields: st.fields };
    }
    return { index, line, level: detectLogLevel(line), timestamp: extractTimestamp(line), message: null };
  });
}

/** フィルタ条件。 */
export interface LogFilter {
  /** これらのレベルのみ表示。 */
  levels?: LogLevel[];
  /** この重要度以上のみ表示。 */
  minLevel?: LogLevel;
  /** 語(空白区切り)をすべて含む行のみ(AND)。 */
  query?: string;
  /** 正規表現に一致する行のみ(query と併用可)。 */
  regex?: string;
  caseSensitive?: boolean;
}

/** 解析済みログ行をフィルタする。 */
export function filterLogLines(parsed: LogLine[], options: LogFilter = {}): LogLine[] {
  const { levels, minLevel, query, regex, caseSensitive } = options;
  const minSev = minLevel ? SEVERITY[minLevel] : 0;
  const terms = (query ?? "").split(/\s+/).filter(Boolean).map((t) => (caseSensitive ? t : t.toLowerCase()));
  let re: RegExp | null = null;
  if (regex) { try { re = new RegExp(regex, caseSensitive ? "" : "i"); } catch { re = null; } }
  return parsed.filter((p) => {
    if (levels && (p.level == null || !levels.includes(p.level))) return false;
    if (minSev > 0 && (p.level == null || SEVERITY[p.level] < minSev)) return false;
    if (terms.length) {
      const hay = caseSensitive ? p.line : p.line.toLowerCase();
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    if (re && !re.test(p.line)) return false;
    return true;
  });
}

/** レベル別の件数を数える。 */
export function countByLevel(parsed: LogLine[]): Record<LogLevel | "none", number> {
  const out: Record<LogLevel | "none", number> = { error: 0, warn: 0, info: 0, debug: 0, none: 0 };
  for (const p of parsed) out[p.level ?? "none"]++;
  return out;
}

const TS_RE = /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/;

/** 行からタイムスタンプ(epoch ms)を抽出する。無ければ null。 */
export function extractTimestamp(line: string): number | null {
  const m = line.match(TS_RE);
  if (!m) return null;
  const ms = Date.parse(m[1]!.replace(" ", "T"));
  return Number.isNaN(ms) ? null : ms;
}

/** 時間バケット(レベル別件数つき)。 */
export interface TimeBucket { start: number; counts: Record<LogLevel | "none", number>; total: number }

/** タイムスタンプを持つ行を intervalMs 単位で集計する(時系列ミニチャート用)。 */
export function bucketByTime(parsed: LogLine[], intervalMs: number): TimeBucket[] {
  const withTs = parsed.filter((p) => p.timestamp != null);
  if (withTs.length === 0 || intervalMs <= 0) return [];
  const times = withTs.map((p) => p.timestamp!);
  const min = Math.min(...times);
  const max = Math.max(...times);
  const startBucket = Math.floor(min / intervalMs) * intervalMs;
  const buckets = new Map<number, TimeBucket>();
  for (let b = startBucket; b <= max; b += intervalMs) buckets.set(b, { start: b, counts: { error: 0, warn: 0, info: 0, debug: 0, none: 0 }, total: 0 });
  for (const p of withTs) {
    const b = Math.floor(p.timestamp! / intervalMs) * intervalMs;
    const bk = buckets.get(b);
    if (bk) { bk.counts[p.level ?? "none"]++; bk.total++; }
  }
  return [...buckets.values()].sort((a, b) => a.start - b.start);
}

/** 行(文字列 or LogLine)をテキスト化する(コピー/ダウンロード用)。 */
export function logLinesToText(lines: Array<LogLine | string>): string {
  return lines.map((l) => (typeof l === "string" ? l : l.line)).join("\n");
}

const LOCALE_TAG: Record<string, string> = { ja: "ja-JP", en: "en-US", zh: "zh-CN", ko: "ko-KR" };

/** 相対時刻(例: 3分前)。Intl.RelativeTimeFormat 利用。 */
export function formatRelativeTime(fromMs: number, nowMs: number = Date.now(), locale = "ja"): string {
  const diff = fromMs - nowMs;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(LOCALE_TAG[locale] ?? locale, { numeric: "auto" });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [["day", 86400000], ["hour", 3600000], ["minute", 60000], ["second", 1000]];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === "second") return rtf.format(Math.round(diff / ms), unit);
  }
  return rtf.format(0, "second");
}

function normalizeLevel(v: string): LogLevel | null {
  const t = v.toUpperCase();
  if (t === "ERROR" || t === "ERR" || t === "FATAL" || t === "CRITICAL" || t === "CRIT") return "error";
  if (t.startsWith("WARN")) return "warn";
  if (t === "INFO" || t === "NOTICE") return "info";
  if (t === "DEBUG" || t === "TRACE" || t === "VERBOSE") return "debug";
  return null;
}

function parseTsValue(v: string): number | null {
  if (/^\d+$/.test(v)) { const n = Number(v); return v.length <= 10 ? n * 1000 : n; }
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : ms;
}

/** 構造化ログ 1 行の解析結果。 */
export interface StructuredLog {
  fields: Record<string, string>;
  level: LogLevel | null;
  timestamp: number | null;
  message: string | null;
}

/** JSON もしくは logfmt(key=value)のログ行を解析する。非対応形式は null。 */
export function parseStructuredLog(line: string): StructuredLog | null {
  const trimmed = line.trim();
  const fields: Record<string, string> = {};
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj: unknown = JSON.parse(trimmed);
      if (!obj || typeof obj !== "object") return null;
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        fields[k] = v !== null && typeof v === "object" ? JSON.stringify(v) : String(v);
      }
    } catch { return null; }
  } else {
    const re = /(\w[\w.-]*)=("([^"]*)"|'([^']*)'|\S+)/g;
    let m: RegExpExecArray | null;
    let found = false;
    while ((m = re.exec(trimmed))) { found = true; fields[m[1]!] = m[3] ?? m[4] ?? m[2]!; }
    if (!found) return null;
  }
  const levelRaw = fields.level ?? fields.lvl ?? fields.severity ?? fields.l;
  const tsRaw = fields.ts ?? fields.time ?? fields.timestamp ?? fields["@timestamp"];
  return {
    fields,
    level: levelRaw ? normalizeLevel(levelRaw) : null,
    timestamp: tsRaw ? parseTsValue(tsRaw) : null,
    message: fields.msg ?? fields.message ?? null,
  };
}

/** timestamp が ms 以上の最初の行の原インデックスを返す(時系列ジャンプ用)。無ければ -1。 */
export function firstLineIndexAtOrAfter(parsed: LogLine[], ms: number): number {
  for (const p of parsed) if (p.timestamp != null && p.timestamp >= ms) return p.index;
  return -1;
}

/** 構造化ログに含まれるフィールドキーを列挙する(出現順・重複なし)。 */
export function collectFieldKeys(parsed: LogLine[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parsed) {
    if (!p.fields) continue;
    for (const k of Object.keys(p.fields)) if (!seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

/** あるフィールドの値ごとの件数(ファセット)。件数降順。 */
export function fieldFacets(parsed: LogLine[], key: string): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const p of parsed) {
    const v = p.fields?.[key];
    if (v == null) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** フィールド値でフィルタする(キー間は AND、値内は OR)。値配列が空のキーは無視。 */
export function filterByFields(parsed: LogLine[], filters: Record<string, string[]>): LogLine[] {
  const active = Object.entries(filters).filter(([, vals]) => vals.length > 0);
  if (active.length === 0) return parsed;
  return parsed.filter((p) =>
    active.every(([key, vals]) => {
      const v = p.fields?.[key];
      return v != null && vals.includes(v);
    }),
  );
}

/** ストリーム用: buffer に incoming を足し、末尾 max 件に丸める。 */
export function appendCapped<T>(buffer: readonly T[], incoming: readonly T[], max: number): T[] {
  const combined = buffer.concat(incoming as T[]);
  return max > 0 && combined.length > max ? combined.slice(combined.length - max) : combined;
}
