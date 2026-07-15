/**
 * プレゼンス(オンライン・タイピング)の追跡。ハートビートとタイピングを TTL 付きで保持し、
 * スナップショット時に期限切れを間引く。時刻はミリ秒で受け取るためテストしやすい。
 * 分散環境では TTL を Redis に置くが、判定ロジックはここに集約する。
 * @packageDocumentation
 */

/** プレゼンスのスナップショット。 */
export interface PresenceSnapshot {
  /** オンラインのユーザー ID(重複なし・ソート済み)。 */
  online: string[];
  /** 入力中のユーザー ID(重複なし・ソート済み)。 */
  typing: string[];
}

/** プレゼンストラッカー。 */
export interface PresenceTracker {
  /** オンライン継続の合図(now から onlineTtl だけ在席)。 */
  heartbeat(roomId: string, userId: string, nowMs: number): void;
  /** 明示的に離席する。 */
  offline(roomId: string, userId: string): void;
  /** 入力中の合図(now から typingTtl だけ入力中)。 */
  typing(roomId: string, userId: string, nowMs: number): void;
  /** 入力を止める。 */
  stopTyping(roomId: string, userId: string): void;
  /** 現時点のオンライン/入力中(期限切れは除外)。 */
  snapshot(roomId: string, nowMs: number): PresenceSnapshot;
  /** ルームのオンライン人数。 */
  onlineCount(roomId: string, nowMs: number): number;
}

/** トラッカーを生成する。 */
export function createPresenceTracker(options: { onlineTtlMs?: number; typingTtlMs?: number } = {}): PresenceTracker {
  const onlineTtl = options.onlineTtlMs ?? 30_000;
  const typingTtl = options.typingTtlMs ?? 5_000;
  // roomId -> (userId -> expiresAtMs)
  const online = new Map<string, Map<string, number>>();
  const typing = new Map<string, Map<string, number>>();

  const put = (map: Map<string, Map<string, number>>, roomId: string, userId: string, expires: number) => {
    const m = map.get(roomId) ?? new Map<string, number>();
    m.set(userId, expires);
    map.set(roomId, m);
  };
  const drop = (map: Map<string, Map<string, number>>, roomId: string, userId: string) => {
    map.get(roomId)?.delete(userId);
  };
  const live = (map: Map<string, Map<string, number>>, roomId: string, nowMs: number): string[] => {
    const m = map.get(roomId);
    if (!m) return [];
    const alive: string[] = [];
    for (const [userId, exp] of m) {
      if (exp > nowMs) alive.push(userId);
      else m.delete(userId);
    }
    return alive.sort();
  };

  return {
    heartbeat(roomId, userId, nowMs) {
      put(online, roomId, userId, nowMs + onlineTtl);
    },
    offline(roomId, userId) {
      drop(online, roomId, userId);
      drop(typing, roomId, userId);
    },
    typing(roomId, userId, nowMs) {
      put(typing, roomId, userId, nowMs + typingTtl);
      // 入力中なら在席でもある
      put(online, roomId, userId, nowMs + onlineTtl);
    },
    stopTyping(roomId, userId) {
      drop(typing, roomId, userId);
    },
    snapshot(roomId, nowMs) {
      return { online: live(online, roomId, nowMs), typing: live(typing, roomId, nowMs) };
    },
    onlineCount(roomId, nowMs) {
      return live(online, roomId, nowMs).length;
    },
  };
}
