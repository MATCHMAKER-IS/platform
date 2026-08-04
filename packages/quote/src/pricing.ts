/**
 * 見積の値引き・改訂履歴・粗利の計算。
 *
 * `quote.ts` は見積の基本（作成・有効期限・請求書への変換）を扱う。
 * ここでは**商談の中で必ず起きること**を扱う:
 *
 *   - 「もう少し安くならないか」→ **全体値引き**
 *   - 「仕様を変えたい」→ **改訂（版を上げる）**
 *   - 「この価格で受けて利益は出るのか」→ **粗利の確認**
 *
 * 【値引きで気をつけること】
 * 全体値引きは**明細に按分してから消費税を計算する**。
 * 税込金額から単純に引くと、税率が混在する見積で消費税額が合わなくなる
 * （8% と 10% の明細があるとき、どちらから引いたかで納税額が変わる）。
 *
 * 【改訂で気をつけること】
 * **前の版を消さない**。「言った・言わない」になったとき、
 * どの版を提示したかが唯一の証拠になる。
 *
 * @packageDocumentation
 */
import type { InvoiceLine } from "@platform/invoice";

/** 値引きの指定。 */
export interface Discount {
  /** 値引きの種類。 */
  type: "amount" | "rate";
  /** 金額（円。`type: "amount"` のとき）または率（0〜1。`type: "rate"` のとき）。 */
  value: number;
  /** 値引きの理由（**記録しておくと後で説明できる**）。 */
  reason?: string;
}

/** 値引きを按分した結果。 */
export interface DiscountedLines {
  /** 按分後の明細。 */
  lines: InvoiceLine[];
  /** 実際に値引いた合計（税抜）。 */
  discountTotal: number;
  /** 端数の調整で最後の明細に寄せた額。 */
  roundingAdjustment: number;
}

/**
 * 全体値引きを明細へ按分する。
 *
 * **税込金額から単純に引かない**。税率が混在する見積では、
 * どの明細から引いたかで消費税額が変わってしまう。
 * 各明細の金額に比例して配分し、**端数は最後の明細で調整**する。
 *
 * @param lines 明細
 * @param discount 値引きの指定
 * @returns 按分後の明細と、実際に値引いた額
 *
 * @example
 * ```ts
 * // 10 万円の見積から 1 万円値引き
 * const r = applyDiscount(lines, { type: "amount", value: 10_000, reason: "初回取引" });
 * // 各明細の discount に按分された額が入る
 * ```
 */
export function applyDiscount(
  lines: readonly InvoiceLine[],
  discount: Discount,
): DiscountedLines {
  const subtotals = lines.map((l) => l.quantity * l.unitPrice - (l.discount ?? 0));
  const total = subtotals.reduce((s, v) => s + v, 0);
  if (total <= 0) {
    return { lines: [...lines], discountTotal: 0, roundingAdjustment: 0 };
  }

  // 値引き額を決める（率なら金額に直す）
  const raw = discount.type === "rate"
    ? total * Math.max(0, Math.min(1, discount.value))
    : Math.max(0, discount.value);
  // **値引きが総額を超えないようにする**（マイナスの見積は作れない）
  const target = Math.min(Math.floor(raw), total);

  // 比例配分（1 円未満は切り捨て）
  const shares = subtotals.map((s) => Math.floor((target * s) / total));
  const distributed = shares.reduce((s, v) => s + v, 0);
  // **端数は最後の明細に寄せる**。配りきらないと合計が合わない
  const adjustment = target - distributed;
  const lastIndex = shares.length - 1;

  const out = lines.map((l, i) => ({
    ...l,
    discount: (l.discount ?? 0) + (shares[i] ?? 0) + (i === lastIndex ? adjustment : 0),
  }));

  return { lines: out, discountTotal: target, roundingAdjustment: adjustment };
}

/** 改訂の 1 版。 */
export interface QuoteRevision {
  /** 版番号（1 から始まる）。 */
  version: number;
  /** その版の明細。 */
  lines: InvoiceLine[];
  /** 改訂日（YYYY-MM-DD）。 */
  revisedOn: string;
  /** 何を変えたか（**必須**。空だと後から追えない）。 */
  changeReason: string;
  /** 提示したか（**提示済みの版は変更しない**）。 */
  presented?: boolean;
}

