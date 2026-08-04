"use client";
/**
 * 非同期ジョブのデモ。**`@platform/jobs` のメモリ実装をそのまま動かす**。
 *
 * 本番は BullMQ(Redis)だが、`createMemoryQueue` は**同じ形**でブラウザでも動く。
 * Redis を用意しなくても、再試行とデッドレターの挙動を確かめられる。
 */
import * as React from "react";
import { Button, Badge, Alert, Input, Select } from "@platform/ui";
import { createMemoryQueue, defineJob, type FailedJob } from "@platform/jobs/browser";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };

/** 送るジョブの中身。 */
interface MailJob {
  to: string;
  /** 失敗を模擬する回数(0 なら必ず成功)。 */
  failTimes: number;
}

/** ジョブの定義。**名前を 1 か所で決める**ので、投入側と処理側でずれない。 */
const sendMail = defineJob<MailJob>("mail.send");

/** 画面に出す記録。 */
type LogEntry = { at: string; text: string; kind: "info" | "retry" | "ok" | "dead" };

const ATTEMPTS_OPTIONS = [
  { label: "3 回（既定）", value: "3" },
  { label: "1 回（再試行しない）", value: "1" },
  { label: "5 回", value: "5" },
];

export function JobsDemo() {
  const [to, setTo] = React.useState("tanaka@example.co.jp");
  const [failTimes, setFailTimes] = React.useState("2");
  const [attempts, setAttempts] = React.useState("3");
  const [log, setLog] = React.useState<LogEntry[]>([]);
  const [dead, setDead] = React.useState<FailedJob<MailJob>[]>([]);
  const [busy, setBusy] = React.useState(false);

  const push = (text: string, kind: LogEntry["kind"]) =>
    setLog((l) => [{ at: new Date().toLocaleTimeString("ja-JP"), text, kind }, ...l].slice(0, 12));

  const run = async () => {
    setBusy(true);
    const max = Number(attempts);
    // **再試行の回数はキューが持つ**(処理側は「失敗したら例外を投げる」だけでよい)
    const queue = createMemoryQueue<MailJob>({ attempts: max });

    let tried = 0;
    queue.process(async (data) => {
      tried += 1;
      if (tried <= data.failTimes) {
        push(`${tried} 回目: 送信に失敗（一時的な障害を模擬）`, "retry");
        throw new Error("SMTP タイムアウト");
      }
      push(`${tried} 回目: ${data.to} に送信できました`, "ok");
    });

    push(`ジョブを投入（最大 ${max} 回まで試行）`, "info");
    await sendMail.enqueue(queue, { to, failTimes: Number(failTimes) });
    await queue.drain();

    const failed = queue.failed();
    setDead(failed);
    if (failed.length > 0) {
      push(`${max} 回試しても失敗。**デッドレターに退避**しました`, "dead");
    }
    setBusy(false);
  };

  return (
    <>
      <div style={box}>
        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ fontSize: 12 }}>
            <div style={{ color: "var(--color-muted)", marginBottom: 4 }}>宛先</div>
            <Input value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ color: "var(--color-muted)", marginBottom: 4 }}>何回失敗させるか（一時的な障害の模擬）</div>
            <Input type="number" value={failTimes} onChange={(e) => setFailTimes(e.target.value)} style={{ width: 120 }} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ color: "var(--color-muted)", marginBottom: 4 }}>最大試行回数</div>
            <Select value={attempts} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAttempts(e.target.value)} options={ATTEMPTS_OPTIONS} />
          </label>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={() => void run()} disabled={busy}>{busy ? "処理中…" : "ジョブを投入する"}</Button>
        </div>
      </div>

      {log.length > 0 && (
        <div style={box}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>実行の記録</div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {log.map((l) => (
              <li key={`${l.at}-${l.text}`} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                <Badge variant={l.kind === "ok" ? "success" : l.kind === "dead" ? "danger" : l.kind === "retry" ? "warning" : "secondary"}>
                  {l.kind === "ok" ? "成功" : l.kind === "dead" ? "退避" : l.kind === "retry" ? "再試行" : "投入"}
                </Badge>
                <span style={{ color: "var(--color-muted)" }}>{l.at}</span>
                <span>{l.text.replace(/\*\*/g, "")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dead.length > 0 && (
        <div style={box}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>デッドレター</div>
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10 }}>
            試行し尽くしたジョブはここに残ります。<strong>黙って消さない</strong>ので、後から原因を調べて再投入できます。
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {dead.map((d, i) => (
              <li key={`${d.name}-${i}`} style={{ fontSize: 12, padding: "8px 10px", borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
                <code style={{ marginRight: 8 }}>{d.name}</code>
                <span style={{ color: "var(--color-danger)" }}>{d.error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Alert variant="info" title="本番は Redis（BullMQ）">
        <code>createMemoryQueue</code> は <strong>プロセスが落ちるとジョブが消えます</strong>。
        本番は <code>createQueue</code>（BullMQ）に差し替えますが、<strong>投入側・処理側の書き方は変わりません</strong>。
        重い処理をリクエストから切り離すと、利用者を待たせずに済みます。
      </Alert>
    </>
  );
}
