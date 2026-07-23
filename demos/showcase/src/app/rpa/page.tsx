"use client";
/**
 * RPA ランナーのデモ。**@platform/rpa の createRpaRunner を実際に使っている**。
 *
 * RPA は「相手の画面を人間のふりをして操作する」ため、二重実行・途中失敗・無限待ちが
 * そのまま業務事故になる。基盤が受け持つのはその安全装置:
 *   - 冪等キー   … 同じ処理を二度実行しない
 *   - ロック     … 同じ対象を同時に触らない
 *   - リトライ   … 一時的な失敗は指数バックオフで再試行
 *   - タイムアウト … 応答が返らないときに打ち切る
 *   - 監査       … 誰が・いつ・何をしたかを残す
 * ドライラン（書き込みをしない試し実行）は業務側の判断なので、アプリで実装している。
 */
import * as React from "react";
import { createRpaRunner, type RpaAuditEvent } from "@platform/rpa";
import { Alert, Badge, Button, Checkbox, Input } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
const STEPS: { label: string; write: boolean }[] = [
  { label: "業務システムにログイン", write: false },
  { label: "対象月の一覧を開く", write: false },
  { label: "CSV をダウンロード", write: false },
  { label: "会計システムへ取込", write: true },
  { label: "完了通知を送信", write: true },
];

type Line = { text: string; kind: "step" | "audit" | "result" | "error" };

export default function Page() {
  const [dryRun, setDryRun] = React.useState(true);
  const [failFirst, setFailFirst] = React.useState(false);
  const [idemKey, setIdemKey] = React.useState("2026-07-close");
  const [lines, setLines] = React.useState<Line[]>([]);
  const [running, setRunning] = React.useState(false);

  // 冪等記憶とロックは「アプリが用意する入れ物」。本番では DB や Redis を差し込む。
  const seen = React.useRef(new Set<string>());
  const locks = React.useRef(new Map<string, number>());
  const attempt = React.useRef(0);

  const push = (text: string, kind: Line["kind"] = "step") => setLines((l) => [...l, { text, kind }]);

  const runner = React.useMemo(() => createRpaRunner({
    actor: "demo-user",
    audit: (e: RpaAuditEvent) => { push(`${e.action}${e.target ? ` / ${e.target}` : ""} ${JSON.stringify(e.metadata ?? {})}`, "audit"); },
    seenStore: {
      has: (k) => seen.current.has(k),
      add: (k) => { seen.current.add(k); },
    },
    lock: {
      acquire: (key, ttlMs) => {
        const until = locks.current.get(key) ?? 0;
        if (until > Date.now()) return false;   // 既に誰かが握っている
        locks.current.set(key, Date.now() + ttlMs);
        return true;
      },
      release: (key) => { locks.current.delete(key); },
    },
  }), []);

  const run = async () => {
    setRunning(true);
    setLines([]);
    attempt.current = 0;

    const res = await runner.run({
      name: "月次締めの取込",
      lockKey: "accounting",       // 会計システムを同時に触らない
      lockTtlMs: 60_000,
      timeoutMs: 30_000,           // 応答が返らないときは打ち切る
      idempotencyKey: idemKey,     // 同じ月を二度取り込まない
      retry: { maxAttempts: 3, baseDelayMs: 200 },
      async run(ctx) {
        attempt.current = ctx.attempt;
        push(`— 試行 ${ctx.attempt} 回目（runId: ${ctx.runId}）—`, "result");
        for (const s of STEPS) {
          if (ctx.signal.aborted) throw new Error("中断されました");
          await new Promise((r) => setTimeout(r, 300));

          if (dryRun && s.write) { push(`SKIP  ${s.label}（ドライラン: 書き込みなし）`); continue; }
          // 1回目だけ失敗させ、リトライの様子を見せる
          if (failFirst && s.write && ctx.attempt === 1) {
            push(`FAIL  ${s.label}`, "error");
            throw new Error(`${s.label} に失敗`);
          }
          await ctx.audit("rpa.step", { step: s.label, dryRun });
          push(`OK    ${s.label}`);
        }
        return { imported: dryRun ? 0 : 128 };
      },
    });

    if (res.ok) {
      const { runId, attempts, skipped, value } = res.value;
      push(skipped
        ? `冪等キー「${idemKey}」は実行済みのため、処理をスキップしました`
        : `完了（runId: ${runId} / 試行 ${attempts} 回 / 取込 ${value?.imported ?? 0} 件）`, "result");
    } else {
      push(`失敗: ${res.error.code} — ${res.error.message}`, "error");
    }
    setRunning(false);
  };

  const color = (k: Line["kind"]) =>
    k === "error" ? "var(--color-danger, #c00)" : k === "audit" ? "var(--color-muted)" : k === "result" ? "var(--color-primary)" : "var(--color-fg)";

  return (
    <main style={{ maxWidth: 820, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>RPA ランナー（安全実行）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        冪等キー・ロック・リトライ・タイムアウト・監査を、基盤の <code>createRpaRunner</code> が受け持ちます。
        同じ冪等キーで2回実行すると、2回目は処理そのものが走りません。
      </p>

      <div style={box}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Checkbox  checked={dryRun} onCheckedChange={(v) => setDryRun(!!v)} disabled={running} />
            ドライラン（書き込みをしない）
          </label>
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Checkbox  checked={failFirst} onCheckedChange={(v) => setFailFirst(!!v)} disabled={running} />
            1回目をわざと失敗させる（リトライを見る）
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" }}>冪等キー
            <Input value={idemKey} onChange={(e) => setIdemKey(e.target.value)} disabled={running} style={{ width: 180 }} />
          </label>
          <Button onClick={() => void run()} disabled={running}>{running ? "実行中…" : "実行"}</Button>
          <Button variant="secondary" onClick={() => { seen.current.clear(); setLines([]); }} disabled={running}>実行履歴を消す</Button>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          ドライランを外して実行 → もう一度実行、と試すと冪等キーの効果が分かります。
          「実行履歴を消す」は冪等記憶のリセットです。
        </p>
      </div>

      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>実行ログ</span>
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
            {dryRun ? <Badge variant="warning">ドライラン</Badge> : <Badge variant="danger">本実行</Badge>}
          </span>
        </div>
        {lines.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--color-muted)" }}>「実行」を押すと、手順とあわせて監査イベントが流れます。</div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {lines.map((l, i) => (
              <li key={i} style={{ fontFamily: "monospace", fontSize: 11.5, color: color(l.kind), wordBreak: "break-all" }}>
                {l.kind === "audit" ? "audit " : ""}{l.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Alert variant="info" title="RPA は最後の手段">
        自動化の優先順位は <strong>API &gt; MCP &gt; RPA</strong> です。画面操作は相手の変更に弱く、壊れても気づきにくいため、
        API が用意されているならそちらを使います。RPA を選ぶ場合でも、<code>@platform/rpa</code> の安全装置を通して実行します。
      </Alert>
    </main>
  );
}
