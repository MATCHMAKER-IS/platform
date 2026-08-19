// public-api: 死活監視。監視システムから認可なしで叩けることが要件
// no-rate-limit: 死活監視は数十秒ごとに叩かれるのが要件。制限すると監視そのものが落ちる
/**
 * 生きているか（health）。
 *
 * **監視システムが数十秒ごとに叩く**ため、認可は通さない。
 * 代わりに、内部の詳しい情報は返さない（外に出すと攻撃の手がかりになる）。
 *
 * `?type=live` は「動いているか」だけ、既定は「依存も含めて使えるか」。
 * 分けるのは、依存が落ちているときに**再起動すべきか判断が変わる**ため。
 */
import { runHealthChecks } from "@platform/observability";
import { env, usePrisma } from "../../../server/env";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const liveOnly = new URL(req.url).searchParams.get("type") === "live";

  const report = await runHealthChecks(
    liveOnly
      ? { process: () => true }
      : {
        // 保存先。未設定ならメモリで動くが、再起動で消える
        "persistence": () => {
          // **`PERSISTENCE` は env のスキーマに無い。** 真偽値の `usePrisma` として
          // 公開されている(server/env.ts)。生の環境変数を直接見ない
          if (usePrisma && !env.DATABASE_URL) {
            throw new Error("PERSISTENCE=prisma には DATABASE_URL が必要です");
          }
        },
        },
    { timeoutMs: 3000 },
  );

  // 落ちているときは 503。監視側が「異常」と判断できるようにする
  return Response.json(report, { status: report.status === "healthy" ? 200 : 503 });
}
