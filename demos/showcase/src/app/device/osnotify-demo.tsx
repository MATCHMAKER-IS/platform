"use client";
/**
 * OS通知のデモ（@platform/os-notify 相当の「コマンド生成」をローカルで再現）。
 * タイトル・本文から OS 別の通知コマンドを組み立てる。実行中マシン自身への通知・音向け。
 */
import * as React from "react";
import { Button, Badge, Alert, Input } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" };
const esc = (s: string) => s.replace(/"/g, '\\"');
type OS = "windows" | "macos" | "linux";
function buildCmd(os: OS, title: string, message: string): string {
  if (os === "windows") return `powershell -Command "New-BurntToastNotification -Text '${title.replace(/'/g, "''")}','${message.replace(/'/g, "''")}'"`;
  if (os === "macos") return `osascript -e 'display notification "${esc(message)}" with title "${esc(title)}"'`;
  return `notify-send "${esc(title)}" "${esc(message)}"`;
}
const OS_LABEL: Record<OS, string> = { windows: "Windows", macos: "macOS", linux: "Linux" };

export function OsNotifyDemo() {
  const [title, setTitle] = React.useState("バッチ完了");
  const [message, setMessage] = React.useState("月次集計が正常に終了しました");
  const [log, setLog] = React.useState<{ at: number; title: string }[]>([]);

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 16 }}>OS通知（デスクトップ通知・音）</h1>
      <div style={box}>
        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ fontSize: 12 }}><div style={{ color: "var(--color-muted)", marginBottom: 4 }}>タイトル</div><Input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label style={{ fontSize: 12 }}><div style={{ color: "var(--color-muted)", marginBottom: 4 }}>本文</div><Input value={message} onChange={(e) => setMessage(e.target.value)} /></label>
        </div>
        <div style={{ marginTop: 12 }}><Button onClick={() => setLog((l) => [{ at: Date.now(), title }, ...l].slice(0, 6))}>通知を送る（ログに記録）</Button></div>
      </div>
      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>OS別の生成コマンド</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(["windows", "macos", "linux"] as OS[]).map((os) => (
            <div key={os}>
              <Badge variant="secondary">{OS_LABEL[os]}</Badge>
              <div style={{ ...mono, padding: 8, marginTop: 4, background: "var(--color-bg)", borderRadius: "var(--radius)", border: "1px solid var(--color-border)" }}>{buildCmd(os, title, message)}</div>
            </div>))}
        </div>
      </div>
      {log.length > 0 && (<div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>通知ログ</div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {log.map((l) => (<li key={l.at} style={{ fontSize: 12, display: "flex", gap: 8 }}><span>🔔 {l.title}</span><span style={{ color: "var(--color-muted)", marginLeft: "auto" }}>{new Date(l.at).toLocaleTimeString("ja-JP")}</span></li>))}
        </ul></div>)}
      <Alert variant="info" title="実基盤では"><code>@platform/os-notify</code> は「実行中のマシン自身」に通知・音を出します（常駐ツール・RPA・バッチの完了通知）。外部サービスへの通知は <code>@platform/notify</code> が担当。</Alert>
    </>
  );
}
