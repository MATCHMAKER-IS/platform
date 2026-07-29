// public-api: 起動完了の確認。ロードバランサが認可なしで叩く
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
import { env } from "../../../server/env";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const report = await runHealthChecks(
    {
        // 保存先。未設定ならメモリで動くが、再起動で消える
        "persistence": () => {
          if (env.PERSISTENCE === "prisma" && !env.DATABASE_URL) {
            throw new Error("PERSISTENCE=prisma には DATABASE_URL が必要です");
          }
        },
    },
    { timeoutMs: 2000 },
  );

  return Response.json(report, { status: report.status === "healthy" ? 200 : 503 });
}
