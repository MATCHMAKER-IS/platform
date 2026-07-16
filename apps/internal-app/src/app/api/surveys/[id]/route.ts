/** アンケート: 個別取得(GET)。認証ユーザー。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { surveyStore } from "../../../../server/platform-services";

async function handleGET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const { id } = await ctx.params;
  const survey = await surveyStore.get(id);
  if (!survey) return Response.json({ error: "アンケートが見つかりません" }, { status: 404 });
  return Response.json(survey);
}

export const GET = withApiObservability("/api/surveys/[id]", handleGET);
