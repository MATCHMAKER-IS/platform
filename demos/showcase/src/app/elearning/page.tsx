"use client";
/**
 * 社内研修(e-learning)のデモ。進捗計算・クイズ採点・修了判定。
 *
 * UI は **@platform/ui の部品だけ**で組む(CLAUDE.md「UI 部品は @platform/ui を使う」)。
 */
import * as React from "react";
import { Button, Badge, Alert, Separator, Checkbox, RadioGroup, RadioGroupItem } from "@platform/ui";
import {
  gradeQuiz,
  courseProgress,
  moduleProgress,
  nextLesson,
  markLessonComplete,
  issueCertificate,
  type Course,
  type Lesson,
  type Progress,
  type QuizQuestion,
  type Certificate,
} from "@platform/elearning";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const TYPE_LABEL: Record<Lesson["type"], string> = { video: "動画", article: "記事", quiz: "テスト" };

const QUIZ: QuizQuestion[] = [
  {
    id: "q1",
    prompt: "不審なメールの添付を開いてしまった。まず何をしますか（複数選択）",
    choices: ["LAN ケーブルを抜く / Wi-Fi を切る", "情報システム部に連絡する", "自分で調べて様子を見る", "PC を再起動する"],
    correct: [0, 1],
    multiple: true,
  },
  {
    id: "q2",
    prompt: "業務システムのパスワードを他のサービスでも使うのは",
    choices: ["問題ない", "使い回してはいけない"],
    correct: [1],
  },
  {
    id: "q3",
    prompt: "顧客情報を私物 USB に入れて持ち帰るのは",
    choices: ["上司の許可があれば可", "禁止", "暗号化すれば可"],
    correct: [1],
  },
];

/** 社内の情報セキュリティ研修。**修了条件は 80%**（全部やらなくてよい）。 */
const COURSE: Course = {
  id: "sec-2026",
  title: "情報セキュリティ研修 2026",
  completionRatio: 0.8,
  modules: [
    {
      id: "m1",
      title: "1. なぜ必要か",
      lessons: [
        { id: "l1", title: "情報漏洩は何が起きるか（動画）", type: "video", estimatedMinutes: 12 },
        { id: "l2", title: "実際の事故事例", type: "article", estimatedMinutes: 8 },
      ],
    },
    {
      id: "m2",
      title: "2. 日常の注意点",
      lessons: [
        { id: "l3", title: "メールとパスワード（動画）", type: "video", estimatedMinutes: 15 },
        { id: "l4", title: "持ち出しルール", type: "article", estimatedMinutes: 5 },
      ],
    },
    {
      id: "m3",
      title: "3. 確認テスト",
      lessons: [{ id: "l5", title: "確認テスト（3 問）", type: "quiz", quiz: QUIZ, passRatio: 0.6 }],
    },
  ],
};

