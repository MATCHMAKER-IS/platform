/**
 * 三点照合（発注・入荷・請求の突合）。
 *
 * **支払う前に「頼んだもの」「届いたもの」「請求されたもの」が一致するか**を確かめる。
 * 経理の基本的な統制で、これが無いと次のことが起きる:
 *
 *   - **頼んでいないものを請求される**（発注に無い明細）
 *   - **届いていないものを払う**（入荷より多い請求）
 *   - **同じ請求書で二度払う**（二重計上）
 *   - **単価が勝手に上がっている**（発注時と違う単価）
 *
 * どれも「請求書が来たから払う」運用では気づけない。
 * **金額が合っていても、数量と単価の内訳が違えば問題**になる
 * （数量を減らして単価を上げると合計は同じになる）。
 *
 * 【許容差の考え方】
 * 完全一致を求めると、端数や送料で毎回止まる。
 * **金額の許容差と数量の許容差を分けて指定**できるようにしてある。
 * 数量は原則 0（1 個でも違えば確認する）、金額は端数程度を許す。
 *
 * @packageDocumentation
 */

/** 突合する明細。発注・入荷・請求で共通の形にする。 */
export interface MatchLine {
  /** 品目（**3 者で同じ文字列**にする。ここがずれると突合できない）。 */
  description: string;
  /** 数量。 */
  quantity: number;
  /** 単価（税抜）。 */
  unitPrice: number;
}

/** 突合の入力。 */
export interface ThreeWayInput {
  /** 発注番号（記録用）。 */
  orderNumber: string;
  /** 発注した明細。 */
  ordered: readonly MatchLine[];
  /** 入荷した明細（**検収済みのもの**）。 */
  received: readonly MatchLine[];
  /** 請求された明細。 */
  invoiced: readonly MatchLine[];
}

/** 許容差の設定。 */
export interface MatchTolerance {
  /**
   * 数量の許容差（個）。
   *
   * **既定は 0**。1 個でも違えば確認する。
   * 「だいたい合っていればよい」にすると、盗難や誤配送に気づけない。
   */
  quantity: number;
  /**
   * 金額の許容差（円）。
   *
   * 端数や小額の送料を許す。**大きくしすぎない**
   * （1 万円まで許すと、1 万円の水増しが通る）。
   */
  amount: number;
}

/** 既定の許容差。 */
export const DEFAULT_TOLERANCE: MatchTolerance = { quantity: 0, amount: 10 };

/** 不一致の種類。 */
export type MismatchKind =
  /** 発注していないものが請求されている。 */
  | "not-ordered"
  /** 発注したが入荷していない。 */
  | "not-received"
  /** 入荷より多く請求されている。 */
  | "over-invoiced"
  /** 入荷したのに請求が来ていない。 */
  | "not-invoiced"
  /** 単価が発注と違う。 */
  | "price-changed"
  /** 数量が入荷と違う。 */
  | "quantity-mismatch";

/** 不一致 1 件。 */
export interface Mismatch {
  /** 品目。 */
  description: string;
  /** 不一致の種類。 */
  kind: MismatchKind;
  /** 深刻度。`blocking` は**支払ってはいけない**。 */
  severity: "blocking" | "warning";
  /** 何が起きているか。 */
  message: string;
  /** 発注の数量・金額。 */
  ordered?: { quantity: number; amount: number };
  /** 入荷の数量・金額。 */
  received?: { quantity: number; amount: number };
  /** 請求の数量・金額。 */
  invoiced?: { quantity: number; amount: number };
}

/** 突合の結果。 */
export interface ThreeWayResult {
  /** 発注番号。 */
  orderNumber: string;
  /** **支払ってよいか**。`blocking` が 1 件でもあれば false。 */
  payable: boolean;
  /** 不一致の一覧（深刻な順）。 */
  mismatches: Mismatch[];
  /** 支払ってよい金額（税抜。**入荷と請求の小さい方**で計算）。 */
  payableAmount: number;
}

