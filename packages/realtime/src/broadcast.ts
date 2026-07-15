/**
 * サーバ側のブロードキャストハブ(水平スケール対応)。
 * 複数インスタンスにまたがる WebSocket 接続へ、Redis Pub/Sub を介して同報する。
 * あるインスタンスで publish したメッセージが、全インスタンスのローカル接続へ届く。
 * (Socket.io の Redis adapter と同じ考え方。依存ゼロで pub/sub クライアントを注入。)
 * @packageDocumentation
 */

/** Redis Pub/Sub の最小インターフェース(ioredis 互換・テスト差し替え用)。 */
export interface RedisPubSubClient {
  /** チャネルへ発行。 */
  publish(channel: string, message: string): Promise<unknown> | unknown;
  /** チャネルを購読。message ごとに handler が呼ばれる。 */
  subscribe(channel: string, handler: (message: string) => void): Promise<void> | void;
  /** 購読解除。 */
  unsubscribe(channel: string): Promise<void> | void;
}

/** ローカル接続への送信関数。 */
export type SendFn = (data: string) => void;

/** ブロードキャストハブ。 */
export interface BroadcastHub {
  /** ローカル接続をチャネルに登録する。 */
  subscribe(channel: string, connectionId: string, send: SendFn): Promise<void>;
  /** ローカル接続を解除する。空になったチャネルは Redis 購読も解除。 */
  unsubscribe(channel: string, connectionId: string): Promise<void>;
  /** チャネルへ同報する(全インスタンスのローカル接続に届く)。 */
  publish(channel: string, data: unknown): Promise<void>;
  /** チャネルのローカル接続数。 */
  localCount(channel: string): number;
  /** 全チャネルの購読を解除(shutdown 用)。 */
  close(): Promise<void>;
}

/** {@link createBroadcastHub} のオプション。 */
export interface BroadcastHubOptions {
  /** Redis チャネルの接頭辞(既定 "ws:")。 */
  keyPrefix?: string;
  /** 送信中の例外を握る(1接続の失敗で全体を止めない)。 */
  onSendError?: (connectionId: string, error: unknown) => void;
}

/** ブロードキャストハブを作る。 */
export function createBroadcastHub(pubsub: RedisPubSubClient, options: BroadcastHubOptions = {}): BroadcastHub {
  const keyPrefix = options.keyPrefix ?? "ws:";
  // channel -> (connectionId -> send)
  const local = new Map<string, Map<string, SendFn>>();
  // Redis を購読済みのチャネル(重複購読防止)
  const subscribed = new Set<string>();

  const redisChannel = (channel: string) => `${keyPrefix}${channel}`;

  // Redis から受け取ったメッセージをローカル接続へ配る。
  function fanOut(channel: string, payload: string): void {
    const conns = local.get(channel);
    if (!conns) return;
    for (const [connectionId, send] of conns) {
      try { send(payload); }
      catch (e) { options.onSendError?.(connectionId, e); }
    }
  }

  async function ensureSubscribed(channel: string): Promise<void> {
    if (subscribed.has(channel)) return;
    subscribed.add(channel);
    await pubsub.subscribe(redisChannel(channel), (message) => fanOut(channel, message));
  }

  return {
    async subscribe(channel, connectionId, send) {
      let conns = local.get(channel);
      if (!conns) { conns = new Map(); local.set(channel, conns); }
      conns.set(connectionId, send);
      await ensureSubscribed(channel);
    },
    async unsubscribe(channel, connectionId) {
      const conns = local.get(channel);
      if (!conns) return;
      conns.delete(connectionId);
      if (conns.size === 0) {
        local.delete(channel);
        subscribed.delete(channel);
        await pubsub.unsubscribe(redisChannel(channel));
      }
    },
    async publish(channel, data) {
      // Redis に流すと、購読中の全インスタンス(自分含む)の handler が発火し fanOut される。
      // → ローカル即時配信はせず loopback に任せることで二重配信を防ぐ。
      await pubsub.publish(redisChannel(channel), JSON.stringify(data));
    },
    localCount(channel) {
      return local.get(channel)?.size ?? 0;
    },
    async close() {
      for (const channel of subscribed) await pubsub.unsubscribe(redisChannel(channel));
      subscribed.clear();
      local.clear();
    },
  };
}
