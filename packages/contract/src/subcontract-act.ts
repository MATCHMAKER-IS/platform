/**
 * 下請法（下請代金支払遅延等防止法）の判定。
 *
 * **発注する側に義務がある法律**。違反すると公正取引委員会の勧告・企業名の公表を受ける。
 * 「知らなかった」は通らない。
 *
 * 【最大の落とし穴：資本金の組み合わせで適用が決まる】
 * 自社が大きくても、相手も大きければ適用されない。逆に**自社が中小でも、
 * 相手がより小さければ適用される**。「うちは中小だから関係ない」は誤り。
 *
 * 取引の種類で基準が違う:
 *
 * | 取引 | 親事業者 | 下請事業者 |
 * |---|---|---|
 * | 製造委託・修理委託・**プログラム作成**・運送等 | 3 億円超 | 3 億円以下 |
 * | 〃 | 1,000 万円超〜3 億円以下 | 1,000 万円以下 |
 * | 情報成果物作成（プログラム除く）・役務提供 | 5,000 万円超 | 5,000 万円以下 |
 * | 〃 | 1,000 万円超〜5,000 万円以下 | 1,000 万円以下 |
 *
 * **システム開発は「プログラム作成」で 3 億円の基準**、デザインや原稿は
 * 「情報成果物作成」で 5,000 万円の基準になる。同じ IT の仕事でも分かれる。
 *
 * 【主な義務】
 *   - **書面の交付**（3 条書面）… 発注時に直ちに。口頭発注は違反
 *   - **支払期日**… 給付を受領した日から **60 日以内**（暦日。営業日ではない）
 *   - **遅延利息**… 期日を過ぎたら年 14.6%
 *   - **書類の保存**… 2 年間（5 条書類）
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

/** 取引の種類。**基準となる資本金が変わる**。 */
export type SubcontractType =
  /** 製造委託・修理委託。 */
  | "manufacturing"
  /** **プログラムの作成**（システム開発。3 億円の基準）。 */
  | "program"
  /** 運送・物品の倉庫保管・情報処理。 */
  | "logistics"
  /** 情報成果物作成（プログラムを除く。デザイン・原稿など。5,000 万円の基準）。 */
  | "creative"
  /** 役務提供委託（プログラム・運送等を除く）。 */
  | "service";

/** 適用の判定結果。 */
export interface ApplicabilityResult {
  /** 下請法の適用があるか。 */
  applies: boolean;
  /** なぜそう判断したか。 */
  reason: string;
  /** 判定に使った資本金の区分。 */
  threshold: string;
}

/** 3 億円の基準を使う取引。 */
const LARGE_THRESHOLD_TYPES: readonly SubcontractType[] = ["manufacturing", "program", "logistics"];

/**
 * 下請法が適用される取引かを判定する。
 *
 * **自社が中小でも、相手がより小さければ適用される**。
 * 「うちは中小だから関係ない」という思い込みが最も危ない。
 *
 * @param input.type 取引の種類
 * @param input.ownCapital 自社（発注側）の資本金（円）
 * @param input.partnerCapital 相手（受注側）の資本金（円）
 * @returns 適用の有無と理由
 *
 * @example
 * ```ts
 * // 資本金 5,000 万円の会社が、資本金 500 万円の会社にシステム開発を委託
 * appliesSubcontractAct({ type: "program", ownCapital: 50_000_000, partnerCapital: 5_000_000 });
 * // → { applies: true, … }  中小同士でも適用される
 * ```
 */
export function appliesSubcontractAct(input: {
  type: SubcontractType;
  ownCapital: number;
  partnerCapital: number;
}): ApplicabilityResult {
  const isLarge = LARGE_THRESHOLD_TYPES.includes(input.type);
  const upper = isLarge ? 300_000_000 : 50_000_000;
  const label = isLarge ? "3 億円" : "5,000 万円";

  // 区分 1: 親が上限超・下請が上限以下
  if (input.ownCapital > upper && input.partnerCapital <= upper) {
    return {
      applies: true,
      reason: `発注側の資本金が ${label}超、受注側が ${label}以下です`,
      threshold: label,
    };
  }
  // 区分 2: 親が 1,000 万円超〜上限以下・下請が 1,000 万円以下
  // **ここが見落とされやすい。** 中小同士でも適用される
  if (
    input.ownCapital > 10_000_000 && input.ownCapital <= upper &&
    input.partnerCapital <= 10_000_000
  ) {
    return {
      applies: true,
      reason: "発注側の資本金が 1,000 万円超、受注側が 1,000 万円以下です"
        + "（**中小企業同士でも適用されます**）",
      threshold: "1,000 万円",
    };
  }
  return {
    applies: false,
    reason: "資本金の組み合わせが適用の区分に当てはまりません",
    threshold: label,
  };
}

/** 発注の内容。 */
export interface SubcontractOrder {
  /** 発注の識別子。 */
  id: string;
  /** 取引の種類。 */
  type: SubcontractType;
  /** 発注日（YYYY-MM-DD）。 */
  orderedOn: string;
  /** **3 条書面を交付した日**（YYYY-MM-DD。口頭発注なら未指定）。 */
  documentIssuedOn?: string;
  /** 給付を受領した日（YYYY-MM-DD。納品日。未納なら未指定）。 */
  receivedOn?: string;
  /** 定めた支払期日（YYYY-MM-DD）。 */
  paymentDueOn?: string;
  /** 実際に支払った日（YYYY-MM-DD。未払いなら未指定）。 */
  paidOn?: string;
  /** 下請代金（円）。 */
  amount: number;
}

