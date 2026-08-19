/**
 * 複数チャネルへの送信結果を個別に返すファンアウト(createNotifier は all-or-nothing なのに対し、
 * これは 1 つ失敗しても他チャネルへ送り、各結果を返す)。
 * @packageDocumentation
 */
import type { NotifyChannel, NotifyMessage } from "./index";

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
 * **`allOk` だけでは足りない。** 一斉通知の結果は 3 通りあり、
 * **やるべきことがそれぞれ違う**:
 *
 * - **全部成功** … 何もしない
 * - **一部だけ失敗**(`partial`) … **届かなかった相手に別経路で連絡する**。
 *   障害通知を 100 人に送って 3 人だけ失敗した場合、**その 3 人は障害を知らない**。
 *   「送信した」記録は残るので、後から気づくのが難しい。
 * - **全部失敗**(`allFailed`) … 通知の仕組み自体が壊れている(即対応)
 *
 * `allOk: false` は下 2 つを区別しないので、**一部失敗が全部失敗に埋もれる**
 * (2026-08 に `partial` / `allFailed` を追加)。
 *
 * @param results 各チャネルの結果
 * @returns 件数と、3 つの状態(`allOk` / `partial` / `allFailed`)、失敗したチャネル名
 */
export function summarizeResults(results: ChannelResult[]): {
  total: number;
  succeeded: number;
  failed: number;
  allOk: boolean;
  /** **一部だけ失敗した。** 届かなかった相手に別経路で連絡すること。 */
  partial: boolean;
  /** **全部失敗した。** 通知の仕組み自体を疑うこと。 */
  allFailed: boolean;
  /** 失敗したチャネル名(誰に届かなかったかを追えるように)。 */
  failedChannels: string[];
} {
  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;
  return {
    total: results.length,
    succeeded,
    failed,
    allOk: succeeded === results.length && results.length > 0,
    partial: succeeded > 0 && failed > 0,
    allFailed: results.length > 0 && succeeded === 0,
    failedChannels: results.filter((r) => !r.ok).map((r) => r.name),
  };
}
