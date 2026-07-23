"use client";
/** フィーチャーフラグのデモ: kill switch・割合ロールアウト・allow/deny・A/B バリアント。 */
import * as React from "react";
import { Button, Input, Slider, Checkbox } from "@platform/ui";
import { bucketOf, evaluateFlag, selectVariant, type FlagContext, type FlagRule } from "@platform/flags";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12 };

/** 社員（モック）。key が同じなら、いつ評価しても同じバケットになる。 */
const PEOPLE = [
  { key: "u-yamada", name: "山田太郎", role: "staff", plan: "standard" },
  { key: "u-suzuki", name: "鈴木花子", role: "staff", plan: "standard" },
  { key: "u-admin", name: "管理者", role: "admin", plan: "standard" },
  { key: "u-trial", name: "試用アカウント", role: "staff", plan: "trial" },
  { key: "u-sato", name: "佐藤次郎", role: "staff", plan: "standard" },
  { key: "u-tanaka", name: "田中三郎", role: "staff", plan: "standard" },
  { key: "u-ito", name: "伊藤四郎", role: "staff", plan: "standard" },
  { key: "u-watanabe", name: "渡辺五郎", role: "staff", plan: "standard" },
];

const ctxOf = (p: (typeof PEOPLE)[number]): FlagContext => ({
  key: p.key,
  attributes: { role: p.role, plan: p.plan },
});