/** 明細の金額。 */
function amountOf(l: MatchLine): number {
  return l.quantity * l.unitPrice;
}

/** 品目ごとにまとめる（同じ品目が複数行ある場合に備える）。 */
function groupByDescription(lines: readonly MatchLine[]): Map<string, MatchLine> {
  const map = new Map<string, MatchLine>();
  for (const l of lines) {
    const cur = map.get(l.description);
    if (cur === undefined) {
      map.set(l.description, { ...l });
      continue;
    }
    // 同じ品目が複数行あれば数量を足す。単価は加重平均にする
    const totalQty = cur.quantity + l.quantity;
    const totalAmount = amountOf(cur) + amountOf(l);
    map.set(l.description, {
      description: l.description,
      quantity: totalQty,
      unitPrice: totalQty > 0 ? totalAmount / totalQty : 0,
    });
  }
  return map;
}

/**
 * 発注・入荷・請求を突き合わせる。
 *
 * **支払う前に必ず通す**。`payable` が false なら支払わない。
 *
 * 「合計金額が合っているから大丈夫」は誤り。
 * **数量を減らして単価を上げると合計は同じ**になるため、内訳まで見る。
 *
 * @param input 発注・入荷・請求の明細
 * @param tolerance 許容差（既定は数量 0・金額 10 円）
 * @returns 不一致の一覧と、支払ってよい金額
 *
 * @example
 * ```ts
 * const r = threeWayMatch({ orderNumber: "PO-001", ordered, received, invoiced });
 * if (!r.payable) {
 *   // **支払わない。** 仕入先に確認する
 *   console.log(r.mismatches.map((m) => m.message).join("\n"));
 * }
 * ```
 */
