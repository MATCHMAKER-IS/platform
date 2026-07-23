"use client";
/**
 * 非同期ジョブ（キュー）のデモ（@platform/jobs 相当の挙動をローカルで再現）。
 * 待機→実行中→完了/失敗と遷移。失敗は最大3回リトライ。実基盤は BullMQ(Redis)。
 */
import * as React from "react";
import { Button, Badge } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
type State = "waiting" | "active" | "completed" | "failed";
type Job = { id: number; name: string; state: State; attempts: number };
const JOB_NAMES = ["請求書PDF生成", "月次レポート集計", "メール一括送信", "画像サムネイル", "CSVインポート", "在庫再計算"];
const STATE_LABEL: Record<State, string> = { waiting: "待機", active: "実行中", completed: "完了", failed: "失敗" };
const STATE_VARIANT: Record<State, "secondary" | "warning" | "success" | "danger"> = { waiting: "secondary", active: "warning", completed: "success", failed: "danger" };

export function JobsQueueDemo() {
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [running, setRunning] = React.useState(true);
  const seq = React.useRef(1);
  const enqueue = () => { const name = JOB_NAMES[Math.floor(Math.random() * JOB_NAMES.length)]!; setJobs((j) => [...j, { id: seq.current++, name, state: "waiting", attempts: 0 }]); };

  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setJobs((prev) => {
        if (prev.some((j) => j.state === "active")) return prev;
        const idx = prev.findIndex((j) => j.state === "waiting");
        if (idx === -1) return prev;
        const next = prev.slice();
        next[idx] = { ...next[idx]!, state: "active", attempts: next[idx]!.attempts + 1 };
        const jobId = next[idx]!.id;
        setTimeout(() => {
          setJobs((cur) => cur.map((j) => {
            if (j.id !== jobId || j.state !== "active") return j;
            const success = Math.random() > 0.25;
            if (success) return { ...j, state: "completed" };
            if (j.attempts >= 3) return { ...j, state: "failed" };
            return { ...j, state: "waiting" };
          }));
        }, 1200);
        return next;
      });
    }, 600);
    return () => clearInterval(id);
  }, [running]);

  const count = (s: State) => jobs.filter((j) => j.state === s).length;
  const COLS: State[] = ["waiting", "active", "completed", "failed"];
  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 16 }}>ジョブキュー（非同期処理）</h1>
      <div style={box}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button size="sm" onClick={enqueue}>ジョブを投入</Button>
          <Button size="sm" onClick={() => { for (let i = 0; i < 5; i++) enqueue(); }} variant="secondary">5件まとめて</Button>
          <Button size="sm" variant="secondary" onClick={() => setRunning((r) => !r)}>{running ? "ワーカー停止" : "ワーカー開始"}</Button>
          <Button size="sm" variant="secondary" onClick={() => setJobs([])}>クリア</Button>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-muted)", alignSelf: "center" }}>ワーカー: {running ? "稼働中" : "停止"}</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {COLS.map((s) => (
          <div key={s} style={{ ...box, marginBottom: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <Badge variant={STATE_VARIANT[s]}>{STATE_LABEL[s]}</Badge><span style={{ fontSize: 13, fontWeight: 700 }}>{count(s)}</span>
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6, minHeight: 40 }}>
              {jobs.filter((j) => j.state === s).slice(-8).map((j) => (
                <li key={j.id} style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
                  <div style={{ fontWeight: 600 }}>#{j.id} {j.name}</div>
                  {j.attempts > 1 && <div style={{ color: "var(--color-muted)", fontSize: 11 }}>試行 {j.attempts} 回目</div>}</li>))}
            </ul>
          </div>))}
      </div>
      <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 16, lineHeight: 1.8 }}>重い処理・遅延処理・定期処理をリクエストから切り離して裏で実行します。失敗は最大3回までリトライ（このデモは約25%で失敗）。実基盤 <code>@platform/jobs</code> は BullMQ(Redis) で本番運用します。</p>
    </>
  );
}
