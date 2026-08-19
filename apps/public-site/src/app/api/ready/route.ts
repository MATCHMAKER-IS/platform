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


export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const report = await runHealthChecks(
    {
        // 公開サイトは外部依存が少ない。起動していること自体を返す
        "server": () => true,
    },
    { timeoutMs: 2000 },
  );

  return Response.json(report, { status: report.status === "healthy" ? 200 : 503 });
}
