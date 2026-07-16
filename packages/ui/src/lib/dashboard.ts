/**
 * ダッシュボード可視化の純ロジック。
 * 構成比・ドーナツの円弧・目標達成率・ファネルの比率・相対時刻を計算する。
 * コンポーネント(donut-chart / breakdown-bar / funnel / goal-progress / freshness-indicator)が使う。
 * @packageDocumentation
 */

/** 値の構成比(合計に対する割合)。 */
export interface Share {
  value: number;
  /** 0..1 の割合。 */
  ratio: number;
  /** パーセント(小数第1位)。 */
  percent: number;
}

/**
 * 数値を構成比に変換する。
 *
 * @param values 数値の配列
 * @returns 各要素の比率(0–1)。**合計が 0 なら全て 0**(0 除算を避ける)
 */
export function computeShares(values: number[]): Share[] {
  const total = values.reduce((s, v) => s + Math.max(0, v), 0);
  return values.map((v) => {
    const value = Math.max(0, v);
    const ratio = total > 0 ? value / total : 0;
    return { value, ratio, percent: Math.round(ratio * 1000) / 10 };
  });
}

/** ドーナツ/円グラフの 1 セグメント(SVG circle の dasharray/offset 用)。 */
export interface DonutSegment {
  value: number;
  ratio: number;
  percent: number;
  /** 円周上でこのセグメントが占める長さ。 */
  dash: number;
  /** 円周からのオフセット(前セグメントまでの累積長。負値で time-12 時方向から開始)。 */
  offset: number;
  /** 円周(2πr)。 */
  circumference: number;
}

/**
 * ドーナツの各セグメントを計算する(SVG の stroke-dasharray/offset 方式)。
 * 各セグメントを circle として重ね、dasharray=[dash, C-dash]、dashoffset で開始位置をずらす。
 *
 * @param values 数値の配列
 * @returns 各セグメントの角度(**0° は真上・時計回り**)
 */
export function donutSegments(values: number[], radius: number): DonutSegment[] {
  const circumference = 2 * Math.PI * radius;
  const shares = computeShares(values);
  let acc = 0;
  return shares.map((s) => {
    const dash = s.ratio * circumference;
    const offset = -acc; // 直前までの累積ぶん戻す(12時方向起点は circle の回転で調整)
    acc += dash;
    return { value: s.value, ratio: s.ratio, percent: s.percent, dash, offset, circumference };
  });
}

/**
 * 目標に対する達成率を返す。
 *
 * @param actual 実績
 * @param target 目標
 * @returns 達成率(%)。**目標が 0 以下なら 0**(「目標なし」を 100% にしない)
 */
export function achievementRate(actual: number, target: number): number {
  if (target <= 0) return 0;
  return Math.round((actual / target) * 1000) / 10;
}

/** ファネルの 1 段。 */
export interface FunnelStage {
  label: string;
  value: number;
  /** 先頭に対する割合(0..1)。バーの幅に使う。 */
  ratioToFirst: number;
  /** 直前段からの遷移率(0..1)。先頭は 1。 */
  conversionFromPrev: number;
  /** 直前段からの離脱数。 */
  dropoff: number;
}

/**
 * ファネルの各段を計算する。
 *
 * **遷移率(前の段から何%進んだか)を出す**のが要点。全体比だけでは
 * 「どこで落ちているか」が分からない(訪問 1000 → 登録 100 → 購入 90 なら、
 * 問題は登録であって購入ではない)。
 *
 * @param stages 各段の名前と件数
 * @returns 全体比・遷移率・離脱数
 */
export function funnelStages(steps: { label: string; value: number }[]): FunnelStage[] {
  const first = steps[0]?.value ?? 0;
  return steps.map((step, i) => {
    const prev = i > 0 ? steps[i - 1]!.value : step.value;
    return {
      label: step.label,
      value: step.value,
      ratioToFirst: first > 0 ? step.value / first : 0,
      conversionFromPrev: prev > 0 ? step.value / prev : i === 0 ? 1 : 0,
      dropoff: i > 0 ? Math.max(0, prev - step.value) : 0,
    };
  });
}

/**
 * 相対時刻を返す(日本語)。
 *
 * **古くなったら日付に切り替える**(「300日前」より「2025-09-18」の方が分かる)。
 *
 * @param date 対象の日時
 * @param now 現在時刻(テスト注入用)
 * @returns `たった今` / `3分前` / `2時間前` / `5日前` / 日付
 */
export function relativeTime(fromMs: number, nowMs: number = Date.now()): string {
  const diff = nowMs - fromMs;
  if (diff < 0) return "たった今";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "たった今";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}時間前`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}日前`;
  const d = new Date(fromMs);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
