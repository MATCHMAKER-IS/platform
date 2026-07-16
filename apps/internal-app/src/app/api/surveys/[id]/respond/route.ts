/** アンケート: 回答(POST)。公開中(open)のみ受付。認証ユーザー。 */
import { withApiObservability } from "../../../../../server/instrument";
import { currentUser } from "../../../../../server/authorize";
import { serverEnv } from "../../../../../server/env";
import { surveyStore } from "../../../../../server/platform-services";
import { isAcceptingResponses, type Answer } from "../../../../../server/survey-repo";

async function handlePOST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const { id } = await ctx.params;
  const survey = await surveyStore.get(id);
  if (!survey) return Response.json({ error: "アンケートが見つかりません" }, { status: 404 });
  if (!isAcceptingResponses(survey)) return Response.json({ error: "このアンケートは回答を受け付けていません（未公開または締切超過）" }, { status: 409 });
  const body = (await req.json()) as { answers?: Answer[] };
  if (!Array.isArray(body.answers)) return Response.json({ error: "回答が不正です" }, { status: 400 });
  const resp = await surveyStore.respond(id, body.answers, survey.anonymous ? undefined : user.email);
  return Response.json({ id: resp.id }, { status: 201 });
}

export const POST = withApiObservability("/api/surveys/[id]/respond", handlePOST);
