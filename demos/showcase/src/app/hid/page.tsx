"use client";
/** WebHID(PC周辺機器)デモ。機器に接続し入力レポートを受信。 */
import { useHid, Button, Badge } from "@platform/ui";

export default function Page() {
  const hid = useHid();
  return (
    <main style={{ maxWidth: 460, margin: "3rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>PC周辺機器(WebHID)</h1>
      <p style={{ color: "var(--color-muted)", marginBottom: "1rem" }}>
        @platform/hid のデモ。HID機器(キーボード・スキャナ等)に接続して入力レポートを受信します。
      </p>
      {!hid.supported ? (
        <Badge variant="warning">この環境は WebHID 非対応です(Chrome/Edge が必要)</Badge>
      ) : hid.device ? (
        <div style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}>
          <div>接続中: <strong>{hid.device.productName || `${hid.device.vendorId.toString(16)}:${hid.device.productId.toString(16)}`}</strong></div>
          <div style={{ fontFamily: "monospace", fontSize: ".85rem" }}>
            入力: {hid.lastReport ? `#${hid.lastReport.reportId} [${hid.lastReport.bytes.join(", ")}]` : "(待機中…機器を操作してください)"}
          </div>
          <Button variant="secondary" onClick={hid.disconnect}>切断</Button>
        </div>
      ) : (
        <Button onClick={() => hid.connect()} disabled={hid.connecting}>{hid.connecting ? "接続中..." : "HID機器に接続"}</Button>
      )}
      {hid.error && <p style={{ color: "var(--color-danger)", fontSize: ".9rem", marginTop: ".5rem" }}>{hid.error}</p>}
      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </main>
  );
}
