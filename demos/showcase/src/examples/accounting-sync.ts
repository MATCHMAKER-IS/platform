/**
 * 外部会計 SaaS への仕訳送信バッチ(freee 接続の結線例)。
 * accounting の syncJournals に「freee へ 1 件送る関数」を注入する。冪等キーで二重送信を防ぐ。
 * 実運用では jobs の createGuardedJob で日次実行し、送信済みキーを永続化する。
 * @packageDocumentation
 */
import { syncJournals, summarizeSync, type Sender, type JournalEntry } from "@platform/accounting";
import { buildManualJournal } from "@platform/freee";

/** freee へ送る Sender を作る(companyId と送信関数を渡す)。 */
export function createFreeeSender(
  companyId: number,
  post: (journal: ReturnType<typeof buildManualJournal>) => Promise<{ ok: boolean; error?: string }>,
): Sender {
  return async (payload) => {
    const journal = buildManualJournal({
      companyId,
      issueDate: payload.date,
      details: payload.details.map((d) => ({
        entrySide: d.entrySide,
        accountItemId: d.accountItemId,
        amount: d.amount,
        // freee は税区分コードが必須。0 = 対象外(仕訳の内容に応じて変える)
        taxCode: 0,
      })),
    });
    return post(journal);
  };
}

/** 仕訳を freee へバッチ送信し、結果サマリを返す。 */
export async function runSyncBatch(
  entries: JournalEntry[],
  options: { companyId: number; accountItemIds: Record<string, number>; alreadySent: Set<string>; post: (j: ReturnType<typeof buildManualJournal>) => Promise<{ ok: boolean; error?: string }> },
) {
  const send = createFreeeSender(options.companyId, options.post);
  const result = await syncJournals(entries, { send, accountItemIds: options.accountItemIds, alreadySent: options.alreadySent });
  return { ...result, summary: summarizeSync(result.results) };
}
