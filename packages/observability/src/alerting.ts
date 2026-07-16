/**
 * SLO 評価とアラート判定(依存ゼロ)。メトリクスのスナップショットに対してルールを評価し、
 * 発報/回復を検知する。実際の通知(Slack/PagerDuty)は notify 側へ委譲する。
 * @packageDocumentation
 */

/** アラート深刻度。 */
export type Severity = "info" | "warning" | "critical";

/** アラートルール。metrics スナップショット(任意の数値マップ)を受けて発報可否を返す。 */
export interface AlertRule {
  name: string;
  severity: Severity;
  /** 発報条件。true なら異常。 */
  condition: (metrics: MetricsView) => boolean;
  /** 人間向け説明(発報時のメッセージ)。 */
  describe: (metrics: MetricsView) => string;
  /** 連続で condition が true になったらこの回数で発報(フラッピング抑制・既定 1)。 */
  forEvaluations?: number;
}

/** ルールが参照するメトリクスビュー(カウンタ/ゲージ/ヒストグラム集計)。 */
export interface MetricsView {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, { count: number; sum: number }>;
}

/** 発報中/回復のアラート状態。 */
export interface Alert {
  name: string;
  severity: Severity;
  message: string;
  firing: boolean;
}

/**
 * エラー率がしきい値を超えたら発報する条件を作る。
 *
 * @param totalCounter 総数のカウンタ名
 * @param errorCounter エラー数のカウンタ名
 * @param threshold しきい値(0〜1。**0.01 なら 1%**)
 * @returns アラート条件。**総数が 0 なら発報しない**(データが無いだけで騒がない)
 */
export function errorRateAbove(totalKey: string, errorKey: string, threshold: number): (m: MetricsView) => boolean {
  return (m) => {
    const total = m.counters[totalKey] ?? 0;
    const errors = m.counters[errorKey] ?? 0;
    if (total === 0) return false;
    return errors / total > threshold;
  };
}

/**
 * 平均レイテンシがしきい値を超えたら発報する条件を作る。
 *
 * **平均は外れ値に弱い**ので、本来は p95 を見たい。ただし発報の判定としては
 * 平均でも「明らかに遅い」は捉えられる(詳しくは ADR 0012 の性能基準)。
 *
 * @param histogram ヒストグラムの名前
 * @param thresholdMs しきい値(ミリ秒)
 * @returns アラート条件。**サンプルが 0 なら発報しない**
 */
export function avgLatencyAbove(histogramKey: string, thresholdMs: number): (m: MetricsView) => boolean {
  return (m) => {
    const h = m.histograms[histogramKey];
    if (!h || h.count === 0) return false;
    return h.sum / h.count > thresholdMs;
  };
}

/**
 * ゲージがしきい値以上なら発報する条件を作る。
 *
 * 「サーキットブレーカーが開いた」「キューが溜まった」など、**状態を数値で見る**もの。
 *
 * @param gauge ゲージの名前
 * @param threshold しきい値(**以上**で発報)
 * @returns アラート条件
 */
export function gaugeAtLeast(gaugeKey: string, threshold: number): (m: MetricsView) => boolean {
  return (m) => (m.gauges[gaugeKey] ?? 0) >= threshold;
}

/** アラートマネージャ。ルールを保持し、評価ごとに発報/回復を判定する(状態つき)。 */
export interface AlertManager {
  /** 現在のメトリクスで全ルールを評価し、状態が変化したアラート(発報 or 回復)を返す。 */
  evaluate(metrics: MetricsView): Alert[];
  /** 現在発報中のアラート一覧。 */
  active(): Alert[];
}

/**
 * アラートマネージャを作る。
 *
 * **状態を保つ**ので、アプリで 1 つだけ作って使い回すこと
 * (毎回作ると「発報中かどうか」が分からず、鳴り続ける)。
 *
 * @param rules 評価するルール
 * @returns マネージャ。`evaluate` は**状態が変わったアラートだけ**を返す
 *   (発報中ずっと通知すると、やがて誰も見なくなる)
 */
export function createAlertManager(rules: AlertRule[]): AlertManager {
  const streak = new Map<string, number>(); // ルール名 -> 連続異常回数
  const firing = new Map<string, Alert>();   // 発報中

  return {
    evaluate(metrics) {
      const changes: Alert[] = [];
      for (const rule of rules) {
        const need = rule.forEvaluations ?? 1;
        const abnormal = rule.condition(metrics);
        const count = abnormal ? (streak.get(rule.name) ?? 0) + 1 : 0;
        streak.set(rule.name, count);

        const wasFiring = firing.has(rule.name);
        const nowFiring = count >= need;

        if (nowFiring && !wasFiring) {
          const alert: Alert = { name: rule.name, severity: rule.severity, message: rule.describe(metrics), firing: true };
          firing.set(rule.name, alert);
          changes.push(alert);
        } else if (!abnormal && wasFiring) {
          firing.delete(rule.name);
          changes.push({ name: rule.name, severity: rule.severity, message: `回復: ${rule.name}`, firing: false });
        }
      }
      return changes;
    },
    active: () => [...firing.values()],
  };
}
