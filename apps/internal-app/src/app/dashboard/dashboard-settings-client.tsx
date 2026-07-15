"use client";
/**
 * ダッシュボード設定画面。/api/dashboard/preferences を GET/PUT し、表示ウィジェットを編集する。
 * @packageDocumentation
 */
import * as React from "react";
import { DashboardSettings } from "@platform/ui";

const ALL_WIDGETS = [
  { key: "unread", label: "未読通知" },
  { key: "pendingApprovals", label: "承認待ち（全体）" },
  { key: "myTasks", label: "自分の申請（承認待ち）" },
  { key: "recentFiles", label: "最近のファイル" },
  { key: "recentNotifications", label: "最近の通知" },
  { key: "recentAudit", label: "監査イベント" },
  { key: "receivables", label: "売掛残高" },
  { key: "inventoryAlerts", label: "在庫アラート" },
];

export interface DashboardSettingsClientProps {
  fetchImpl?: typeof fetch;
}

export function DashboardSettingsClient({ fetchImpl }: DashboardSettingsClientProps) {
  const [visible, setVisible] = React.useState<string[]>(ALL_WIDGETS.map((w) => w.key));
  const [saving, setSaving] = React.useState(false);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const res = await doFetch("/api/dashboard/preferences");
      if (!alive || !res.ok) return;
      const data = (await res.json()) as { preference: { widgets: string[] } };
      setVisible(data.preference.widgets);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onSave = async () => {
    setSaving(true);
    await doFetch("/api/dashboard/preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ widgets: visible }) });
    setSaving(false);
  };

  return <DashboardSettings all={ALL_WIDGETS} visible={visible} onChange={setVisible} onSave={onSave} saving={saving} />;
}
