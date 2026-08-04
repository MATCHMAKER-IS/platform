/**
 * e-learning の中核ロジック(コース構造・進捗計算・クイズ採点・修了判定)。
 *
 * データ永続化(DB)や画面はアプリ側に委ね、ここは「進捗をどう計算するか」「クイズをどう採点するか」
 * 「修了条件を満たすか」といった純粋なドメインロジックだけを提供する。
 * @packageDocumentation
 */
import { type Result } from "@platform/core";
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
/**
 * クイズを採点する。answers は questionId → 選んだ選択肢インデックス配列。
 * @param passRatio 合格に必要な正答率(0–1・既定 0.6)
 * @returns 得点と合否(**合格点は問題側で決める**。コースによって基準が違う)
 */
export declare function gradeQuiz(questions: QuizQuestion[], answers: Record<string, number[]>, passRatio?: number): Result<QuizResult>;
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
export declare function flattenLessons(course: Course): Lesson[];
/**
 * コース進捗を計算する。完了レッスンの重み合計 / 全体の重み合計。
 * @param course コース
 * @param progress 学習の進捗
 * @returns 完了率(0–1)・完了数・総数・**所要分の合計**・修了したか
 */
export declare function courseProgress(course: Course, progress: Progress): {
    ratio: number;
    completed: number;
    total: number;
    completedMinutes: number;
    totalMinutes: number;
    certified: boolean;
};
/**
 * モジュール単位の進捗を返す。
 *
 * **章ごとに見せる**ことで「あと 1 つで終わる」が分かり、離脱を防げる
 * (全体の進捗だけだと、長いコースでは進んでいる実感が無い)。
 *
 * @param course コース
 * @param progress 学習の進捗
 * @returns モジュールごとの完了率
 */
export declare function moduleProgress(course: Course, progress: Progress): {
    moduleId: string;
    title: string;
    completed: number;
    total: number;
    ratio: number;
}[];
/**
 * 次に取り組むべきレッスンを返す(コース順で最初の未完了)。全完了なら null。
 *
 * @param course コース
 * @param progress 学習の進捗
 * @returns 次に受けるレッスン。**すべて完了なら null**
 */
export declare function nextLesson(course: Course, progress: Progress): Lesson | null;
/**
 * レッスンを完了としてマークした新しい進捗を返す(元は破壊しない・重複しない)。
 * 存在しないレッスン ID は VALIDATION。
 *
 * @param course コース(レッスンの存在確認に使う)
 * @param progress 現在の進捗
 * @param lessonId 完了したレッスン
 * @returns 追加した**新しい進捗**({@link Result})。元の progress は変更しない。
 *   既に完了済みならそのまま返す(**重複しない**)
 * @throws なし。コースに無いレッスンは `VALIDATION` の err で返す
 */
export declare function markLessonComplete(course: Course, progress: Progress, lessonId: string): Result<Progress>;
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
export declare function issueCertificate(course: Course, progress: Progress, learnerId: string, now?: Date): Result<Certificate>;
//# sourceMappingURL=index.d.ts.map