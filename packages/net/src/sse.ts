/**
 * Server-Sent Events(SSE)の整形とパース(純)。HTTP ロングコネクション向け。
 * @packageDocumentation
 */

/** SSE イベント。 */
export interface SseEvent { event?: string; data: string; id?: string; retry?: number }

/** SSE イベントをワイヤ形式("event: ...\ndata: ...\n\n")に整形する。 */
export function formatSseEvent(ev: SseEvent): string {
  const lines: string[] = [];
  if (ev.id !== undefined) lines.push(`id: ${ev.id}`);
  if (ev.event !== undefined) lines.push(`event: ${ev.event}`);
  if (ev.retry !== undefined) lines.push(`retry: ${ev.retry}`);
  for (const line of ev.data.split("\n")) lines.push(`data: ${line}`);
  return lines.join("\n") + "\n\n";
}

/** SSE ストリームのパーサ(チャンクを push し、完成イベントを返す)。 */
export class SseDecoder {
  private buf = "";

  push(chunk: string): SseEvent[] {
    this.buf += chunk;
    const out: SseEvent[] = [];
    let idx: number;
    // イベントは空行(\n\n)区切り
    while ((idx = this.buf.indexOf("\n\n")) >= 0) {
      const block = this.buf.slice(0, idx);
      this.buf = this.buf.slice(idx + 2);
      const ev = this.parseBlock(block);
      if (ev) out.push(ev);
    }
    return out;
  }

  private parseBlock(block: string): SseEvent | null {
    const dataLines: string[] = [];
    let event: string | undefined;
    let id: string | undefined;
    let retry: number | undefined;
    for (const raw of block.split("\n")) {
      if (raw === "" || raw.startsWith(":")) continue; // コメント/空行
      const colon = raw.indexOf(":");
      const field = colon < 0 ? raw : raw.slice(0, colon);
      let value = colon < 0 ? "" : raw.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "data") dataLines.push(value);
      else if (field === "event") event = value;
      else if (field === "id") id = value;
      else if (field === "retry") { const n = Number(value); if (!Number.isNaN(n)) retry = n; }
    }
    if (dataLines.length === 0 && event === undefined && id === undefined) return null;
    return { data: dataLines.join("\n"), event, id, retry };
  }
}