/** 改訂の差分。 */
export interface RevisionDiff {
  /** 前の版。 */
  from: number;
  /** 後の版。 */
  to: number;
  /** 追加された明細。 */
  added: InvoiceLine[];
  /** 削除された明細。 */
  removed: InvoiceLine[];
  /** 金額が変わった明細。 */
  changed: { description: string; before: number; after: number }[];
  /** 合計の差（税抜）。 */
  totalDiff: number;
}

/** 明細の小計（税抜）。 */
function lineSubtotal(l: InvoiceLine): number {
  return l.quantity * l.unitPrice - (l.discount ?? 0);
}

/**
 * 新しい版を作る。
 *
 * **前の版を消さない**。「言った・言わない」になったとき、
 * どの版を提示したかが唯一の証拠になる。
 *
 * @param revisions これまでの版（**空でもよい**）
 * @param lines 新しい版の明細
 * @param input.revisedOn 改訂日（YYYY-MM-DD）
 * @param input.changeReason 何を変えたか（**空は許さない**）
 * @returns 新しい版を足した配列
 * @throws 変更理由が空の場合
 *
 * @example
 * ```ts
 * const next = addRevision(revisions, newLines, {
 *   revisedOn: "2026-08-03",
 *   changeReason: "保守期間を 1 年から 3 年に変更",
 * });
 * ```
 */
export function addRevision(
  revisions: readonly QuoteRevision[],
  lines: readonly InvoiceLine[],
  input: { revisedOn: string; changeReason: string },
): QuoteRevision[] {
  // **理由の記録を必須にする。** 「なぜ変えたか」が無いと、
  // 後から見て正しい版がどれか判断できない
  if (input.changeReason.trim() === "") {
    throw new Error("改訂の理由が空です。何を変えたかを記録してください");
  }
  const nextVersion = revisions.reduce((max, r) => Math.max(max, r.version), 0) + 1;
  return [
    ...revisions,
    { version: nextVersion, lines: [...lines], revisedOn: input.revisedOn, changeReason: input.changeReason },
  ];
}

/**
 * 2 つの版の差分を取る。
 *
 * **何が変わったかを相手に説明する**ために使う。
 * 「新しい見積を送りました」だけでは、相手は全項目を見比べることになる。
 *
 * @param revisions 版の一覧
 * @param fromVersion 比較元の版番号
 * @param toVersion 比較先の版番号
 * @returns 追加・削除・変更された明細と、合計の差
 * @throws 指定した版が無い場合
 *
 * @example
 * ```ts
 * const d = diffRevisions(revisions, 1, 2);
 * console.log(`合計が ${d.totalDiff > 0 ? "増" : "減"}えました: ${Math.abs(d.totalDiff)} 円`);
 * ```
 */
export function diffRevisions(
  revisions: readonly QuoteRevision[],
  fromVersion: number,
  toVersion: number,
): RevisionDiff {
  const from = revisions.find((r) => r.version === fromVersion);
  const to = revisions.find((r) => r.version === toVersion);
  if (from === undefined || to === undefined) {
    throw new Error(`版が見つかりません（from: ${fromVersion} / to: ${toVersion}）`);
  }

  const beforeMap = new Map(from.lines.map((l) => [l.description, l]));
  const afterMap = new Map(to.lines.map((l) => [l.description, l]));

  const added = to.lines.filter((l) => !beforeMap.has(l.description));
  const removed = from.lines.filter((l) => !afterMap.has(l.description));
  const changed: RevisionDiff["changed"] = [];

  for (const [desc, after] of afterMap) {
    const before = beforeMap.get(desc);
    if (before === undefined) continue;
    const b = lineSubtotal(before);
    const a = lineSubtotal(after);
    if (b !== a) changed.push({ description: desc, before: b, after: a });
  }

  const sum = (ls: readonly InvoiceLine[]) => ls.reduce((s, l) => s + lineSubtotal(l), 0);
  return { from: fromVersion, to: toVersion, added, removed, changed, totalDiff: sum(to.lines) - sum(from.lines) };
}

