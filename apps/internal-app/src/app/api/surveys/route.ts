/** アンケート: 一覧(GET)・作成(POST)。作成は manager 以上。 */
import { withApiObservability } from "../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../server/authorize.js";
import { serverEnv } from "../../../server/env.js";
import { surveyStore, auditActions } from "../../../server/platform-services.js";
import { type QuestionType } from "../../../server/survey-repo.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  return Response.json({ surveys: await surveyStore.list() });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "inquiry:write");
  const body = (await req.json()) as { title?: string; description?: string; questions?: { text: string; type: QuestionType; options?: string[] }[] };
  if (!body.title || !Array.isArray(body.questions) || body.questions.length === 0) return Response.json({ error: "タイトルと設問（1つ以上）が必要です" }, { status: 400 });
  const survey = await surveyStore.create({ title: body.title, description: body.description, questions: body.questions });
  await auditActions.record(user!.email, "survey.create", `survey:${survey.id}`, { after: { questions: survey.questions.length } });
  return Response.json(survey, { status: 201 });
}

export const GET = withApiObservability("/api/surveys", handleGET);
export const POST = withApiObservability("/api/surveys", handlePOST);
