/**
 * 口座残高の画面（サーバ側）。
 *
 * 取得はサーバで行う。**鍵をブラウザに渡さない**ため。
 */
import { getBalances } from "../server/balance-service";
import { BalanceClient } from "./balance-client";

// 残高は変わるので、毎回取り直す
export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getBalances();
  return <BalanceClient view={view} />;
}
