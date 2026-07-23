"use client";
/**
 * 承認を Slack で回すデモ。
 *
 * 申請が来たら Slack に通知し、**その場で承認/却下**できるようにする。
 * 承認のために業務システムを開かなくてよくなるので、滞留が減る。
 *
 * ただし**チャットで承認するときほど、誰が押したかの確認が要る**。
 * Slack の利用者と社内の権限を突き合わせずに処理すると、
 * 「チャンネルにいる人なら誰でも承認できる」状態になる。
 *
 * 使う基盤:
 *   @platform/slack … 通知の組み立て(buildApprovalBlocks)と押下の解析(parseInteraction)
 *   @platform/auth  … 押した人が承認してよいかの判定(can)
 */
import * as React from "react";
import { buildApprovalBlocks, parseInteraction } from "@platform/slack";
import { can, resolveHierarchy } from "@platform/auth";
import { Button, Badge, Alert, Select } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 11.5, whiteSpace: "pre-wrap", wordBreak: "break-word" };

/** Slack の利用者 → 社内の利用者。実運用では users.lookupByEmail で突き合わせる。 */
const SLACK_TO_USER: Record<string, { name: string; roles: string[] }> = {
  U_KACHO: { name: "課長 佐藤", roles: ["manager"] },
  U_STAFF: { name: "担当 山田", roles: ["employee"] },
  U_UNKNOWN: { name: "（社内に該当なし）", roles: [] },
};

const POLICY = resolveHierarchy({
  employee: { permissions: ["expense:create"] },
  manager: { inherits: ["employee"], permissions: ["expense:approve:any"] },
});

type Step = { at: string; text: string; kind: "ok" | "ng" | "info" };

export function SlackApprovalDemo() {
  const [pressedBy, setPressedBy] = React.useState("U_KACHO");
  const [action, setAction] = React.useState("approve");
  const [status, setStatus] = React.useState<"pending" | "approved" | "rejected">("pending");
  const [log, setLog] = React.useState<Step[]>([]);

  const request = { id: "expense:123", applicant: "山田 太郎", amount: 12000, purpose: "客先訪問の交通費" };

  // 送信するメッセージ（基盤で組み立てる）
  const blocks = React.useMemo(() => buildApprovalBlocks({
    title: "経費申請の承認",
    summary: `*${request.applicant}* さんから申請がありました。`,
    fields: [
      { label: "金額", value: `${request.amount.toLocaleString()} 円` },
      { label: "用途", value: request.purpose },
    ],
    actionValue: request.id,
  }), [request.applicant, request.amount, request.purpose, request.id]);

  const add = (text: string, kind: Step["kind"] = "info") =>
    setLog((l) => [{ at: new Date().toLocaleTimeString(), text, kind }, ...l].slice(0, 10));

  /** ボタンが押された、という想定で受信側の処理を再現する。 */
  const press = () => {
    // Slack から届く payload の形（実際は署名検証を通してから解く）
    const payload = encodeURIComponent(JSON.stringify({
      actions: [{ action_id: action, value: request.id }],
      user: { id: pressedBy, username: pressedBy },
      channel: { id: "C_KEIRI" },
      message: { ts: "1700000000.000100" },
      response_url: "https://hooks.slack.com/actions/…",
    }));
    const it = parseInteraction(`payload=${payload}`);
    if (!it) { add("payload を解けませんでした", "ng"); return; }

    add(`受信: ${it.actionId} / 対象 ${it.value} / 押した人 ${it.userId}`, "info");

    // ここが要点: 押した人が社内で誰か、そして承認してよいか
    const user = SLACK_TO_USER[it.userId];
    if (!user || user.roles.length === 0) {
      add("社内の利用者と結び付きません → 処理しない", "ng");
      return;
    }
    const permission = it.actionId === "approve" ? "expense:approve:any" : "expense:approve:any";
    if (!can(POLICY, user.roles, permission)) {
      add(`${user.name} は承認権限を持ちません（${user.roles.join(",")}）→ 403`, "ng");
      return;
    }

    setStatus(it.actionId === "approve" ? "approved" : "rejected");
    add(`${user.name} が${it.actionId === "approve" ? "承認" : "却下"}しました → 元メッセージを更新して結果に差し替え`, "ok");
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        申請が来たら Slack に通知し、その場で承認できるようにします。
        <strong>押した人が承認してよいかを必ず確かめる</strong>のが要点です。
      </p>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>1. Slack へ送るメッセージ</div>
        <p style={{ fontSize: 12.5, color: "var(--color-muted)", marginTop: 0, lineHeight: 1.8 }}>
          <code>buildApprovalBlocks</code> が Block Kit の構造を組み立てます。
          却下ボタンには<strong>確認</strong>が入ります（押し間違いが申請者に通知されるため）。
        </p>
        <pre style={{ ...mono, margin: 0, padding: 12, borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)", maxHeight: 220, overflow: "auto" }}>
{JSON.stringify(blocks, null, 2)}
        </pre>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>2. ボタンが押されたとき</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" }}>押した人
            <Select value={pressedBy} onChange={(e) => setPressedBy(e.target.value)}
              options={[
                { label: "課長 佐藤（manager）", value: "U_KACHO" },
                { label: "担当 山田（employee）", value: "U_STAFF" },
                { label: "社内に該当なし", value: "U_UNKNOWN" },
              ]} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" }}>操作
            <Select value={action} onChange={(e) => setAction(e.target.value)}
              options={[{ label: "承認する", value: "approve" }, { label: "却下する", value: "reject" }]} />
          </label>
          <Button onClick={press}>ボタンを押す</Button>
          <Button variant="secondary" onClick={() => { setStatus("pending"); setLog([]); }}>やり直す</Button>
          <Badge variant={status === "approved" ? "success" : status === "rejected" ? "danger" : "secondary"}>
            {status === "approved" ? "承認済み" : status === "rejected" ? "却下" : "未処理"}
          </Badge>
        </div>

        {log.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
            {log.map((l, i) => (
              <li key={i} style={{ fontSize: 12.5, display: "flex", gap: 8 }}>
                <span style={{ ...mono, color: "var(--color-muted)" }}>{l.at}</span>
                <span style={{ color: l.kind === "ng" ? "var(--color-danger, #c00)" : l.kind === "ok" ? "var(--color-primary)" : "var(--color-fg)" }}>{l.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <Alert variant="warning" title="チャットで承認するときの注意">
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.9 }}>
            <li><strong>押した人を必ず確かめる</strong> — 確かめないと「チャンネルにいる人なら誰でも承認できる」状態になります</li>
            <li><strong>署名の検証を先に行う</strong> — 受信口は URL さえ分かれば叩けます（<code>verifySlackSignature</code>）</li>
            <li><strong>二重押しに備える</strong> — 処理済みなら「すでに承認されています」と返し、二重に処理しない</li>
            <li><strong>元メッセージを更新する</strong> — 結果に差し替えないと、他の人がもう一度押します</li>
            <li><strong>監査に残す</strong> — 誰がいつ承認したかは、後から説明が必要になります</li>
          </ul>
        </Alert>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>受信口の実装</div>
        <p style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.9, margin: 0 }}>
          実際に動く受信口は <code>demos/showcase/src/app/api/slack-events/route.ts</code> にあります。
          署名を検証し、生ボディのまま照合し、古い要求を弾きます。
          Slack は <strong>3 秒で接続を切る</strong>ため、重い処理は <code>@platform/jobs</code> のキューへ回してすぐ応答します。
        </p>
      </div>
    </div>
  );
}
