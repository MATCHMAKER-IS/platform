"use client";
/**
 * saga(補償トランザクション)のデモ。
 *
 * UI は **@platform/ui の部品だけ**で組む(CLAUDE.md「UI 部品は @platform/ui を使う」)。
 */
import * as React from "react";
import { Button, Checkbox, Badge, Alert, Separator } from "@platform/ui";
import { runSaga, sagaStep, type SagaStep, type SagaResult } from "@platform/saga";

/** 受注処理の文脈。各ステップがここを書き換える。 */
interface OrderCtx {
  orderId: string;
  /** 何が起きたかの記録(画面に出す)。 */
  journal: { at: string; text: string; kind: "run" | "compensate" | "fail" }[];
  stock: number;
  charged: number;
  mailSent: boolean;
}

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12 };

const STEP_NAMES = ["在庫を引く", "決済する", "配送を手配する", "確認メールを送る"] as const;
type StepName = (typeof STEP_NAMES)[number];

const now = () => new Date().toISOString().slice(11, 19);

export function SagaDemo() {
  // どのステップで失敗させるか(null = 全部成功)
  const [failAt, setFailAt] = React.useState<StepName | null>("配送を手配する");
  // 打ち消し自体を失敗させる(現場で一番困るケース)
  const [breakCompensation, setBreakCompensation] = React.useState(false);
  const [result, setResult] = React.useState<SagaResult | null>(null);
  const [ctx, setCtx] = React.useState<OrderCtx | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function run() {
    setBusy(true);
    const c: OrderCtx = { orderId: "ORD-2026-0042", journal: [], stock: 10, charged: 0, mailSent: false };

    const add = (text: string, kind: "run" | "compensate" | "fail") => {
      c.journal.push({ at: now(), text, kind });
    };

    const guard = (name: StepName) => {
      if (failAt === name) {
        add(`${name} — 失敗`, "fail");
        throw new Error(`${name}で失敗しました（外部サービスが応答しません）`);
      }
    };

    const steps: SagaStep<OrderCtx>[] = [
      sagaStep<OrderCtx>(
        "在庫を引く",
        (x) => {
          guard("在庫を引く");
          x.stock -= 1;
          add("在庫 10 → 9", "run");
        },
        (x) => {
          if (breakCompensation) {
            add("在庫を戻す — ★失敗（手動対応が必要）", "fail");
            throw new Error("在庫サービスが応答しません");
          }
          x.stock += 1;
          add("在庫 9 → 10（戻した）", "compensate");
        },
      ),
      sagaStep<OrderCtx>(
        "決済する",
        async (x) => {
          await new Promise((r) => setTimeout(r, 200));
          guard("決済する");
          x.charged = 12800;
          add("¥12,800 を決済", "run");
        },
        async (x) => {
          await new Promise((r) => setTimeout(r, 150));
          x.charged = 0;
          add("¥12,800 を返金（打ち消し）", "compensate");
        },
      ),
      sagaStep<OrderCtx>(
        "配送を手配する",
        async () => {
          await new Promise((r) => setTimeout(r, 200));
          guard("配送を手配する");
          add("配送を手配", "run");
        },
        async () => {
          add("配送をキャンセル", "compensate");
        },
      ),
      // ★ compensate を持たない。メールは送ったら取り消せない。
      sagaStep<OrderCtx>("確認メールを送る", (x) => {
        guard("確認メールを送る");
        x.mailSent = true;
        add("確認メールを送信（★取り消せない）", "run");
      }),
    ];

    const r = await runSaga(steps, c);
    setResult(r);
    setCtx({ ...c, journal: [...c.journal] });
    setBusy(false);
  }

  const compErrors = result?.compensationErrors ?? [];

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>補償トランザクション（saga）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        <strong>「在庫を引いた。決済も通った。でも配送手配で失敗した」</strong>——このとき在庫と決済を
        どう戻すか。<strong>外部 API を含む処理は DB のトランザクションで囲えません</strong>。
        <code>@platform/saga</code> は<strong>成功済みのステップを逆順で打ち消します</strong>。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>受注処理を走らせる</h2>

        <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 8 }}>どこで失敗させますか</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <Button size="sm" variant={failAt === null ? "primary" : "secondary"} onClick={() => setFailAt(null)}>
            失敗させない
          </Button>
          {STEP_NAMES.map((n) => (
            <Button key={n} size="sm" variant={failAt === n ? "danger" : "secondary"} onClick={() => setFailAt(n)}>
              {n}
            </Button>
          ))}
        </div>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12 }}>
          <Checkbox checked={breakCompensation} onCheckedChange={(v) => setBreakCompensation(!!v)} />
          <span>
            打ち消し自体も失敗させる（<strong>現場で一番困るケース</strong>）
          </span>
        </label>

        <div>
          <Button onClick={() => void run()} disabled={busy}>
            {busy ? "処理中…" : "受注処理を実行"}
          </Button>
        </div>
      </div>

      {result !== null && ctx !== null && (
        <>
          <div style={box}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>結果</h2>
              <Badge variant={result.ok ? "success" : "danger"}>{result.ok ? "確定" : "巻き戻し済み"}</Badge>
              {compErrors.length > 0 && <Badge variant="warning">手動対応が必要</Badge>}
            </div>

            {result.ok ? (
              <Alert variant="success" title="全ステップが成功しました">
                {result.completed.join(" → ")}
              </Alert>
            ) : (
              <Alert variant="danger" title={`「${result.failedStep}」で失敗 → 巻き戻しました`}>
                {result.error instanceof Error ? result.error.message : String(result.error)}
              </Alert>
            )}

            {compErrors.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <Alert variant="warning" title="打ち消しに失敗したステップがあります（自動では戻せません）">
                  {compErrors.map((e) => (
                    <div key={e.step} style={{ fontSize: 12 }}>
                      <b>{e.step}</b>: {e.error instanceof Error ? e.error.message : String(e.error)}
                    </div>
                  ))}
                  <div style={{ fontSize: 11, marginTop: 6 }}>
                    <strong>saga は打ち消しが失敗しても止まりません。</strong>他の打ち消しは続行し、
                    失敗した分だけを <code>compensationErrors</code> に残します。
                    ここに出たものは<strong>人が対応する</strong>しかありません。
                  </div>
                </Alert>
              </div>
            )}

            <Separator style={{ margin: "14px 0" }} />

            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13 }}>
              <span>
                在庫 <b>{ctx.stock}</b>
              </span>
              <span>
                決済 <b>¥{ctx.charged.toLocaleString()}</b>
              </span>
              <span>
                メール <b>{ctx.mailSent ? "送信済（取り消せない）" : "未送信"}</b>
              </span>
            </div>
            <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 8 }}>
              巻き戻しが効いていれば、在庫は <b>10</b>・決済は <b>¥0</b> に戻ります。
            </p>
          </div>

          <div style={box}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>実行の記録</h2>
            {ctx.journal.map((j, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "5px 0", borderTop: i === 0 ? "none" : "1px solid var(--color-border)" }}>
                <span style={{ ...mono, color: "var(--color-muted)", width: 62 }}>{j.at}</span>
                <Badge variant={j.kind === "run" ? "secondary" : j.kind === "compensate" ? "warning" : "danger"}>
                  {j.kind === "run" ? "実行" : j.kind === "compensate" ? "打ち消し" : "失敗"}
                </Badge>
                <span style={{ fontSize: 13 }}>{j.text}</span>
              </div>
            ))}
            <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
              <strong>打ち消しは逆順です</strong>（配送 → 決済 → 在庫）。順方向で戻すと、
              まだ確定していないものを先に触ることになります。
            </p>
          </div>

          <div style={box}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>ステップの状態</h2>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
                  <th style={{ padding: 5 }}>ステップ</th>
                  <th style={{ padding: 5 }}>実行</th>
                  <th style={{ padding: 5 }}>打ち消し</th>
                </tr>
              </thead>
              <tbody>
                {STEP_NAMES.map((n) => {
                  const done = result.completed.includes(n);
                  const comp = result.compensated.includes(n);
                  const failed = result.failedStep === n;
                  const compErr = compErrors.some((e) => e.step === n);
                  return (
                    <tr key={n} style={{ borderTop: "1px solid var(--color-border)" }}>
                      <td style={{ padding: 5 }}>{n}</td>
                      <td style={{ padding: 5 }}>
                        {failed ? <Badge variant="danger">失敗</Badge> : done ? <Badge variant="success">確定</Badge> : comp || compErr ? <Badge variant="secondary">実行後に打ち消し</Badge> : <Badge variant="outline">未実行</Badge>}
                      </td>
                      <td style={{ padding: 5 }}>
                        {compErr ? <Badge variant="warning">★失敗（手動）</Badge> : comp ? <Badge variant="secondary">済</Badge> : <span style={{ color: "var(--color-muted)" }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>試してみてください</h2>
        <ul style={{ fontSize: 13, lineHeight: 2, margin: 0, paddingLeft: "1.2em", color: "var(--color-muted)" }}>
          <li>
            <strong>「配送を手配する」で失敗</strong> → 決済と在庫が<strong>逆順で</strong>打ち消され、
            在庫 10・決済 ¥0 に戻ります
          </li>
          <li>
            <strong>「在庫を引く」で失敗</strong> → 打ち消すものが無いので <code>compensated</code> は空。
            <strong>最初のステップで落ちるのが一番安全</strong>です
          </li>
          <li>
            <strong>「打ち消し自体も失敗させる」+ 配送で失敗</strong> →{" "}
            <strong>決済は返金できたのに在庫が戻らない</strong>。
            saga は止まらず、<code>compensationErrors</code> に残して人へ回します
          </li>
          <li>
            <strong>「確認メールを送る」で失敗</strong> → メールは <code>compensate</code> を持たないので、
            そこまでのステップだけが打ち消されます
          </li>
        </ul>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 12, lineHeight: 1.8 }}>
          <strong>saga は万能ではありません。</strong>「送ってしまったメール」「相手に渡った通知」は
          打ち消せません。<code>@platform/saga</code> の TSDoc も
          <strong>「取り消せない副作用があるなら Saga には向かない」</strong>と明記しています。
          <br />
          取り消せない処理は<strong>最後に置く</strong>——このデモでメールを最後にしているのはそのためです。
        </p>
      </div>
    </>
  );
}
