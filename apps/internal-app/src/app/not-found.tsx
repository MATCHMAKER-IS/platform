/**
 * 404 ページ。存在しない URL やデータ未検出時の制御された表示。
 */
import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ padding: "3rem", maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
      <h2 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>ページが見つかりません</h2>
      <p style={{ color: "#666", marginBottom: "1.5rem" }}>お探しのページは移動または削除された可能性があります。</p>
      <Link href="/" style={{ color: "#2563eb" }}>トップへ戻る</Link>
    </div>
  );
}
