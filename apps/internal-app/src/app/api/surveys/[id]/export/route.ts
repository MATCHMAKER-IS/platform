/** アンケート: 集計結果CSVのダウンロード(GET)。manager 以上。 */
import { withApiObservability } from "../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../server/authorize";
import { serverEnv } from "../../../../../server/env";
import { surveyStore } from "../../../../../server/platform-services";
import { aggregateSurvey } from "../../../../../server/survey-repo";
import { surveyResultsCsv } from "../../../../../server/survey-export";

async function handleGET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "inquiry:read");
  const { id } = await ctx.params;
  const survey = await surveyStore.get(id);
  if (!survey) return Response.json({ error: "アンケートが見つかりません" }, { status: 404 });
  const csv = surveyResultsCsv(survey, aggregateSurvey(survey, await surveyStore.responses(id)));
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="survey-${id}.csv"` } });
}

export const GET = withApiObservability("/api/surveys/[id]/export", handleGET);