/** 原価の指定（明細ごと）。 */
export interface CostLine {
  /** 品目（{@link InvoiceLine.description} と対応）。 */
  description: string;
  /** 1 個あたりの原価（円）。 */
  unitCost: number;
}

/** 粗利の計算結果。 */
export interface MarginResult {
  /** 売上（税抜）。 */
  revenue: number;
  /** 原価。 */
  cost: number;
  /** 粗利。 */
  grossProfit: number;
  /** **粗利率**（0〜1。売上に対する粗利の割合）。 */
  marginRate: number;
  /** 原価が分からなかった明細（**そのまま計算すると粗利が過大に出る**）。 */
  missingCost: string[];
  /** 明細ごとの粗利率（低い順）。 */
  byLine: { description: string; revenue: number; cost: number; marginRate: number }[];
}

/**
 * 粗利を計算する。
 *
 * **原価が分からない明細を無視しない**。無視すると粗利が過大に出て、
 * 「利益が出る」と判断して受注してしまう。`missingCost` に挙げて気づけるようにする。
 *
 * 値引き後の金額で計算するので、**{@link applyDiscount} の結果を渡す**こと。
 *
 * @param lines 明細（値引き後）
 * @param costs 原価
 * @returns 粗利と粗利率
 *
 * @example
 * ```ts
 * const m = calcMargin(discounted.lines, costs);
 * if (m.missingCost.length > 0) console.warn("原価が未設定の明細があります");
 * if (m.marginRate < 0.2) console.warn("粗利率が 20% を切っています");
 * ```
 */
export function calcMargin(
  lines: readonly InvoiceLine[],
  costs: readonly CostLine[],
): MarginResult {
  const costMap = new Map(costs.map((c) => [c.description, c.unitCost]));
  const missingCost: string[] = [];
  const byLine: MarginResult["byLine"] = [];

  let revenue = 0;
  let cost = 0;

  for (const l of lines) {
    const lineRevenue = lineSubtotal(l);
    revenue += lineRevenue;

    const unitCost = costMap.get(l.description);
    if (unitCost === undefined) {
      // **原価が無いことを記録する。** 0 として扱うと粗利が過大に出る
      missingCost.push(l.description);
      byLine.push({ description: l.description, revenue: lineRevenue, cost: 0, marginRate: 1 });
      continue;
    }
    const lineCost = unitCost * l.quantity;
    cost += lineCost;
    byLine.push({
      description: l.description,
      revenue: lineRevenue,
      cost: lineCost,
      marginRate: lineRevenue > 0 ? Math.round(((lineRevenue - lineCost) / lineRevenue) * 1000) / 1000 : 0,
    });
  }

  const grossProfit = revenue - cost;
  return {
    revenue,
    cost,
    grossProfit,
    marginRate: revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 1000 : 0,
    missingCost,
    // **粗利率が低い順**。値引きの余地を探すときはここを見る
    byLine: byLine.sort((a, b) => a.marginRate - b.marginRate),
  };
}

/**
 * 目標粗利率を保てる値引きの上限を求める。
 *
 * 商談中に「あといくらまで引けるか」を即答するために使う。
 * **原価が未設定の明細があると正しく出ない**ので、その場合は 0 を返す。
 *
 * @param lines 明細（値引き前）
 * @param costs 原価
 * @param targetMarginRate 保ちたい粗利率（0〜1）
 * @returns 値引きできる上限（円。税抜）
 *
 * @example
 * ```ts
 * // 粗利率 25% を保つなら、あといくら引けるか
 * maxDiscountForMargin(lines, costs, 0.25);
 * ```
 */
export function maxDiscountForMargin(
  lines: readonly InvoiceLine[],
  costs: readonly CostLine[],
  targetMarginRate: number,
): number {
  const m = calcMargin(lines, costs);
  // **原価が分からなければ答えられない。** 憶測で数字を出さない
  if (m.missingCost.length > 0) return 0;
  const rate = Math.max(0, Math.min(1, targetMarginRate));
  if (rate >= 1) return 0;
  // 売上 x のとき粗利率 = (x - cost) / x >= rate → x >= cost / (1 - rate)
  const minRevenue = m.cost / (1 - rate);
  return Math.max(0, Math.floor(m.revenue - minRevenue));
}
