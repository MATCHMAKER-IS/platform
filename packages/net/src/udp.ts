/**
 * UDP データグラム ソケット(node:dgram)。
 * @packageDocumentation
 */
import * as dgram from "node:dgram";

/** UDP ソケット。 */
export interface UdpSocket {
  /** 宛先へ 1 データグラム送信する。 */
  send(message: Uint8Array, port: number, host: string): Promise<void>;
  /** バインドされたポート。 */
  readonly port: number;
  /** ソケットを閉じる。 */
  close(): Promise<void>;
}

/** UDP ソケットを作成する(port 省略/0 で自動割当)。 */
export function createUdpSocket(
  options: { port?: number; host?: string } = {},
  onMessage?: (message: Uint8Array, from: { address: string; port: number }) => void,
): Promise<UdpSocket> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    socket.on("error", reject);
    if (onMessage) {
      socket.on("message", (msg: Buffer, rinfo: { address: string; port: number }) => {
        onMessage(new Uint8Array(msg.buffer, msg.byteOffset, msg.byteLength), { address: rinfo.address, port: rinfo.port });
      });
    }
    socket.bind(options.port ?? 0, options.host ?? "127.0.0.1", () => {
      const addr = socket.address();
      resolve({
        port: addr.port,
        send: (message, port, host) =>
          new Promise<void>((res, rej) => socket.send(message, port, host, (err) => (err ? rej(err) : res()))),
        close: () => new Promise<void>((res) => socket.close(() => res())),
      });
    });
  });
}
