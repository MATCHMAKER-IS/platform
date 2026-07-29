// public-api: 死活監視。監視システムから認可なしで叩けることが要件
/**
 * 生きているか。
 *
 * freee が落ちていても**このアプリ自体は動く**（見本データに切り替わる）ので、
 * 依存の失敗では unhealthy にしません。再起動しても直らないためです。
 */
import { runHealthChecks } from "@platform/observability";
import { canUseFreee } from "../../../server/env";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const liveOnly = new URL(req.url).searchParams.get("type") === "live";
  const report = await runHealthChecks(
    liveOnly
      ? { process: () => true }
      : {
          process: () => true,
          // 設定の有無は「異常」ではなく状態として返す
          "freee-configured": () => canUseFreee,
        },
    { timeoutMs: 3000 },
  );
  return Response.json(report, { status: report.status === "healthy" ? 200 : 503 });
}
