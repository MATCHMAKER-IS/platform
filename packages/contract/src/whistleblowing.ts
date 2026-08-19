/**
 * 内部通報の管理（公益通報者保護法）。
 *
 * **2022 年の改正で、従業員 300 人超の事業者は体制整備が義務**になった
 * （300 人以下は努力義務）。消費者庁の勧告・企業名の公表を受けることがある。
 *
 * 【この法律で最も重い義務：通報者の特定につながる情報を漏らさない】
 * 従事者（通報を受ける担当者）が通報者を特定できる情報を漏らすと、
 * **30 万円以下の罰金**（法第21条）。**個人が処罰される**のが他の法令と違う。
 *
 * この制約はコードの構造で守る:
 *   - {@link maskReporter} が通報者の情報を伏せる
 *   - {@link canAccess} が従事者以外のアクセスを拒む
 *   - 集計は {@link summarizeReports} が返し、**個別の通報内容は含めない**
 *
 * 【体制整備の 3 要素】
 *   1. **窓口の設置**（内部・外部のどちらでもよい）
 *   2. **従事者の指定**（書面で指定する。誰が受けるかを決める）
 *   3. **不利益取扱いの防止**（通報を理由とした解雇・降格の禁止）
 *
 * 【対応の期限】
 * 法令に明示の期限は無いが、**20 営業日以内に調査開始を通知しない**と、
 * 通報者が報道機関へ通報しても保護される（法第3条第3号ホ）。
 * つまり**20 営業日が実質的な期限**になる。
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

/** 通報の受付経路。 */
export type ReportChannel =
  /** 社内の窓口。 */
  | "internal"
  /** 外部の窓口（弁護士・専門業者）。 */
  | "external"
  /** 行政機関。 */
  | "authority";

/** 通報の状態。 */
export type ReportStatus =
  /** 受け付けた（まだ調査を始めていない）。 */
  | "received"
  /** 調査中。 */
  | "investigating"
  /** 事実が確認され、是正した。 */
  | "resolved"
  /** 事実が確認できなかった。 */
  | "unfounded"
  /** 通報者が取り下げた。 */
  | "withdrawn";

/** 1 件の通報。 */
export interface Report {
  /** 通報の識別子。 */
  id: string;
  /** 受付経路。 */
  channel: ReportChannel;
  /** 受付日（YYYY-MM-DD）。 */
  receivedOn: string;
  /**
   * 通報者の氏名（**匿名なら未指定**）。
   *
   * この項目に触れてよいのは従事者だけ。
   * 画面や通知に出す前に {@link maskReporter} を通すこと。
   */
  reporterName?: string;
  /** 通報者の所属（**通報者の特定につながる**ため扱いは氏名と同じ）。 */
  reporterDepartment?: string;
  /** 通報の内容。 */
  content: string;
  /** 現在の状態。 */
  status: ReportStatus;
  /** 調査を開始する旨を通報者へ通知した日（YYYY-MM-DD）。 */
  notifiedOn?: string;
  /** 是正・完了した日（YYYY-MM-DD）。 */
  closedOn?: string;
  /** 対応した従事者の識別子。 */
  handlerId?: string;
}

/** 通報者の情報を伏せた形。 */
export interface MaskedReport extends Omit<Report, "reporterName" | "reporterDepartment"> {
  /** 匿名の通報か。 */
  anonymous: boolean;
}

/**
 * 通報者を特定できる情報を取り除く。
 *
 * **従事者以外に見せる前に必ず通す**。氏名だけでなく**所属も落とす**
 * （「経理部の誰か」でも、少人数の部署なら特定できてしまう）。
 *
 * @param report 通報
 * @returns 通報者の情報を除いた形
 *
 * @example
 * ```ts
 * // 経営会議に出す資料
 * const safe = reports.map(maskReporter);
 * ```
 */
export function maskReporter(report: Report): MaskedReport {
  const { reporterName, reporterDepartment, ...rest } = report;
  return { ...rest, anonymous: reporterName === undefined };
}

