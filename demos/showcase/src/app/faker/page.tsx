"use client";
/**
 * 日本語ダミーデータ生成のデモ。**@platform/faker の関数を実際に呼んでいる**。
 *
 * 開発・テスト・画面確認のたびに「それっぽいデータ」を手で作るのは無駄が多く、
 * かといって本番データのコピーは事故のもと。シードを固定すれば毎回同じ結果になるので、
 * テストの期待値としても使える。
 */
import * as React from "react";
import { setSeed, seedMany, japaneseName, companyName, email, phoneNumber, address, zipCode } from "@platform/faker";
import { Button, Input, Select, Badge } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
const lb: React.CSSProperties = { display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" };
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", color: "var(--color-muted)", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "6px 8px", fontSize: 12.5 };

type Row = { name: string; company: string; mail: string; tel: string; zip: string; addr: string };

export default function Page() {
  const [seed, setSeedValue] = React.useState(42);
  const [count, setCount] = React.useState("10");
  const [rows, setRows] = React.useState<Row[]>([]);
  const [generatedWith, setGeneratedWith] = React.useState<number | null>(null);

  const generate = React.useCallback((s: number, n: number) => {
    setSeed(s); // 基盤: 乱数の種を固定する
    const data = seedMany(n, (): Row => ({
      name: japaneseName(), company: companyName(), mail: email(),
      tel: phoneNumber(), zip: zipCode(), addr: address(),
    }));
    setRows(data);
    setGeneratedWith(s);
  }, []);

  React.useEffect(() => { generate(42, 10); }, [generate]);

  const toCsv = () => {
    const head = ["氏名", "会社", "メール", "電話", "郵便番号", "住所"];
    const body = rows.map((r) => [r.name, r.company, r.mail, r.tel, r.zip, r.addr]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob(["\uFEFF" + [head.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dummy-${generatedWith ?? 0}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>ダミーデータ生成</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        画面確認やテスト用のデータを作ります。<strong>同じシードなら毎回まったく同じ結果</strong>になるので、
        テストの期待値としても使えます。本番データをコピーして使う必要がなくなります。
      </p>

      <div style={box}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={lb}>シード
            <Input type="number" value={seed} onChange={(e) => setSeedValue(Number(e.target.value) || 0)} style={{ width: 110 }} />
          </label>
          <label style={lb}>件数
            <Select value={count} onChange={(e) => setCount(e.target.value)}
              options={["5", "10", "25", "50"].map((v) => ({ label: `${v} 件`, value: v }))} />
          </label>
          <Button onClick={() => generate(seed, Number(count))}>生成</Button>
          <Button variant="secondary" onClick={() => { const s = Math.floor(Math.random() * 9999); setSeedValue(s); generate(s, Number(count)); }}>
            シードを変えて生成
          </Button>
          <Button variant="secondary" onClick={toCsv} disabled={rows.length === 0}>CSV で保存</Button>
          {generatedWith !== null && <Badge variant="secondary">シード {generatedWith} で生成</Badge>}
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          同じシードで「生成」を押し直すと、まったく同じ一覧が出ます。これがテストで扱いやすい理由です。
        </p>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>生成結果（{rows.length} 件）</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead><tr>
              <th style={th}>氏名</th><th style={th}>会社</th><th style={th}>メール</th>
              <th style={th}>電話</th><th style={th}>郵便番号</th><th style={th}>住所</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={td}>{r.name}</td>
                  <td style={td}>{r.company}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11.5 }}>{r.mail}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11.5 }}>{r.tel}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11.5 }}>{r.zip}</td>
                  <td style={td}>{r.addr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>どこで使うか</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.9 }}>
          <li><strong>画面確認</strong> — 一覧が 1 件のときと 50 件のときで、見た目が壊れないか確かめる</li>
          <li><strong>テスト</strong> — シードを固定して、毎回同じデータで検証する</li>
          <li><strong>デモ・研修</strong> — 本番データを持ち出さずに、それらしい画面を見せる</li>
          <li><strong>負荷試験</strong> — <code>seedMany</code> で大量に作り、<code>@platform/loadtest</code> と組み合わせる</li>
        </ul>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          本番データのコピーは、たとえ社内でも個人情報の持ち出しにあたります。ダミーデータで足りる場面では、そちらを使ってください。
        </p>
      </div>
    </main>
  );
}
