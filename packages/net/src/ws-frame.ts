/**
 * WebSocket(RFC 6455)フレームのエンコード/デコード(純)。
 * ライブラリ無しで text/binary/ping/pong/close フレームを扱う。
 * @packageDocumentation
 */

/** WebSocket オペコード。 */
export const WsOpcode = { continuation: 0x0, text: 0x1, binary: 0x2, close: 0x8, ping: 0x9, pong: 0xa } as const;

/** デコードされたフレーム。 */
export interface WsFrame { fin: boolean; opcode: number; payload: Uint8Array }

/** フレームをエンコードする(mask=true でクライアント→サーバ用にマスク)。 */
export function encodeWsFrame(opts: { opcode: number; payload?: Uint8Array; fin?: boolean; mask?: boolean; maskKey?: Uint8Array }): Uint8Array {
  const payload = opts.payload ?? new Uint8Array(0);
  const fin = opts.fin ?? true;
  const masked = opts.mask ?? false;
  const len = payload.length;

  const header: number[] = [(fin ? 0x80 : 0) | (opts.opcode & 0x0f)];
  const maskBit = masked ? 0x80 : 0;
  if (len < 126) {
    header.push(maskBit | len);
  } else if (len < 0x10000) {
    header.push(maskBit | 126, (len >> 8) & 0xff, len & 0xff);
  } else {
    header.push(maskBit | 127, 0, 0, 0, 0, (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff);
  }

  let maskKey: Uint8Array = new Uint8Array(0);
  let body: Uint8Array = payload;
  if (masked) {
    maskKey = opts.maskKey ?? new Uint8Array([Math.random() * 256, Math.random() * 256, Math.random() * 256, Math.random() * 256].map((n) => n & 0xff));
    body = new Uint8Array(len);
    for (let i = 0; i < len; i++) body[i] = (payload[i] as number) ^ (maskKey[i % 4] as number);
  }

  const out = new Uint8Array(header.length + maskKey.length + body.length);
  out.set(header, 0);
  out.set(maskKey, header.length);
  out.set(body, header.length + maskKey.length);
  return out;
}

/** テキストをマスク付き text フレームにする簡易版(クライアント用)。 */
export function encodeWsText(text: string, mask = true): Uint8Array {
  return encodeWsFrame({ opcode: WsOpcode.text, payload: new TextEncoder().encode(text), mask });
}

/** ストリームから WebSocket フレームを復元するデコーダ。 */
export class WsFrameDecoder {
  private buf = new Uint8Array(0);

  push(chunk: Uint8Array): WsFrame[] {
    const merged = new Uint8Array(this.buf.length + chunk.length);
    merged.set(this.buf);
    merged.set(chunk, this.buf.length);
    this.buf = merged;

    const out: WsFrame[] = [];
    for (;;) {
      const frame = this.tryReadFrame();
      if (!frame) break;
      out.push(frame);
    }
    return out;
  }

  private tryReadFrame(): WsFrame | null {
    const buf = this.buf;
    if (buf.length < 2) return null;
    const b0 = buf[0] as number;
    const b1 = buf[1] as number;
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let offset = 2;

    if (len === 126) {
      if (buf.length < offset + 2) return null;
      len = ((buf[offset] as number) << 8) | (buf[offset + 1] as number);
      offset += 2;
    } else if (len === 127) {
      if (buf.length < offset + 8) return null;
      // 下位 32bit のみ利用(実用上十分)。
      len = (buf[offset + 4] as number) * 0x1000000 + ((buf[offset + 5] as number) << 16) + ((buf[offset + 6] as number) << 8) + (buf[offset + 7] as number);
      offset += 8;
    }

    let maskKey: Uint8Array | null = null;
    if (masked) {
      if (buf.length < offset + 4) return null;
      maskKey = buf.slice(offset, offset + 4);
      offset += 4;
    }

    if (buf.length < offset + len) return null;
    let payload = buf.slice(offset, offset + len);
    if (maskKey) {
      const p = new Uint8Array(len);
      for (let i = 0; i < len; i++) p[i] = (payload[i] as number) ^ (maskKey[i % 4] as number);
      payload = p;
    }
    this.buf = buf.slice(offset + len);
    return { fin, opcode, payload };
  }
}
