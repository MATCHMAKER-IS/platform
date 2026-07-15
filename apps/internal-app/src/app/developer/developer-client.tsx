"use client";
/** 開発者向けドキュメント。外部API(OpenAPI)・送信Webhookイベント・APIキー発行手順をまとめて表示。 */
import * as React from "react";

interface EventDef { event: string; description: string; payloadExample: Record<string, unknown>; }

export function DeveloperClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [events, setEvents] = React.useState<EventDef[]>([]);
  const [sig, setSig] = React.useState<{ header: string; algorithm: string; eventHeader: string } | null>(null);

  React.useEffect(() => { (async () => { const r = await doFetch("/api/v1/events"); if (r.ok) { const d = (await r.json()) as { events: EventDef[]; signature: typeof sig }; setEvents(d.events); setSig(d.signature); } })(); }, [doFetch]);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-bold">開発者向けドキュメント</h1>

      <section className="mb-6 rounded border border-neutral-200 p-4">
        <h2 className="mb-2 text-lg font-semibold">外部API（v1）</h2>
        <p className="text-sm text-neutral-600">サービスアカウント（APIキー）で認証する外部向け API です。OpenAPI 仕様は下記から取得できます。</p>
        <ul className="mt-2 list-disc pl-5 text-sm">
          <li><a href="/api/v1/openapi" className="text-blue-600 hover:underline">/api/v1/openapi</a>（OpenAPI 3.0 JSON）</li>
          <li><code>GET /api/v1/invoices</code> — 請求一覧（スコープ <code>invoice:read</code>・100回/分）</li>
        </ul>
        <pre className="mt-2 overflow-x-auto rounded bg-neutral-900 p-3 text-xs text-neutral-100">{`curl -H "Authorization: Bearer sk_live_..." \\
  ${typeof window !== "undefined" ? window.location.origin : ""}/api/v1/invoices`}</pre>
      </section>

      <section className="mb-6 rounded border border-neutral-200 p-4">
        <h2 className="mb-2 text-lg font-semibold">APIキーの発行</h2>
        <ol className="list-decimal pl-5 text-sm text-neutral-700">
          <li>管理者で <a href="/admin/service-accounts" className="text-blue-600 hover:underline">/admin/service-accounts</a> を開く</li>
          <li>名前とスコープを指定してキーを発行（平文は発行直後のみ表示）</li>
          <li><code>Authorization: Bearer &lt;キー&gt;</code> ヘッダで API を呼ぶ</li>
        </ol>
      </section>

      <section className="rounded border border-neutral-200 p-4">
        <h2 className="mb-2 text-lg font-semibold">送信Webhook</h2>
        {sig && <p className="mb-2 text-sm text-neutral-600">署名は <code>{sig.header}</code> ヘッダに <code>{sig.algorithm}</code>。イベント種別は <code>{sig.eventHeader}</code> ヘッダ。</p>}
        <table className="w-full text-sm">
          <thead><tr className="border-b border-neutral-200 text-left text-xs text-neutral-500"><th className="px-2 py-1">イベント</th><th className="px-2 py-1">説明</th><th className="px-2 py-1">ペイロード例</th></tr></thead>
          <tbody>{events.map((e) => <tr key={e.event} className="border-b border-neutral-100"><td className="px-2 py-1.5"><code>{e.event}</code></td><td className="px-2 py-1.5">{e.description}</td><td className="px-2 py-1.5"><code className="text-xs">{JSON.stringify(e.payloadExample)}</code></td></tr>)}</tbody>
        </table>
        <p className="mt-2 text-xs text-neutral-500">購読は <a href="/admin/insights" className="text-blue-600 hover:underline">/admin/insights</a> の送信Webhookタブで管理します。</p>
      </section>
    </div>
  );
}
