/**
 * 長さ接頭辞フレーミングを使う TCP クライアント/サーバ(node:net)。
 * @packageDocumentation
 */
import * as net from "node:net";
import { encodeLengthPrefixed, LengthPrefixedDecoder } from "./framing.js";

/** フレーム付き TCP 接続。 */
export interface FramedConnection {
  /** ペイロードを 1 メッセージとして送る。 */
  send(payload: Uint8Array): void;
  /** 接続を閉じる。 */
  close(): void;
}

/** フレーム付き TCP サーバ。 */
export interface FramedServer {
  /** 実際に待ち受けているポート。 */
  readonly port: number;
  /** サーバを閉じる。 */
  close(): Promise<void>;
}

function attachFraming(socket: net.Socket, onMessage: (payload: Uint8Array, conn: FramedConnection) => void): FramedConnection {
  const decoder = new LengthPrefixedDecoder();
  const conn: FramedConnection = {
    send: (payload) => socket.write(encodeLengthPrefixed(payload)),
    close: () => socket.end(),
  };
  socket.on("data", (chunk: Buffer) => {
    const messages = decoder.push(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
    for (const m of messages) onMessage(m, conn);
  });
  return conn;
}

/** フレーム付き TCP サーバを起動する。 */
export function createFramedServer(
  options: { port?: number; host?: string },
  onMessage: (payload: Uint8Array, conn: FramedConnection) => void,
): Promise<FramedServer> {
  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => { attachFraming(socket, onMessage); });
    server.on("error", reject);
    server.listen(options.port ?? 0, options.host ?? "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        port,
        close: () => new Promise<void>((res) => server.close(() => res())),
      });
    });
  });
}

/** フレーム付き TCP クライアントで接続する。 */
export function connectFramed(
  options: { host: string; port: number },
  onMessage: (payload: Uint8Array, conn: FramedConnection) => void,
): Promise<FramedConnection> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: options.host, port: options.port }, () => {
      resolve(conn);
    });
    socket.on("error", reject);
    const conn = attachFraming(socket, onMessage);
  });
}
