/**
 * 見つからない画面。
 */
import Link from "next/link";

export const metadata = { title: "見つかりません — 口座残高" };

export default function NotFound() {
  return (
    <main style={{ maxWidth: 480, margin: "5rem auto", padding: "0 1rem", textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
      <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 10 }}>この画面はありません</h1>
      <p style={{ fontSize: 13.5, color: "var(--color-muted)", lineHeight: 2, margin: "0 0 20px" }}>
        URL が違う可能性があります。<strong>システムの障害ではありません。</strong>
      </p>
      <Link href="/" style={{ fontSize: 13, color: "var(--color-primary)" }}>残高の画面へ</Link>
    </main>
  );
}
