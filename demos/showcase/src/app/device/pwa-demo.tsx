"use client";
/**
 * PWA（ホーム画面から開く・オフライン・通知）のデモ。
 *
 * **いま開いている端末で判定が変わる**ので、スマートフォンで開くと違う結果になる。
 * iOS と Android で扱いが異なる部分（インストールの促し方・通知の可否）を、
 * 実際の userAgent で確かめられるようにしている。
 */
import * as React from "react";
import {
  buildWebManifest, checkInstallable, installGuidance,
  buildServiceWorker, pushAvailability, shouldAskPushPermission,
} from "@platform/mobile";
import { Badge, Alert, Input, Select, Checkbox } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 11.5, whiteSpace: "pre-wrap", wordBreak: "break-word" };
const lb: React.CSSProperties = { display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" };

/** 試せるように、代表的な端末の userAgent を用意する。 */
const AGENTS = [
  { label: "この端末", value: "" },
  { label: "iPhone (Safari)", value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" },
  { label: "Android (Chrome)", value: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120" },
  { label: "パソコン", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120" },
];

export function PwaDemo() {
  const [name, setName] = React.useState("社内システム");
  const [shortName, setShortName] = React.useState("社内");
  const [withIcons, setWithIcons] = React.useState(true);
  const [maskable, setMaskable] = React.useState(true);
  const [agent, setAgent] = React.useState("");
  const [realUa, setRealUa] = React.useState("");
  const [standalone, setStandalone] = React.useState(false);
  const [hasNotify, setHasNotify] = React.useState(false);

  React.useEffect(() => {
    setRealUa(navigator.userAgent);
    // ホーム画面から起動しているか（URL バーが無い状態か）
    setStandalone(window.matchMedia("(display-mode: standalone)").matches);
    setHasNotify("Notification" in window);
  }, []);

  const ua = agent === "" ? realUa : agent;

  const manifest = React.useMemo(() => buildWebManifest({
    name, shortName, themeColor: "#1e40af", backgroundColor: "#ffffff",
    icons: withIcons
      ? [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", ...(maskable ? { purpose: "any maskable" as const } : {}) },
        ]
      : [],
  }), [name, shortName, withIcons, maskable]);

  const warnings = checkInstallable(manifest);
  const guide = installGuidance(ua);
  const push = pushAvailability({ userAgent: ua, isStandalone: standalone, hasNotificationApi: hasNotify });
  const sw = buildServiceWorker({ version: "2026-07-23", precache: ["/", "/offline"], offlineFallback: "/offline" });

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        ネイティブアプリを作らずに、<strong>ホーム画面のアイコンから起動</strong>できるようにする仕組みです。
        オフラインでも画面が出るようにし、通知も受け取れます（端末によって条件が違います）。
      </p>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>1. manifest を組み立てる</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
          <label style={lb}>アプリ名<Input value={name} onChange={(e) => setName(e.target.value)} style={{ width: 180 }} /></label>
          <label style={lb}>短い名前<Input value={shortName} onChange={(e) => setShortName(e.target.value)} style={{ width: 140 }} /></label>
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Checkbox checked={withIcons} onCheckedChange={(v) => setWithIcons(v === true)} />アイコンを付ける
          </label>
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Checkbox checked={maskable} onCheckedChange={(v) => setMaskable(v === true)} disabled={!withIcons} />maskable
          </label>
        </div>

        {warnings.length === 0 ? (
          <Alert variant="success" title="インストールできる条件を満たしています">
            この内容なら、対応ブラウザでホーム画面に追加できます。
          </Alert>
        ) : (
          <Alert variant="warning" title={`インストールできません（${warnings.length} 件）`}>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.9 }}>
              {warnings.map((w, i) => <li key={i}><code>{w.field}</code>: {w.message}</li>)}
            </ul>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              ブラウザは「インストールできない」としか言わないため、<strong>何が足りないかを基盤側で示します</strong>。
            </div>
          </Alert>
        )}

        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 12.5, cursor: "pointer", color: "var(--color-muted)" }}>生成される manifest.json を見る</summary>
          <pre style={{ ...mono, margin: "8px 0 0", padding: 12, borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
{JSON.stringify(manifest, null, 2)}
          </pre>
        </details>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>2. インストールを促す</div>
        <label style={{ ...lb, maxWidth: 260, marginBottom: 12 }}>端末を切り替えて試す
          <Select value={agent} onChange={(e) => setAgent(e.target.value)} options={AGENTS} />
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <Badge variant="secondary">{guide.platform}</Badge>
          {guide.canPrompt
            ? <Badge variant="success">インストールを自動で促せる</Badge>
            : <Badge variant="warning">手順を案内する必要がある</Badge>}
          {standalone && <Badge variant="success">ホーム画面から起動中</Badge>}
        </div>

        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.9 }}>
          {guide.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>

        {guide.platform === "ios" && (
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
            iOS はインストールの確認を出せません。Android と同じ案内を出すと、
            <strong>利用者は何をすればよいか分からなくなります</strong>。端末ごとに文言を変えてください。
          </p>
        )}
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>3. 通知が使えるか</div>
        <div style={{ marginBottom: 10 }}>
          {push.available
            ? <Alert variant="success">この状態なら通知を受け取れます。</Alert>
            : <Alert variant="warning">{push.reason}</Alert>}
        </div>
        <table style={{ borderCollapse: "collapse", fontSize: 12.5 }}>
          <tbody>
            {[
              ["Notification API", hasNotify ? "あり" : "なし"],
              ["ホーム画面から起動", standalone ? "はい" : "いいえ（ブラウザのタブ）"],
              ["いま許可を求めるべきか", shouldAskPushPermission({ permission: "default", didRelevantAction: false }) ? "はい" : "いいえ（文脈が無い）"],
            ].map(([k, v]) => (
              <tr key={k} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: "6px 12px 6px 0", color: "var(--color-muted)" }}>{k}</td>
                <td style={{ padding: "6px 0" }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          開いた直後に許可を求めないでください。何のための通知か分からないまま拒否されると、
          <strong>その後は設定画面から変えてもらうしかありません</strong>（拒否は覚えられます）。
          承認依頼を出した直後など、<strong>通知が要る操作の後</strong>に求めます。
        </p>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>4. オフライン対応（Service Worker）</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.9 }}>
          <li><strong>API はキャッシュしない</strong> — 古い在庫数や承認状態を見せる方が、オフラインで見えないことより害が大きい</li>
          <li><strong>GET 以外は素通し</strong> — 送信・更新をキャッシュすると二重送信になる</li>
          <li><strong>版を変えたら古いキャッシュを捨てる</strong> — 更新したのに古い画面が出る、を防ぐ</li>
          <li><strong>通知を押したら既存のタブへ</strong> — 押すたびにタブが増えない</li>
        </ul>
        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 12.5, cursor: "pointer", color: "var(--color-muted)" }}>生成される sw.js を見る（{sw.split("\n").length} 行）</summary>
          <pre style={{ ...mono, margin: "8px 0 0", padding: 12, borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)", maxHeight: 320, overflow: "auto" }}>{sw}</pre>
        </details>
      </div>

      <Alert variant="info" title="ネイティブアプリが要るのはどんなときか">
        カメラ・バーコード読取・Bluetooth・位置情報は Web の API で扱えます（このタブの他の項目で確認できます）。
        <strong>バックグラウンドでの常時位置取得</strong>、他アプリとの深い連携、オフラインでの大量データ保持が
        必要になったときに、初めてネイティブを検討してください。
      </Alert>
    </div>
  );
}
