import { DataConsole } from "../../examples/data-console";
export const metadata = { title: "データ管理画面" };
export default function Page() {
  return (
    <div style={{ padding: 16, maxWidth: 1000 }}>
      <h2 style={{ fontSize: 18, margin: "0 0 6px" }}>データ管理画面</h2>
      <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "0 0 16px", lineHeight: 1.8 }}>
        検索 + 外部フィルタ + ソート + ページャの完成形。<strong>一覧画面を作るときのコピー元</strong>です。
        DataTable の組み込み検索では足りない「状態フィルタ」を外部で足す構成を示します。
      </p>
      <DataConsole />
    </div>
  );
}
