"use client";
/**
 * Microsoft 365 連携のデモ。**`@platform/microsoft` の本物のクライアントを動かす**。
 *
 * Graph API には認証情報が要るので、`authedFetch` に**応答を模した関数**を注入する。
 * クライアント側のロジック（要求の組み立て・応答の解釈）は本物がそのまま動く。
 *
 * 見せたいのは **`available` の意味**。権限が無い相手は予定が空で返るため、
 * 「空いている」と区別できないと、参照できていない人を空き扱いにして会議を入れてしまう。
 */
import * as React from "react";
import { Button, Badge, Alert, Textarea } from "@platform/ui";
import { createMicrosoftGraphClient, type ScheduleAvailability } from "@platform/microsoft";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };

/** 模擬の予定表。**`denied` の人は権限が無い**設定にする。 */
const FAKE_CALENDAR: Record<string, { start: string; end: string; status: string }[] | "denied"> = {
  "tanaka@example.co.jp": [
    { start: "2026-08-05T10:00:00", end: "2026-08-05T11:00:00", status: "busy" },
    { start: "2026-08-05T14:00:00", end: "2026-08-05T15:30:00", status: "busy" },
  ],
  "suzuki@example.co.jp": [
    { start: "2026-08-05T13:00:00", end: "2026-08-05T14:00:00", status: "tentative" },
  ],
  "sato@example.co.jp": "denied",
};

/** Graph API の getSchedule 応答を模した fetch。 */
function createFakeFetch(): typeof fetch {
  return (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { schedules: string[] };
    return new Response(JSON.stringify({
      value: body.schedules.map((email) => {
        const cal = FAKE_CALENDAR[email];
        // **権限が無い相手は error が返り、予定は空になる**
        if (cal === "denied" || cal === undefined) {
          return { scheduleId: email, error: { message: "アクセス権がありません" } };
        }
        return {
          scheduleId: email,
          scheduleItems: cal.map((c) => ({ start: { dateTime: c.start }, end: { dateTime: c.end }, status: c.status })),
        };
      }),
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

export function GraphDemo() {
  const [emails, setEmails] = React.useState("tanaka@example.co.jp\nsuzuki@example.co.jp\nsato@example.co.jp");
  const [result, setResult] = React.useState<ScheduleAvailability[] | null>(null);
  const [busy, setBusy] = React.useState(false);

  const run = async () => {
    setBusy(true);
    // **本物のクライアント。** 差し替えているのは fetch だけ
    const graph = createMicrosoftGraphClient(createFakeFetch());
    const res = await graph.getSchedule({
      emails: emails.split("\n").map((e) => e.trim()).filter(Boolean),
      start: "2026-08-05T09:00:00",
      end: "2026-08-05T18:00:00",
    });
    setResult(res);
    setBusy(false);
  };

  const fmt = (iso: string) => iso.slice(11, 16);

  return (
    <>
      <div style={box}>
        <label style={{ fontSize: 12 }}>
          <div style={{ color: "var(--color-muted)", marginBottom: 4 }}>
            参加者のメールアドレス（1 行に 1 件）
          </div>
          <Textarea value={emails} onChange={(e) => setEmails(e.target.value)} rows={4} style={{ fontFamily: "monospace", fontSize: 12 }} />
        </label>
        <div style={{ marginTop: 12 }}>
          <Button onClick={() => void run()} disabled={busy}>空き状況を調べる（8/5 9:00〜18:00）</Button>
        </div>
      </div>

      {result && (
        <div style={box}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>結果</div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {result.map((r) => (
              <li key={r.email} style={{ padding: "10px 12px", borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Badge variant={r.available ? "success" : "danger"}>{r.available ? "参照できた" : "参照できない"}</Badge>
                  <code style={{ fontSize: 12 }}>{r.email}</code>
                </div>
                <div style={{ fontSize: 12, color: "var(--color-muted)" }}>
                  {!r.available
                    ? "権限がありません。予定が空で返りますが、空いているわけではありません"
                    : r.busy.length === 0
                      ? "この時間帯は空いています"
                      : `埋まっている時間: ${r.busy.map((b) => `${fmt(b.start)}〜${fmt(b.end)}`).join(" / ")}`}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Alert variant="info" title="「空き」と「見えない」は違う">
        権限が無い相手の予定は<strong>空で返ります</strong>。これを空き時間として扱うと、
        相手の予定を無視して会議を入れることになります。<code>available</code> を必ず確認してください。
        予定の中身（件名・場所）は返らず、<strong>埋まっているかどうかだけ</strong>が分かります。
      </Alert>
    </>
  );
}
