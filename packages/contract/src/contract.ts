/**
 * 契約管理の純ロジック(期間・自動更新・解約通知・更新期限アラート)。
 *
 * 金額の明細は `@platform/invoice`、見積からの変換は `@platform/quote` の担当。
 * ここは**契約に固有の関心事**だけを扱う:
 * - いつからいつまで有効か
 * - 自動更新されるのか、放っておくと切れるのか
 * - **解約するなら、いつまでに言わなければならないか**(これが最も実務で問題になる)
 *
 * @packageDocumentation
 */
import { AppError, ErrorCode } from "@platform/core";

/** 契約の状態。 */
export type ContractStatus =
  /** 作成中(まだ効力なし)。 */
  | "draft"
  /** 相手の承認待ち。 */
  | "pending"
  /** 有効。 */
  | "active"
  /** 期間満了で終了。 */
  | "expired"
  /** 解約された。 */
  | "terminated";

/** 更新の仕方。 */
export type RenewalType =
  /** 自動更新(何もしなければ続く)。 */
  | "auto"
  /** 手動更新(何もしなければ切れる)。 */
  | "manual"
  /** 更新しない(一回限り)。 */
  | "none";

/** 契約 1 件。 */
export interface Contract {
  id: string;
  /** 契約名。 */
  title: string;
  /** 取引先。 */
  partner: string;
  status: ContractStatus;
  /** 開始日(YYYY-MM-DD)。 */
  startDate: string;
  /** 終了日(YYYY-MM-DD)。 */
  endDate: string;
  renewalType: RenewalType;
  /** 自動更新の期間(月数)。auto のとき必須。 */
  renewalMonths?: number;
  /**
   * 解約予告期間(日数)。
   * **終了日のこの日数前までに申し出ないと、自動更新されてしまう**。
   */
  noticeDays?: number;
  /** 契約金額(円・任意)。 */
  amount?: number;
  /** 担当者。 */
  owner?: string;
  /** 書類の保管場所(URL・ファイル ID など)。 */
  documentRef?: string;
  createdAt: string;
  updatedAt: string;
}

/** 日付文字列(YYYY-MM-DD)を UTC の Date にする。 */
function toDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

/** 今日を YYYY-MM-DD にする。 */
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * 契約が有効期間内かを判定する。
 *
 * **状態ではなく日付で見る**(status が active のまま終了日を過ぎていることがあるため)。
 *
 * @param contract 対象の契約
 * @param today    基準日(テスト注入用。既定は今日)
 * @returns 開始日 <= today <= 終了日 なら true
 */
export function isInEffect(contract: Contract, today = new Date()): boolean {
  const t = ymd(today);
  return contract.startDate <= t && t <= contract.endDate;
}

/**
 * 終了日までの日数を返す。
 *
 * @param contract 対象の契約
 * @param today    基準日(テスト注入用)
 * @returns 残り日数(**過ぎていれば負**)
 */
export function daysUntilEnd(contract: Contract, today = new Date()): number {
  const end = toDate(contract.endDate).getTime();
  const base = toDate(ymd(today)).getTime();
  return Math.round((end - base) / 86_400_000);
}

/**
 * 解約を申し出る期限を返す(この日までに言わないと自動更新される)。
 *
 * @param contract 対象の契約
 * @returns 期限の YYYY-MM-DD。**予告期間が設定されていなければ undefined**
 *
 * @example
 * ```ts
 * // 終了 2026-12-31、予告 90 日 → 2026-10-02 までに申し出る必要がある
 * noticeDeadline({ endDate: "2026-12-31", noticeDays: 90, ... });  // => "2026-10-02"
 * ```
 */
export function noticeDeadline(contract: Contract): string | undefined {
  if (contract.noticeDays === undefined) return undefined;
  const d = toDate(contract.endDate);
  d.setUTCDate(d.getUTCDate() - contract.noticeDays);
  return ymd(d);
}

/**
 * 解約の申し出が間に合うかを判定する。
 *
 * **これを過ぎると、望まなくても契約が更新される。** 実務で最も問題になる点。
 *
 * @param contract 対象の契約
 * @param today    基準日(テスト注入用)
 * @returns 期限内なら true。**予告期間が無い契約は常に true**(いつでも申し出られる)
 */
export function canGiveNotice(contract: Contract, today = new Date()): boolean {
  const deadline = noticeDeadline(contract);
  if (deadline === undefined) return true;
  return ymd(today) <= deadline;
}

/** アラートの深刻度。 */
export type ContractAlertLevel = "danger" | "warning" | "info";

/** 契約のアラート 1 件。 */
export interface ContractAlert {
  contract: Contract;
  level: ContractAlertLevel;
  /** 何が起きているか。 */
  message: string;
  /** 何をすべきか。 */
  action: string;
}

/**
 * 対応が必要な契約を挙げる。
 *
 * **放っておくと損をするもの**を優先する:
 * - 自動更新の解約予告期限が迫っている(過ぎると 1 年延びる)
 * - 手動更新なのに終了日が近い(放置すると切れる)
 *
 * @param contracts 対象の契約
 * @param today     基準日(テスト注入用)
 * @param soonDays  「近い」とみなす日数(既定 30)
 * @returns 深刻な順(danger → warning → info)。期限の近い順
 */