export function threeWayMatch(
  input: ThreeWayInput,
  tolerance: MatchTolerance = DEFAULT_TOLERANCE,
): ThreeWayResult {
  const ordered = groupByDescription(input.ordered);
  const received = groupByDescription(input.received);
  const invoiced = groupByDescription(input.invoiced);

  const mismatches: Mismatch[] = [];
  const allKeys = new Set([...ordered.keys(), ...received.keys(), ...invoiced.keys()]);

  let payableAmount = 0;

  for (const key of allKeys) {
    const o = ordered.get(key);
    const r = received.get(key);
    const i = invoiced.get(key);

    const info = {
      ...(o ? { ordered: { quantity: o.quantity, amount: amountOf(o) } } : {}),
      ...(r ? { received: { quantity: r.quantity, amount: amountOf(r) } } : {}),
      ...(i ? { invoiced: { quantity: i.quantity, amount: amountOf(i) } } : {}),
    };

    // ── 発注していないものが請求されている ──
    // **最も危ない**。頼んでいないものに払うことになる
    if (o === undefined && i !== undefined) {
      mismatches.push({
        description: key, kind: "not-ordered", severity: "blocking",
        message: `発注していない品目が請求されています（請求 ${i.quantity} 個・${amountOf(i).toLocaleString("ja-JP")} 円）`,
        ...info,
      });
      continue;
    }

    // ── 発注したが入荷していない ──
    if (o !== undefined && r === undefined) {
      if (i !== undefined) {
        mismatches.push({
          description: key, kind: "not-received", severity: "blocking",
          message: `入荷していないのに請求されています（請求 ${i.quantity} 個）。**届いていないものは払わない**`,
          ...info,
        });
      } else {
        mismatches.push({
          description: key, kind: "not-received", severity: "warning",
          message: `発注しましたが入荷していません（発注 ${o.quantity} 個）`,
          ...info,
        });
      }
      continue;
    }

    // ── 入荷したのに請求が来ていない ──
    // 支払い漏れではないが、**後からまとめて請求されて資金繰りが狂う**
    if (r !== undefined && i === undefined) {
      mismatches.push({
        description: key, kind: "not-invoiced", severity: "warning",
        message: `入荷済みですが請求が来ていません（入荷 ${r.quantity} 個）。後からまとめて請求されることがあります`,
        ...info,
      });
      continue;
    }

    if (r === undefined || i === undefined) continue;

    // ── 数量の突合 ──
    const qtyDiff = i.quantity - r.quantity;
    if (Math.abs(qtyDiff) > tolerance.quantity) {
      mismatches.push({
        description: key,
        kind: qtyDiff > 0 ? "over-invoiced" : "quantity-mismatch",
        severity: qtyDiff > 0 ? "blocking" : "warning",
        message: qtyDiff > 0
          ? `入荷 ${r.quantity} 個に対して ${i.quantity} 個が請求されています（${qtyDiff} 個多い）`
          : `入荷 ${r.quantity} 個に対して請求は ${i.quantity} 個です（${-qtyDiff} 個少ない）`,
        ...info,
      });
    }

    // ── 単価の突合 ──
    // **金額が合っていても単価が違えば問題**（数量を減らして単価を上げると合計は同じ）
    // **差額が許容内なら単価差とみなさない。** 端数処理や小額の調整で
    // 毎回止まると、確認が形骸化して本当の水増しを見逃す
    const priceDiffAmount = o !== undefined ? Math.abs(i.unitPrice - o.unitPrice) * i.quantity : 0;
    if (o !== undefined && priceDiffAmount > tolerance.amount) {
      const diff = (i.unitPrice - o.unitPrice) * i.quantity;
      mismatches.push({
        description: key, kind: "price-changed",
        // 値上げは止める。値下げは確認だけ
        severity: i.unitPrice > o.unitPrice ? "blocking" : "warning",
        message: `単価が発注と違います（発注 ${o.unitPrice.toLocaleString("ja-JP")} 円 → 請求 ${i.unitPrice.toLocaleString("ja-JP")} 円・差額 ${diff.toLocaleString("ja-JP")} 円）`,
        ...info,
      });
    }

    // **支払ってよいのは、入荷と請求の小さい方**
    payableAmount += Math.min(amountOf(r), amountOf(i));
  }

  // 金額の許容差は**「請求が入荷より多い」場合にだけ**適用する。
  //
  // **単価の食い違いには適用しない。** 数量を減らして単価を上げると合計は同じになるため、
  // 「金額差が 0 だから許す」と判定すると、単価の水増しが素通りする
  // (10 個 × 1,000 円 → 5 個 × 2,000 円 は合計が同じでも別の取引)。
  const blocking = mismatches.filter((m) => m.severity === "blocking");
  const amountOnly = blocking.filter((m) => m.kind === "over-invoiced");
  const totalDiff = amountOnly.reduce((s, m) => {
    const inv = m.invoiced?.amount ?? 0;
    const rec = m.received?.amount ?? 0;
    return s + Math.abs(inv - rec);
  }, 0);
  // 止める理由が「請求超過」だけで、その差が許容内なら払ってよい
  const withinTolerance =
    blocking.length > 0 &&
    blocking.length === amountOnly.length &&
    totalDiff <= tolerance.amount;

  return {
    orderNumber: input.orderNumber,
    payable: blocking.length === 0 || withinTolerance,
    mismatches: mismatches.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "blocking" ? -1 : 1)),
    payableAmount: Math.floor(payableAmount),
  };
}

/** 過去に処理した請求（二重払いの判定に使う）。 */
export interface ProcessedInvoice {
  /** 請求書番号。 */
  invoiceNumber: string;
  /** 仕入先。 */
  supplier: string;
  /** 金額（税込）。 */
  amount: number;
  /** 支払日（YYYY-MM-DD）。 */
  paidOn?: string;
  /**
   * このレコードの識別子(DB の主キーなど)。
   *
   * **履歴に「自分自身」が入っている場合を除くために使う。**
   * 2026-08 まで**値の一致で除外**しており(番号・仕入先・金額・支払日が全部同じなら
   * 自分とみなす)、**同じ請求書を 2 回入力した場合も除外**していた
   * ——最も明白な二重払いが検出されない状態だった。
   *
   * **値が同じことと、同じレコードであることは別**。
   * `id` を渡せば正しく区別できる。渡さない場合は**除外しない**
   * (見逃すより、余分に指摘する方が安全)。
   */
  id?: string;
}

