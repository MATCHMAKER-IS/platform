"use client";
/** Bluetooth(BLE)デモ。機器接続→電池残量読み取り。Chrome/Edge + 実機で動作。 */
import { useState } from "react";
import { useBluetooth, Button, Badge } from "@platform/ui";
import { readBatteryLevel, readDeviceInformation } from "@platform/bluetooth";
import { connectReceiptPrinter, createReceipt } from "@platform/print";

export default function Page() {
  const bt = useBluetooth();
  const [battery, setBattery] = useState<number | null>(null);
  const [info, setInfo] = useState<string>("");
  const [printMsg, setPrintMsg] = useState<string>("");

  const connect = async () => {
    setBattery(null);
    await bt.connect({ filters: [{ services: ["battery_service"] }], optionalServices: ["device_information"] });
  };
  const readBattery = async () => {
    if (!bt.connection) return;
    const r = await readBatteryLevel(bt.connection);
    if (r.ok) setBattery(r.value);
  };
  const readInfo = async () => {
    if (!bt.connection) return;
    const r = await readDeviceInformation(bt.connection);
    if (r.ok) setInfo([r.value.manufacturer, r.value.model, r.value.firmware].filter(Boolean).join(" / ") || "(公開なし)");
  };
  const printReceipt = async () => {
    const res = await connectReceiptPrinter();
    if (!res.ok) { setPrintMsg(res.error.message); return; }
    const bytes = createReceipt().init().align("center").bold(true).size(2, 2).line("領収書").size(1, 1).bold(false)
      .align("left").line("合計  ¥1,320").feed(2).cut().build();
    const p = await res.value.print(bytes);
    setPrintMsg(p.ok ? "印刷を送信しました" : p.error.message);
    res.value.disconnect();
  };

  return (
    <main style={{ maxWidth: 460, margin: "3rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Bluetooth(BLE)</h1>
      <p style={{ color: "var(--color-muted)", marginBottom: "1rem" }}>
        @platform/bluetooth のデモ。機器を選択して接続し、電池残量を読みます。
      </p>

      {!bt.supported ? (
        <Badge variant="warning">この環境は Web Bluetooth 非対応です(Chrome/Edge の HTTPS または localhost が必要)</Badge>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: ".75rem" }}>
          {bt.device ? (
            <>
              <div>接続中: <strong>{bt.device.name ?? bt.device.id}</strong></div>
              <div style={{ display: "flex", gap: ".5rem" }}>
                <Button onClick={readBattery}>電池残量を読む</Button>
                <Button variant="secondary" onClick={readInfo}>機器情報</Button>
                <Button variant="secondary" onClick={bt.disconnect}>切断</Button>
              </div>
              {battery != null && <div>電池残量: <strong>{battery}%</strong></div>}
              {info && <div style={{ fontSize: ".9rem", color: "var(--color-muted)" }}>機器情報: {info}</div>}
            </>
          ) : (
            <Button onClick={connect} disabled={bt.connecting}>{bt.connecting ? "接続中..." : "機器に接続"}</Button>
          )}
          {bt.error && <span style={{ color: "var(--color-danger)", fontSize: ".9rem" }}>{bt.error}</span>}
        </div>
      )}
      <hr style={{ margin: "1.5rem 0", border: 0, borderTop: "1px solid var(--color-border)" }} />
      <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>レシートプリンタ(ESC/POS)</h2>
      <Button onClick={printReceipt}>レシートを印刷</Button>
      {printMsg && <p style={{ fontSize: ".9rem", marginTop: ".5rem" }}>{printMsg}</p>}

      <p style={{ marginTop: "1.5rem" }}><a href="/hid">PC周辺機器(WebHID)デモへ →</a></p>
      <p style={{ marginTop: ".5rem" }}><a href="/">← 戻る</a></p>
    </main>
  );
}
