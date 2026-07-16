/** 自分に対するフィーチャーフラグの評価結果(GET)。UIの出し分けに使う。認証ユーザー。 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser } from "../../../server/authorize";
import { serverEnv } from "../../../server/env";
import { flagStore } from "../../../server/platform-services";
import { createAppFlags, flagContext } from "../../../server/feature-flags";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const defs = await flagStore.get();
  const flags = createAppFlags(defs);
  const ctx = flagContext({ email: user.email, roles: user.roles });
  const result: Record<string, { enabled: boolean; variant: string | null }> = {};
  for (const name of Object.keys(defs)) {
    result[name] = { enabled: await flags.isEnabled(name, ctx), variant: await flags.variant(name, ctx) };
  }
  return Response.json({ flags: result });
}

export const GET = withApiObservability("/api/flags", handleGET);
