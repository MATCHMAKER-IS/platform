"use client";
/**
 * ネットワークユーティリティのデモ。基盤の関数を実際に呼んでいる。
 * URL 文字列の操作は @platform/url、ネットワーク層(IP/バックオフ)は @platform/net が担当。
 *
 *  - URL の組み立て/解析（joinUrl / setParams / parseQuery / stringifyQuery）
 *  - 指数バックオフの待ち時間（backoffDelay）
 *  - IP アドレスと CIDR の判定（isValidIpv4 / ipInCidr / isPrivateIp / parseCidr）
 *
 * どれも「自分で書くと地味に間違える」ものばかりなので、基盤に寄せている。
 */
import * as React from "react";
import { backoffDelay, isValidIpv4, ipInCidr, isPrivateIp, parseCidr } from "@platform/net/browser";
import { joinUrl, setParams, parseQuery, stringifyQuery } from "@platform/url";
import { Button, Badge, Input, Select } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" };
const lb: React.CSSProperties = { display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" };
const row: React.CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 };
const outBox: React.CSSProperties = { padding: "8px 10px", borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)" };

type Tab = "url" | "retry" | "ip";
const TABS: { id: Tab; label: string }[] = [
  { id: "url", label: "URL" }, { id: "retry", label: "リトライ" }, { id: "ip", label: "IP / CIDR" },
];

