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

/** ロットごとの現在庫を集計する（数量 0 以下は除外）。 */
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

/** 指定日から days 日以内に期限切れになる在庫ロット。 */
export function expiringSoon(movements: LotMovement[], asOf: string, days: number): LotBalance[] {
  const asOfTime = new Date(`${asOf.slice(0, 10)}T00:00:00Z`).getTime();
  const limit = asOfTime + days * 86_400_000;
  return lotBalances(movements).filter((l) => {
    if (!l.expiry) return false;
    const exp = new Date(`${l.expiry.slice(0, 10)}T00:00:00Z`).getTime();
    return exp <= limit;
  });
}

/** 期限切れ(asOf 時点で期限超過）のロット。 */
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