export function contractAlerts(contracts: Contract[], today = new Date(), soonDays = 30): ContractAlert[] {
  const alerts: ContractAlert[] = [];

  for (const c of contracts) {
    if (c.status !== "active") continue;
    const remaining = daysUntilEnd(c, today);

    // 1) 自動更新の解約予告期限(最も重要。過ぎると意図せず更新される)
    const deadline = noticeDeadline(c);
    if (c.renewalType === "auto" && deadline !== undefined) {
      const untilDeadline = Math.round((toDate(deadline).getTime() - toDate(ymd(today)).getTime()) / 86_400_000);
      if (untilDeadline < 0) {
        alerts.push({
          contract: c,
          level: "info",
          message: `解約予告の期限(${deadline})を過ぎています`,
          action: `この契約は ${c.endDate} に自動更新されます。次回に備えて予定に入れてください`,
        });
      } else if (untilDeadline <= soonDays) {
        alerts.push({
          contract: c,
          level: "danger",
          message: `解約予告の期限まであと ${untilDeadline} 日(${deadline}まで)`,
          action: "解約するなら今すぐ申し出てください。過ぎると自動更新されます",
        });
      }
    }

    // 2) 手動更新で終了が近い(放置すると切れる)
    if (c.renewalType !== "auto" && remaining >= 0 && remaining <= soonDays) {
      alerts.push({
        contract: c,
        level: remaining <= 7 ? "danger" : "warning",
        message: `終了まであと ${remaining} 日(${c.endDate})`,
        action: c.renewalType === "manual" ? "更新するなら手続きしてください。放置すると切れます" : "この契約は更新されません。後継の契約を検討してください",
      });
    }

    // 3) 既に終了日を過ぎているのに active のまま(データの不整合)
    if (remaining < 0) {
      alerts.push({
        contract: c,
        level: "warning",
        message: `終了日(${c.endDate})を過ぎていますが「有効」のままです`,
        action: "状態を更新してください(自動更新されたなら終了日を、終わったなら状態を)",
      });
    }
  }

  const order: Record<ContractAlertLevel, number> = { danger: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.level] - order[b.level] || daysUntilEnd(a.contract, today) - daysUntilEnd(b.contract, today));
}

/**
 * 契約を更新した後の姿を返す(自動更新・手動更新の両方で使う)。
 *
 * @param contract 対象の契約
 * @param now      現在時刻(テスト注入用)
 * @returns 開始日・終了日を次の期間にずらした**新しい**契約
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — 更新しない契約(`none`)、または auto なのに `renewalMonths` が無い場合
 *
 * @example
 * ```ts
 * // 2026-01-01〜2026-12-31、12 ヶ月更新 → 2027-01-01〜2027-12-31
 * renew(contract);
 * ```
 */
export function renew(contract: Contract, now = new Date()): Contract {
  if (contract.renewalType === "none") {
    throw new AppError(ErrorCode.VALIDATION, "この契約は更新できません(renewalType: none)");
  }
  const months = contract.renewalMonths;
  if (months === undefined || months <= 0) {
    throw new AppError(ErrorCode.VALIDATION, "更新期間(renewalMonths)が設定されていません");
  }

  // 次の期間: 今の終了日の翌日から、months ヶ月後の前日まで
  const nextStart = toDate(contract.endDate);
  nextStart.setUTCDate(nextStart.getUTCDate() + 1);
  const nextEnd = new Date(nextStart);
  nextEnd.setUTCMonth(nextEnd.getUTCMonth() + months);
  nextEnd.setUTCDate(nextEnd.getUTCDate() - 1);

  return {
    ...contract,
    status: "active",
    startDate: ymd(nextStart),
    endDate: ymd(nextEnd),
    updatedAt: now.toISOString(),
  };
}

/** 契約全体の状況。 */
export interface ContractSummary {
  total: number;
  active: number;
  /** 期限切れ(終了日を過ぎている)。 */
  expired: number;
  /** 対応が必要な件数(danger のアラート)。 */
  urgent: number;
  /** 有効な契約の金額合計。 */
  activeAmount: number;
  /** 取引先ごとの件数(多い順)。 */
  byPartner: { partner: string; count: number; amount: number }[];
}

/**
 * 契約全体の状況をまとめる(ダッシュボード用)。
 *
 * @param contracts 対象の契約
 * @param today     基準日(テスト注入用)
 * @returns 件数・緊急対応数・金額・取引先別
 */
export function summarizeContracts(contracts: Contract[], today = new Date()): ContractSummary {
  const active = contracts.filter((c) => c.status === "active");
  const alerts = contractAlerts(contracts, today);
  const map = new Map<string, { count: number; amount: number }>();
  for (const c of active) {
    const cur = map.get(c.partner) ?? { count: 0, amount: 0 };
    map.set(c.partner, { count: cur.count + 1, amount: cur.amount + (c.amount ?? 0) });
  }
  return {
    total: contracts.length,
    active: active.length,
    expired: contracts.filter((c) => daysUntilEnd(c, today) < 0 && c.status === "active").length,
    urgent: alerts.filter((a) => a.level === "danger").length,
    activeAmount: active.reduce((sum, c) => sum + (c.amount ?? 0), 0),
    byPartner: [...map.entries()]
      .map(([partner, v]) => ({ partner, ...v }))
      .sort((a, b) => b.count - a.count || b.amount - a.amount),
  };
}