export default function Page() {
  const [tab, setTab] = React.useState<Tab>("url");

  // --- URL ---
  const [base, setBase] = React.useState("https://api.example.co.jp/v1/");
  const [seg, setSeg] = React.useState("invoices/2026");
  const [q, setQ] = React.useState("status=open&page=2&limit=50");

  // --- リトライ ---
  const [baseMs, setBaseMs] = React.useState(200);
  const [factor, setFactor] = React.useState("2");
  const [maxMs, setMaxMs] = React.useState(10000);
  const [jitter, setJitter] = React.useState("0");

  // --- IP ---
  const [ip, setIp] = React.useState("192.168.10.25");
  const [cidr, setCidr] = React.useState("192.168.0.0/16");

  const joined = React.useMemo(() => { try { return joinUrl(base, seg); } catch { return "（入力を確認してください）"; } }, [base, seg]);
  const parsed = React.useMemo(() => { try { return parseQuery(q); } catch { return {}; } }, [q]);
  const withQ = React.useMemo(() => { try { return setParams(joined, { ...parsed, updatedAt: "2026-07-22" }); } catch { return ""; } }, [joined, parsed]);

  const delays = React.useMemo(
    () => Array.from({ length: 6 }, (_, i) => backoffDelay(i + 1, { baseMs, maxMs, factor: Number(factor), jitter: Number(jitter) })),
    [baseMs, maxMs, factor, jitter]);

  const ipOk = isValidIpv4(ip);
  const cidrParsed = parseCidr(cidr);
  const inRange = ipOk && cidrParsed !== null ? ipInCidr(ip, cidr) : null;

  return (
    <main style={{ maxWidth: 820, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>ネットワークユーティリティ</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        リトライの待ち時間と IP レンジの判定は <code>@platform/net</code>、URL の組み立てと解析は <code>@platform/url</code> が担当します（同じ関心事を1か所に集約）。
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {TABS.map((t) => (
          <Button key={t.id} size="sm" variant={tab === t.id ? "primary" : "secondary"} onClick={() => setTab(t.id)}>{t.label}</Button>
        ))}
      </div>

      {tab === "url" && (
        <div style={box}>
          <div style={row}>
            <label style={{ ...lb, flex: "1 1 260px" }}>ベース URL<Input value={base} onChange={(e) => setBase(e.target.value)} /></label>
            <label style={{ ...lb, flex: "1 1 180px" }}>つなげるパス<Input value={seg} onChange={(e) => setSeg(e.target.value)} /></label>
          </div>
          <label style={{ ...lb, marginBottom: 12 }}>クエリ文字列<Input value={q} onChange={(e) => setQ(e.target.value)} /></label>

          <div style={{ display: "grid", gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--color-muted)" }}>joinUrl(base, path) — スラッシュの重複や欠落を気にしなくてよい</div>
              <div style={{ ...outBox, ...mono }}>{joined}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--color-muted)" }}>parseQuery(qs) — クエリをオブジェクトに</div>
              <div style={{ ...outBox, ...mono }}>{JSON.stringify(parsed)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--color-muted)" }}>stringifyQuery(params) — 値のエスケープを含めて組み立て</div>
              <div style={{ ...outBox, ...mono }}>{stringifyQuery({ ...parsed, q: "山田 太郎", flag: true })}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--color-muted)" }}>setParams(url, params) — 既存のクエリを保ったまま追加</div>
              <div style={{ ...outBox, ...mono }}>{withQ}</div>
            </div>
          </div>
        </div>
      )}

      {tab === "retry" && (
        <div style={box}>
          <div style={row}>
            <label style={lb}>初期遅延(ms)<Input type="number" value={baseMs} onChange={(e) => setBaseMs(Number(e.target.value) || 0)} style={{ width: 110 }} /></label>
            <label style={lb}>倍率<Select value={factor} onChange={(e) => setFactor(e.target.value)} options={["1.5", "2", "3"].map((v) => ({ label: `×${v}`, value: v }))} /></label>
            <label style={lb}>上限(ms)<Input type="number" value={maxMs} onChange={(e) => setMaxMs(Number(e.target.value) || 0)} style={{ width: 110 }} /></label>
            <label style={lb}>ジッタ<Select value={jitter} onChange={(e) => setJitter(e.target.value)} options={[{ label: "なし", value: "0" }, { label: "±20%", value: "0.2" }, { label: "±50%", value: "0.5" }]} /></label>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr><th style={th}>試行</th><th style={th}>待ち時間</th><th style={th}>累計</th></tr></thead>
            <tbody>
              {delays.map((d, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={td}>{i + 1} 回目のあと</td>
                  <td style={{ ...td, ...mono }}>{Math.round(d)} ms</td>
                  <td style={{ ...td, color: "var(--color-muted)" }}>{(delays.slice(0, i + 1).reduce((a, b) => a + b, 0) / 1000).toFixed(1)} 秒</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
            失敗のたびに待ち時間を伸ばすことで、落ちている相手に追い打ちをかけずに済みます。
            <strong>ジッタ</strong>は待ち時間を少しゆらす仕組みで、復旧の瞬間に全台が同時再送する「雪崩」を防ぎます。
          </p>
        </div>
      )}

      {tab === "ip" && (
        <div style={box}>
          <div style={row}>
            <label style={lb}>IP アドレス<Input value={ip} onChange={(e) => setIp(e.target.value)} style={{ width: 180 }} /></label>
            <label style={lb}>CIDR<Input value={cidr} onChange={(e) => setCidr(e.target.value)} style={{ width: 180 }} /></label>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 13 }}>
              形式: {ipOk ? <Badge variant="success">正しい IPv4</Badge> : <Badge variant="danger">不正</Badge>}
              {" "}／ 種別: {ipOk ? (isPrivateIp(ip) ? <Badge variant="secondary">プライベート</Badge> : <Badge variant="warning">グローバル</Badge>) : "—"}
            </div>
            <div style={{ fontSize: 13 }}>
              範囲判定: {inRange === null ? "（入力を確認してください）"
                : inRange ? <Badge variant="success">CIDR に含まれる</Badge> : <Badge variant="danger">含まれない</Badge>}
            </div>
            {cidrParsed && (
              <div style={{ ...outBox, ...mono }}>parseCidr → prefix /{cidrParsed.prefix}（{2 ** (32 - cidrParsed.prefix)} アドレス）</div>
            )}
          </div>
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
            社内システムの「社内ネットワークからのみ許可」や、管理画面の接続元制限で使います。
            自前でビット演算を書くと取りこぼしが出やすい部分です。
          </p>
        </div>
      )}
    </main>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", color: "var(--color-muted)", fontWeight: 600, fontSize: 12 };
const td: React.CSSProperties = { padding: "6px 8px" };
