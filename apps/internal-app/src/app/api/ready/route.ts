// public-api: 起動完了の確認。ロードバランサが認可なしで叩く
/** レディネスチェック API(GET)。DB・マイグレーション等を集約し 200/503 を返す(デプロイの健全性確認用)。 */
import { withApiObservability } from "../../../server/instrument";
import { checkReadiness, readinessHttpStatus } from "../../../lib/readiness";
import { serverEnv } from "../../../server/env";

async function handleGET(_req: Request): Promise<Response> {
  const result = await checkReadiness([
    { name: "database", probe: async () => ({ ok: Boolean(serverEnv.DATABASE_URL), detail: "connection" }) },
    { name: "session-secret", probe: async () => ({ ok: Boolean(serverEnv.SESSION_SECRET) }) },
  ]);
  return Response.json(result, { status: readinessHttpStatus(result) });
}

export const GET = withApiObservability("/api/ready", handleGET);
