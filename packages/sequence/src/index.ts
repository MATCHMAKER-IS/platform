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
  /**
   * ゼロ埋めの桁数(例 6 → `"000123"`)。既定 0(埋めない)。
   *
   * **桁を超えたら例外を投げる。** `padding: 4` で 10001 件目が来ると
   * 番号が 1 桁伸びるが、それを黙って通すと**固定長を前提にした処理が壊れる**
   * ——全銀ファイルや CSV の桁揃えが崩れ、DB の `varchar(N)` で切れ、
   * 番号でソートすると順序が狂う(文字列比較なので `10000 < 9999`)。
   *
   * **黙って形式が変わる方が危ない**ので、気づける形にする(2026-08)。
   * 桁が足りなくなったら `padding` を増やすか、期間でリセットすること
   * (`resetPeriod: "yearly"` なら年ごとに 1 へ戻る)。
   */
  padding?: number;
  /**
   * 桁あふれを許すか(既定 `false`)。
   *
   * `true` にすると、桁を超えても例外を投げずにそのまま伸びる。
   * **固定長を前提にしていない用途**(画面の表示だけ、など)でのみ使うこと。
   */
  allowOverflow?: boolean;
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

/**
 * 期間トークンを作る(リセット単位を表す文字列)。
 *
 * **「年度で連番をリセットする」を実現する**ための鍵。
 * 同じトークンの間は連番が続き、変わると 1 に戻る。
 *
 * @param period リセット単位(`never` / `yearly` / `monthly` / `daily`)
 * @param now 基準日(テスト注入用)
 * @param fiscalStartMonth 期初の月（**4 月始まりなら 4**。年度で区切るときに使う）
 * @returns 期間トークン(`2026` / `2026-07` など)
 */
export function periodToken(period: ResetPeriod, now: Date, fiscalStartMonth: number): string {
  // **JST で年月を取る。** `getFullYear()` / `getMonth()` は**サーバのタイムゾーン**に
  // 依存する。UTC で動くサーバ(クラウドの既定)だと、JST の 8/1 00:30 はまだ 7 月なので、
  // **月次リセットの採番で 8 月最初の伝票に 7 月の連番が払い出される**。
  // 昼間に試すと必ず通り、深夜の申請でだけ起きるので気づけない(2026-08 に修正)。
  // JST は UTC+9。**9 時間ずらしてから UTC として読む**のが最小の実装。
  // `@platform/datetime` の `formatMonthJst` と同じ計算だが、
  // 採番のためだけに依存を増やさない(この 1 行以外に日時の処理は無い)。
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString();
  const y = Number(jst.slice(0, 4));
  const m = Number(jst.slice(5, 7));
  if (period === "never") return "";
  if (period === "yearly") return String(y);
  if (period === "monthly") return `${y}${String(m).padStart(2, "0")}`;
  // fiscalYearly: 開始月より前なら前年度
  const fiscalYear = m >= fiscalStartMonth ? y : y - 1;
  return `FY${fiscalYear}`;
}

/**
 * 採番器を作る。
 *
 * **請求書番号・受付番号など、飛び番のない連番**を作る。
 * 採番の状態はストアが持つので、**複数プロセスでも重複しない**
 * (メモリ実装を除く)。
 *
 * @param store 採番の状態を持つストア
 * @param name 採番の名前（**種類ごとに分ける**。請求書と見積で別の連番にする）
 * @param options.prefix 接頭辞(`INV-` など)
 * @param options.resetPeriod 採番をリセットする単位(年度・月など)。
 *   `fiscalStartMonth` は年度の開始月、`prefix` / `suffix` / `separator` / `padding` は書式
 * @param options.padding ゼロ埋めの桁数
 * @returns 採番器(`next` で次の番号)
 * @throws 採番の形式が不正な場合（**桁が足りないと請求書番号が重複します**）
 */
export function createSequencer(store: SequenceStore, name: string, options: SequenceOptions = {}): Sequencer {
  const { prefix = "", suffix = "", padding = 0, resetPeriod = "never", separator = "-", fiscalStartMonth = 4, allowOverflow = false } = options;

  function keyFor(now: Date = new Date()): string {
    const token = periodToken(resetPeriod, now, fiscalStartMonth);
    return token ? `${name}:${token}` : name;
  }

  function format(seq: number, now: Date): string {
    const token = periodToken(resetPeriod, now, fiscalStartMonth);
    const raw = String(seq);
    // **桁あふれを黙って通さない。** 番号の長さが変わると、
    // 固定長を前提にした処理(帳票の桁揃え・DB の varchar・文字列ソート)が壊れる
    if (padding > 0 && raw.length > padding && !allowOverflow) {
      throw new Error(
        `採番が ${padding} 桁を超えました(${raw})。padding を増やすか、resetPeriod で期間ごとに戻してください`,
      );
    }
    const num = padding > 0 ? raw.padStart(padding, "0") : raw;
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

/**
 * 採番ストアのメモリ実装(開発・テスト用)。
 *
 * **複数プロセスでは番号が重複する**(プロセスごとに別のカウンタを持つため)。
 * **本番では DB か Redis の実装に差し替えること**。請求書番号が重複すると、
 * 会計上の問題になる。
 *
 * @returns ストア
 */
export function createMemorySequenceStore(): SequenceStore & { reset(): void } {
  const counters = new Map<string, number>();
  return {
    next(key) { const v = (counters.get(key) ?? 0) + 1; counters.set(key, v); return v; },
    peek(key) { return counters.get(key) ?? 0; },
    reset() { counters.clear(); },
  };
}
