/**
 * 年次有給休暇の付与・消化・残日数(純ロジック)。
 *
 * 有給は**法律で付与日数と時効が決まっている**ため、会社ごとに作り直すものではない。
 * 一方で「取得の申請と承認」は業務の流れなので、`@platform/workflow` の担当。
 * ここは**日数の計算だけ**を持つ。
 *
 * 押さえている点:
 *   - 継続勤務年数に応じた**法定付与日数**(労働基準法 第39条)
 *   - **時効は 2 年**。付与から 2 年で消える
 *   - 消化は**古い分から**充てる(そうしないと時効で捨てる分が増える)
 *   - 繰越の上限は付与日数まで(法定どおり)
 * @packageDocumentation
 */

/** 付与 1 回分。 */
export interface LeaveGrant {
  /** 付与日(YYYY-MM-DD)。 */
  grantedOn: string;
  /** 付与日数。 */
  days: number;
  /** 失効日(YYYY-MM-DD)。付与から 2 年後。 */
  expiresOn: string;
}

/** 取得 1 件。 */
export interface LeaveTaken {
  /** 取得日(YYYY-MM-DD)。 */
  date: string;
  /** 日数(半日なら 0.5、時間単位なら端数)。 */
  days: number;
  /** 種別(年休 / 特別休暇など。集計は年休のみ)。 */
  kind?: string;
}

/** 残日数の内訳。 */
export interface LeaveBalance {
  /** 使える残日数。 */
  remaining: number;
  /** 付与された合計(有効なもの)。 */
  granted: number;
  /** 取得済みの合計。 */
  taken: number;
  /** 時効で消えた日数。 */
  expired: number;
  /** 次に失効する分(残っている場合)。 */
  nextExpiry?: { date: string; days: number };
}

/**
 * 継続勤務年数に応じた法定付与日数(週 5 日勤務・フルタイム)。
 *
 * 週の所定労働日数が少ない場合は比例付与になるが、
 * それは会社の制度によるため、必要なら呼び出し側で調整する。
 */
const STATUTORY_DAYS: { years: number; days: number }[] = [
  { years: 0.5, days: 10 },
  { years: 1.5, days: 11 },
  { years: 2.5, days: 12 },
  { years: 3.5, days: 14 },
  { years: 4.5, days: 16 },
  { years: 5.5, days: 18 },
  { years: 6.5, days: 20 },
];

/**
 * 入社日から数えた、その時点の法定付与日数を返す。
 *
 * 6 か月継続勤務で 10 日、以降 1 年ごとに増え、6 年半以降は 20 日で頭打ち。
 *
 * @param yearsOfService 継続勤務年数(0.5 = 6 か月)
 * @returns 付与日数(6 か月未満は 0)
 */
export function statutoryLeaveDays(yearsOfService: number): number {
  let days = 0;
  for (const row of STATUTORY_DAYS) {
    if (yearsOfService >= row.years) days = row.days;
  }
  return days;
}

