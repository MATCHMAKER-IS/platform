/**
 * 複数チャネルへの送信結果を個別に返すファンアウト(createNotifier は all-or-nothing なのに対し、
 * これは 1 つ失敗しても他チャネルへ送り、各結果を返す)。
 * @packageDocumentation
 */
import type { NotifyChannel, NotifyMessage } from "./index.js";

/** 1 チャネルの送信結果。 */
export interface ChannelResult { name: string; ok: boolean; error?: string }

/** 名前つきチャネル。 */
export interface NamedChannel { name: string; channel: NotifyChannel }

/**
 * 全チャネルへ送る。
 *
 * **例外を握って結果に入れる**(1 つのチャネルが落ちても、他は送る)。
 * メールが失敗したから Slack にも送らない、では困る。
 *
 * @param channels チャネルの配列
 * @param message 通知
 * @returns 各チャネルの結果(**成否を含む**)
 */
export async function notifyAllSettled(channels: NamedChannel[], message: NotifyMessage): Promise<ChannelResult[]> {
  return Promise.all(
    channels.map(async ({ name, channel }) => {
      try {
        await channel.send(message);
        return { name, ok: true };
      } catch (e) {
        return { name, ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
}

/**
 * 送信結果を要約する。
 *
 * @param results 各チャネルの結果
 * @returns 成功・失敗の件数と、全成功か
 */
export function summarizeResults(results: ChannelResult[]): { total: number; succeeded: number; failed: number; allOk: boolean } {
  const succeeded = results.filter((r) => r.ok).length;
  return { total: results.length, succeeded, failed: results.length - succeeded, allOk: succeeded === results.length && results.length > 0 };
}
