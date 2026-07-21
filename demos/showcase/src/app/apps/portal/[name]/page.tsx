/**
 * 基盤ポータルのパッケージ詳細。**関数の説明・引数・戻り値**を一覧で見せる。
 *
 * Server Component で生成物を読む(1.2MB あるのでクライアントへ送らない)。
 * `generateStaticParams` で 106 ページを静的生成するので、実行時のコストはゼロ。
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { PORTAL_REFERENCE, type RefEntry } from "../../../../lib/portal-reference.generated";

/** 106 パッケージ分を静的生成する(SSR で毎回 1.2MB を読まない)。 */
export function generateStaticParams() {
  return PORTAL_REFERENCE.map((p) => ({ name: p.name }));
}

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return { title: `@platform/${name} — 基盤ポータル(デモ)` };
}

const KIND_LABEL: Record<string, string> = {
  function: "関数",
  const: "定数",
  interface: "型",
  type: "型",
  class: "クラス",
  enum: "列挙",
  let: "変数",
};

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 12,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12 };

/** 関数 1 件。説明・シグネチャ・引数・戻り値・例外・使用例。 */
function EntryCard({ e }: { e: RefEntry }) {
  return (
    <div style={box} id={e.name}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <b style={{ fontSize: 14, fontFamily: "monospace" }}>{e.name}</b>
        <span
          style={{
            fontSize: 10,
            padding: "1px 8px",
            borderRadius: 999,
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            color: "var(--color-muted)",
          }}
        >
          {KIND_LABEL[e.kind] ?? e.kind}
        </span>
      </div>

      {e.summary !== "" && <p style={{ fontSize: 13, lineHeight: 1.8, margin: "8px 0 0" }}>{e.summary}</p>}

      {e.signature !== undefined && (
        <pre style={{ ...mono, background: "var(--color-bg)", padding: 10, borderRadius: "var(--radius)", margin: "10px 0 0", overflowX: "auto" }}>
          {e.signature}
        </pre>
      )}

      {e.params !== undefined && e.params.length > 0 && (
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", marginTop: 10 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: "3px 8px 3px 0", width: 140 }}>引数</th>
              <th style={{ padding: "3px 0" }}>説明</th>
            </tr>
          </thead>
          <tbody>
            {e.params.map((p) => (
              <tr key={p.name} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: "4px 8px 4px 0", ...mono, verticalAlign: "top" }}>{p.name}</td>
                <td style={{ padding: "4px 0", color: "var(--color-muted)", lineHeight: 1.7 }}>{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {e.returns !== undefined && (
        <div style={{ display: "flex", gap: 8, fontSize: 12, marginTop: 8 }}>
          <span style={{ color: "var(--color-muted)", width: 132, flexShrink: 0 }}>戻り値</span>
          <span style={{ lineHeight: 1.7 }}>{e.returns}</span>
        </div>
      )}

      {e.throws !== undefined && e.throws.length > 0 && (
        <div style={{ display: "flex", gap: 8, fontSize: 12, marginTop: 6 }}>
          <span style={{ color: "var(--color-muted)", width: 132, flexShrink: 0 }}>例外</span>
          <span style={{ lineHeight: 1.7, color: "var(--color-danger)" }}>{e.throws.join(" / ")}</span>
        </div>
      )}

      {e.example !== undefined && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ fontSize: 12, color: "var(--color-primary)", cursor: "pointer" }}>使用例</summary>
          <pre style={{ ...mono, background: "var(--color-bg)", padding: 10, borderRadius: "var(--radius)", marginTop: 6, overflowX: "auto", lineHeight: 1.7 }}>
            {e.example}
          </pre>
        </details>
      )}
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const pkg = PORTAL_REFERENCE.find((p) => p.name === name);
  if (!pkg) notFound();

  const functions = pkg.entries.filter((e) => e.kind === "function" || e.kind === "const");
  const types = pkg.entries.filter((e) => e.kind === "interface" || e.kind === "type" || e.kind === "enum" || e.kind === "class");
  const documented = functions.filter((e) => e.summary !== "").length;

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
      <Link href="/apps/portal" style={{ fontSize: 12, color: "var(--color-primary)" }}>
        ← 基盤ポータル
      </Link>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", margin: "8px 0 4px" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0, fontFamily: "monospace" }}>@platform/{pkg.name}</h1>
        <span
          style={{
            fontSize: 11,
            padding: "2px 10px",
            borderRadius: 999,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-muted)",
          }}
        >
          {pkg.category}
        </span>
      </div>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 12 }}>{pkg.summary}</p>

      <div style={{ display: "flex", gap: 20, fontSize: 12, color: "var(--color-muted)", marginBottom: 20, flexWrap: "wrap" }}>
        <span>
          関数・定数 <b style={{ color: "var(--color-fg)" }}>{functions.length}</b>
        </span>
        <span>
          型 <b style={{ color: "var(--color-fg)" }}>{types.length}</b>
        </span>
        <span>
          TSDoc <b style={{ color: documented === functions.length ? "var(--color-success)" : "var(--color-warning)" }}>
            {documented} / {functions.length}
          </b>
        </span>
        <span style={{ marginLeft: "auto" }}>
          <code>import {"{ … }"} from &quot;@platform/{pkg.name}&quot;</code>
        </span>
      </div>

      {functions.length > 0 && (
        <>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>関数・定数</h2>
          {functions.map((e) => (
            <EntryCard key={`${e.kind}-${e.name}`} e={e} />
          ))}
        </>
      )}

      {types.length > 0 && (
        <>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "24px 0 10px" }}>型</h2>
          {types.map((e) => (
            <EntryCard key={`${e.kind}-${e.name}`} e={e} />
          ))}
        </>
      )}

      <p style={{ fontSize: 11.5, color: "var(--color-muted)", marginTop: 24, lineHeight: 1.7 }}>
        この内容は <code>packages/{pkg.name}/src</code> の TSDoc から自動生成しています
        （<code>tools/gen-reference.mjs</code> → <code>tools/gen-portal-reference.mjs</code>）。
        <strong>コードを直せばここも変わります</strong>。手で書いた説明ではないので、実装とずれません。
      </p>
    </main>
  );
}
