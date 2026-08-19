/**
 * 見つからない画面（404）。
 *
 * 用意しないと**素っ気ない既定の画面**が出て、
 * 「壊れたのか、URL が違うのか」が利用者に分からない。
 *
 * ここで示すのは 3 つ:
 *   - 何が起きたか（URL が違う。システムの障害ではない）
 *   - どこへ戻れるか
 *   - よく使う入口
 */
import Link from "next/link";

export const metadata = { title: "見つかりません — 基盤デモ" };

const LINKS = [
  { href: "/", label: "デモの一覧へ" },
  { href: "/core", label: "作法（Result / AppError）" },
  { href: "/ui", label: "UI 部品の一覧" },
  { href: "/faq", label: "よくある質問" },
];

export default function NotFound() {
  return (
    <main style={{ maxWidth: 520, margin: "5rem auto", padding: "0 1rem", textAlign: "center" }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>🔍</div>
      <h1 style={{ fontSize: "1.35rem", fontWeight: 700, marginBottom: 10 }}>この画面はありません</h1>
      <p style={{ fontSize: 13.5, color: "var(--color-muted)", lineHeight: 2, margin: "0 0 24px" }}>
        URL が違うか、デモが移動または削除された可能性があります。
        <br />
        <strong>システムの障害ではありません。</strong>
      </p>

      <div
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius)",
          padding: 16,
          textAlign: "left",
          background: "var(--color-surface)",
        }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>よく使う入口</div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} style={{ fontSize: 13, color: "var(--color-primary)" }}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <p style={{ fontSize: 11.5, color: "var(--color-muted)", margin: "12px 0 0", lineHeight: 1.8 }}>
          探しているものが分からないときは、<strong>⌘K（Ctrl+K）</strong>で全デモを検索できます。
        </p>
      </div>
    </main>
  );
}
