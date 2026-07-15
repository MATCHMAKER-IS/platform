"use client";
/**
 * 設定(環境変数)の状態表示。障害調査で「今どの設定で動いているか」を見るための表。
 * 値のマスクはサーバ側(@platform/env の maskSecrets)で済ませ、ここは表示に徹する。
 * どのアプリでも使えるよう、データは props で受け取る。
 * @packageDocumentation
 */
import * as React from "react";

/** 設定 1 件の表示用データ。 */
export interface EnvSettingRow {
  /** 変数名。 */
  name: string;
  /** 値(秘密値は "***" にマスク済みで渡すこと)。 */
  value: string;
  /** 設定されているか。 */
  isSet: boolean;
  /** 秘密値か(鍵アイコンを出す)。 */
  secret: boolean;
  /** 区分(グループ見出しに使う)。 */
  group: string;
}

export interface EnvSettingsTableProps {
  /** 表示する設定。 */
  rows: EnvSettingRow[];
  /** 区分ごとの説明(任意)。 */
  groupNotes?: Record<string, string>;
  /** 実行環境の情報(任意)。 */
  runtime?: { nodeEnv: string; nodeVersion: string };
}

/**
 * 設定を区分ごとの表で見せる。値は渡されたまま表示するため、
 * **秘密値は必ずサーバ側でマスクしてから渡すこと**。
 */
export function EnvSettingsTable({ rows, groupNotes, runtime }: EnvSettingsTableProps) {
  const groups = React.useMemo(() => {
    const seen: string[] = [];
    for (const r of rows) if (!seen.includes(r.group)) seen.push(r.group);
    return seen;
  }, [rows]);

  const card: React.CSSProperties = {
    background: "var(--color-surface, #fff)",
    border: "1px solid var(--color-border, #e5e7eb)",
    borderRadius: "var(--radius, 10px)",
    padding: 16,
    marginBottom: 12,
  };

  return (
    <div>
      {runtime && (
        <p style={{ fontSize: 12, color: "var(--color-muted, #888)" }}>
          実行環境: <strong>{runtime.nodeEnv}</strong> / Node {runtime.nodeVersion}
        </p>
      )}
      {groups.map((g) => {
        const list = rows.filter((r) => r.group === g);
        return (
          <div key={g} style={card}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{g}</div>
            {groupNotes?.[g] && <p style={{ fontSize: 11, color: "var(--color-muted, #888)", margin: "2px 0 8px" }}>{groupNotes[g]}</p>}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", color: "var(--color-muted, #888)", fontWeight: 600, padding: "4px 6px" }}>変数</th>
                  <th style={{ textAlign: "left", color: "var(--color-muted, #888)", fontWeight: 600, padding: "4px 6px" }}>値</th>
                  <th style={{ textAlign: "left", color: "var(--color-muted, #888)", fontWeight: 600, padding: "4px 6px", width: 90 }}>状態</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.name} style={{ borderTop: "1px solid var(--color-border, #f3f4f6)" }}>
                    <td style={{ padding: "4px 6px" }}>
                      <code>{r.name}</code>
                      {r.secret && <span style={{ marginLeft: 6, fontSize: 10, color: "var(--color-muted, #999)" }} title="秘密値(マスク済み)">🔒</span>}
                    </td>
                    <td style={{ padding: "4px 6px", color: r.isSet ? "var(--color-fg, #111)" : "var(--color-muted, #bbb)", wordBreak: "break-all" }}>
                      {r.value || "(未設定)"}
                    </td>
                    <td style={{ padding: "4px 6px" }}>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 999,
                          color: "#fff",
                          background: r.isSet ? "var(--color-success, #16a34a)" : "var(--color-muted, #9ca3af)",
                        }}
                      >
                        {r.isSet ? "設定済み" : "未設定"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
