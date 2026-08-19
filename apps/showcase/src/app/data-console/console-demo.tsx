import { DataConsole, type BookingRow } from "../../examples/data-console";

export const metadata = { title: "データ管理画面" };

/** デモ用のサンプル(実アプリでは DB から取る)。 */
const ROWS: BookingRow[] = [
  { id: "B-001", customer: "山田太郎", cast: "佐藤", status: "confirmed", date: "2026-07-16" },
  { id: "B-002", customer: "鈴木花子", cast: "田中", status: "requested", date: "2026-07-16" },
  { id: "B-003", customer: "高橋一郎", cast: "佐藤", status: "completed", date: "2026-07-15" },
  { id: "B-004", customer: "伊藤二郎", cast: "鈴木", status: "cancelled", date: "2026-07-15" },
  { id: "B-005", customer: "渡辺三郎", cast: "田中", status: "confirmed", date: "2026-07-17" },
  { id: "B-006", customer: "中村四郎", cast: "佐藤", status: "requested", date: "2026-07-17" },
  { id: "B-007", customer: "小林五郎", cast: "鈴木", status: "completed", date: "2026-07-14" },
  { id: "B-008", customer: "加藤六郎", cast: "田中", status: "confirmed", date: "2026-07-18" },
];

export function ConsoleDemo() {
  return (
    <div style={{ padding: 16, maxWidth: 1000 }}>
      <h2 style={{ fontSize: 18, margin: "0 0 6px" }}>データ管理画面</h2>
      <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "0 0 16px", lineHeight: 1.8 }}>
        検索 + 外部フィルタ + ソート + ページャの完成形。<strong>一覧画面を作るときのコピー元</strong>です。
        DataTable の組み込み検索では足りない「状態フィルタ」を外部で足す構成を示します。
      </p>
      <DataConsole rows={ROWS} />
    </div>
  );
}
