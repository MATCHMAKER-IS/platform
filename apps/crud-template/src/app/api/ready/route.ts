// public-api: 起動完了の確認。ロードバランサが認可なしで叩く
// no-rate-limit: 死活監視は数十秒ごとに叩かれるのが要件。制限すると監視そのものが落ちる
/**
 * 受け入れ可能か（ready）。
 *
 * health との違いは**目的**。
 *   health … 生きているか（落ちていれば再起動する）
 *   ready  … 受け入れてよいか（準備中なら振り分けを止める）
 *
 * 起動直後や設定の読み込み中に振り分けられると、利用者がエラーを見る。
 */
import { runHealthChecks } from "@platform/observability";
import { env, usePrisma } from "../../../server/env";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const report = await runHealthChecks(
    {
        // 保存先。未設定ならメモリで動くが、再起動で消える
        "persistence": () => {
          // **`PERSISTENCE` は env のスキーマに無い。** 真偽値の `usePrisma` として
          // 公開されている(server/env.ts)。生の環境変数を直接見ない。
          //
          // **既定は DB を使う。** メモリで動かしているなら、
          // 「受け入れ可能」ではあるが**再起動で消える**ことを知らせる
          if (!usePrisma) {
            throw new Error("PERSISTENCE=memory で動作中です(再起動でデータが消えます)");
          }
          if (env.DATABASE_URL === "") {
            throw new Error("DATABASE_URL が設定されていません");
          }
        },
    },
    { timeoutMs: 2000 },
  );

  return Response.json(report, { status: report.status === "healthy" ? 200 : 503 });
}
