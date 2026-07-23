"use client";
/** 管理: 秘密情報（暗号化保存）とフィーチャーフラグ（キルスイッチ/割合/バリアント）を設定。 */
import * as React from "react";
import { Button, Input, Textarea } from "@platform/ui";

interface SecretMeta { name: string; updatedAt: string; }
type FlagRule = boolean | { enabled?: boolean; rolloutPercent?: number; variants?: { name: string; weight: number }[] };

export function PlatformClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [tab, setTab] = React.useState("secrets");
  const [secrets, setSecrets] = React.useState<SecretMeta[]>([]);
  const [sName, setSName] = React.useState("");
  const [sValue, setSValue] = React.useState("");
  const [flags, setFlags] = React.useState<Record<string, FlagRule>>({});
  const [flagJson, setFlagJson] = React.useState("");
  const [msg, setMsg] = React.useState("");

  const loadSecrets = React.useCallback(async () => { const r = await doFetch("/api/admin/secrets"); if (r.ok) setSecrets(((await r.json()) as { secrets: SecretMeta[] }).secrets); }, [doFetch]);
  const loadFlags = React.useCallback(async () => { const r = await doFetch("/api/admin/flags"); if (r.ok) { const d = (await r.json()) as { flags: Record<string, FlagRule> }; setFlags(d.flags); setFlagJson(JSON.stringify(d.flags, null, 2)); } }, [doFetch]);
  React.useEffect(() => { if (tab === "secrets") void loadSecrets(); else void loadFlags(); }, [tab, loadSecrets, loadFlags]);

  const saveSecret = async () => {
    setMsg("");
    if (!sName || !sValue) { setMsg("名前と値を入力してください"); return; }
    const r = await doFetch("/api/admin/secrets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: sName, value: sValue }) });
    if (r.ok) { setMsg(`「${sName}」を暗号化保存しました`); setSName(""); setSValue(""); await loadSecrets(); } else setMsg("保存に失敗しました");
  };
  const saveFlags = async () => {
    setMsg("");
    let parsed: unknown;
    try { parsed = JSON.parse(flagJson); } catch { setMsg("JSON が不正です"); return; }
    const r = await doFetch("/api/admin/flags", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed) });
    if (r.ok) { setMsg("フラグ定義を更新しました"); await loadFlags(); } else setMsg("更新に失敗しました");
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-bold">秘密情報・フラグ</h1>
      <div className="mb-4 flex gap-1 border-b border-neutral-200">
        {[["secrets", "秘密情報"], ["flags", "フィーチャーフラグ"]].map(([k, l]) => <Button key={k} onClick={() => setTab(k!)} className={`px-3 py-2 text-sm ${tab === k ? "border-b-2 border-neutral-900 font-medium" : "text-neutral-500"}`}>{l}</Button>)}
      </div>
      {msg && <p className="mb-3 rounded bg-neutral-100 px-3 py-2 text-sm text-neutral-700">{msg}</p>}

      {tab === "secrets" && (
        <div>
          <div className="mb-4 rounded border border-neutral-200 p-4">
            <p className="mb-2 text-xs text-neutral-500">外部API資格情報やWebhook secretを暗号化して保存します（値は保存後に表示できません）。同名で保存するとローテーションになります。</p>
            <div className="grid grid-cols-3 gap-2">
              <Input value={sName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSName(e.target.value)} placeholder="名前 (例 STRIPE_KEY)" className="rounded border border-neutral-300 px-2 py-1 text-sm" />
              <Input value={sValue} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSValue(e.target.value)} placeholder="値" type="password" className="rounded border border-neutral-300 px-2 py-1 text-sm" />
              <Button onClick={saveSecret} className="rounded bg-neutral-900 px-3 py-1 text-sm text-white">保存/ローテーション</Button>
            </div>
          </div>
          <ul className="divide-y divide-neutral-100 rounded border border-neutral-200">
            {secrets.map((s) => <li key={s.name} className="flex items-center justify-between px-3 py-2 text-sm"><code>{s.name}</code><span className="text-xs text-neutral-400">更新: {s.updatedAt.slice(0, 10)}</span></li>)}
            {secrets.length === 0 && <li className="px-3 py-6 text-center text-sm text-neutral-500">秘密情報はありません。</li>}
          </ul>
        </div>
      )}

      {tab === "flags" && (
        <div className="rounded border border-neutral-200 p-4">
          <p className="mb-2 text-xs text-neutral-500">フラグ定義（JSON）。<code>{'{ "flag": { "enabled": true, "rolloutPercent": 20 } }'}</code> の形式。enabled:false で緊急停止、rolloutPercent で段階的ロールアウト、variants で A/B。</p>
          <Textarea value={flagJson} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFlagJson(e.target.value)} rows={12} className="block w-full rounded border border-neutral-300 px-2 py-1 font-mono text-xs" />
          <Button onClick={saveFlags} className="mt-2 rounded bg-neutral-900 px-4 py-2 text-sm text-white">フラグを更新</Button>
        </div>
      )}
    </div>
  );
}
