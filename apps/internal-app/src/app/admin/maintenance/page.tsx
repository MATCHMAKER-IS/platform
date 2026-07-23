"use client";
/**
 * メンテナンス切り替え 管理画面(管理者のみ)。
 * トグルで即オン/オフ。復旧予定・予定期間・メッセージも設定でき、DB に保存されると
 * middleware が(数秒以内に)反映する。デプロイや再起動は不要。
 */
import { useEffect, useState } from "react";
import { Badge, Button, Card, Input, Switch } from "@platform/ui";

interface MaintenanceState {
  enabled: boolean;
  estimatedRecovery?: string;
  message?: string;
  window?: { start: string; end: string };
  updatedBy?: string;
  updatedAt?: string;
}

export default function MaintenancePage() {
  const [state, setState] = useState<MaintenanceState | null>(null);
  const [recovery, setRecovery] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/maintenance")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("読み込みに失敗しました(管理者権限が必要です)"))))
      .then((s: MaintenanceState) => { setState(s); setRecovery(s.estimatedRecovery ?? ""); setMessage(typeof s.message === "string" ? s.message : ""); })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  async function save(enabled: boolean) {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled, estimatedRecovery: recovery || undefined, message: message || undefined }),
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      setState(await res.json());
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  }

  if (error && !state) return <main style={{ padding: 24 }}><p style={{ color: "#dc2626" }}>{error}</p></main>;
  if (!state) return <main style={{ padding: 24 }}>読み込み中…</main>;

  return (
    <main style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>メンテナンス切り替え</h1>
      <Card style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ fontWeight: 600 }}>メンテナンスモード</div>
            <div style={{ fontSize: ".85rem", color: "#6b7280" }}>
              {state.enabled
                ? <Badge variant="danger">稼働中(利用者はメンテ画面)</Badge>
                : <Badge variant="secondary">通常運用</Badge>}
            </div>
          </div>
          <Switch checked={state.enabled} disabled={saving} onCheckedChange={(v: boolean) => save(v)} />
        </div>

        <label style={{ display: "block", marginBottom: ".75rem" }}>
          <span style={{ fontSize: ".85rem", color: "#374151" }}>復旧予定(画面に表示)</span>
          <Input value={recovery} onChange={(e) => setRecovery(e.target.value)} placeholder="例: 本日 22:00 頃"
            style={{ display: "block", width: "100%", padding: ".5rem", marginTop: ".25rem", border: "1px solid #e5e7eb", borderRadius: 8 }} />
        </label>
        <label style={{ display: "block", marginBottom: "1rem" }}>
          <span style={{ fontSize: ".85rem", color: "#374151" }}>お知らせメッセージ(任意)</span>
          <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="例: システム更新のため一時停止しています"
            style={{ display: "block", width: "100%", padding: ".5rem", marginTop: ".25rem", border: "1px solid #e5e7eb", borderRadius: 8 }} />
        </label>

        <div style={{ display: "flex", gap: ".5rem" }}>
          <Button onClick={() => save(state.enabled)} disabled={saving}>設定を保存</Button>
        </div>

        {error ? <p style={{ color: "#dc2626", marginTop: "1rem" }}>{error}</p> : null}
        {state.updatedBy ? (
          <p style={{ fontSize: ".8rem", color: "#9ca3af", marginTop: "1rem" }}>
            最終更新: {state.updatedBy}{state.updatedAt ? ` / ${new Date(state.updatedAt).toLocaleString("ja-JP")}` : ""}
          </p>
        ) : null}
      </Card>
      <p style={{ fontSize: ".8rem", color: "#9ca3af", marginTop: "1rem" }}>
        切り替えは数秒以内に全ページへ反映されます(再起動・デプロイ不要)。管理者と許可 IP は保守中もアクセスできます。
      </p>
    </main>
  );
}
