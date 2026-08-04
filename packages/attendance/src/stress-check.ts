/**
 * ストレスチェック（労働安全衛生法 第66条の10）。
 *
 * **常時 50 人以上の労働者がいる事業場は、年 1 回の実施が義務**。
 * 実施しないと労働基準監督署への報告義務違反になる。
 *
 * 【この基盤が扱う範囲】
 * 厚生労働省の「職業性ストレス簡易調査票（57 項目）」の採点と、
 * **高ストレス者の判定**を行う。設問文そのものは持たない（アプリが用意する）。
 *
 * 【最も重要な制約：本人以外に結果を見せない】
 * ストレスチェックの結果は、**本人の同意なく事業者へ提供してはならない**（法第66条の10第2項）。
 * 違反すると罰則がある。この制約はコードの構造で守る:
 *
 *   - {@link scoreStressCheck} は個人の結果を返す（**実施者だけが見る**）
 *   - {@link aggregateByGroup} は集団の集計を返す（**10 人未満は返さない**）
 *
 * 10 人未満の集団で集計すると、**誰の結果か推測できてしまう**。
 * そのため人数が足りない集団は集計そのものを行わない。
 *
 * @packageDocumentation
 */

/**
 * 職業性ストレス簡易調査票（57 項目）の領域。
 *
 * A・B・C の 3 領域に分かれ、**高ストレス者の判定に使うのは A と B の一部**。
 */
export type StressArea =
  /** A: 仕事のストレス要因（17 問）。 */
  | "workload"
  /** B: 心身のストレス反応（29 問）。 */
  | "response"
  /** C: 周囲のサポート（9 問）。 */
  | "support";

/** 設問 1 問。 */
export interface StressQuestion {
  /** 設問番号（1〜57）。 */
  no: number;
  /** どの領域か。 */
  area: StressArea;
  /**
   * **点数の向きが逆の設問か**。
   *
   * 「そうだ」を 4 点とする設問と、1 点とする設問がある。
   * 例: 「非常にたくさんの仕事をしなければならない」は「そうだ」= 4 点（ストレス高）だが、
   * 「自分のペースで仕事ができる」は「そうだ」= 1 点（ストレス低）。
   *
   * **ここを間違えると点数が真逆になる**。
   */
  reversed?: boolean;
}

/** 1 人分の回答（設問番号 → 1〜4 の選択）。 */
export type StressAnswers = Readonly<Record<number, number>>;

/** 採点の結果。 */
export interface StressScore {
  /** A: 仕事のストレス要因の合計（17〜68 点）。 */
  workload: number;
  /** B: 心身のストレス反応の合計（29〜116 点）。 */
  response: number;
  /** C: 周囲のサポートの合計（9〜36 点）。 */
  support: number;
  /** 高ストレス者と判定されたか。 */
  highStress: boolean;
  /** どの基準で判定されたか。 */
  reason: "response" | "workload-and-support" | "none";
  /** 未回答の設問番号。**空でないと判定は信頼できない**。 */
  missing: number[];
}

/**
 * 高ストレス者の判定基準（厚生労働省の推奨値）。
 *
 * 次の**どちらか**に当てはまれば高ストレス者:
 *   1. B（心身のストレス反応）が 77 点以上
 *   2. B が 63 点以上 かつ A + C（仕事のストレス要因 + 周囲のサポート）が 76 点以上
 *
 * 事業場の実情に応じて変えられるため、引数で渡せるようにしてある。
 */
export interface HighStressCriteria {
  /** B 単独で高ストレスとする点数（既定 77）。 */
  responseAlone: number;
  /** 2 つ目の基準の B の点数（既定 63）。 */
  responseCombined: number;
  /** 2 つ目の基準の A + C の点数（既定 76）。 */
  workloadSupportCombined: number;
}

/** 厚生労働省の推奨値。 */
export const DEFAULT_CRITERIA: HighStressCriteria = {
  responseAlone: 77,
  responseCombined: 63,
  workloadSupportCombined: 76,
};

/** 集団分析の最小人数。**これ未満は誰の結果か推測できてしまう**。 */
export const MIN_GROUP_SIZE = 10;

/**
 * 回答を採点し、高ストレス者かを判定する。
 *
 * **この結果は本人と実施者（産業医など）だけが見るもの**。
 * 事業者（会社）に渡すには**本人の同意が要る**（法第66条の10第2項）。
 *
 * @param questions 設問の定義（57 問）
 * @param answers 回答（設問番号 → 1〜4）
 * @param criteria 判定基準（既定は厚労省の推奨値）
 * @returns 領域別の点数と判定
 *
 * @example
 * ```ts
 * const score = scoreStressCheck(questions, answers);
 * if (score.missing.length > 0) throw new Error("未回答があります");
 * if (score.highStress) {
 *   // **本人に医師の面接指導を案内する**（会社に知らせるのではない）
 * }
 * ```
 */
export function scoreStressCheck(
  questions: readonly StressQuestion[],
  answers: StressAnswers,
  criteria: HighStressCriteria = DEFAULT_CRITERIA,
): StressScore {
  const totals: Record<StressArea, number> = { workload: 0, response: 0, support: 0 };
  const missing: number[] = [];

  for (const q of questions) {
    const raw = answers[q.no];
    if (raw === undefined || raw < 1 || raw > 4) {
      missing.push(q.no);
      continue;
    }
    // **向きが逆の設問は 5 から引く**（4→1、1→4）。
    // ここを忘れると、ストレスが低い人を高いと判定してしまう
    totals[q.area] += q.reversed === true ? 5 - raw : raw;
  }

  const { workload, response, support } = totals;
  let highStress = false;
  let reason: StressScore["reason"] = "none";

  if (response >= criteria.responseAlone) {
    highStress = true;
    reason = "response";
  } else if (response >= criteria.responseCombined && workload + support >= criteria.workloadSupportCombined) {
    highStress = true;
    reason = "workload-and-support";
  }

  return { workload, response, support, highStress, reason, missing };
}

