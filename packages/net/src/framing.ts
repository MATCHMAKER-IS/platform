/**
 * ソケット(ストリーム)向けメッセージフレーミング(純)。
 * TCP はバイトストリームでメッセージ境界が無いため、長さ接頭辞 or 改行区切りで区切る。
 * @packageDocumentation
 */

/**
 * 長さ接頭辞を付けてフレーム化する(4 バイト・ビッグエンディアン)。
 *
 * **TCP はストリームなので、メッセージの境界が無い**。長さを先に送ることで、
 * 受信側が「どこまでが 1 通か」を判断できる。
 *
 * @param payload 送るデータ
 * @returns 長さ接頭辞付きのバイト列
 */
export function encodeLengthPrefixed(payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + payload.length);
  new DataView(out.buffer).setUint32(0, payload.length, false);
  out.set(payload, 4);
  return out;
}

/**
 * 長さ接頭辞フレームのデコーダ。断片化・複数連結どちらでも、`push` で
 * 完成したペイロードだけを配列で返す(内部で余りをバッファリング)。
 */
export class LengthPrefixedDecoder {
  private buf = new Uint8Array(0);
  private readonly maxFrameBytes: number;
  /** @param maxFrameBytes 上限(DoS 防止・既定 16MB)。 */
  constructor(maxFrameBytes = 16 * 1024 * 1024) { this.maxFrameBytes = maxFrameBytes; }

  push(chunk: Uint8Array): Uint8Array[] {
    const merged = new Uint8Array(this.buf.length + chunk.length);
    merged.set(this.buf);
    merged.set(chunk, this.buf.length);
    this.buf = merged;

    const out: Uint8Array[] = [];
    while (this.buf.length >= 4) {
      const len = new DataView(this.buf.buffer, this.buf.byteOffset, 4).getUint32(0, false);
      if (len > this.maxFrameBytes) throw new Error(`フレームが大きすぎます: ${len}`);
      if (this.buf.length < 4 + len) break;
      out.push(this.buf.slice(4, 4 + len));
      this.buf = this.buf.slice(4 + len);
    }
    return out;
  }

  /** 未処理バイト数。 */
  get pending(): number { return this.buf.length; }
}

/** 改行区切りのデコーダ(行単位のプロトコル用)。 */
export class LineDecoder {
  private buf = "";
  private decoder = new TextDecoder();

  push(chunk: Uint8Array): string[] {
    this.buf += this.decoder.decode(chunk, { stream: true });
    const lines = this.buf.split("\n");
    this.buf = lines.pop() ?? "";
    return lines.map((l) => (l.endsWith("\r") ? l.slice(0, -1) : l));
  }

  /** バッファに残った未終端の行(あれば)。 */
  flush(): string { const r = this.buf; this.buf = ""; return r; }
}

/**
 * テキストを改行区切りでエンコードする。
 *
 * **改行を含むデータには使えない**(境界が壊れる)。バイナリや任意のテキストには
 * {@link frameMessage}(長さ接頭辞)を使う。
 *
 * @param text 送るテキスト
 * @returns 改行付きのバイト列
 */
export function encodeLine(text: string): Uint8Array {
  return new TextEncoder().encode(text.endsWith("\n") ? text : text + "\n");
}
