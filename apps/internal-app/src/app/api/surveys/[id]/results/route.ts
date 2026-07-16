/** アンケート: 集計結果(GET)。manager 以上。 */
import { withApiObservability } from "../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../server/authorize";
import { serverEnv } from "../../../../../server/env";
import { surveyStore } from "../../../../../server/platform-services";
import { aggregateSurvey } from "../../../../../server/survey-repo";

async function handleGET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "inquiry:read");
  const { id } = await ctx.params;
  const survey = await surveyStore.get(id);
  if (!survey) return Response.json({ error: "アンケートが見つかりません" }, { status: 404 });
  const responses = await surveyStore.responses(id);
  return Response.json({ survey, result: aggregateSurvey(survey, responses) });
}

export const GET = withApiObservability("/api/surveys/[id]/results", handleGET);
