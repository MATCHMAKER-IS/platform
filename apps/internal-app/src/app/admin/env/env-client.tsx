"use client";
/**
 * 設定(環境変数)の確認画面。障害調査で「今どの設定で動いているか」を見る。
 * 表示は基盤の EnvSettingsTable に任せ、ここはデータ取得に徹する。
 * 秘密値はサーバ側でマスクされて届く(値そのものは画面に来ない)。
 */
import * as React from "react";
import { EnvSettingsTable, type EnvSettingRow } from "@platform/ui";

const GROUP_NOTES: Record<string, string> = {
  基本: "スキーマ検証済み（起動時に必須チェック）",
  秘密: "本番では未設定・脆弱だと起動しません",
  機能: "未設定なら該当機能が無効/モックになります",
};

export function EnvClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [rows, setRows] = React.useState<EnvSettingRow[]>([]);
  const [runtime, setRuntime] = React.useState<{ nodeEnv: string; nodeVersion: string } | undefined>(undefined);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    void (async () => {
      const r = await doFetch("/api/admin/env");
      const d = (await r.json()) as { env?: EnvSettingRow[]; runtime?: { nodeEnv: string; nodeVersion: string }; error?: string };
      if (r.ok && d.env) { setRows(d.env); setRuntime(d.runtime); }
      else setError(d.error ?? "設定の取得に失敗しました");
    })();
  }, [doFetch]);

  if (error) return <div style={{ padding: 40, color: "var(--color-danger, #c00)" }}>{error}</div>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 22 }}>設定の確認</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted, #666)", lineHeight: 1.6 }}>
        起動時に読み込まれた環境変数の状態です。<strong>秘密値（鍵・トークン・パスワード）は伏せられています</strong>が、設定されているかどうかは分かります。
        設定を変えるにはサーバの環境変数（.env）を書き換えて再起動してください。
      </p>
      <EnvSettingsTable rows={rows} groupNotes={GROUP_NOTES} {...(runtime ? { runtime } : {})} />
    </div>
  );
}
