// public-api: メトリクス収集。ネットワーク側(社内のみ許可)で保護する
// no-rate-limit: 監視基盤が定期取得する。制限すると計測に穴が空く
/**
 * Prometheus 形式のメトリクス公開。スクレイプ対象。
 * 実運用では内部ネットワーク限定やトークン保護を推奨。
 */
import { metrics } from "../../../server/observability";

export const dynamic = "force-dynamic";

export function GET() {
  return new Response(metrics.toPrometheus(), {
    status: 200,
    headers: { "Content-Type": "text/plain; version=0.0.4" },
  });
}
