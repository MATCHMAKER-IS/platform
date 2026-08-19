# @platform/elearning

社内研修（教材・小テスト・受講記録）。**受けたかどうかを記録に残す**ためのものです。

## これは何のためか

**受けたかどうかを記録に残す**ためのものです。

安全教育・情報セキュリティ研修は、
**「全員が受けた」ことを示せる必要**があります。

## 使う前に知っておくこと

| | |
|---|---|
| **複数選択は順不同で採点** | 選ぶ順序は**関係ありません** |
| **部分正解は不正解** | 3 つのうち 2 つ合っていても**不正解**です——**中途半端な理解を通さない**ためです |
| **所要時間で重み付けします** | 一瞬で全問正解は**答えを知っていた**か、**適当に押した**かです |
| **記録は消せません** | 「受けたことにする」ができると、**記録の意味がなくなります** |

## よく使うもの

```ts
import { gradeQuiz, flattenLessons, courseProgress } from "@platform/elearning";
const result = gradeQuiz(quiz.quiz, { q1: [1], q2: [0, 2] }, 0.6);
if (result.ok && result.value.passed) { /* 合格 */ }

const p = courseProgress(course, { completedLessons: ["l1", "l2"] });
// { ratio, completed, total, certified, ... }
```

進捗の重みは各レッスンの `estimatedMinutes`(未指定は 1)。修了条件は `course.completionRatio`(既定 1.0=全完了)。
