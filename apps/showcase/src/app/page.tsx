/**
 * 統合デモサイトのトップ。
 *
 * **区分ごとにまとめて見せる**(基盤デモ / アプリデモ / 使用例)。
 * 1 サイトだが、利用者には別物として映るようにする。
 */
import Link from "next/link";
import { SECTIONS, allDemos } from "../lib/nav";
import { DevGuide } from "../components/dev-guide";

export default function Page() {
  const total = allDemos().length;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 64px" }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, margin: "0 0 8px" }}>基盤デモ</h1>
        <p style={{ fontSize: 14, color: "var(--color-muted)", margin: 0, lineHeight: 1.8 }}>
          社内基盤(<code>@platform/*</code>)で何ができるかを、動く画面で見せます。
          <br />
          全 {total} デモ。すべて <strong>DB 不要</strong>(メモリ・モックデータ)で動きます。
        </p>
      </header>

      <DevGuide />

      {SECTIONS.map((section) => (
        <section key={section.title} id={section.title} style={{ marginBottom: 40 }}>
          <div style={{ marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid var(--color-border)" }}>
            <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>
              {section.title}
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--color-muted)", marginLeft: 8 }}>
                {section.items.length} 件
              </span>
            </h2>
            <p style={{ fontSize: 12.5, color: "var(--color-muted)", margin: 0 }}>{section.description}</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {section.items.map((demo) => (
              <Link
                key={demo.href + demo.title}
                href={demo.href}
                style={{
                  display: "block",
                  padding: 14,
                  borderRadius: "var(--radius, 10px)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  textDecoration: "none",
                  color: "var(--color-fg)",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{demo.title}</div>
                <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.6, marginBottom: 8 }}>
                  {demo.desc}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {demo.packages.map((p) => (
                    <span
                      key={p}
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 999,
                        background: "var(--color-bg)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-muted)",
                      }}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <footer style={{ marginTop: 48, paddingTop: 16, borderTop: "1px solid var(--color-border)", fontSize: 12, color: "var(--color-muted)", lineHeight: 1.8 }}>
        <strong>このサイトについて</strong>
        <br />
        アプリデモは、実際の業務アプリ(<code>apps/</code>)の画面を<strong>モックデータで再現</strong>したものです。
        実物は DB を使いますが、このサイトは DB を持たないため、単体でデプロイできます。
      </footer>
    </div>
  );
}