/** 違反・注意 1 件。 */
export interface SubcontractIssue {
  /** 発注の識別子。 */
  orderId: string;
  /** 深刻度。`violation` は**既に法令違反**。 */
  severity: "violation" | "warning";
  /** 何が起きているか。 */
  message: string;
  /** 根拠となる条文。 */
  law: string;
}

/** 支払期日の上限（日）。**暦日で数える**（営業日ではない）。 */
export const PAYMENT_DEADLINE_DAYS = 60;

/** 遅延利息の年率（法定）。 */
export const LATE_INTEREST_RATE = 0.146;

/** YYYY-MM-DD を UTC の Date にする。 */
function toDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

/** 日数の差（b - a）。 */
function daysBetween(a: string, b: string): number {
  return Math.floor((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000);
}

/**
 * 発注が下請法の義務を満たしているかを確認する。
 *
 * **支払期日は「受領日から 60 日以内」**。暦日で数えるので、
 * 「月末締め翌々月末払い」は月によって 60 日を超える（**違反になる**）。
 *
 * @param orders 発注の一覧
 * @param today 基準日（テスト注入用）
 * @returns 違反・注意の一覧（深刻な順）
 *
 * @example
 * ```ts
 * const issues = checkSubcontractCompliance(orders);
 * const urgent = issues.filter((i) => i.severity === "violation");
 * ```
 */
export function checkSubcontractCompliance(
  orders: readonly SubcontractOrder[],
  today: Date = new Date(),
): SubcontractIssue[] {
  const out: SubcontractIssue[] = [];
  const todayStr = jstDate(today);

  for (const o of orders) {
    // ── 3 条書面 ──
    // **発注時に直ちに交付する義務**。口頭発注は違反
    if (o.documentIssuedOn === undefined) {
      out.push({
        orderId: o.id, severity: "violation",
        message: `3 条書面を交付していません（発注 ${o.orderedOn}）。**口頭発注は違反です**`,
        law: "下請法 第3条",
      });
    } else if (daysBetween(o.orderedOn, o.documentIssuedOn) > 0) {
      out.push({
        orderId: o.id, severity: "warning",
        message: `3 条書面の交付が発注日より後です（発注 ${o.orderedOn}・交付 ${o.documentIssuedOn}）。**発注時に直ちに**交付します`,
        law: "下請法 第3条",
      });
    }

    if (o.receivedOn === undefined) continue;

    // ── 支払期日 ──
    // **受領日から 60 日以内。暦日で数える**
    const limit = new Date(toDate(o.receivedOn));
    limit.setUTCDate(limit.getUTCDate() + PAYMENT_DEADLINE_DAYS);
    const limitStr = limit.toISOString().slice(0, 10);

    if (o.paymentDueOn !== undefined && o.paymentDueOn > limitStr) {
      out.push({
        orderId: o.id, severity: "violation",
        message: `支払期日が受領から 60 日を超えています（受領 ${o.receivedOn}・期日 ${o.paymentDueOn}・上限 ${limitStr}）。`
          + "**「月末締め翌々月末払い」は月によって超えます**",
        law: "下請法 第2条の2",
      });
    }

    // ── 支払遅延 ──
    const due = o.paymentDueOn ?? limitStr;
    if (o.paidOn === undefined) {
      if (todayStr > due) {
        out.push({
          orderId: o.id, severity: "violation",
          message: `支払期日を過ぎても未払いです（期日 ${due}・${daysBetween(due, todayStr)} 日経過）。遅延利息 年 14.6% がかかります`,
          law: "下請法 第4条第1項第2号",
        });
      } else if (daysBetween(todayStr, due) <= 7) {
        out.push({
          orderId: o.id, severity: "warning",
          message: `支払期日まで ${daysBetween(todayStr, due)} 日です（期日 ${due}）`,
          law: "下請法 第2条の2",
        });
      }
    } else if (o.paidOn > due) {
      out.push({
        orderId: o.id, severity: "violation",
        message: `支払が期日より ${daysBetween(due, o.paidOn)} 日遅れました（期日 ${due}・支払 ${o.paidOn}）`,
        law: "下請法 第4条第1項第2号",
      });
    }
  }

  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "violation" ? -1 : 1));
}

/**
 * 支払期日の上限を求める。
 *
 * **受領日から 60 日以内（暦日）**。「月末締め翌々月末払い」のような
 * 慣行は月によって 60 日を超えるため、**個別に確認する必要がある**。
 *
 * @param receivedOn 給付を受領した日（YYYY-MM-DD）
 * @returns 支払期日の上限（YYYY-MM-DD。この日まで）
 *
 * @example
 * ```ts
 * paymentDeadline("2026-01-31");  // → "2026-04-01"（翌々月末の 3/31 を超える）
 * ```
 */
export function paymentDeadline(receivedOn: string): string {
  const d = toDate(receivedOn);
  d.setUTCDate(d.getUTCDate() + PAYMENT_DEADLINE_DAYS);
  return d.toISOString().slice(0, 10);
}

/**
 * 遅延利息を計算する。
 *
 * **年 14.6%**（法定）。支払期日の翌日から実際に支払う日までの日数で計算する。
 *
 * @param amount 下請代金（円）
 * @param dueOn 支払期日（YYYY-MM-DD）
 * @param paidOn 実際に支払った日（YYYY-MM-DD）
 * @returns 遅延利息（円。1 円未満切り捨て）。**遅れていなければ 0**
 *
 * @example
 * ```ts
 * lateInterest(1_000_000, "2026-03-31", "2026-04-30");  // 30 日分
 * ```
 */
export function lateInterest(amount: number, dueOn: string, paidOn: string): number {
  const days = daysBetween(dueOn, paidOn);
  if (days <= 0) return 0;
  return Math.floor((amount * LATE_INTEREST_RATE * days) / 365);
}
