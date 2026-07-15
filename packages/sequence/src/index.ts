/**
 * `@platform/sequence` — 帳票番号などの連番採番(依存ゼロ)。
 *
 * 請求書番号・伝票番号の発番を、プレフィックス・ゼロ埋め・年度/月次リセット付きで統一する。
 * 実際のカウンタ永続化・原子的インクリメントは注入する {@link SequenceStore} に委譲する
 * (本番は DB の行ロックや Redis INCR で実装。重複しない発番を担保する)。
 * @packageDocumentation
 */

/** カウンタの永続ストア(原子的インクリメントを提供)。 */
export interface SequenceStore {
  /** key のカウンタを +1 して新しい値を返す(原子的であること)。 */
  next(key: string): Promise<number> | number;
  /** 現在値を参照(発番せず確認だけ)。未発番なら 0。 */
  peek?(key: string): Promise<number> | number;
}

/** リセット周期。 */
export type ResetPeriod = "never" | "yearly" | "fiscalYearly" | "monthly";

/** {@link createSequencer} のオプション。 */
export interface SequenceOptions {
  /** 番号のプレフィックス(例 "INV-")。 */
  prefix?: string;
  /** サフィックス。 */
  suffix?: string;
  /** ゼロ埋めの桁数(例 6 → "000123")。既定 0(埋めない)。 */
  padding?: number;
  /** リセット周期(既定 never)。yearly は暦年、fiscalYearly は年度(4月始まり)。 */
  resetPeriod?: ResetPeriod;
  /** 期間トークンと番号の区切り(例 "-")。既定 "-"。 */
  separator?: string;
  /** 年度開始月(fiscalYearly 用、既定 4)。 */
  fiscalStartMonth?: number;
}

/** 採番器。 */
export interface Sequencer {
  /** 次の番号を発番する(原子的)。 */
  next(now?: Date): Promise<string>;
  /** リセット周期を含むカウンタキーを返す(ストアのキー設計確認・テスト用)。 */
  keyFor(now?: Date): string;
}

/** 期間トークン(リセット単位を表す文字列)を作る。 */
export function periodToken(period: ResetPeriod, now: Date, fiscalStartMonth: number): string {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (period === "never") return "";
  if (period === "yearly") return String(y);
  if (period === "monthly") return `${y}${String(m).padStart(2, "0")}`;
  // fiscalYearly: 開始月より前なら前年度
  const fiscalYear = m >= fiscalStartMonth ? y : y - 1;
  return `FY${fiscalYear}`;
}

/** 採番器を作る。 */
export function createSequencer(store: SequenceStore, name: string, options: SequenceOptions = {}): Sequencer {
  const { prefix = "", suffix = "", padding = 0, resetPeriod = "never", separator = "-", fiscalStartMonth = 4 } = options;

  function keyFor(now: Date = new Date()): string {
    const token = periodToken(resetPeriod, now, fiscalStartMonth);
    return token ? `${name}:${token}` : name;
  }

  function format(seq: number, now: Date): string {
    const token = periodToken(resetPeriod, now, fiscalStartMonth);
    const num = padding > 0 ? String(seq).padStart(padding, "0") : String(seq);
    const middle = token ? `${token}${separator}${num}` : num;
    return `${prefix}${middle}${suffix}`;
  }

  return {
    async next(now = new Date()) {
      const seq = await store.next(keyFor(now));
      return format(seq, now);
    },
    keyFor,
  };
}

/** メモリ実装(開発・テスト用。本番は DB/Redis のストアに差し替え)。 */
export function createMemorySequenceStore(): SequenceStore & { reset(): void } {
  const counters = new Map<string, number>();
  return {
    next(key) { const v = (counters.get(key) ?? 0) + 1; counters.set(key, v); return v; },
    peek(key) { return counters.get(key) ?? 0; },
    reset() { counters.clear(); },
  };
}
