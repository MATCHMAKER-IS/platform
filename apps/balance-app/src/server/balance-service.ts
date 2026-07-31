/**
 * 口座残高の取得。
 *
 * freee に繋がるなら実データ、繋がらないなら見本データを返します。
 * **どちらを使ったかを必ず返す**ので、画面で「見本です」と示せます
 * （見本を実データと誤解されるのが最も危険）。
 * @packageDocumentation
 */
import {
  createFreeeTokenManager, createFreeeAuthedFetch, createFreeeClient,
  buildBalanceHistory, totalBalance, summarizeBalance,
  type FreeeWalletable, type FreeeWalletTxn, type WalletBalanceHistory, type BalancePoint, type BalanceSummary,
} from "@platform/freee";
import { env, canUseFreee } from "./env";
import { SAMPLE_WALLETS, sampleTxns } from "./sample";

/** 画面に渡すもの。 */
export interface BalanceView {
  /** 見本データか（画面に明示する）。 */
  isSample: boolean;
  /** 口座ごとの推移。 */
  histories: WalletBalanceHistory[];
  /** 合算（クレジットカードを除く）。 */
  total: BalancePoint[];
  /** 要約。 */
  summary: BalanceSummary | null;
  /** いつ時点のデータか。 */
  fetchedAt: string;
  /** 取得に失敗した場合の理由（見本に切り替えた理由）。 */
  fallbackReason?: string;
}

/** 期間の既定（直近 90 日）。 */
function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 89);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

/**
 * 口座残高の推移を取る。
 *
 * @param range 期間（省略で直近 90 日）
 * @returns 画面に渡す形
 */
export async function getBalances(range?: { from: string; to: string }): Promise<BalanceView> {
  const { from, to } = range ?? defaultRange();
  const fetchedAt = new Date().toISOString();

  if (!canUseFreee) {
    return buildView(SAMPLE_WALLETS, sampleTxns(from, 90), from, to, fetchedAt, true,
      "freee の鍵が設定されていません");
  }

  try {
    const manager = createFreeeTokenManager({
      clientId: env.FREEE_CLIENT_ID!,
      clientSecret: env.FREEE_CLIENT_SECRET!,
      refreshToken: env.FREEE_REFRESH_TOKEN!,
      // **リフレッシュトークンは回転する。** 保存し直さないといずれ失効する
      onRefresh: (r) => { console.warn("freee のトークンが更新されました。保存先の更新が必要です", { hasNew: Boolean(r.refreshToken) }); },
    });
    // **`createFreeeAuthedFetch` は fetch を返すので `fetchImpl` に渡す。**
    // Authorization はその fetch 側で毎回付け直される(期限切れなら自動で更新する)ため、
    // `accessToken` はここでは使われない。必須項目なので空文字を渡す。
    const client = createFreeeClient({ accessToken: "", fetchImpl: createFreeeAuthedFetch(manager) });
    const companyId = env.FREEE_COMPANY_ID!;

    const wallets = await client.getWalletables(companyId);
    if (!wallets.ok) {
      return buildView(SAMPLE_WALLETS, sampleTxns(from, 90), from, to, fetchedAt, true,
        `口座の取得に失敗しました（${wallets.error.message}）`);
    }

    // 口座ごとに明細を取る。**件数が多いので期間を絞る**
    const txns: FreeeWalletTxn[] = [];
    for (const w of wallets.value.walletables) {
      const r = await client.getWalletTxns(companyId, { walletableId: w.id, limit: 500 });
      if (r.ok) txns.push(...r.value.wallet_txns);
    }

    return buildView(wallets.value.walletables, txns, from, to, fetchedAt, false);
  } catch (e) {
    return buildView(SAMPLE_WALLETS, sampleTxns(from, 90), from, to, fetchedAt, true,
      `freee に接続できませんでした（${e instanceof Error ? e.message : "原因不明"}）`);
  }
}

/** 取得結果を画面の形にまとめる。 */
function buildView(
  wallets: FreeeWalletable[],
  txns: FreeeWalletTxn[],
  from: string,
  to: string,
  fetchedAt: string,
  isSample: boolean,
  fallbackReason?: string,
): BalanceView {
  const histories = wallets.map((w) =>
    buildBalanceHistory(w, txns.filter((t) => t.walletable_id === w.id), from, to),
  );
  const total = totalBalance(histories);
  return { isSample, histories, total, summary: summarizeBalance(total), fetchedAt, fallbackReason };
}

/** 口座の一覧だけを取る（定期取得で使う）。 */
export async function getWallets(): Promise<{ wallets: FreeeWalletable[]; isSample: boolean }> {
  if (!canUseFreee) return { wallets: SAMPLE_WALLETS, isSample: true };
  try {
    const manager = createFreeeTokenManager({
      clientId: env.FREEE_CLIENT_ID!,
      clientSecret: env.FREEE_CLIENT_SECRET!,
      refreshToken: env.FREEE_REFRESH_TOKEN!,
    });
    // **`createFreeeAuthedFetch` は fetch を返すので `fetchImpl` に渡す。**
    // Authorization はその fetch 側で毎回付け直される(期限切れなら自動で更新する)ため、
    // `accessToken` はここでは使われない。必須項目なので空文字を渡す。
    const client = createFreeeClient({ accessToken: "", fetchImpl: createFreeeAuthedFetch(manager) });
    const r = await client.getWalletables(env.FREEE_COMPANY_ID!);
    // 取れなければ見本に落とす。**記録が途切れるより、見本と分かる形で残す方がよい**
    if (!r.ok) return { wallets: SAMPLE_WALLETS, isSample: true };
    return { wallets: r.value.walletables, isSample: false };
  } catch {
    return { wallets: SAMPLE_WALLETS, isSample: true };
  }
}