/** 集団分析の結果。 */
export interface GroupAnalysis {
  /** 集団の名前（部署など）。 */
  group: string;
  /** 人数。 */
  count: number;
  /** A の平均点。 */
  averageWorkload: number;
  /** B の平均点。 */
  averageResponse: number;
  /** C の平均点。 */
  averageSupport: number;
  /** 高ストレス者の割合（0〜1）。 */
  highStressRatio: number;
}

/**
 * 集団ごとに集計する（集団分析）。
 *
 * **10 人未満の集団は返さない**。少人数だと平均から個人の結果を推測できてしまい、
 * 「本人の同意なく事業者へ提供しない」という法の趣旨に反する。
 *
 * 集団分析は努力義務だが、職場環境の改善に使えるため実施が推奨されている。
 *
 * @param entries 個人の結果と所属（**個人が特定できる情報は渡さない**）
 * @param minSize 最小人数（既定 10。**下げないこと**）
 * @returns 集団ごとの集計（人数が足りない集団は含まれない）
 *
 * @example
 * ```ts
 * const groups = aggregateByGroup(entries);
 * // 10 人未満の部署は結果に出ない（意図的）
 * ```
 */
export function aggregateByGroup(
  entries: readonly { group: string; score: StressScore }[],
  minSize: number = MIN_GROUP_SIZE,
): GroupAnalysis[] {
  const byGroup = new Map<string, StressScore[]>();
  for (const e of entries) {
    const list = byGroup.get(e.group) ?? [];
    list.push(e.score);
    byGroup.set(e.group, list);
  }

  const out: GroupAnalysis[] = [];
  for (const [group, scores] of byGroup) {
    // **人数が足りない集団は集計しない**（個人が推測できてしまう）
    if (scores.length < minSize) continue;
    const n = scores.length;
    const avg = (pick: (s: StressScore) => number) =>
      Math.round((scores.reduce((sum, s) => sum + pick(s), 0) / n) * 10) / 10;
    out.push({
      group,
      count: n,
      averageWorkload: avg((s) => s.workload),
      averageResponse: avg((s) => s.response),
      averageSupport: avg((s) => s.support),
      highStressRatio: Math.round((scores.filter((s) => s.highStress).length / n) * 1000) / 1000,
    });
  }
  // ストレスが高い集団から並べる（改善が要る順）
  return out.sort((a, b) => b.highStressRatio - a.highStressRatio);
}

/** 実施状況の確認結果。 */
export interface ComplianceCheck {
  /** 実施義務があるか（常時 50 人以上）。 */
  required: boolean;
  /** 受検率（0〜1）。 */
  participationRate: number;
  /** 対応が要ることの一覧。 */
  issues: string[];
}

/**
 * 実施状況が法令の要件を満たしているかを確認する。
 *
 * **年 1 回の実施と、労働基準監督署への報告が義務**（50 人以上の事業場）。
 * 報告を忘れると義務違反になるが、**期限が来ても誰も教えてくれない**。
 *
 * @param input.employeeCount 常時使用する労働者数
 * @param input.checkedCount 受検した人数
 * @param input.lastConductedOn 前回の実施日（YYYY-MM-DD。未実施なら未指定）
 * @param input.reportedToLabourOffice 労働基準監督署へ報告したか
 * @param today 基準日（テスト注入用）
 * @returns 確認結果
 *
 * @example
 * ```ts
 * const c = checkCompliance({ employeeCount: 80, checkedCount: 60, lastConductedOn: "2025-06-01", reportedToLabourOffice: true });
 * if (c.issues.length > 0) console.log(c.issues.join("\n"));
 * ```
 */
export function checkCompliance(
  input: {
    employeeCount: number;
    checkedCount: number;
    lastConductedOn?: string;
    reportedToLabourOffice?: boolean;
  },
  today: Date = new Date(),
): ComplianceCheck {
  const required = input.employeeCount >= 50;
  const participationRate = input.employeeCount > 0
    ? Math.round((input.checkedCount / input.employeeCount) * 1000) / 1000
    : 0;
  const issues: string[] = [];

  if (!required) {
    // 50 人未満は努力義務。**やらなくてよいとは言わない**
    return { required, participationRate, issues };
  }

  if (input.lastConductedOn === undefined) {
    issues.push("**一度も実施していません。** 常時 50 人以上の事業場は年 1 回の実施が義務です（労働安全衛生法 第66条の10）");
  } else {
    const last = new Date(`${input.lastConductedOn}T00:00:00Z`);
    const days = Math.floor((today.getTime() - last.getTime()) / 86_400_000);
    if (days > 365) {
      issues.push(`前回の実施から ${days} 日経っています。**年 1 回の実施が義務**です（前回 ${input.lastConductedOn}）`);
    } else if (days > 300) {
      issues.push(`前回の実施から ${days} 日です。**1 年を超える前に**次回を実施してください（前回 ${input.lastConductedOn}）`);
    }
    if (input.reportedToLabourOffice !== true) {
      issues.push("**労働基準監督署へ報告していません。** 実施したら「心理的な負担の程度を把握するための検査結果等報告書」を提出します");
    }
  }

  // 受検は義務ではない（本人が拒否できる）が、低すぎると実施したとは言いにくい
  if (participationRate < 0.5 && input.lastConductedOn !== undefined) {
    issues.push(`受検率が ${Math.round(participationRate * 100)}% です。受検は強制できませんが、案内が届いているか確認してください`);
  }

  return { required, participationRate, issues };
}
