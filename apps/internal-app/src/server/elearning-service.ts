/**
 * e-learning の配線(internal-app)。@platform/elearning にサンプルコースと進捗ストアを載せる。
 * 進捗はメモリ(デモ)。実運用は DB(User×Lesson の完了テーブル)に差し替える。
 * @packageDocumentation
 */
import { type Course, type Progress, courseProgress, moduleProgress, nextLesson, markLessonComplete, gradeQuiz, issueCertificate, type QuizQuestion } from "@platform/elearning";

/** サンプルコース(情報セキュリティ基礎)。 */
export const sampleCourse: Course = {
  id: "security-basics",
  title: "情報セキュリティ基礎",
  completionRatio: 1.0,
  modules: [
    { id: "m1", title: "はじめに", lessons: [
      { id: "l1", title: "なぜセキュリティが重要か", type: "video", estimatedMinutes: 8 },
      { id: "l2", title: "情報資産とリスク", type: "article", estimatedMinutes: 5 },
    ] },
    { id: "m2", title: "パスワードと認証", lessons: [
      { id: "l3", title: "強いパスワードの作り方", type: "article", estimatedMinutes: 6 },
      { id: "l4", title: "多要素認証", type: "video", estimatedMinutes: 7 },
    ] },
    { id: "m3", title: "理解度チェック", lessons: [
      { id: "l5", title: "確認クイズ", type: "quiz", estimatedMinutes: 5, passRatio: 0.6, quiz: [
        { id: "q1", prompt: "安全なパスワードは？", choices: ["誕生日", "長く複雑な文字列", "1234"], correct: [1] },
        { id: "q2", prompt: "多要素認証に該当するものを全て選べ", choices: ["パスワード", "SMS コード", "指紋"], correct: [1, 2], multiple: true },
      ] },
    ] },
  ],
};

/** 学習者ごとの進捗(メモリ・デモ)。 */
const progressStore = new Map<string, Progress>();

function getProgress(learnerId: string): Progress {
  return progressStore.get(learnerId) ?? { completedLessons: [] };
}

/** コースの現在の学習状況(進捗+章別+次のレッスン)を返す。 */
export function getLearningState(learnerId: string) {
  const progress = getProgress(learnerId);
  return {
    course: sampleCourse,
    progress,
    summary: courseProgress(sampleCourse, progress),
    modules: moduleProgress(sampleCourse, progress),
    next: nextLesson(sampleCourse, progress),
  };
}

/** レッスンを完了にする。 */
export function completeLesson(learnerId: string, lessonId: string): { ok: boolean; error?: string } {
  const r = markLessonComplete(sampleCourse, getProgress(learnerId), lessonId);
  if (!r.ok) return { ok: false, error: r.error.message };
  progressStore.set(learnerId, r.value);
  return { ok: true };
}

/** クイズを採点し、合格ならレッスンを完了にする。 */
export function submitQuiz(learnerId: string, lessonId: string, answers: Record<string, number[]>) {
  const lesson = sampleCourse.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
  if (!lesson || !lesson.quiz) return { ok: false as const, error: "クイズが見つかりません" };
  const graded = gradeQuiz(lesson.quiz as QuizQuestion[], answers, lesson.passRatio ?? 0.6);
  if (!graded.ok) return { ok: false as const, error: graded.error.message };
  if (graded.value.passed) completeLesson(learnerId, lessonId);
  return { ok: true as const, result: graded.value };
}

/** 修了証を発行する(未修了なら error)。 */
export function getCertificate(learnerId: string) {
  const r = issueCertificate(sampleCourse, getProgress(learnerId), learnerId);
  return r.ok ? { ok: true as const, certificate: r.value } : { ok: false as const, error: r.error.message };
}