/** 従事者（通報を受ける担当者）。**書面で指定する必要がある**。 */
export interface Handler {
  /** 従事者の識別子。 */
  id: string;
  /** 氏名。 */
  name: string;
  /** 書面で指定した日（YYYY-MM-DD）。**これが無いと従事者ではない**。 */
  designatedOn?: string;
  /** 解任した日（YYYY-MM-DD）。 */
  revokedOn?: string;
}

/**
 * その人が通報を見てよいかを判定する。
 *
 * **書面で指定された従事者だけ**が通報者の情報に触れられる。
 * 「役職が上だから」「調査に必要だから」は理由にならない。
 *
 * @param handler 見ようとしている人
 * @param today 基準日（テスト注入用）
 * @returns 見てよければ true
 *
 * @example
 * ```ts
 * if (!canAccess(user)) throw new Error("従事者に指定されていません");
 * ```
 */
export function canAccess(handler: Handler, today: Date = new Date()): boolean {
  // **書面での指定が無ければ従事者ではない**
  if (handler.designatedOn === undefined) return false;
  const todayStr = jstDate(today);
  if (handler.designatedOn > todayStr) return false;
  if (handler.revokedOn !== undefined && handler.revokedOn <= todayStr) return false;
  return true;
}

/** 対応が必要なこと 1 件。 */
export interface ReportIssue {
  /** 通報の識別子。 */
  reportId: string;
  /** 深刻度。 */
  severity: "urgent" | "warning";
  /** 何が起きているか。 */
  message: string;
  /** 根拠。 */
  law: string;
}

/** 調査開始の通知期限（営業日）。 */
export const NOTIFY_DEADLINE_BUSINESS_DAYS = 20;

/** YYYY-MM-DD を UTC の Date にする。 */
function toDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

/**
 * 営業日を数える（土日を除く。祝日は考慮しない）。
 *
 * **祝日を含めないため、実際より緩く出る**。厳密に見るなら
 * `@platform/datetime` の営業日計算を使うこと。
 */
function businessDaysBetween(from: string, to: string): number {
  const start = toDate(from);
  const end = toDate(to);
  let days = 0;
  const cur = new Date(start);
  while (cur < end) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) days += 1;
  }
  return days;
}

/**
 * 対応が滞っている通報を挙げる。
 *
 * **20 営業日以内に調査開始を通知しないと、通報者が報道機関へ通報しても
 * 保護される**（法第3条第3号ホ）。法令に明示の期限は無いが、
 * これが実質的な期限になる。
 *
 * @param reports 通報の一覧
 * @param today 基準日（テスト注入用）
 * @returns 対応が要ることの一覧（緊急な順）
 *
 * @example
 * ```ts
 * const issues = checkReportHandling(reports);
 * // 20 営業日が近い通報を先に処理する
 * ```
 */
