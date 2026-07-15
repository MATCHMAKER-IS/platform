# @platform/elearning

社内 e-learning の中核ロジック。コース構造・進捗計算・クイズ採点・修了判定を純関数で提供します。データ永続化と画面はアプリ側に委ねます。

## 構造

`Course` → `Module`(章)→ `Lesson`(動画/記事/クイズ)。

## 主な関数

- `gradeQuiz(questions, answers, passRatio)`: クイズ採点(単一/複数選択・順不同)
- `courseProgress(course, progress)`: 完了率(estimatedMinutes で重み付け)・修了判定
- `moduleProgress` / `nextLesson`: 章ごとの進捗・次に学ぶレッスン
- `markLessonComplete(course, progress, lessonId)`: 完了マーク(不変・重複しない)
- `issueCertificate(course, progress, learnerId)`: 修了証発行(未修了は拒否)

```ts
const result = gradeQuiz(quiz.quiz, { q1: [1], q2: [0, 2] }, 0.6);
if (result.ok && result.value.passed) { /* 合格 */ }

const p = courseProgress(course, { completedLessons: ["l1", "l2"] });
// { ratio, completed, total, certified, ... }
```

進捗の重みは各レッスンの `estimatedMinutes`(未指定は 1)。修了条件は `course.completionRatio`(既定 1.0=全完了)。