export default function Page() {
  const [progress, setProgress] = React.useState<Progress>({ completedLessons: [] });
  const [answers, setAnswers] = React.useState<Record<string, number[]>>({});
  const [graded, setGraded] = React.useState<ReturnType<typeof gradeQuiz> | null>(null);
  const [cert, setCert] = React.useState<Certificate | null>(null);
  const [certError, setCertError] = React.useState("");

  const cp = courseProgress(COURSE, progress);
  const mp = moduleProgress(COURSE, progress);
  const next = nextLesson(COURSE, progress);

  function complete(lessonId: string) {
    const r = markLessonComplete(COURSE, progress, lessonId);
    if (r.ok) setProgress(r.value);
  }

  function submitQuiz() {
    const r = gradeQuiz(QUIZ, answers, 0.6);
    setGraded(r);
    // 合格したらレッスンも完了に
    if (r.ok && r.value.passed) complete("l5");
  }

  function issue() {
    setCertError("");
    const r = issueCertificate(COURSE, progress, "u-yamada", new Date("2026-07-17"));
    if (r.ok) setCert(r.value);
    else {
      setCert(null);
      setCertError(r.error.message);
    }
  }

  function toggleAnswer(qid: string, index: number, multiple: boolean) {
    setAnswers((a) => {
      const cur = a[qid] ?? [];
      if (!multiple) return { ...a, [qid]: [index] };
      return { ...a, [qid]: cur.includes(index) ? cur.filter((i) => i !== index) : [...cur, index] };
    });
  }

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>社内研修（e-learning）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        <code>@platform/elearning</code> は<strong>進捗の計算・クイズの採点・修了判定だけ</strong>を持ちます。
        画面と DB はアプリ側です。<strong>「何をもって修了とするか」は毎回もめる</strong>ので、
        ロジックを 1 箇所に置く価値があります。
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { label: "進捗", value: `${Math.round(cp.ratio * 100)}%`, color: cp.certified ? "var(--color-success)" : "var(--color-fg)" },
          { label: "完了レッスン", value: `${cp.completed} / ${cp.total}`, color: "var(--color-fg)" },
          { label: "学習時間", value: `${cp.completedMinutes} / ${cp.totalMinutes} 分`, color: "var(--color-fg)" },
          { label: "修了", value: cp.certified ? "達成" : "未達", color: cp.certified ? "var(--color-success)" : "var(--color-muted)" },
        ].map((s) => (
          <div key={s.label} style={{ ...box, marginBottom: 0, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--color-muted)" }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <Alert variant="info" title="進捗はレッスン数ではなく「時間」で重み付けされます" style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 12, lineHeight: 1.8 }}>
          <strong>1 本目の動画（12 分）を見ただけで 30%</strong> になります（12 分 / 40 分）。
          レッスン数だと 1/5 = 20% ですが、<strong>15 分の動画と 5 分の記事を同じ 1 件として数えるのは実態に合いません</strong>。
          <br />
          <code>estimatedMinutes</code> が無いレッスンは 1 分として扱われます。
        </span>
      </Alert>

      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{COURSE.title}</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <Button size="sm" variant="secondary" onClick={() => { setProgress({ completedLessons: [] }); setAnswers({}); setGraded(null); setCert(null); setCertError(""); }}>
              最初から
            </Button>
            {next !== null && (
              <Button size="sm" onClick={() => complete(next.id)}>
                次を完了にする（{next.title.slice(0, 12)}…）
              </Button>
            )}
          </div>
        </div>

        {COURSE.modules.map((m) => {
          const mprog = mp.find((x) => x.moduleId === m.id);
          return (
            <div key={m.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                <span>{m.title}</span>
                <span style={{ color: "var(--color-muted)", fontWeight: 400 }}>
                  {mprog?.completed} / {mprog?.total}
                </span>
              </div>
              <div style={{ height: 4, background: "var(--color-bg)", borderRadius: 2, marginBottom: 6 }}>
                <div style={{ height: 4, width: `${(mprog?.ratio ?? 0) * 100}%`, background: "var(--color-primary)", borderRadius: 2 }} />
              </div>
              {m.lessons.map((l) => {
                const done = progress.completedLessons.includes(l.id);
                const isNext = next?.id === l.id;
                return (
                  <div
                    key={l.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: "var(--radius)",
                      background: isNext ? "color-mix(in srgb, var(--color-primary) 8%, transparent)" : "transparent",
                    }}
                  >
                    <Checkbox checked={done} onCheckedChange={() => { if (!done) complete(l.id); }} disabled={done} />
                    <span style={{ fontSize: 13, flex: 1, color: done ? "var(--color-muted)" : "var(--color-fg)", textDecoration: done ? "line-through" : "none" }}>
                      {l.title}
                    </span>
                    <Badge variant="outline">{TYPE_LABEL[l.type]}</Badge>
                    <span style={{ fontSize: 11, color: "var(--color-muted)", width: 44, textAlign: "right" }}>
                      {l.estimatedMinutes !== undefined ? `${l.estimatedMinutes} 分` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8, lineHeight: 1.8 }}>
          <code>nextLesson()</code> が<strong>次にやるべき 1 件</strong>を返します（薄い青の行）。
          全部終わると <code>null</code> です。「どこまでやったか分からない」を防ぎます。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>確認テスト（合格 60%）</h2>
        {QUIZ.map((q, qi) => (
          <div key={q.id} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              問 {qi + 1}. {q.prompt}
              {q.multiple === true && (
                <Badge variant="secondary" style={{ marginLeft: 6 }}>
                  複数選択
                </Badge>
              )}
            </div>
            {q.multiple === true ? (
              q.choices.map((c, ci) => (
                <label key={ci} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "3px 0", cursor: "pointer" }}>
                  <Checkbox checked={(answers[q.id] ?? []).includes(ci)} onCheckedChange={() => toggleAnswer(q.id, ci, true)} />
                  {c}
                </label>
              ))
            ) : (
              <RadioGroup
                value={String((answers[q.id] ?? [])[0] ?? "")}
                onValueChange={(v) => toggleAnswer(q.id, Number(v), false)}
              >
                {q.choices.map((c, ci) => (
                  <label key={ci} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "3px 0", cursor: "pointer" }}>
                    <RadioGroupItem value={String(ci)} />
                    {c}
                  </label>
                ))}
              </RadioGroup>
            )}
          </div>
        ))}

        <Button onClick={submitQuiz}>採点する</Button>

        {graded !== null && (
          <div style={{ marginTop: 12 }}>
            {graded.ok ? (
              <>
                <Alert variant={graded.value.passed ? "success" : "danger"} title={graded.value.passed ? "合格" : "不合格"}>
                  <span style={{ fontSize: 13 }}>
                    {graded.value.correctCount} / {graded.value.total} 問正解（{Math.round(graded.value.ratio * 100)}%）
                    {graded.value.passed ? " — レッスンも完了になりました" : " — 60% 以上で合格です"}
                  </span>
                </Alert>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", marginTop: 8 }}>
                  <tbody>
                    {graded.value.details.map((d, i) => (
                      <tr key={d.questionId} style={{ borderTop: "1px solid var(--color-border)" }}>
                        <td style={{ padding: 4 }}>問 {i + 1}</td>
                        <td style={{ padding: 4 }}>
                          <Badge variant={d.correct ? "success" : "danger"}>{d.correct ? "正解" : "不正解"}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <Alert variant="danger" title="採点できません">
                <span style={{ fontSize: 13 }}>{graded.error.message}</span>
              </Alert>
            )}
          </div>
        )}

        <Separator style={{ margin: "14px 0" }} />

        <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.9 }}>
          <strong>複数選択は「集合」で判定します。</strong>問 1 で <code>[0,1]</code> と <code>[1,0]</code> は
          どちらも正解です（選ぶ順番は関係ない）。ただし <strong>1 つだけ選ぶと不正解</strong>——
          「部分点」はありません。
          <br />
          <strong>設問が 0 件だとエラーを返します。</strong>「問題が無いから全員合格」にしないためで、
          <code>gradeQuiz()</code> は <code>Result</code> 型を返します。
        </div>
      </div>

      <div style={{ ...box, borderColor: cert !== null ? "var(--color-success)" : "var(--color-border)" }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>修了証</h2>
        <Button onClick={issue} disabled={cert !== null}>
          修了証を発行する
        </Button>

        {certError !== "" && (
          <Alert variant="warning" title="発行できません" style={{ marginTop: 10 }}>
            <span style={{ fontSize: 13 }}>
              {certError}（現在 {Math.round(cp.ratio * 100)}% / 必要 {Math.round((COURSE.completionRatio ?? 1) * 100)}%）
            </span>
          </Alert>
        )}

        {cert !== null && (
          <div style={{ marginTop: 12, padding: 20, border: "2px solid var(--color-success)", borderRadius: "var(--radius)", textAlign: "center", background: "var(--color-bg)" }}>
            <div style={{ fontSize: 12, color: "var(--color-muted)" }}>修了証</div>
            <div style={{ fontSize: 18, fontWeight: 700, margin: "8px 0" }}>{cert.courseTitle}</div>
            <div style={{ fontSize: 13 }}>{cert.learnerId} 殿</div>
            <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8 }}>
              修了日 {cert.completedAt.slice(0, 10)} / 達成率 {Math.round(cert.ratio * 100)}%
            </div>
          </div>
        )}

        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 12, lineHeight: 1.8 }}>
          <strong>未修了では発行されません</strong>（<code>issueCertificate()</code> が <code>Result</code> の
          エラーを返す）。「画面でボタンを隠す」だけだと、API を直接叩かれたら発行できてしまいます。
          <strong>ロジック側で止めるのが正解</strong>です——<code>/board-threads</code> の
          <code>canReply()</code> と同じ考え方です。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>試してみてください</h2>
        <ul style={{ fontSize: 13, lineHeight: 2, margin: 0, paddingLeft: "1.2em", color: "var(--color-muted)" }}>
          <li>
            <strong>1 本目の動画（12 分）だけ完了</strong> → <b>30%</b>。レッスン数なら 20% ですが、
            <strong>時間で重み付け</strong>されます
          </li>
          <li>
            <strong>テスト以外の 4 件を完了</strong> → <b>{Math.round((40 / 41) * 100)}%</b> で
            <strong>修了条件（80%）を満たします</strong>。テストを受けなくても修了扱いです
          </li>
          <li>
            <strong>問 1 で 1 つだけ選ぶ</strong> → 不正解。<strong>部分点はありません</strong>
          </li>
          <li>
            <strong>2 問正解で採点</strong> → 67% で合格（60% 以上）
          </li>
          <li>
            <strong>未修了のまま修了証を発行</strong> → <strong>ロジックが拒否します</strong>
          </li>
        </ul>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 12, lineHeight: 1.8 }}>
          <strong>「テストを受けなくても修了できる」は設定次第です。</strong>
          <code>completionRatio: 1.0</code> にすれば全レッスン必須になります。
          <strong>この 1 行がもめる部分</strong>なので、コースのデータに持たせてあります。
        </p>
      </div>
    </main>
  );
}
