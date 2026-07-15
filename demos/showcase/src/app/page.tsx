/**
 * ショーケースのトップ。どのデモがどの基盤パッケージを使うかを一覧する。
 */
import Link from "next/link";

const demos = [
  { href: "/inquiries", title: "問い合わせフォーム", desc: "入力検証→受付→確認メール→一覧→Excel出力の縦一本",
    packages: ["validation", "ui", "http", "datetime", "mail", "xlsx"] },
  { href: "/security", title: "暗号化と権限(RBAC)", desc: "機密データの暗号化/復号と、ロールごとの権限判定",
    packages: ["crypto", "auth"] },
  { href: "/ui", title: "UI コンポーネント", desc: "ボタン・入力・スライダー・コンボボックス・カルーセルなど共通部品",
    packages: ["ui"] },
  { href: "/register", title: "会員登録フォーム", desc: "zodスキーマ→型安全フォーム。郵便番号から住所を自動入力",
    packages: ["form", "validation", "ui", "address"] },
  { href: "/components", title: "追加コンポーネント", desc: "DataTable・Steps・Toast・各種ダイアログ・テンキー・リッチテキストエディタ",
    packages: ["ui"] },
  { href: "/views", title: "表示切替 / ページネーション", desc: "カード/リスト/ブロック表示・ページネーション・トップに戻る",
    packages: ["ui"] },
  { href: "/charts", title: "グラフ(チャート)", desc: "棒/積み上げ/折れ線/円/レーダー/散布/複合/ガント/ヒートマップ/ツリーマップ/ファネル",
    packages: ["ui"] },
  { href: "/board", title: "ダッシュボード", desc: "グリッドレイアウト・KPIカード・CSV/PNGエクスポート付きチャート",
    packages: ["ui", "csv"] },
  { href: "/live-dashboard", title: "ライブダッシュボード", desc: "DnD配置・レイアウト保存・ポーリング自動更新",
    packages: ["ui", "realtime"] },
  { href: "/ws", title: "WebSocketリアルタイム", desc: "実サーバ連携(pnpm ws:demo)・差分更新",
    packages: ["ui", "realtime"] },
  { href: "/files", title: "アップロード / ダウンロード", desc: "進捗付きアップロード→検証→保存→ダウンロード",
    packages: ["upload", "storage", "ui"] },
  { href: "/device", title: "端末・ブラウザ情報", desc: "OS・ブラウザ・画面・ネットワーク・ロケール・位置情報",
    packages: ["device", "ui"] },
  { href: "/bluetooth", title: "Bluetooth(BLE)", desc: "レシートプリンタ印刷・イヤホン電池/機器情報",
    packages: ["bluetooth", "print", "ui"] },
  { href: "/hid", title: "PC周辺機器(WebHID)", desc: "HID機器に接続して入力レポート受信",
    packages: ["hid", "ui"] },
  { href: "/session", title: "セッション / クッキー", desc: "封緘クッキーセッションでログイン→読み取り→ログアウト",
    packages: ["session", "ui"] },
  { href: "/invoice", title: "帳票(請求書)", desc: "消費税計算(税率別・内税/外税・インボイス)→ 印刷用HTML",
    packages: ["report", "pdf"] },
  { href: "/theme", title: "テーマ機構(スキン)", desc: "11スキンの切り替え・全トークン表示・WCAGコントラスト検査。後から拡張可",
    packages: ["theme", "ui", "color"] },
];

export default function Page() {
  return (
    <main style={{ maxWidth: 760, margin: "3rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700 }}>基盤ショーケース</h1>
      <p style={{ color: "var(--color-muted)", marginTop: ".5rem" }}>
        <code>@platform/*</code> の使い方を動く形で示すデモです。各カードから機能を試せます。
      </p>
      <div style={{ display: "grid", gap: "1rem", marginTop: "1.5rem" }}>
        {demos.map((d) => (
          <Link
            key={d.href}
            href={d.href}
            style={{
              display: "block", padding: "1.25rem", textDecoration: "none", color: "inherit",
              border: "1px solid var(--color-border)", borderRadius: "var(--radius)",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: "1.1rem" }}>{d.title}</div>
            <div style={{ color: "var(--color-muted)", marginTop: ".25rem" }}>{d.desc}</div>
            <div style={{ marginTop: ".75rem", display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
              {d.packages.map((p) => (
                <span key={p} style={{
                  fontSize: ".75rem", padding: ".15rem .5rem", borderRadius: "999px",
                  background: "#f1f5f9", color: "var(--color-muted)",
                }}>@platform/{p}</span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
