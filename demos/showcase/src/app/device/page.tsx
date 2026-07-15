"use client";
/** クライアント情報のデモ(@platform/device の useClientInfo)。 */
import { useState } from "react";
import { useClientInfo, Button, Badge } from "@platform/ui";
import { requestGeolocation } from "@platform/device";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: ".4rem 0", borderBottom: "1px solid var(--color-border)" }}>
      <span style={{ color: "var(--color-muted)" }}>{k}</span>
      <span style={{ fontFamily: "monospace", textAlign: "right" }}>{v}</span>
    </div>
  );
}

export default function Page() {
  const info = useClientInfo();
  const [geo, setGeo] = useState<string>("(未取得)");

  if (!info) return <main style={{ maxWidth: 560, margin: "3rem auto", padding: "0 1rem" }}>読み込み中...</main>;

  return (
    <main style={{ maxWidth: 560, margin: "3rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>端末・ブラウザ情報</h1>
      <p style={{ color: "var(--color-muted)", marginBottom: "1rem" }}>@platform/device で取得したこの端末の情報です。</p>

      <section style={{ fontSize: ".9rem" }}>
        <Row k="ブラウザ" v={`${info.browser.name ?? "?"} ${info.browser.version ?? ""}`} />
        <Row k="エンジン" v={`${info.engine.name ?? "?"} ${info.engine.version ?? ""}`} />
        <Row k="OS" v={`${info.os.name ?? "?"} ${info.os.version ?? ""}`} />
        <Row k="端末種別" v={<Badge variant="secondary">{info.device.type}</Badge>} />
        <Row k="ハードウェア" v={`${info.hardware.cores ?? "?"}コア / ${info.hardware.memoryGB ?? "?"}GB / タッチ${info.hardware.maxTouchPoints}`} />
        <Row k="画面" v={`${info.screen.width}×${info.screen.height} @${info.screen.pixelRatio}x / ${info.screen.colorDepth}bit`} />
        <Row k="ビューポート" v={`${info.viewport.width}×${info.viewport.height}`} />
        <Row k="向き" v={info.screen.orientation ?? "?"} />
        <Row k="ネットワーク" v={`${info.network.online ? "オンライン" : "オフライン"}${info.network.effectiveType ? ` / ${info.network.effectiveType}` : ""}${info.network.downlinkMbps ? ` / ${info.network.downlinkMbps}Mbps` : ""}`} />
        <Row k="言語 / TZ" v={`${info.locale.language} / ${info.locale.timezone}`} />
        <Row k="配色 / モーション" v={`${info.preferences.colorScheme} / ${info.preferences.reducedMotion ? "低減" : "通常"}`} />
        <Row k="機能" v={`Cookie:${info.capabilities.cookiesEnabled ? "✓" : "✗"} / タッチ:${info.capabilities.touch ? "✓" : "✗"} / PWA:${info.capabilities.standalone ? "✓" : "✗"}`} />
        <Row k="位置情報" v={geo} />
      </section>

      <div style={{ marginTop: "1rem" }}>
        <Button variant="secondary" onClick={async () => {
          const r = await requestGeolocation();
          setGeo(r.ok ? `${r.value.latitude.toFixed(4)}, ${r.value.longitude.toFixed(4)} (±${Math.round(r.value.accuracyMeters)}m)` : r.error.message);
        }}>位置情報を取得(要許可)</Button>
      </div>

      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </main>
  );
}