export function FlagsDemo() {
  // ── 段階リリース ──
  const [enabled, setEnabled] = React.useState(true);
  const [percent, setPercent] = React.useState(30);
  const [allowAdmin, setAllowAdmin] = React.useState(true);
  const [denyTrial, setDenyTrial] = React.useState(true);

  const rule: FlagRule = React.useMemo(
    () => ({
      enabled,
      rolloutPercent: percent,
      ...(allowAdmin ? { allow: [{ role: "admin" }] } : {}),
      ...(denyTrial ? { deny: [{ plan: "trial" }] } : {}),
    }),
    [enabled, percent, allowAdmin, denyTrial],
  );

  const results = PEOPLE.map((p) => ({
    ...p,
    bucket: bucketOf(p.key),
    on: evaluateFlag(rule, ctxOf(p), "new-expense-ui"),
  }));
  const onCount = results.filter((r) => r.on).length;

  // ── A/B バリアント ──
  const abRule: FlagRule = React.useMemo(
    () => ({ enabled: true, variants: [{ name: "A（現行）", weight: 50 }, { name: "B（新デザイン）", weight: 50 }] }),
    [],
  );
  const abResults = PEOPLE.map((p) => ({ ...p, variant: selectVariant(abRule, ctxOf(p), "checkout-ab") }));

  // ── 安定ハッシュの確認 ──
  const [probeKey, setProbeKey] = React.useState("u-yamada");
  const [probeLog, setProbeLog] = React.useState<number[]>([]);

  function probe() {
    // 何度呼んでも同じ値になることを見せる
    setProbeLog([bucketOf(probeKey), bucketOf(probeKey), bucketOf(probeKey)]);
  }

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>フィーチャーフラグ</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        新機能を<strong>一部の人にだけ出す</strong>、まずければ<strong>デプロイせず止める</strong>。
        「リリース＝全員に公開」だと、問題が出たときに切り戻すしかありません。
        <code>@platform/flags</code> は判定だけを持つ純ロジックなので、
        <strong>この画面でそのまま動いています</strong>。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>① 段階リリース</h2>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Checkbox checked={enabled} onCheckedChange={(v) => setEnabled(!!v)} />
            <code>enabled</code>（kill switch）
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--color-muted)" }}>
            <code>rolloutPercent</code>
            <Slider value={[percent]} min={0} max={100} step={5} onValueChange={([v]) => setPercent(v ?? 0)} style={{ width: 160 }} />
            <span style={{ ...mono, width: 34, textAlign: "right" }}>{percent}%</span>
          </label>
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Checkbox checked={allowAdmin} onCheckedChange={(v) => setAllowAdmin(!!v)} />
            <code>allow: [{"{"} role: &quot;admin&quot; {"}"}]</code>
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Checkbox checked={denyTrial} onCheckedChange={(v) => setDenyTrial(!!v)} />
            <code>deny: [{"{"} plan: &quot;trial&quot; {"}"}]</code>
          </label>
        </div>

        <div style={{ fontSize: 13, marginBottom: 10 }}>
          <b>{onCount}</b> / {PEOPLE.length} 人に公開中
        </div>

        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 4 }}>利用者</th>
              <th style={{ padding: 4 }}>属性</th>
              <th style={{ padding: 4 }}>バケット</th>
              <th style={{ padding: 4 }}>判定</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.key} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 4 }}>{r.name}</td>
                <td style={{ padding: 4, color: "var(--color-muted)", ...mono }}>
                  {r.role}
                  {r.plan === "trial" && <span style={{ color: "var(--color-warning)" }}> / trial</span>}
                </td>
                <td style={{ padding: 4, ...mono }}>
                  <span style={{ color: r.bucket < percent ? "var(--color-primary)" : "var(--color-muted)" }}>{r.bucket}</span>
                </td>
                <td style={{ padding: 4, fontWeight: 700, color: r.on ? "var(--color-success)" : "var(--color-muted)" }}>
                  {r.on ? "ON" : "OFF"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>スライダーを動かしてください。</strong>バケットが <code>rolloutPercent</code> 未満の人だけ ON になります。
          <strong>0% にしても管理者は ON のまま</strong>（<code>allow</code> が優先）——
          <strong>作った本人が確認できないと、段階リリースは回りません</strong>。
          <br />
          <strong>試用アカウントは何%にしても OFF</strong>（<code>deny</code> は <code>allow</code> より優先）。
          <br />
          <code>enabled</code> を外すと<strong>全員 OFF</strong>。これが kill switch で、
          <strong>デプロイせずに機能を止められます</strong>。障害時に効きます。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>② 同じ人は、いつも同じ結果</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10, lineHeight: 1.8 }}>
          <strong>ここが乱数ではいけない理由です。</strong>
          <code>Math.random() &lt; 0.3</code> で判定すると、<strong>ページを開くたびに新 UI と旧 UI が入れ替わります</strong>。
          A/B テストの結果も濁ります（「昨日は A、今日は B」）。
          <code>bucketOf()</code> は key の安定ハッシュ（FNV-1a）なので、
          <strong>何度呼んでも、サーバが変わっても、同じ値</strong>です。
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Input value={probeKey} onChange={(e) => setProbeKey(e.target.value)} style={{ width: 180 }} />
          <Button size="sm" onClick={probe}>3 回続けて評価</Button>
          {probeLog.length > 0 && (
            <span style={{ ...mono, fontSize: 14 }}>
              → {probeLog.join(" , ")} <span style={{ color: "var(--color-success)", marginLeft: 6 }}>全部同じ</span>
            </span>
          )}
        </div>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>③ A/B バリアント</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10 }}>
          重み付きで振り分けます。<strong>ON/OFF ではなく「どちらを見せるか」</strong>のとき。
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {abResults.map((r) => (
            <span
              key={r.key}
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 999,
                border: "1px solid var(--color-border)",
                background: "var(--color-bg)",
              }}
            >
              {r.name}: <b>{r.variant ?? "—"}</b>
            </span>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10 }}>
          こちらも安定ハッシュなので、<strong>同じ人は常に同じバリアント</strong>を見ます。
          計測は <code>/analytics</code> と組み合わせます。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>使い方</h2>
        <pre style={{ ...mono, background: "var(--color-bg)", padding: 12, borderRadius: "var(--radius)", margin: 0, lineHeight: 1.7, overflowX: "auto" }}>
{`import { createFlags, createRemoteProvider } from "@platform/flags";

// 定義は DB や設定サービスから。**デプロイなしで変えられるのが要点**
const flags = createFlags(createRemoteProvider(() => fetchFlagsFromDb()));

if (await flags.isEnabled("new-expense-ui", { key: user.id, attributes: { role: user.role } })) {
  // 新 UI
}`}
        </pre>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>未定義のフラグは <code>false</code> を返します</strong>（安全側）。
          タイポで機能が勝手に出ることはありません。
          <br />
          定義を DB に置けば、<strong>障害時に SQL 1 本で止められます</strong>。
          コードに <code>if (true)</code> と書くのとは、そこが違います。
        </p>
      </div>
    </>
  );
}
