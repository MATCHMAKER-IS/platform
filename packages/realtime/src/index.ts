/**
 * `@platform/realtime` — 自動更新の基盤。ポーリングと再接続 WebSocket。
 * フレームワーク非依存(React 用フックは @platform/ui の usePolling / useWebSocket)。
 * @packageDocumentation
 */

/** 指数バックオフの待ち時間(ms)。attempt=0,1,2... で base*2^n を max で頭打ち。 */
export function backoffDelay(attempt: number, baseMs = 500, maxMs = 15000): number {
  return Math.min(maxMs, baseMs * 2 ** attempt);
}

/** ポーラー。 */
export interface Poller {
  start(): void;
  stop(): void;
  /** 動作中か。 */
  isRunning(): boolean;
}

/**
 * 一定間隔で関数を呼ぶポーラーを作る。開始時に即時 1 回実行する。
 * テスト用に scheduler/clear を差し替え可能。
 */
export function createPoller(
  fn: () => void | Promise<void>,
  intervalMs: number,
  scheduler: (cb: () => void, ms: number) => unknown = setInterval,
  clear: (id: unknown) => void = clearInterval as (id: unknown) => void,
): Poller {
  let id: unknown = null;
  return {
    start() {
      if (id != null) return;
      void fn();
      id = scheduler(() => void fn(), intervalMs);
    },
    stop() {
      if (id != null) { clear(id); id = null; }
    },
    isRunning() { return id != null; },
  };
}

/** WebSocket 相当の最小型(注入・テスト用)。 */
export interface WebSocketLike {
  send(data: string): void;
  close(): void;
  onopen: ((ev?: unknown) => void) | null;
  onclose: ((ev?: unknown) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
}

/** {@link createReconnectingWebSocket} のオプション。 */
export interface ReconnectingWsOptions<T = unknown> {
  /** メッセージ受信(JSON は自動 parse、失敗時は生文字列)。 */
  onMessage?: (data: T) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: () => void;
  /** 最大再接続回数(既定 Infinity)。 */
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** WebSocket 実装の注入(既定はグローバル WebSocket)。 */
  WebSocketImpl?: new (url: string) => WebSocketLike;
  /** 再接続の待ちをスケジュールする関数(テスト用)。 */
  scheduleReconnect?: (cb: () => void, ms: number) => void;
  /** 切断中の send をバッファし、再接続時に送信する(既定 true)。 */
  queueWhileDisconnected?: boolean;
  /** バッファ上限(超過分は古いものから破棄。既定 100)。 */
  maxQueueSize?: number;
}

/** 再接続 WebSocket のハンドル。 */
export interface ReconnectingWebSocket {
  send(data: unknown): void;
  close(): void;
  status(): "connecting" | "open" | "closed";
  /** 未送信(切断中にバッファされた)件数。 */
  pending(): number;
}

/**
 * 自動再接続する WebSocket を作る(指数バックオフ)。JSON メッセージを自動 parse。
 */
export function createReconnectingWebSocket<T = unknown>(url: string, options: ReconnectingWsOptions<T> = {}): ReconnectingWebSocket {
  const {
    onMessage, onOpen, onClose, onError,
    maxRetries = Infinity, baseDelayMs = 500, maxDelayMs = 15000,
    WebSocketImpl = (globalThis as unknown as { WebSocket?: new (url: string) => WebSocketLike }).WebSocket,
    scheduleReconnect = (cb, ms) => setTimeout(cb, ms),
    queueWhileDisconnected = true,
    maxQueueSize = 100,
  } = options;

  // 切断中の送信バッファ(再接続時に flush)
  const sendQueue: string[] = [];

  let ws: WebSocketLike | null = null;
  let state: "connecting" | "open" | "closed" = "connecting";
  let attempt = 0;
  let closedByUser = false;

  function connect() {
    if (!WebSocketImpl) { state = "closed"; return; }
    state = "connecting";
    ws = new WebSocketImpl(url);
    ws.onopen = () => {
      state = "open"; attempt = 0;
      // バッファした送信を順に流す
      while (sendQueue.length > 0) { const msg = sendQueue.shift()!; ws!.send(msg); }
      onOpen?.();
    };
    ws.onmessage = (ev) => {
      let data: unknown = ev.data;
      if (typeof data === "string") { try { data = JSON.parse(data); } catch { /* 生文字列のまま */ } }
      onMessage?.(data as T);
    };
    ws.onerror = () => onError?.();
    ws.onclose = () => {
      onClose?.();
      if (closedByUser || attempt >= maxRetries) { state = "closed"; return; }
      const delay = backoffDelay(attempt++, baseDelayMs, maxDelayMs);
      state = "connecting";
      scheduleReconnect(connect, delay);
    };
  }
  connect();

  return {
    send(data) {
      const payload = typeof data === "string" ? data : JSON.stringify(data);
      if (state === "open" && ws) { ws.send(payload); return; }
      if (queueWhileDisconnected && !closedByUser) {
        sendQueue.push(payload);
        while (sendQueue.length > maxQueueSize) sendQueue.shift(); // 古いものから破棄
      }
    },
    close() { closedByUser = true; state = "closed"; sendQueue.length = 0; ws?.close(); },
    status() { return state; },
    pending() { return sendQueue.length; },
  };
}
export { createBroadcastHub, type BroadcastHub, type RedisPubSubClient, type BroadcastHubOptions, type SendFn } from "./broadcast.js";
