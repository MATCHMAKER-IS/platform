import { describe, it, expect } from "vitest";
import {
  gradeQuiz, flattenLessons, courseProgress, moduleProgress, nextLesson,
  markLessonComplete, issueCertificate,
  type Course, type QuizQuestion,
} from "./index";

const course: Course = {
  id: "c1",
  title: "情報セキュリティ研修",
  modules: [
    { id: "m1", title: "基礎", lessons: [
      { id: "l1", title: "動画", type: "video", estimatedMinutes: 10 },
      { id: "l2", title: "記事", type: "article", estimatedMinutes: 5 },
    ] },
    { id: "m2", title: "確認", lessons: [
      { id: "l3", title: "小テスト", type: "quiz", estimatedMinutes: 5 },
    ] },
  ],
};

const questions: QuizQuestion[] = [
  { id: "q1", prompt: "単一選択", choices: ["A", "B"], correct: [0] },
  { id: "q2", prompt: "複数選択", choices: ["A", "B", "C"], correct: [0, 2], multiple: true },
];

describe("gradeQuiz", () => {
  it("全問正解なら合格", () => {
    const r = gradeQuiz(questions, { q1: [0], q2: [0, 2] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.correctCount).toBe(2);
    expect(r.value.ratio).toBe(1);
    expect(r.value.passed).toBe(true);
  });

  it("**複数選択は順不同で採点する**(選んだ順で不正解にしない)", () => {
    const r = gradeQuiz(questions, { q1: [0], q2: [2, 0] });
    expect(r.ok && r.value.correctCount).toBe(2);
  });

  it("**部分正解は不正解**(半分だけ選んでも点にならない)", () => {
    const r = gradeQuiz(questions, { q1: [0], q2: [0] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.details.find((d) => d.questionId === "q2")?.correct).toBe(false);
  });

  it("余分に選んでも不正解", () => {
    const r = gradeQuiz(questions, { q1: [0], q2: [0, 1, 2] });
    expect(r.ok && r.value.correctCount).toBe(1);
  });

  it("未回答は不正解(例外にしない)", () => {
    const r = gradeQuiz(questions, {});
    expect(r.ok && r.value.correctCount).toBe(0);
    expect(r.ok && r.value.passed).toBe(false);
  });

  it("合格ラインを指定できる(既定 0.6)", () => {
    const half = { q1: [0], q2: [1] }; // 1/2 = 0.5
    // 一度変数に受ける。2 回呼ぶと絞り込みが効かない
    const strict = gradeQuiz(questions, half);
    expect(strict.ok && strict.value.passed).toBe(false);
    const lenient = gradeQuiz(questions, half, 0.5);
    expect(lenient.ok && lenient.value.passed).toBe(true);
  });

  it("設問が無ければ VALIDATION(0 除算にしない)", () => {
    const r = gradeQuiz([], {});
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDATION");
  });

  it("設問ごとの正誤を返す(どこを間違えたか見せられる)", () => {
    const r = gradeQuiz(questions, { q1: [1], q2: [0, 2] });
    expect(r.ok && r.value.details.map((d) => d.correct)).toEqual([false, true]);
  });
});

describe("進捗の計算", () => {
  it("flattenLessons はモジュールの順序を保つ", () => {
    expect(flattenLessons(course).map((l) => l.id)).toEqual(["l1", "l2", "l3"]);
  });

  it("**所要時間で重み付けする**(短い記事 3 本より長い動画 1 本が進む)", () => {
    // 全 20 分のうち動画 10 分を終えた = 50%
    const p = courseProgress(course, { completedLessons: ["l1"] });
    expect(p.ratio).toBeCloseTo(0.5);
    expect(p.completedMinutes).toBe(10);
    expect(p.totalMinutes).toBe(20);
  });

  it("完了数と総数も返す(件数で見せたいとき)", () => {
    const p = courseProgress(course, { completedLessons: ["l1"] });
    expect(p.completed).toBe(1);
    expect(p.total).toBe(3);
  });

  it("所要時間が無いレッスンは重み 1", () => {
    const noMinutes: Course = { id: "c", title: "t", modules: [{ id: "m", title: "m", lessons: [
      { id: "a", title: "a", type: "article" }, { id: "b", title: "b", type: "article" },
    ] }] };
    expect(courseProgress(noMinutes, { completedLessons: ["a"] }).ratio).toBeCloseTo(0.5);
  });

  it("**既定は全完了で修了**", () => {
    expect(courseProgress(course, { completedLessons: ["l1", "l2"] }).certified).toBe(false);
    expect(courseProgress(course, { completedLessons: ["l1", "l2", "l3"] }).certified).toBe(true);
  });

  it("修了に必要な完了率を下げられる", () => {
    const lenient: Course = { ...course, completionRatio: 0.7 };
    // 15/20 = 0.75
    expect(courseProgress(lenient, { completedLessons: ["l1", "l2"] }).certified).toBe(true);
  });

  it("レッスンが無いコースでも 0 除算にしない", () => {
    const empty: Course = { id: "c", title: "t", modules: [] };
    expect(courseProgress(empty, { completedLessons: [] }).ratio).toBe(0);
  });

  it("知らないレッスン ID は無視する(壊さない)", () => {
    expect(courseProgress(course, { completedLessons: ["unknown"] }).completed).toBe(0);
  });
});

describe("moduleProgress", () => {
  it("**章ごとの進捗を返す**(全体だけだと進んでいる実感が無い)", () => {
    const rows = moduleProgress(course, { completedLessons: ["l1"] });
    expect(rows.map((r) => r.moduleId)).toEqual(["m1", "m2"]);
    expect(rows[0]?.ratio).toBeCloseTo(0.5);
    expect(rows[1]?.ratio).toBe(0);
  });

  it("レッスンが無い章でも 0 除算にしない", () => {
    const c: Course = { id: "c", title: "t", modules: [{ id: "m", title: "空", lessons: [] }] };
    expect(moduleProgress(c, { completedLessons: [] })[0]?.ratio).toBe(0);
  });
});

describe("nextLesson", () => {
  it("コース順で最初の未完了を返す", () => {
    expect(nextLesson(course, { completedLessons: [] })?.id).toBe("l1");
    expect(nextLesson(course, { completedLessons: ["l1"] })?.id).toBe("l2");
  });

  it("**すべて完了なら null**(TSDoc の undefined は誤り)", () => {
    expect(nextLesson(course, { completedLessons: ["l1", "l2", "l3"] })).toBe(null);
  });
});

describe("markLessonComplete", () => {
  it("完了を追加した**新しい進捗**を返す(元は変えない)", () => {
    const before = { completedLessons: ["l1"] };
    const r = markLessonComplete(course, before, "l2");
    expect(r.ok && r.value.completedLessons).toEqual(["l1", "l2"]);
    expect(before.completedLessons).toEqual(["l1"]); // 元は不変
  });

  it("**重複しない**(二度押しで 2 件にならない)", () => {
    const r = markLessonComplete(course, { completedLessons: ["l1"] }, "l1");
    expect(r.ok && r.value.completedLessons).toEqual(["l1"]);
  });

  it("コースに無いレッスンは VALIDATION", () => {
    const r = markLessonComplete(course, { completedLessons: [] }, "nope");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDATION");
  });
});

describe("issueCertificate", () => {
  const at = new Date("2026-07-29T00:00:00Z");

  it("修了していれば発行する", () => {
    const r = issueCertificate(course, { completedLessons: ["l1", "l2", "l3"] }, "u1", at);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.learnerId).toBe("u1");
    expect(r.value.courseTitle).toBe("情報セキュリティ研修");
    expect(r.value.completedAt).toBe("2026-07-29T00:00:00.000Z");
    expect(r.value.ratio).toBe(1);
  });

  it("**未修了なら発行しない**(研修記録は監査の証跡になる)", () => {
    const r = issueCertificate(course, { completedLessons: ["l1"] }, "u1", at);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("FORBIDDEN");
  });
});