export function checkReportHandling(
  reports: readonly Report[],
  today: Date = new Date(),
): ReportIssue[] {
  const out: ReportIssue[] = [];
  const todayStr = jstDate(today);

  for (const r of reports) {
    // 完了しているものは対象外
    if (r.status === "resolved" || r.status === "unfounded" || r.status === "withdrawn") continue;

    // ── 調査開始の通知 ──
    if (r.notifiedOn === undefined) {
      const elapsed = businessDaysBetween(r.receivedOn, todayStr);
      if (elapsed > NOTIFY_DEADLINE_BUSINESS_DAYS) {
        out.push({
          reportId: r.id, severity: "urgent",
          message: `受付から ${elapsed} 営業日、調査開始を通知していません。`
            + "**この状態だと、通報者が報道機関へ通報しても保護されます**",
          law: "公益通報者保護法 第3条第3号ホ",
        });
      } else if (elapsed >= NOTIFY_DEADLINE_BUSINESS_DAYS - 5) {
        out.push({
          reportId: r.id, severity: "warning",
          message: `受付から ${elapsed} 営業日です。20 営業日以内に調査開始を通知してください`,
          law: "公益通報者保護法 第3条第3号ホ",
        });
      }
    }

    // ── 従事者の割り当て ──
    // **誰が対応しているか分からない状態にしない**
    if (r.handlerId === undefined) {
      out.push({
        reportId: r.id, severity: "warning",
        message: "対応する従事者が割り当てられていません",
        law: "公益通報者保護法 第11条（従事者の指定）",
      });
    }
  }

  const rank = { urgent: 0, warning: 1 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** 集計（**個別の通報内容は含めない**）。 */
export interface ReportSummary {
  /** 受付件数。 */
  total: number;
  /** 経路ごとの件数。 */
  byChannel: Record<ReportChannel, number>;
  /** 状態ごとの件数。 */
  byStatus: Record<ReportStatus, number>;
  /** 匿名の通報の割合（0〜1）。 */
  anonymousRatio: number;
  /** 平均対応日数（完了したもののみ）。 */
  averageDaysToClose: number;
}

/**
 * 通報を集計する。
 *
 * **個別の内容も通報者の情報も返さない**。経営会議や監査に出すのはこの形にする。
 * 「どんな通報があったか」を知りたくなるが、**それを共有した時点で
 * 通報者が推測されうる**。
 *
 * @param reports 通報の一覧
 * @returns 件数の集計のみ
 *
 * @example
 * ```ts
 * const s = summarizeReports(reports);
 * // s に通報者の情報も内容も入っていない（意図的）
 * ```
 */
export function summarizeReports(reports: readonly Report[]): ReportSummary {
  const byChannel: Record<ReportChannel, number> = { internal: 0, external: 0, authority: 0 };
  const byStatus: Record<ReportStatus, number> = {
    received: 0, investigating: 0, resolved: 0, unfounded: 0, withdrawn: 0,
  };
  let anonymous = 0;
  let closedCount = 0;
  let totalDays = 0;

  for (const r of reports) {
    byChannel[r.channel] += 1;
    byStatus[r.status] += 1;
    if (r.reporterName === undefined) anonymous += 1;
    if (r.closedOn !== undefined) {
      closedCount += 1;
      totalDays += Math.floor((toDate(r.closedOn).getTime() - toDate(r.receivedOn).getTime()) / 86_400_000);
    }
  }

  return {
    total: reports.length,
    byChannel,
    byStatus,
    anonymousRatio: reports.length > 0 ? Math.round((anonymous / reports.length) * 1000) / 1000 : 0,
    averageDaysToClose: closedCount > 0 ? Math.round(totalDays / closedCount) : 0,
  };
}

/** 体制整備の確認結果。 */
export interface SystemCheck {
  /** 体制整備の義務があるか（従業員 300 人超）。 */
  required: boolean;
  /** 対応が要ることの一覧。 */
  issues: string[];
}

/**
 * 体制整備が要件を満たしているかを確認する。
 *
 * **従業員 300 人超は義務、300 人以下は努力義務**（法第11条）。
 *
 * @param input.employeeCount 従業員数
 * @param input.hasChannel 窓口を設置しているか
 * @param input.handlers 従事者の一覧
 * @param input.hasProtectionPolicy 不利益取扱いを禁じる規程があるか
 * @param today 基準日（テスト注入用）
 * @returns 確認結果
 */
export function checkSystem(
  input: {
    employeeCount: number;
    hasChannel: boolean;
    handlers: readonly Handler[];
    hasProtectionPolicy: boolean;
  },
  today: Date = new Date(),
): SystemCheck {
  const required = input.employeeCount > 300;
  const issues: string[] = [];

  if (!input.hasChannel) {
    issues.push(
      required
        ? "**通報窓口を設置していません。** 従業員 300 人超は体制整備が義務です（法第11条）"
        : "通報窓口がありません（300 人以下は努力義務ですが、設置が推奨されます）",
    );
  }

  const active = input.handlers.filter((h) => canAccess(h, today));
  if (active.length === 0) {
    issues.push(
      "**従事者が指定されていません。** 書面での指定が必要です（法第11条第1項）"
        + "。指定が無い人が通報を受けても、守秘義務の対象になりません",
    );
  }

  if (!input.hasProtectionPolicy) {
    issues.push("通報を理由とする不利益取扱いを禁じる規程がありません（法第5条）");
  }

  return { required, issues };
}
