/**
 * e-learning の中核ロジック(コース構造・進捗計算・クイズ採点・修了判定)。
 *
 * データ永続化(DB)や画面はアプリ側に委ね、ここは「進捗をどう計算するか」「クイズをどう採点するか」
 * 「修了条件を満たすか」といった純粋なドメインロジックだけを提供する。
 * @packageDocumentation
 */
import { AppError, ErrorCode, ok, err, type Result } from "@platform/core";

// ─────────────────────────── コース構造 ───────────────────────────

/** レッスン(動画・記事・クイズのいずれか)。 */
export interface Lesson {
  id: string;
  title: string;
  type: "video" | "article" | "quiz";
  /** 動画・記事の想定所要分。進捗の重み付けに使う(既定 1)。 */
  estimatedMinutes?: number;
  /** クイズの場合の設問。 */
  quiz?: QuizQuestion[];
  /** このレッスンを完了とみなすのに必要なクイズ正答率(0–1・既定 0.6)。 */
  passRatio?: number;
}

/** モジュール(章)。複数レッスンをまとめる。 */
export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

/** コース。 */
export interface Course {
  id: string;
  title: string;
  modules: Module[];
  /** 修了に必要な完了率(0–1・既定 1.0=全レッスン完了)。 */
  completionRatio?: number;
}

// ─────────────────────────── クイズ ───────────────────────────

/** クイズの設問(単一選択 or 複数選択)。 */
export interface QuizQuestion {
  id: string;
  prompt: string;
  choices: string[];
  /** 正解の選択肢インデックス(複数可)。 */
  correct: number[];
  /** 複数選択か(既定 false=単一選択)。 */
  multiple?: boolean;
}

/** 1問の採点結果。 */
export interface QuestionResult {
  questionId: string;
  correct: boolean;
}

/** クイズ全体の採点結果。 */
export interface QuizResult {
  total: number;
  correctCount: number;
  ratio: number;
  passed: boolean;
  details: QuestionResult[];
}

/** 配列を集合として比較(順不同・重複無視)。 */
function sameSet(a: number[], b: number[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const v of sa) if (!sb.has(v)) return false;
  return true;
}

/**
 * クイズを採点する。answers は questionId → 選んだ選択肢インデックス配列。
 * @param passRatio 合格に必要な正答率(0–1・既定 0.6)
 * @returns 得点と合否(**合格点は問題側で決める**。コースによって基準が違う)
 */
export function gradeQuiz(questions: QuizQuestion[], answers: Record<string, number[]>, passRatio = 0.6): Result<QuizResult> {
  if (questions.length === 0) return err(new AppError(ErrorCode.VALIDATION, "設問がありません"));
  const details: QuestionResult[] = [];
  let correctCount = 0;
  for (const q of questions) {
    const given = answers[q.id] ?? [];
    const isCorrect = sameSet(given, q.correct);
    if (isCorrect) correctCount += 1;
    details.push({ questionId: q.id, correct: isCorrect });
  }
  const ratio = correctCount / questions.length;
  return ok({ total: questions.length, correctCount, ratio, passed: ratio >= passRatio, details });
}

// ─────────────────────────── 進捗 ───────────────────────────

/** 学習者の進捗状態(完了したレッスン ID の集合)。 */
export interface Progress {
  /** 完了済みレッスン ID。 */
  completedLessons: string[];
}

/**
 * コース内の全レッスンを平坦化して返す。
 *
 * @param course コース(モジュールの入れ子)
 * @returns すべてのレッスン(**モジュールの順序を保つ**)
 */
export function flattenLessons(course: Course): Lesson[] {
  return course.modules.flatMap((m) => m.lessons);
}

/** レッスンの重み(estimatedMinutes 優先・既定 1)。 */
function lessonWeight(lesson: Lesson): number {
  return lesson.estimatedMinutes && lesson.estimatedMinutes > 0 ? lesson.estimatedMinutes : 1;
}

/**
 * コース進捗を計算する。完了レッスンの重み合計 / 全体の重み合計。
 * @returns 完了率(0–1)・完了数・総数・修了したか
 * @param course コース
 * @param completed 完了したレッスン ID
 */
