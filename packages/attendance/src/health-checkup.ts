/**
 * 健康診断の実施管理（労働安全衛生法 第66条）。
 *
 * **ストレスチェックと違い、事業場の人数を問わず全社に義務**がある。
 * 実施しないと 50 万円以下の罰金（法第120条）。
 *
 * 【種類と時期】
 *   - **雇入時健診**（規則第43条）… 雇い入れの**直前または直後**
 *   - **定期健診**（規則第44条）… **1 年以内ごとに 1 回**
 *   - **特定業務従事者健診**（規則第45条）… 深夜業などは**6 か月以内ごとに 1 回**
 *
 * 【最も見落とされるのが特定業務従事者健診】
 * 深夜業（22 時〜5 時）に**常時従事する人**は年 2 回必要。
 * 「常時」は**月 4 回以上の深夜業が続く**状態が目安。
 * 24 時間営業の店舗・当直のある職場で漏れやすい。
 *
 * 【結果の取り扱い】
 * 健康診断の結果は**本人に通知する義務**があり（法第66条の6）、
 * 異常所見があれば**医師の意見を聴く義務**がある（法第66条の4）。
 * 結果を放置すると、後の労災認定で「会社が知っていたのに何もしなかった」と判断されうる。
 *
 * @packageDocumentation
 */

/**
 * 「今日」を **JST の日付**(`YYYY-MM-DD`)で返す。
 *
 * **`toISOString()` は UTC。** そのまま使うと、UTC で動くサーバ(クラウドの既定)では
 * **JST の 00:00〜08:59 が前日として扱われ、判定が 1 日ずれる**
 * ——期限切れのはずのものが「まだ間に合う」と出る(2026-08 に修正)。
 */