/** 二重払いの疑い 1 件。 */
export interface DuplicateSuspicion {
  /** 疑いのある請求書番号。 */
  invoiceNumber: string;
  /** 同じとみなした過去の請求。 */
  matched: ProcessedInvoice;
  /** なぜ疑わしいか。 */
  reason: string;
  /** 確度。`certain` は請求書番号が完全に一致。 */
  confidence: "certain" | "likely";
}

/**
 * 二重払いの疑いを探す。
 *
 * **同じ請求書で二度払う**のは、思っているより頻繁に起きる。
 * 原本と写しが別々に回る、担当者が変わる、月をまたぐ、といった理由で。
 *
 * 2 つの見方で探す:
 *   1. **請求書番号が同じ**（確実）
 *   2. **仕入先と金額が同じで日付が近い**（番号が違っても疑わしい）
 *
 * @param candidate これから払う請求
 * @param history 過去に処理した請求
 * @param windowDays 「日付が近い」とみなす日数（既定 60）
 * @returns 疑いの一覧（確度の高い順）
 *
 * @example
 * ```ts
 * const dup = findDuplicatePayments(newInvoice, history);
 * if (dup.length > 0) {
 *   // **払う前に確認する**
 * }
 * ```
 */
export function findDuplicatePayments(
  candidate: ProcessedInvoice,
  history: readonly ProcessedInvoice[],
  windowDays = 60,
): DuplicateSuspicion[] {
  const out: DuplicateSuspicion[] = [];

  for (const h of history) {
    // **自分自身は `id` で除く。** 値が同じでも別のレコードかもしれない
    // ——同じ請求書を 2 回入力した場合がまさにそれで、
    // 値の一致で除外すると**最も明白な二重払いを見逃す**(2026-08 に修正)。
    // `id` が無い場合は除外しない(見逃すより余分に指摘する方が安全)。
    if (h.id !== undefined && candidate.id !== undefined && h.id === candidate.id) {
      continue;
    }

    // ── 請求書番号が同じ ──
    if (h.invoiceNumber === candidate.invoiceNumber && h.supplier === candidate.supplier) {
      out.push({
        invoiceNumber: candidate.invoiceNumber,
        matched: h,
        reason: `同じ請求書番号が既に処理されています（${h.paidOn ?? "支払日不明"}・${h.amount.toLocaleString("ja-JP")} 円）`,
        confidence: "certain",
      });
      continue;
    }

    // ── 仕入先と金額が同じで日付が近い ──
    // **番号が違っても疑わしい**（振り直された請求書、原本と写し）
    if (h.supplier === candidate.supplier && h.amount === candidate.amount) {
      if (h.paidOn === undefined || candidate.paidOn === undefined) {
        out.push({
          invoiceNumber: candidate.invoiceNumber, matched: h,
          reason: `同じ仕入先・同じ金額の請求があります（${h.invoiceNumber}）`,
          confidence: "likely",
        });
        continue;
      }
      const days = Math.abs(
        (new Date(`${candidate.paidOn}T00:00:00Z`).getTime() - new Date(`${h.paidOn}T00:00:00Z`).getTime()) / 86_400_000,
      );
      if (days <= windowDays) {
        out.push({
          invoiceNumber: candidate.invoiceNumber, matched: h,
          reason: `同じ仕入先・同じ金額の請求が ${Math.round(days)} 日前にあります（${h.invoiceNumber}）`,
          confidence: "likely",
        });
      }
    }
  }

  return out.sort((a, b) => (a.confidence === b.confidence ? 0 : a.confidence === "certain" ? -1 : 1));
}
