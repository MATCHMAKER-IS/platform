"use client";
/**
 * 権限の棚卸しデモ。**`@platform/access-review` をそのまま動かす**。
 *
 * 退職者に権限が残っていないか、強い権限に期限があるか、といった
 * 「半年に 1 回やると決めたのに誰もやらない」類の点検を機械にやらせる。
 */
import * as React from "react";
import { Badge, Alert, Select } from "@platform/ui";
import { reviewAccess, offboardingSteps, type AccessGrant, type Person } from "@platform/access-review";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", fontSize: 12, color: "var(--color-muted)", borderBottom: "1px solid var(--color-border)" };
const td: React.CSSProperties = { padding: "6px 8px", fontSize: 13, borderBottom: "1px solid var(--color-border)" };

/** 点検する日。固定にして、デモの結果が日によって変わらないようにする。 */
const AS_OF = "2026-08-01";

const PEOPLE: Person[] = [
  { userId: "u-tanaka", name: "田中", department: "経理", status: "active" },
  { userId: "u-suzuki", name: "鈴木", department: "営業", status: "resigned", resignedOn: "2026-06-30" },
  { userId: "u-sato", name: "佐藤", department: "情報システム", status: "active" },
  { userId: "u-ito", name: "伊藤", department: "人事", status: "leave" },
];

const GRANTS: AccessGrant[] = [
  // 退職者に残ったまま(最も危険)
  { userId: "u-suzuki", grant: "expense:approve", grantedOn: "2025-04-01", grantedBy: "u-sato", reason: "営業部の承認者" },
  // 強い権限に期限が無い
  { userId: "u-sato", grant: "*", grantedOn: "2024-01-15", grantedBy: "u-sato", reason: "情シス管理者" },
  // 期限切れなのに残っている
  { userId: "u-tanaka", grant: "pii:unmask", grantedOn: "2026-01-10", grantedBy: "u-sato", reason: "年末調整の確認", expiresOn: "2026-03-31" },
  // 名簿に無い利用者(誰の権限か分からない)
  { userId: "u-unknown", grant: "invoice:read", grantedOn: "2025-09-01", grantedBy: "u-sato", reason: "(記録なし)" },
  // 正常: 期限つきの強い権限
  { userId: "u-tanaka", grant: "period:lock", grantedOn: "2026-07-01", grantedBy: "u-sato", reason: "月次締め", expiresOn: "2026-12-31", lastReviewedOn: "2026-07-01", lastReviewedBy: "u-sato" },
  // 正常: 外した権限
  { userId: "u-ito", grant: "user:manage", grantedOn: "2025-05-01", grantedBy: "u-sato", reason: "人事異動対応", revokedOn: "2026-05-01" },
];

const SEVERITY_LABEL = { high: "今すぐ", medium: "早めに", low: "確認" } as const;

export function ReviewDemo() {
  const [personId, setPersonId] = React.useState("u-suzuki");
  const findings = React.useMemo(() => reviewAccess(PEOPLE, GRANTS, AS_OF), []);
  const person = PEOPLE.find((p) => p.userId === personId) ?? PEOPLE[0]!;
  const steps = React.useMemo(() => offboardingSteps(person, GRANTS), [person]);
  const nameOf = (userId: string) => PEOPLE.find((p) => p.userId === userId)?.name ?? `${userId}（名簿に無い）`;

  return (
    <>
      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>棚卸しの結果（{AS_OF} 時点）</div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10 }}>
          6 件の権限を点検して <strong>{findings.length} 件</strong>の指摘。
          <strong>正常なもの（期限つきの強い権限・外した権限）は挙がりません</strong>——
          誤検知が混ざると、一覧そのものが読まれなくなります。
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr><th style={th}>深刻度</th><th style={th}>対象者</th><th style={th}>権限</th><th style={th}>何が問題か</th><th style={th}>どうするか</th></tr>
          </thead>
          <tbody>
            {findings.map((f) => (
              <tr key={`${f.userId}-${f.grant}-${f.reason}`}>
                <td style={td}>
                  <Badge variant={f.severity === "high" ? "danger" : f.severity === "medium" ? "warning" : "secondary"}>
                    {SEVERITY_LABEL[f.severity]}
                  </Badge>
                </td>
                <td style={td}>{nameOf(f.userId)}</td>
                <td style={td}><code style={{ fontSize: 12 }}>{f.grant}</code></td>
                <td style={td}>{f.reason}</td>
                <td style={td} >{f.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>退職・異動時の停止手順</div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10 }}>
          <strong>順序に意味があります。</strong>権限を先に消しても、セッションが生きていれば操作できます。
        </p>
        <div style={{ marginBottom: 12 }}>
          <Select
            value={personId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPersonId(e.target.value)}
            options={PEOPLE.map((p) => ({ label: `${p.name}（${p.department}・${p.status === "resigned" ? "退職" : p.status === "leave" ? "休職" : "在籍"}）`, value: p.userId }))}
          />
        </div>
        <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          {steps.map((s) => (
            <li key={s.order} style={{ fontSize: 13 }}>
              <strong>{s.title}</strong>
              <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>{s.detail}</div>
            </li>
          ))}
        </ol>
      </div>

      <Alert variant="info" title="この画面は基盤をそのまま動かしています">
        <code>reviewAccess(people, grants, asOf)</code> と <code>offboardingSteps(person, grants)</code> の
        戻り値を並べているだけです。判定の中身（強い権限の一覧・期限の扱い）は
        <code>@platform/access-review</code> にあり、<strong>アプリ側で書き直しません</strong>。
      </Alert>
    </>
  );
}
