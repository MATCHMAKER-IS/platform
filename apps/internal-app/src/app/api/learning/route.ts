/** e-learning API。GET=学習状況、POST=レッスン完了/クイズ提出/修了証取得。ログインユーザー単位。 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser } from "../../../server/authorize";
import "../../../server/env";
import { getLearningState, completeLesson, submitQuiz, getCertificate } from "../../../server/elearning-service";
import { validate, z } from "@platform/validation";

// **`answers` の中身を配列で強制する。** 以前は型注釈だけで、実行時には
// 確かめていなかった——文字列を渡すと `Record<string, number[]>` の
// 形を満たさないまま採点ロジックに渡る(掲示板の添付と同種の穴)。
const LearningInput = z.object({
  action: z.enum(["complete", "quiz", "certificate"]),
  lessonId: z.string().optional(),
  answers: z.record(z.string(), z.array(z.number())).optional(),
});

function learnerId(req: Request): string | null {
  const u = currentUser(req);
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
  const parsed = validate(LearningInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const body = parsed.value;
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
