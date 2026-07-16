/**
 * ロット別在庫・賞味期限管理(純ロジック)。ロットごとの在庫、期限切れ間近、FEFO 引当を扱う。
 * @packageDocumentation
 */

/** ロット別の入出庫。 */
export interface LotMovement {
  lotId: string;
  type: "inbound" | "outbound" | "adjustment";
  quantity: number;
  at: string;
  /** 賞味/使用期限(ISO 日付。inbound で指定）。 */
  expiry?: string;
}

/** ロットの在庫状況。 */
export interface LotBalance {
  lotId: string;
  quantity: number;
  expiry?: string;
}

/**
 * ロットごとの現在庫を集計する。
 *
 * @param movements 入出庫の履歴
 * @returns ロットごとの在庫数。**0 以下は除外**(在庫が無いロットを一覧に出さない)
 */
export function lotBalances(movements: LotMovement[]): LotBalance[] {
  const map = new Map<string, { quantity: number; expiry?: string }>();
  const order: string[] = [];
  for (const m of movements) {
    if (!map.has(m.lotId)) {
      map.set(m.lotId, { quantity: 0, expiry: m.expiry });
      order.push(m.lotId);
    }
    const lot = map.get(m.lotId)!;
    if (m.expiry && !lot.expiry) lot.expiry = m.expiry;
    lot.quantity += m.type === "outbound" ? -m.quantity : m.quantity;
  }
  return order
    .map((lotId) => ({ lotId, quantity: map.get(lotId)!.quantity, expiry: map.get(lotId)!.expiry }))
    .filter((l) => l.quantity > 0);
}

/**
 * まもなく期限切れになるロットを返す。
 *
 * **食品・医薬品では廃棄損に直結する**。早めに気づいて値引きや優先出荷を判断する。
 *
 * @param movements 入出庫の履歴
 * @param days 何日以内か
 * @param asOf 基準日(テスト注入用)
 * @returns 期限が近いロット(**期限の近い順**)
 */
export function expiringSoon(movements: LotMovement[], asOf: string, days: number): LotBalance[] {
  const asOfTime = new Date(`${asOf.slice(0, 10)}T00:00:00Z`).getTime();
  const limit = asOfTime + days * 86_400_000;
  return lotBalances(movements).filter((l) => {
    if (!l.expiry) return false;
    const exp = new Date(`${l.expiry.slice(0, 10)}T00:00:00Z`).getTime();
    return exp <= limit;
  });
}

/**
 * 期限切れのロットを返す。
 *
 * **出荷してはいけない在庫**。数字上は在庫があっても、売れない。
 *
 * @param movements 入出庫の履歴
 * @param asOf 基準日(テスト注入用)
 * @returns 期限切れのロット
 */
export function expiredLots(movements: LotMovement[], asOf: string): LotBalance[] {
  const asOfTime = new Date(`${asOf.slice(0, 10)}T00:00:00Z`).getTime();
  return lotBalances(movements).filter((l) => {
    if (!l.expiry) return false;
    return new Date(`${l.expiry.slice(0, 10)}T00:00:00Z`).getTime() < asOfTime;
  });
}

/** 引当結果(どのロットから何個引き当てたか）。 */
export interface Allocation {
  lotId: string;
  quantity: number;
}

/**
 * FEFO(First Expired, First Out）で引当する。期限の早いロットから順に払い出す。
 * 期限なしのロットは最後に回す。在庫不足なら shortfall に不足数を返す。
 *
 * **期限の早いものから出す**のが原則(FIFO = 先入先出 ではなく FEFO)。
 * 入庫順に出すと、後から入った期限の近い在庫が残って廃棄になる。
 *
 * @param movements 入出庫の履歴
 * @param quantity 引き当てたい数量
 * @returns 引当の内訳と、**不足数**(在庫が足りなければ 0 より大きい)
 */
export function allocateFEFO(movements: LotMovement[], quantity: number): { allocations: Allocation[]; shortfall: number } {
  const lots = lotBalances(movements).slice().sort((a, b) => {
    if (!a.expiry && !b.expiry) return 0;
    if (!a.expiry) return 1;
    if (!b.expiry) return -1;
    return a.expiry.localeCompare(b.expiry);
  });
  let remaining = Math.max(0, quantity);
  const allocations: Allocation[] = [];
  for (const lot of lots) {
    if (remaining <= 0) break;
    const use = Math.min(remaining, lot.quantity);
    if (use > 0) {
      allocations.push({ lotId: lot.lotId, quantity: use });
      remaining -= use;
    }
  }
  return { allocations, shortfall: remaining };
}