function jstDate(d: Date): string {
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 健康診断の種類。 */
export type CheckupKind =
  /** 雇入時健診（規則第43条）。 */
  | "hire"
  /** 定期健診（規則第44条。1 年以内ごとに 1 回）。 */
  | "periodic"
  /** 特定業務従事者健診（規則第45条。6 か月以内ごとに 1 回）。 */
  | "special";

/** 対象者の情報。 */
export interface CheckupTarget {
  /** 氏名（または社員番号）。 */
  name: string;
  /** 雇入れの年月日（YYYY-MM-DD）。 */
  hiredOn: string;
  /**
   * 深夜業などの特定業務に**常時従事**しているか。
   *
   * 「常時」は**月 4 回以上の深夜業が続く**状態が目安。
   * ここを false のままにすると、年 2 回必要な人を年 1 回で済ませてしまう。
   */
  specialWork?: boolean;
  /** 退職日（YYYY-MM-DD。在職中は未指定）。 */
  leftOn?: string;
}

/** 実施の記録。 */
export interface CheckupRecord {
  /** 対象者の氏名（{@link CheckupTarget.name} と対応）。 */
  name: string;
  /** 種類。 */
  kind: CheckupKind;
  /** 受診日（YYYY-MM-DD）。 */
  examinedOn: string;
  /** **異常所見があったか**（医師の判断）。 */
  hasAbnormality?: boolean;
  /** 本人に結果を通知したか（法第66条の6）。 */
  notifiedToWorker?: boolean;
  /** 異常所見について医師の意見を聴いたか（法第66条の4）。 */
  doctorOpinionObtained?: boolean;
}

/** 対応が必要なこと 1 件。 */
export interface CheckupIssue {
  /** 対象者。 */
  name: string;
  /** 深刻度。`overdue` は**既に義務違反**。 */
  severity: "overdue" | "due-soon" | "follow-up";
  /** 何が起きているか。 */
  message: string;
  /** 根拠となる条文。 */
  law: string;
  /** 期限（YYYY-MM-DD。分かる場合）。 */
  dueOn?: string;
}

/** 種類ごとの実施間隔（月）。 */
const INTERVAL_MONTHS: Record<CheckupKind, number> = {
  hire: 0, // 雇入時は 1 回だけ
  periodic: 12,
  special: 6,
};

/** 期限が近いと判断する日数。 */
const DUE_SOON_DAYS = 60;

/** YYYY-MM-DD を UTC の Date にする。 */
function toDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

/** n か月後の日付（YYYY-MM-DD）。 */
function addMonths(ymd: string, months: number): string {
  const d = toDate(ymd);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  // 月末をまたぐときはその月の末日に丸める（1/31 の 1 か月後は 2/28）
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}

/**
 * その人に必要な健診の種類を返す。
 *
 * **特定業務に従事する人は定期健診の代わりに年 2 回**（規則第45条）。
 * 定期健診と両方やる必要はないが、**年 1 回で済ませてはいけない**。
 *
 * @param target 対象者
 * @returns 必要な健診の種類
 */
export function requiredKinds(target: CheckupTarget): CheckupKind[] {
  // 特定業務従事者は 6 か月ごと（定期健診はこれに含まれる）
  return target.specialWork === true ? ["special"] : ["periodic"];
}

/**
 * 次回の健診期限を求める。
 *
 * **前回の受診日から起算する**（年度ではない）。
 * 「毎年 4 月に実施」という運用でも、前回が 5 月なら次は翌年 5 月までが期限。
 *
 * @param lastExaminedOn 前回の受診日（YYYY-MM-DD。未受診なら未指定）
 * @param kind 健診の種類
 * @param hiredOn 雇入れ日（未受診の場合の起算日）
 * @returns 期限（YYYY-MM-DD）
 *
 * @example
 * ```ts
 * nextDueDate("2025-05-20", "periodic");  // → "2026-05-20"
 * nextDueDate(undefined, "periodic", "2026-04-01");  // → "2027-04-01"
 * ```
 */
export function nextDueDate(
  lastExaminedOn: string | undefined,
  kind: CheckupKind,
  hiredOn?: string,
): string {
  const base = lastExaminedOn ?? hiredOn;
  if (base === undefined) return "";
  const months = INTERVAL_MONTHS[kind] || 12;
  return addMonths(base, months);
}

/**
 * 実施状況を確認し、対応が必要なことを挙げる。
 *
 * **期限が来ても誰も教えてくれない**。年 1 回の行事として運用していると、
 * 中途入社の人や特定業務の人が漏れる。
 *
 * @param targets 対象者（**在職者のみ**を渡す。退職者は自動で除く）
 * @param records 実施の記録
 * @param today 基準日（テスト注入用）
 * @returns 対応が要ることの一覧（深刻な順）
 *
 * @example
 * ```ts
 * const issues = checkCheckupStatus(targets, records);
 * const urgent = issues.filter((i) => i.severity === "overdue");
 * ```
 */
export function checkCheckupStatus(
  targets: readonly CheckupTarget[],
  records: readonly CheckupRecord[],
  today: Date = new Date(),
): CheckupIssue[] {
  const out: CheckupIssue[] = [];
  const todayStr = jstDate(today);

  for (const t of targets) {
    // 退職者は対象外
    if (t.leftOn !== undefined && t.leftOn <= todayStr) continue;

    const mine = records.filter((r) => r.name === t.name);

    // ── 雇入時健診 ──
    // **雇い入れの直前または直後**。入社から時間が経つと実施したことにならない
    const hireRecord = mine.find((r) => r.kind === "hire");
    if (hireRecord === undefined) {
      const daysSinceHire = Math.floor((today.getTime() - toDate(t.hiredOn).getTime()) / 86_400_000);
      if (daysSinceHire >= 0) {
        out.push({
          name: t.name,
          severity: daysSinceHire > 90 ? "overdue" : "due-soon",
          message: `雇入時健診の記録がありません（入社 ${t.hiredOn}・${daysSinceHire} 日経過）`,
          law: "労働安全衛生規則 第43条",
        });
      }
    }

    // ── 定期・特定業務 ──
    for (const kind of requiredKinds(t)) {
      const done = mine.filter((r) => r.kind === kind).sort((a, b) => (a.examinedOn < b.examinedOn ? 1 : -1));
      const last = done[0]?.examinedOn;
      const due = nextDueDate(last, kind, t.hiredOn);
      if (due === "") continue;

      const daysLeft = Math.floor((toDate(due).getTime() - today.getTime()) / 86_400_000);
      const label = kind === "special" ? "特定業務従事者健診（6 か月ごと）" : "定期健診（1 年ごと）";
      const law = kind === "special" ? "労働安全衛生規則 第45条" : "労働安全衛生規則 第44条";

      if (daysLeft < 0) {
        out.push({
          name: t.name, severity: "overdue", dueOn: due, law,
          message: last === undefined
            ? `${label}を一度も実施していません（期限 ${due}）`
            : `${label}の期限を ${-daysLeft} 日過ぎています（前回 ${last}・期限 ${due}）`,
        });
      } else if (daysLeft <= DUE_SOON_DAYS) {
        out.push({
          name: t.name, severity: "due-soon", dueOn: due, law,
          message: `${label}の期限まで ${daysLeft} 日です（期限 ${due}）`,
        });
      }
    }

    // ── 結果の取り扱い ──
    for (const r of mine) {
      // **本人への通知は義務**（法第66条の6）
      if (r.notifiedToWorker !== true) {
        out.push({
          name: t.name, severity: "follow-up",
          message: `${r.examinedOn} の結果を本人に通知していません`,
          law: "労働安全衛生法 第66条の6",
        });
      }
      // **異常所見があれば医師の意見を聴く義務**（法第66条の4）
      if (r.hasAbnormality === true && r.doctorOpinionObtained !== true) {
        out.push({
          name: t.name, severity: "follow-up",
          message: `${r.examinedOn} に異常の所見がありますが、医師の意見を聴いていません。`
            + "**放置すると、後の労災認定で「知っていたのに何もしなかった」と判断されます**",
          law: "労働安全衛生法 第66条の4",
        });
      }
    }
  }

  const rank: Record<CheckupIssue["severity"], number> = { overdue: 0, "follow-up": 1, "due-soon": 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** 実施率のまとめ。 */
export interface CheckupSummary {
  /** 対象者数（在職者）。 */
  targetCount: number;
  /** 期限内に受診している人数。 */
  upToDateCount: number;
  /** 実施率（0〜1）。 */
  rate: number;
  /** 期限切れの人数。 */
  overdueCount: number;
  /**
   * 労働基準監督署への報告が必要か。
   *
   * **常時 50 人以上の事業場は定期健診結果報告書の提出が義務**（規則第52条）。
   */
  reportRequired: boolean;
}

/**
 * 実施率をまとめる。
 *
 * **50 人以上の事業場は労働基準監督署への報告が義務**（規則第52条）。
 * ストレスチェックと同じ基準だが、**健診は実施そのものは全社に義務**である点が違う。
 *
 * @param targets 対象者
 * @param records 実施の記録
 * @param employeeCount 常時使用する労働者数
 * @param today 基準日（テスト注入用）
 * @returns 実施率のまとめ
 */
export function summarizeCheckups(
  targets: readonly CheckupTarget[],
  records: readonly CheckupRecord[],
  employeeCount: number,
  today: Date = new Date(),
): CheckupSummary {
  const todayStr = jstDate(today);
  const active = targets.filter((t) => t.leftOn === undefined || t.leftOn > todayStr);

  let upToDate = 0;
  let overdue = 0;
  for (const t of active) {
    const kind = requiredKinds(t)[0]!;
    const done = records
      .filter((r) => r.name === t.name && r.kind === kind)
      .sort((a, b) => (a.examinedOn < b.examinedOn ? 1 : -1));
    const due = nextDueDate(done[0]?.examinedOn, kind, t.hiredOn);
    if (due !== "" && toDate(due).getTime() >= today.getTime()) upToDate += 1;
    else overdue += 1;
  }

  return {
    targetCount: active.length,
    upToDateCount: upToDate,
    rate: active.length > 0 ? Math.round((upToDate / active.length) * 1000) / 1000 : 0,
    overdueCount: overdue,
    reportRequired: employeeCount >= 50,
  };
}
