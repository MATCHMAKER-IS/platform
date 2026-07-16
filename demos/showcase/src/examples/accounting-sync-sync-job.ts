/**
 * 仕訳送信バッチのジョブ化(@platform/cron の createGuardedJob で日次実行)。
 * preventOverlap で多重起動を防ぎ、送信済みキーを永続化して冪等に保つ。
 * @packageDocumentation
 */
import { createGuardedJob } from "@platform/cron";
import { syncJournals, summarizeSync, type Sender, type JournalEntry } from "@platform/accounting";

/** 送信済みキーの永続化ストア(DB/Redis を注入)。 */
export interface SentStore {
  loadSent(): Promise<Set<string>>;
  markSent(keys: string[]): Promise<void>;
}

/** 送信バッチのガード付きジョブを作る。 */
export function createSyncJob(options: {
  loadEntries: () => Promise<JournalEntry[]>;
  send: Sender;
  accountItemIds: Record<string, number>;
  store: SentStore;
  onResult?: (summary: { sent: number; skipped: number; failed: number }) => void;
}) {
  return createGuardedJob({
    name: "accounting-sync",
    preventOverlap: true,
    handler: async () => {
      const entries = await options.loadEntries();
      const alreadySent = await options.store.loadSent();
      const result = await syncJournals(entries, { send: options.send, accountItemIds: options.accountItemIds, alreadySent });
      if (result.sent.length > 0) await options.store.markSent(result.sent);
      options.onResult?.(summarizeSync(result.results));
    },
  });
}
