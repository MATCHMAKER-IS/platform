"use client";
/**
 * 画面ウィジェットのデモ。
 * - 現在日時のリアルタイム時計
 * - 実カウントダウンタイマー（開始/一時停止/リセット・プリセット）
 * - 選択した項目のプロパティを右の固定パネルに出すインスペクタ
 *
 * UI は @platform/ui の部品で組む。
 */
import * as React from "react";
import { Badge, Button, Separator } from "@platform/ui";
import { LiveClock } from "../../components/live-clock";
import { Countdown } from "../../components/countdown";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const PRESETS: { label: string; s: number }[] = [
  { label: "1分", s: 60 },
  { label: "5分", s: 300 },
  { label: "10分", s: 600 },
  { label: "25分", s: 1500 },
];

type Item = { id: string; name: string; category: string; props: Record<string, string> };
const ITEMS: Item[] = [
  { id: "pc-001", name: "ノートPC #001", category: "PC", props: { 管理番号: "PC-001", カテゴリ: "ノートPC", 状態: "貸出中", 購入日: "2024-04-01", 価格: "¥148,000", 保管場所: "本社 3F 開発", 担当者: "山田 太郎", 保証: "2027-03 まで" } },
  { id: "monitor-014", name: "モニタ 27inch", category: "周辺機器", props: { 管理番号: "MON-014", カテゴリ: "モニタ", 状態: "在庫", 購入日: "2023-11-20", 価格: "¥42,800", 保管場所: "倉庫 A-3", 担当者: "—", 保証: "2025-11 まで" } },
  { id: "printer-002", name: "複合機 (経理)", category: "OA機器", props: { 管理番号: "PRN-002", カテゴリ: "複合機", 状態: "稼働中", 購入日: "2022-06-10", 価格: "¥310,000", 保管場所: "本社 2F 経理", 担当者: "経理部", 保証: "リース" } },
  { id: "phone-051", name: "業務スマホ #051", category: "モバイル", props: { 管理番号: "PHN-051", カテゴリ: "スマートフォン", 状態: "貸出中", 購入日: "2025-01-15", 価格: "¥98,000", 保管場所: "—", 担当者: "佐藤 花子", 保証: "2027-01 まで" } },
];

const STATUS_VARIANT: Record<string, "success" | "warning" | "secondary"> = {
  在庫: "success",
  稼働中: "success",
  貸出中: "warning",
};

export default function Page() {
  // カウントダウン
  const [dur, setDur] = React.useState(300);
  const [running, setRunning] = React.useState(false);
  const [resetKey, setResetKey] = React.useState(0);
  const reset = (s: number) => { setDur(s); setRunning(false); setResetKey((k) => k + 1); };

  // インスペクタ
  const [selId, setSelId] = React.useState(ITEMS[0]!.id);
  const cur = ITEMS.find((i) => i.id === selId)!;

  return (
    <main style={{ maxWidth: 960, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 16 }}>画面ウィジェット（時計・タイマー・プロパティ）</h1>

      {/* 時計 */}
      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>現在日時（リアルタイム時計）</h2>
        <LiveClock />
        <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, textAlign: "center" }}>
          1 秒ごとに更新します。上部バーの右上には常に小さい時計も出ています（Windows のタスクバー風）。
        </div>
      </div>

      {/* カウントダウン */}
      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>カウントダウンタイマー</h2>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <Countdown key={resetKey} seconds={dur} running={running} onDone={() => setRunning(false)} style={{ fontSize: 48 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Button size="sm" onClick={() => setRunning((r) => !r)}>{running ? "一時停止" : "開始"}</Button>
          <Button size="sm" variant="secondary" onClick={() => reset(dur)}>リセット</Button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
          {PRESETS.map((p) => (
            <Button
              key={p.s}
              type="button"
              onClick={() => reset(p.s)}
              style={{
                fontSize: 12, padding: "4px 12px", borderRadius: 999, cursor: "pointer",
                border: "1px solid var(--color-border)",
                background: dur === p.s ? "var(--color-primary)" : "var(--color-bg)",
                color: dur === p.s ? "var(--color-primary-fg)" : "var(--color-fg)",
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 12, textAlign: "center" }}>
          残り 1 分を切ると色が変わります。e-learning の「残り学習時間」もこの部品で表示しています。
        </div>
      </div>

      <Separator style={{ margin: "8px 0 16px" }} />

      {/* プロパティ・インスペクタ */}
      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>プロパティ・インスペクタ</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 12, lineHeight: 1.7 }}>
          左の一覧から選ぶと、右の固定パネルにその項目のプロパティが並びます（IDE の「プロパティウィンドウ」風）。
        </p>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* 左: 一覧 */}
          <ul style={{ listStyle: "none", margin: 0, padding: 0, flex: 1, minWidth: 220 }}>
            {ITEMS.map((it) => {
              const active = it.id === selId;
              return (
                <li key={it.id}>
                  <Button
                    type="button"
                    onClick={() => setSelId(it.id)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                      width: "100%", textAlign: "left", cursor: "pointer",
                      padding: "8px 12px", marginBottom: 6, borderRadius: "var(--radius)",
                      border: "1px solid var(--color-border)",
                      background: active ? "var(--color-primary)" : "var(--color-bg)",
                      color: active ? "var(--color-primary-fg)" : "var(--color-fg)",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</span>
                    <span style={{ fontSize: 11, opacity: 0.8 }}>{it.category}</span>
                  </Button>
                </li>
              );
            })}
          </ul>

          {/* 右: 固定プロパティパネル */}
          <aside
            style={{
              width: 300,
              flexShrink: 0,
              position: "sticky",
              top: 60,
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius)",
              background: "var(--color-bg)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{cur.name}</span>
              {cur.props["状態"] && <Badge variant={STATUS_VARIANT[cur.props["状態"]] ?? "secondary"}>{cur.props["状態"]}</Badge>}
            </div>
            <dl style={{ margin: 0, padding: "4px 0" }}>
              {Object.entries(cur.props).map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 8, padding: "6px 12px", fontSize: 12, borderBottom: "1px solid var(--color-border)" }}>
                  <dt style={{ width: 84, flexShrink: 0, color: "var(--color-muted)" }}>{k}</dt>
                  <dd style={{ margin: 0, fontWeight: 500, wordBreak: "break-all" }}>{v}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </div>
    </main>
  );
}
