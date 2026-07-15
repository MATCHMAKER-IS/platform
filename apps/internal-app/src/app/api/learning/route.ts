/** e-learning API。GET=学習状況、POST=レッスン完了/クイズ提出/修了証取得。ログインユーザー単位。 */
import { withApiObservability } from "../../../server/instrument.js";
import { currentUser } from "../../../server/authorize.js";
import { serverEnv } from "../../../server/env.js";
import { getLearningState, completeLesson, submitQuiz, getCertificate } from "../../../server/elearning-service.js";

function learnerId(req: Request): string | null {
  const u = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  return u ? u.email : null;
}

async function handleGET(req: Request): Promise<Response> {
  const id = learnerId(req);
  if (!id) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  return Response.json(getLearningState(id));
}

async function handlePOST(req: Request): Promise<Response> {
  const id = learnerId(req);
  if (!id) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const body = (await req.json()) as { action?: string; lessonId?: string; answers?: Record<string, number[]> };
  if (body.action === "complete" && body.lessonId) {
    const r = completeLesson(id, body.lessonId);
    return r.ok ? Response.json(getLearningState(id)) : Response.json({ error: r.error }, { status: 400 });
  }
  if (body.action === "quiz" && body.lessonId && body.answers) {
    const r = submitQuiz(id, body.lessonId, body.answers);
    return r.ok ? Response.json({ result: r.result, state: getLearningState(id) }) : Response.json({ error: r.error }, { status: 400 });
  }
  if (body.action === "certificate") {
    const r = getCertificate(id);
    return r.ok ? Response.json({ certificate: r.certificate }) : Response.json({ error: r.error }, { status: 400 });
  }
  return Response.json({ error: "不正なリクエストです" }, { status: 400 });
}

export const GET = withApiObservability("/api/learning", handleGET);
export const POST = withApiObservability("/api/learning", handlePOST);