/** 日付に年を足す(YYYY-MM-DD のまま扱う)。 */
function addYears(date: string, years: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

/**
 * 入社日から、指定日までの付与履歴を作る。
 *
 * 基準日を統一する運用(全社員 4/1 付与など)の場合は、
 * この関数を使わず付与記録を直接持つこと。
 *
 * @param hireDate 入社日(YYYY-MM-DD)
 * @param until    どこまでの付与を作るか(YYYY-MM-DD)
 * @returns 付与の配列(古い順)
 *
 * @example
 * ```ts
 * grantsSinceHire("2024-04-01", "2026-07-22");
 * // → 2024-10-01(10日) / 2025-10-01(11日) の 2 件
 * ```
 */
export function grantsSinceHire(hireDate: string, until: string): LeaveGrant[] {
  const grants: LeaveGrant[] = [];
  // 初回は入社から 6 か月後。その後は**初回付与日の 1 年ごと**
  // (入社日の応当日ではない。ここを間違えると付与が 1 回多くなる)
  const first = new Date(`${hireDate}T00:00:00Z`);
  first.setUTCMonth(first.getUTCMonth() + 6);
  const firstGrant = first.toISOString().slice(0, 10);

  let years = 0.5;
  let grantedOn = firstGrant;
  while (grantedOn <= until) {
    const days = statutoryLeaveDays(years);
    if (days > 0) grants.push({ grantedOn, days, expiresOn: addYears(grantedOn, 2) });
    years += 1;
    grantedOn = addYears(firstGrant, Math.round(years - 0.5));
  }
  return grants;
}

/**
 * 残日数を計算する。
 *
 * **古い付与から消化する**(先入先出)。新しい分から使うと、
 * 古い分が時効で消え、実質的に日数を捨てることになる。
 *
 * @param grants 付与の履歴
 * @param taken  取得の履歴
 * @param asOf   基準日(YYYY-MM-DD)
 * @returns 残日数と内訳
 */
export function leaveBalance(grants: LeaveGrant[], taken: LeaveTaken[], asOf: string): LeaveBalance {
  // 古い順に並べ、残数を持つ
  const pool = [...grants]
    .sort((a, b) => (a.grantedOn < b.grantedOn ? -1 : 1))
    .map((g) => ({ ...g, left: g.days }));

  // 年休のみを対象にする(特別休暇は別枠)
  const consumed = [...taken]
    .filter((t) => (t.kind ?? "年休") === "年休")
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  let takenTotal = 0;
  for (const t of consumed) {
    let rest = t.days;
    takenTotal += t.days;
    for (const g of pool) {
      if (rest <= 0) break;
      // その時点で有効な付与だけを使う
      if (g.expiresOn <= t.date) continue;
      const use = Math.min(g.left, rest);
      g.left -= use;
      rest -= use;
    }
    // 残数を超えて取得した場合は、マイナスにせず「取得済み」として数える
  }

  let expired = 0;
  let remaining = 0;
  let nextExpiry: LeaveBalance["nextExpiry"];
  for (const g of pool) {
    if (g.expiresOn <= asOf) {
      expired += g.left;
      continue;
    }
    remaining += g.left;
    if (g.left > 0 && (!nextExpiry || g.expiresOn < nextExpiry.date)) {
      nextExpiry = { date: g.expiresOn, days: g.left };
    }
  }

  return {
    remaining,
    granted: grants.reduce((s, g) => s + g.days, 0),
    taken: takenTotal,
    expired,
    nextExpiry,
  };
}

/**
 * 年 5 日の取得義務を満たしているか(労働基準法 第39条第7項)。
 *
 * 10 日以上付与された人は、**付与日から 1 年以内に 5 日**取らせる義務がある。
 * 満たせないと会社側の違反になるため、期限が近い人を早めに知らせる。
 *
 * @param grant 対象の付与
 * @param taken 取得の履歴
 * @param asOf  基準日
 * @returns 義務の対象か・取得済み日数・不足日数・期限
 */
export function mandatoryLeaveStatus(
  grant: LeaveGrant,
  taken: LeaveTaken[],
  // 判定は付与日から 1 年の窓で行うため、基準日は使わない。
  // 引数に残してあるのは、呼び出し側が他の関数と同じ形で書けるようにするため。
  _asOf?: string,
): { required: boolean; takenDays: number; shortage: number; deadline: string } {
  const deadline = addYears(grant.grantedOn, 1);
  const required = grant.days >= 10;
  const takenDays = taken
    .filter((t) => (t.kind ?? "年休") === "年休" && t.date >= grant.grantedOn && t.date < deadline)
    .reduce((s, t) => s + t.days, 0);
  return {
    required,
    takenDays,
    shortage: required ? Math.max(0, 5 - takenDays) : 0,
    deadline,
  };
}
