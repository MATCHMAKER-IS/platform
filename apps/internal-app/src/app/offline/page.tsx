/**
 * オフライン時に表示する画面。
 *
 * Service Worker が、ネットワークにもキャッシュにも無いときにこれを返す。
 * 真っ白な画面より、**何が起きていて何ができるか**が分かる方がよい。
 */
export const metadata = { title: "オフライン — 社内システム" };

export default function OfflinePage() {
  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
      <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 12 }}>接続できません</h1>
      <p style={{ fontSize: 13.5, color: "var(--color-muted)", lineHeight: 2 }}>
        ネットワークに繋がっていないため、この画面を表示できませんでした。<br />
        電波の届く場所へ移動するか、Wi-Fi の接続を確認してください。
      </p>
      <div style={{ marginTop: 24, padding: 16, border: "1px solid var(--color-border)", borderRadius: 8, textAlign: "left" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>できること</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.9, color: "var(--color-muted)" }}>
          <li>一度開いた画面は、そのまま見られる場合があります</li>
          <li>入力中の内容は、送信するまで保存されていません</li>
          <li>接続が戻ったら、もう一度開き直してください</li>
        </ul>
      </div>
    </main>
  );
}
