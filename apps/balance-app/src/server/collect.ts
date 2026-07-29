/**
 * 残高を取って記録し、古いものを間引く。
 *
 * 1 日に数回動かします。**取得と間引きを 1 回にまとめる**のは、
 * 別々にすると片方だけ止まったときに気づきにくいためです。
 * @packageDocumentation
 */
import { planRetention, verifyRetention, type BalanceSnapshot } from "@platform/freee";
import { formatDateJst } from "@platform/datetime";
import { createLogger } from "@platform/logger";
import { getWallets } from "./balance-service";
import { snapshotStore } from "./services";

const logger = createLogger({ base: { service: "balance-collect" } });

/** 1 回の実行の結果。 */
export interface CollectResult {
  /** 記録した件数。 */
  added: number;
  /** 消した件数。 */
  removed: number;
  /** 残っている件数。 */
  total: number;
  /** 見本データで動いたか（実データではない）。 */
  isSample: boolean;
  /** 間引きを見送った理由（安全のため止めた場合）。 */
  skippedReason?: string;
}

/**
 * 残高を取って記録し、間引く。
 *
 * **間引きは「残すもの」を先に決めてから消します。**
 * 消すものを選ぶ形だと、条件の書き間違いで全部消えます。
 *
 * @param asOf 基準日（YYYY-MM-DD。省略で今日）
 * @returns 実行の結果
 */
export async function collectAndPrune(asOf?: string): Promise<CollectResult> {
  // JST の今日。UTC で切ると 00:00〜08:59 の間だけ前日の残高を集計してしまう
  const today = asOf ?? formatDateJst();
  const takenAt = new Date().toISOString();

  // 1. 取る
  const { wallets, isSample } = await getWallets();
  const snapshots: BalanceSnapshot[] = wallets.map((w) => ({
    walletableId: w.id,
    walletableName: w.name,
    balance: w.last_balance ?? w.walletable_balance ?? 0,
    takenAt,
  }));

  const added = await snapshotStore.add(snapshots);
  logger.info({ added, isSample }, "残高を記録しました");

  // 2. 間引く（何を残すかを先に決める）
  const all = await snapshotStore.all();
  const plan = planRetention(all, today);

  // 3. 確かめてから消す
  const issues = verifyRetention(plan);
  if (issues.length > 0) {
    // **消さずに止める。** 月末の記録が失われると元に戻せない
    logger.error({ issues }, "間引きの内容がおかしいため、削除を見送りました");
    return {
      added,
      removed: 0,
      total: await snapshotStore.count(),
      isSample,
      skippedReason: issues.join(" / "),
    };
  }

  const removed = plan.remove.length > 0
    ? await snapshotStore.removeMany(plan.remove.map((s) => s.takenAt))
    : 0;

  logger.info({ ...plan.reason, removed }, "古い記録を間引きました");

  return { added, removed, total: await snapshotStore.count(), isSample };
}
