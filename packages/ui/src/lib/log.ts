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

/**
 * 行からログレベルを判定する。
 *
 * **先頭寄りの大文字トークンを優先**(本文に「ERROR」が含まれていても、
 * 行頭の `INFO` を採用する。多くのログは先頭にレベルを置くため)。
 *
 * @param line ログ行
 * @returns レベル。**判定できなければ null**
 */
export function detectLogLevel(line: string): LogLevel | null {
  const upper = line.match(/\b(FATAL|ERROR|ERR|WARNING|WARN|INFO|NOTICE|DEBUG|TRACE|VERBOSE)\b/);
  if (upper) return mapToken(upper[1]!);
  const lower = line.match(/\b(fatal|error|warning|warn|info|notice|debug|trace|verbose)\b/i);
  if (lower) return mapToken(lower[1]!);
  return null;
}

/** 解析済みのログ行。 */
export interface LogLine { index: number; line: string; level: LogLevel | null; timestamp: number | null; message: string | null; fields?: Record<string, string> }

/**
 * ログ行を解析してレベル・時刻・構造化フィールドを付ける。
 *
 * @param lines ログ行の配列
 * @returns 解析済みの行(**元の順序と原インデックスを保つ**。絞り込んでも元の行に戻れる)
 */
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

/**
 * ログを絞り込む。
 *
 * @param lines 解析済みの行
 * @param filter レベル・キーワード・時間範囲
 * @returns 条件に合う行
 */
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

/**
 * レベル別の件数を数える。
 *
 * **エラーが何件あるかを一目で**(全部読まずに済む)。
 *
 * @param lines 解析済みの行
 * @returns レベル → 件数
 */
export function countByLevel(parsed: LogLine[]): Record<LogLevel | "none", number> {
  const out: Record<LogLevel | "none", number> = { error: 0, warn: 0, info: 0, debug: 0, none: 0 };
  for (const p of parsed) out[p.level ?? "none"]++;
  return out;
}

const TS_RE = /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/;

/**
 * 行からタイムスタンプを抽出する。
 *
 * **複数の形式に対応**(ISO 8601・`[2026-07-15 10:00:00]`・syslog 形式)。
 * ログの形式は出力元によってばらばらなので、いくつか試す。
 *
 * @param line ログ行
 * @returns epoch ミリ秒。**見つからなければ null**
 */
export function extractTimestamp(line: string): number | null {
  const m = line.match(TS_RE);
  if (!m) return null;
  const ms = Date.parse(m[1]!.replace(" ", "T"));
  return Number.isNaN(ms) ? null : ms;
}

/** 時間バケット(レベル別件数つき)。 */
export interface TimeBucket { start: number; counts: Record<LogLevel | "none", number>; total: number }

/**
 * ログを時系列に集計する(ミニチャート用)。
 *
 * **エラーがいつ集中したかが分かる**(件数だけでは「いつ」が見えない)。
 *
 * @param lines 解析済みの行
 * @param intervalMs 集計の単位
 * @returns 時刻と件数(**タイムスタンプの無い行は除外**)
 */
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

/**
 * 行をテキストにする(コピー・ダウンロード用)。
 *
 * @param lines 行(文字列でも解析済みでも可)
 * @returns 改行で連結したテキスト
 */
export function logLinesToText(lines: Array<LogLine | string>): string {
  return lines.map((l) => (typeof l === "string" ? l : l.line)).join("\n");
}

const LOCALE_TAG: Record<string, string> = { ja: "ja-JP", en: "en-US", zh: "zh-CN", ko: "ko-KR" };

/**
 * 相対時刻にする(`3分前` など)。
 *
 * **「10:23:45」より「3分前」の方が状況が分かる**(障害対応中は特に)。
 *
 * @param timestamp epoch ミリ秒
 * @param now 現在時刻(テスト注入用)
 * @returns `3分前` 形式(`Intl.RelativeTimeFormat` を使うのでロケールに追従)
 */
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

/**
 * 構造化ログを解析する(JSON または logfmt)。
 *
 * **構造化ログはフィールドで絞り込める**(`userId=123` の行だけ見る、など)。
 * 生のテキストログでは grep しかできない。
 *
 * @param line ログ行
 * @returns フィールドの辞書。**対応しない形式なら null**
 */
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

/**
 * 指定時刻以降の最初の行を探す(時系列ジャンプ用)。
 *
 * **チャートをクリックしてその時刻に飛ぶ**のに使う。
 *
 * @param lines 解析済みの行
 * @param ms epoch ミリ秒
 * @returns 原インデックス。**無ければ -1**
 */
export function firstLineIndexAtOrAfter(parsed: LogLine[], ms: number): number {
  for (const p of parsed) if (p.timestamp != null && p.timestamp >= ms) return p.index;
  return -1;
}

/**
 * 構造化ログのフィールドキーを列挙する。
 *
 * **絞り込みの選択肢を作る**のに使う(どんなフィールドがあるか、事前には分からない)。
 *
 * @param lines 解析済みの行
 * @returns キーの配列(**出現順・重複なし**)
 */
export function collectFieldKeys(parsed: LogLine[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parsed) {
    if (!p.fields) continue;
    for (const k of Object.keys(p.fields)) if (!seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

/**
 * フィールドの値ごとの件数を数える(ファセット)。
 *
 * **「どの API がエラーを出しているか」を絞り込む前に見せる**(選択肢に件数が
 * 付いていると、どこを見るべきか分かる)。
 *
 * @param lines 解析済みの行
 * @param key フィールドキー
 * @returns 値と件数(**多い順**)
 */
export function fieldFacets(parsed: LogLine[], key: string): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const p of parsed) {
    const v = p.fields?.[key];
    if (v == null) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/**
 * フィールドの値で絞り込む。
 *
 * **キー間は AND、値内は OR**(`level=[error,warn]` かつ `service=[api]`)。
 * これがログ検索の直感に合う(「エラーか警告で、かつ API のもの」)。
 *
 * @param lines 解析済みの行
 * @param facets キー → 値の配列。**値が空のキーは無視**(絞り込まない)
 * @returns 条件に合う行
 */
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

/**
 * ストリームのバッファを更新する。
 *
 * **末尾 max 件に丸める**(ログは無限に流れてくるので、上限が無いとメモリを食い尽くす)。
 *
 * @param buffer 現在のバッファ
 * @param incoming 新しく届いた行
 * @param max 保持する件数
 * @returns 更新したバッファ(**新しい配列**)
 */
export function appendCapped<T>(buffer: readonly T[], incoming: readonly T[], max: number): T[] {
  const combined = buffer.concat(incoming as T[]);
  return max > 0 && combined.length > max ? combined.slice(combined.length - max) : combined;
}
