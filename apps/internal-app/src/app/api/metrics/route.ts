/**
 * Prometheus 形式のメトリクス公開。スクレイプ対象。
 * 実運用では内部ネットワーク限定やトークン保護を推奨。
 */
import { metrics } from "../../../server/observability.js";

export const dynamic = "force-dynamic";

export function GET() {
  return new Response(metrics.toPrometheus(), {
    status: 200,
    headers: { "Content-Type": "text/plain; version=0.0.4" },
  });
}
