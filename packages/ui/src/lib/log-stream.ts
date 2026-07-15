/**
 * ログの実ストリーム(WebSocket / SSE)アダプタ。受信メッセージを行として配信する。
 * ブラウザ非依存のテストができるよう、WebSocket/EventSource は注入可能。
 * @packageDocumentation
 */

/** ストリーム購読ハンドル。 */
export interface LogStream {
  /** 行を受け取るコールバックを登録。解除関数を返す。 */
  subscribe(onLines: (lines: string[]) => void): () => void;
  /** 接続を閉じる。 */
  close(): void;
}

/** 最小限の WebSocket 互換インタフェース。 */
export interface WsLike {
  addEventListener(type: "message" | "error" | "close" | "open", cb: (ev: { data?: unknown }) => void): void;
  close(): void;
}
/** 最小限の EventSource 互換インタフェース。 */
export interface SseLike {
  addEventListener(type: "message" | "error", cb: (ev: { data?: unknown }) => void): void;
  close(): void;
}

/** {@link createLogStream} のオプション。 */
export interface LogStreamOptions {
  url: string;
  type?: "ws" | "sse";
  /** 受信データ(文字列)を行配列へ変換。既定は改行分割。 */
  transform?: (data: string) => string[];
  /** WebSocket ファクトリ(テスト用)。既定は globalThis.WebSocket。 */
  wsFactory?: (url: string) => WsLike;
  /** EventSource ファクトリ(テスト用)。既定は globalThis.EventSource。 */
  sseFactory?: (url: string) => SseLike;
}

function defaultTransform(data: string): string[] {
  return data.split(/\r?\n/).filter((l) => l.length > 0);
}

/** ログストリームを作成する。type は url の scheme から自動判定(ws://→ws)。 */
export function createLogStream(options: LogStreamOptions): LogStream {
  const type = options.type ?? (options.url.startsWith("ws") ? "ws" : "sse");
  const transform = options.transform ?? defaultTransform;
  const subscribers = new Set<(lines: string[]) => void>();

  const handleData = (data: unknown) => {
    if (typeof data !== "string") return;
    const lines = transform(data);
    if (lines.length === 0) return;
    for (const cb of subscribers) cb(lines);
  };

  let source: WsLike | SseLike | null = null;
  if (type === "ws") {
    const factory = options.wsFactory ?? ((u: string) => new (globalThis as unknown as { WebSocket: new (u: string) => WsLike }).WebSocket(u));
    const ws = factory(options.url);
    ws.addEventListener("message", (ev) => handleData(ev.data));
    source = ws;
  } else {
    const factory = options.sseFactory ?? ((u: string) => new (globalThis as unknown as { EventSource: new (u: string) => SseLike }).EventSource(u));
    const es = factory(options.url);
    es.addEventListener("message", (ev) => handleData(ev.data));
    source = es;
  }

  return {
    subscribe(onLines) { subscribers.add(onLines); return () => subscribers.delete(onLines); },
    close() { subscribers.clear(); source?.close(); },
  };
}
