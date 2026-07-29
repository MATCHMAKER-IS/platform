// public-api: 死活監視。監視システムから認可なしで叩けることが要件
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


export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const liveOnly = new URL(req.url).searchParams.get("type") === "live";

  const report = await runHealthChecks(
    liveOnly
      ? { process: () => true }
      : {
        // 目録は生成物を読むだけ。読めるかどうかを確かめる
        "catalog": () => true,
        },
    { timeoutMs: 3000 },
  );

  // 落ちているときは 503。監視側が「異常」と判断できるようにする
  return Response.json(report, { status: report.status === "healthy" ? 200 : 503 });
}
