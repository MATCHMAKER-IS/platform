import type { AiCallLog, AiLogStore } from "./types";

/**
 * AI ログのメモリ実装(開発・テスト用)。
 *
 * **本番では DB 実装を使うこと**(コストの追跡は経理に関わるので、消えては困る)。
 *
 * @returns ログストア
 */
export function createMemoryAiLogStore(): AiLogStore & {
  list(): AiCallLog[];
  totals(): { calls: number; inputTokens: number; outputTokens: number; costJpy: number; byUser: Record<string, { calls: number; costJpy: number }>; byPurpose: Record<string, { calls: number; costJpy: number }> };
} {
  const entries: AiCallLog[] = [];
  return {
    add(entry) {
      entries.push({ ...entry });
    },
    list() {
      return entries.map((e) => ({ ...e }));
    },
    totals() {
      const byUser: Record<string, { calls: number; costJpy: number }> = {};
      // **用途別の集計。** 「誰が」だけでは減らせるか分かりません——
      // **「何に」が分かって初めて、やめる判断ができます**。
      const byPurpose: Record<string, { calls: number; costJpy: number }> = {};
      let calls = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      let costJpy = 0;
      for (const e of entries) {
        if (!e.ok) continue;
        calls += 1;
        inputTokens += e.usage?.inputTokens ?? 0;
        outputTokens += e.usage?.outputTokens ?? 0;
        costJpy += e.costJpy ?? 0;
        if (e.user) {
          const u = (byUser[e.user] ??= { calls: 0, costJpy: 0 });
          u.calls += 1;
          u.costJpy += e.costJpy ?? 0;
        }
        if (e.purpose !== undefined) {
          const pp = (byPurpose[e.purpose] ??= { calls: 0, costJpy: 0 });
          pp.calls += 1;
          pp.costJpy += e.costJpy ?? 0;
        }
      }
      return { calls, inputTokens, outputTokens, costJpy, byUser, byPurpose };
    },
  };
}
