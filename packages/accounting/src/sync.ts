/**
 * 外部会計 SaaS への仕訳送信バッチ(純オーケストレーション)。
 * 仕訳を freee 形式に変換して送信する。実 I/O(送信関数)は注入し、
 * 重複送信の防止・失敗の収集・未登録科目の事前チェックを行う。freee/マネーフォワード双方に適用可。
 * @packageDocumentation
 */
import { type JournalEntry } from "./journal";
import { journalToFreeeDetails, type FreeeJournalDetail } from "./export";

/** 送信 1 件分のペイロード。 */
export interface SyncPayload {
  /** 冪等キー(重複送信防止)。 */
  key: string;
  date: string;
  description: string;
  details: FreeeJournalDetail[];
}

/** バッチ準備の結果。 */
export interface PreparedBatch {
  /** 送信可能なペイロード。 */
  ready: SyncPayload[];
  /** 未登録科目があり送信できない仕訳。 */
  errors: { key: string; unknownAccounts: string[] }[];
}

/**
 * 仕訳の冪等キーを作る(日付 + 摘要 + 金額合計)。
 *
 * **同じ仕訳を二重に登録しない**ため。外部サービスへの送信が途中で失敗して再実行しても、
 * このキーで重複を検出できる。
 *
 * @param entry 仕訳
 * @returns 冪等キー(同じ内容なら同じ文字列)
 */
export function entryKey(entry: JournalEntry): string {
  const total = entry.lines.reduce((s, l) => s + l.debit, 0);
  return `${entry.date}|${entry.description}|${total}`;
}

/**
 * 仕訳を送信用に変換し、**未登録の科目を先に検出する**。
 *
 * 送ってからエラーになると、どこまで登録されたか分からなくなる。
 * **送る前に確認する**のが安全。
 *
 * @param entries 仕訳の配列
 * @param knownAccounts 登録済みの科目名
 * @returns 送信ペイロードと、未登録の科目名
 */
export function prepareBatch(entries: JournalEntry[], accountItemIds: Record<string, number>): PreparedBatch {
  const ready: SyncPayload[] = [];
  const errors: { key: string; unknownAccounts: string[] }[] = [];
  for (const entry of entries) {
    const key = entryKey(entry);
    const { details, unknownAccounts } = journalToFreeeDetails(entry, accountItemIds);
    if (unknownAccounts.length > 0) errors.push({ key, unknownAccounts });
    else ready.push({ key, date: entry.date, description: entry.description, details });
  }
  return { ready, errors };
}

/** 1 件の送信結果。 */
export interface SyncResult {
  key: string;
  status: "sent" | "skipped" | "failed";
  error?: string;
}

/** 送信関数(注入)。成功時は外部 ID などを返す想定。 */
export type Sender = (payload: SyncPayload) => Promise<{ ok: boolean; error?: string }>;

/**
 * バッチ送信する。alreadySent に含まれるキーはスキップ(冪等)。
 * 送信は 1 件ずつ順に行い、各結果を収集する。
 *
 * **並列にしない**のは、外部サービスのレート制限と、失敗時にどこまで送ったかを
 * 確実に把握するため(速さより確実さを優先)。
 *
 * @param entries 送る仕訳
 * @param options.send 送信する関数(外部 API の呼び出し)
 * @param options.accountItemIds 勘定科目名 → ID の対応表
 * @param options.alreadySent 送信済みの冪等キー(**再実行時に二重登録を防ぐ**)
 * @returns 各件の結果・送信できたキー・送信ペイロード
 */
export async function syncJournals(
  entries: JournalEntry[],
  options: { send: Sender; accountItemIds: Record<string, number>; alreadySent?: Set<string> },
): Promise<{ results: SyncResult[]; sent: string[]; prepared: PreparedBatch }> {
  const prepared = prepareBatch(entries, options.accountItemIds);
  const alreadySent = options.alreadySent ?? new Set<string>();
  const results: SyncResult[] = [];
  const sent: string[] = [];

  for (const err of prepared.errors) {
    results.push({ key: err.key, status: "failed", error: `未登録科目: ${err.unknownAccounts.join(", ")}` });
  }

  for (const payload of prepared.ready) {
    if (alreadySent.has(payload.key)) {
      results.push({ key: payload.key, status: "skipped" });
      continue;
    }
    const res = await options.send(payload);
    if (res.ok) {
      results.push({ key: payload.key, status: "sent" });
      sent.push(payload.key);
    } else {
      results.push({ key: payload.key, status: "failed", error: res.error });
    }
  }

  return { results, sent, prepared };
}

/**
 * 同期結果を集計する。
 *
 * @param results 同期の結果
 * @returns 送信・スキップ・失敗の件数
 */
export function summarizeSync(results: SyncResult[]): { sent: number; skipped: number; failed: number } {
  return {
    sent: results.filter((r) => r.status === "sent").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
  };
}
