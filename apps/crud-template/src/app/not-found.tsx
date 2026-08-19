/**
 * 見つからない画面（404）。
 *
 * 「壊れたのか、URL が違うのか」を利用者が判断できるようにする。
 */
import Link from "next/link";

export const metadata = { title: "見つかりません" };

export default function NotFound() {
  return (
    <main style={{ maxWidth: 480, margin: "5rem auto", padding: "0 1rem", textAlign: "center" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🔍</div>
      <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 10 }}>この画面はありません</h1>
      <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", lineHeight: 1.5, margin: "0 0 20px" }}>
        URL が違うか、画面が移動または削除された可能性があります。
        <br />
        <strong>システムの障害ではありません。</strong>
      </p>
      <Link href="/" style={{ fontSize: "0.8125rem", color: "var(--color-primary)" }}>最初の画面へ戻る</Link>
    </main>
  );
}
