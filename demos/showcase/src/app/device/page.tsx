"use client";
/** デバイス連携の統合デモ（端末情報・Bluetooth・WebHID をタブでまとめたもの）。 */
import * as React from "react";
import { Button } from "@platform/ui";
import { DeviceInfoDemo } from "./info-demo";
import { BluetoothDemo } from "./bluetooth-demo";
import { HidDemo } from "./hid-demo";
import { BarcodeDemo } from "./barcode-demo";
import { OsNotifyDemo } from "./osnotify-demo";
import { PwaDemo } from "./pwa-demo";

const TABS = [
  { id: "info", label: "端末・ブラウザ情報", Comp: DeviceInfoDemo },
  { id: "bluetooth", label: "Bluetooth（BLE）", Comp: BluetoothDemo },
  { id: "hid", label: "WebHID（周辺機器）", Comp: HidDemo },
  { id: "barcode", label: "QR・バーコード", Comp: BarcodeDemo },
  { id: "osnotify", label: "OS通知", Comp: OsNotifyDemo },
  { id: "pwa", label: "PWA（ホーム画面）", Comp: PwaDemo },
] as const;

export default function Page() {
  const [tab, setTab] = React.useState<string>("info");
  const Active = (TABS.find((t) => t.id === tab) ?? TABS[0]).Comp;
  return (
    <main style={{ maxWidth: 1000, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 12 }}>デバイス連携（情報/BLE/HID/QR/通知）</h1>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, borderBottom: "1px solid var(--color-border)", paddingBottom: 10 }}>
        {TABS.map((t) => (
          <Button key={t.id} type="button" onClick={() => setTab(t.id)}
            style={{ fontSize: 13, padding: "6px 14px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--color-border)", background: tab === t.id ? "var(--color-primary)" : "var(--color-bg)", color: tab === t.id ? "var(--color-primary-fg)" : "var(--color-fg)" }}>
            {t.label}</Button>))}
      </div>
      <Active />
    </main>
  );
}
