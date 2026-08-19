// public-api: 死活監視。監視システムから認可なしで叩けることが要件
// no-rate-limit: 死活監視は数十秒ごとに叩かれるのが要件。制限すると監視そのものが落ちる
/**
 * 生きているか(health)。
 *
 * **監視システムが数十秒ごとに叩く**ため、認可は通さない。
 * 代わりに、内部の詳しい情報は返さない(外に出すと攻撃の手がかりになる)。
 *
 * showcase は**外部の保存先を持たない**(基盤の使い方を見せる画面のため、
 * データはすべてメモリかモック)。したがって確かめるのは
 * 「プロセスが応答するか」だけでよい。
 */
import { runHealthChecks } from "@platform/observability";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const report = await runHealthChecks({ process: () => true }, { timeoutMs: 3000 });
  // 落ちているときは 503。監視側が「異常」と判断できるようにする
  return Response.json(report, { status: report.status === "healthy" ? 200 : 503 });
}