export function courseProgress(course: Course, progress: Progress): { ratio: number; completed: number; total: number; completedMinutes: number; totalMinutes: number; certified: boolean } {
  const lessons = flattenLessons(course);
  const done = new Set(progress.completedLessons);
  const totalWeight = lessons.reduce((s, l) => s + lessonWeight(l), 0);
  const doneWeight = lessons.filter((l) => done.has(l.id)).reduce((s, l) => s + lessonWeight(l), 0);
  const ratio = totalWeight === 0 ? 0 : doneWeight / totalWeight;
  const required = course.completionRatio ?? 1.0;
  return {
    ratio,
    completed: lessons.filter((l) => done.has(l.id)).length,
    total: lessons.length,
    completedMinutes: doneWeight,
    totalMinutes: totalWeight,
    certified: ratio >= required,
  };
}

/**
 * モジュール単位の進捗を返す。
 *
 * **章ごとに見せる**ことで「あと 1 つで終わる」が分かり、離脱を防げる
 * (全体の進捗だけだと、長いコースでは進んでいる実感が無い)。
 *
 * @param course コース
 * @param completed 完了したレッスン ID
 * @returns モジュールごとの完了率
 */
export function moduleProgress(course: Course, progress: Progress): { moduleId: string; title: string; completed: number; total: number; ratio: number }[] {
  const done = new Set(progress.completedLessons);
  return course.modules.map((m) => {
    const completed = m.lessons.filter((l) => done.has(l.id)).length;
    return { moduleId: m.id, title: m.title, completed, total: m.lessons.length, ratio: m.lessons.length === 0 ? 0 : completed / m.lessons.length };
  });
}

/**
 * 次に取り組むべきレッスンを返す(コース順で最初の未完了)。全完了なら null。
 *
 * @param course コース
 * @param completed 完了したレッスン ID
 * @returns 次に受けるレッスン。**すべて完了なら undefined**
 */
export function nextLesson(course: Course, progress: Progress): Lesson | null {
  const done = new Set(progress.completedLessons);
  for (const lesson of flattenLessons(course)) {
    if (!done.has(lesson.id)) return lesson;
  }
  return null;
}

/**
 * レッスンを完了としてマークした新しい進捗を返す(元は破壊しない・重複しない)。
 * 存在しないレッスン ID は VALIDATION。
 *
 * @param completed 完了済みの ID
 * @param lessonId 完了したレッスン
 * @returns 追加した**新しい配列**(**重複しない**)
 */
export function markLessonComplete(course: Course, progress: Progress, lessonId: string): Result<Progress> {
  const exists = flattenLessons(course).some((l) => l.id === lessonId);
  if (!exists) return err(new AppError(ErrorCode.VALIDATION, `レッスン ${lessonId} はコースに存在しません`));
  if (progress.completedLessons.includes(lessonId)) return ok(progress);
  return ok({ completedLessons: [...progress.completedLessons, lessonId] });
}

/**
 * 修了証データを生成する。未修了なら FORBIDDEN。
 */
export interface Certificate {
  courseId: string;
  courseTitle: string;
  learnerId: string;
  completedAt: string;
  ratio: number;
}
/**
 * 修了証を発行する。
 *
 * **修了していない人には発行しない**(`FORBIDDEN`)。研修の受講記録は
 * 監査や資格要件の証跡になるため、未修了で出すと意味を失う。
 *
 * @param course コース
 * @param progress 学習の進捗
 * @param learnerId 受講者
 * @param now 発行時刻(テスト注入用)
 * @returns 修了証({@link Result})。**未修了なら `FORBIDDEN` の err**
 */
export function issueCertificate(course: Course, progress: Progress, learnerId: string, now: Date = new Date()): Result<Certificate> {
  const p = courseProgress(course, progress);
  if (!p.certified) return err(new AppError(ErrorCode.FORBIDDEN, "コースを修了していません"));
  return ok({ courseId: course.id, courseTitle: course.title, learnerId, completedAt: now.toISOString(), ratio: p.ratio });
}
