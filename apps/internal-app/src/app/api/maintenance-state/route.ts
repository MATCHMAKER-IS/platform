// public-api: proxy が全リクエストの前に読む。認可を要求すると自分自身を締め出す(メンテ中でも管理画面に入れなくなる)。返すのは enabled と復旧予定だけで、秘密は含まない
// no-rate-limit: 保守モードの状態。全ページの表示前に引かれる
/**
 * メンテナンス状態の読み取り(proxy 専用)。
 *
 * **なぜ API を挟むか。**
 * proxy(旧 middleware)からは **Prisma のクライアントをバンドルできない**。
 * Next 16 の proxy は Node.js ランタイムで動くが、生成された Prisma クライアントを
 * proxy のバンドルに載せようとすると
 * 「Cannot read properties of undefined (reading 'call')」で落ちる
 * (2026-08 に実際に踏んだ。型検査もビルドも通り、画面を開いて初めて出る)。
 *
 * proxy は**全リクエストの前に走る**ので、そこで DB を叩くこと自体が本来避けたい形でもある。
 * 状態の読み取りだけをここへ切り出し、proxy 側は TTL キャッシュ(既定 5 秒)越しに読む。
 *
 * **書き込みはここではしない**(管理画面の API が担当する)。読み取り専用。
 */
import { NextResponse } from "next/server";
import { createDbMaintenanceStore } from "../../../server/maintenance-store";

/** 状態を返す。**認証は要らない**(在席確認と同じで、秘密ではない)。 */
export async function GET() {
  const store = createDbMaintenanceStore();
  const state = await store.get();
  return NextResponse.json(state, {
    // proxy 側が TTL キャッシュを持つので、ここでは保持しない
    headers: { "cache-control": "no-store" },
  });
}
