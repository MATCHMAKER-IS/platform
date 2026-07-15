/**
 * MCP ツール定義。社内データ(請求/取引先/在庫/監査/売上レポート)と Zoho CRM を、
 * Claude Desktop / Claude Code などの MCP クライアントへ「ツール」として公開する。
 * 依存はすべて注入(DI)なので実ストア無しで検証できる。実行時の配線は apps/internal-app/mcp/server.mts。
 * @packageDocumentation
 */
import { errorResult, jsonResult, textResult, type McpToolDef, type McpResourceDef, type McpPromptDef } from "@platform/mcp";
import { salesReport, reportToCsv } from "./reports.js";

/** ツールが必要とする請求の最小形。 */
export interface McpInvoiceLike {
  number: string;
  billTo?: string;
  issueDate: string;
  status: string;
  totals?: { total: number };
  balance?: number;
  cancelled?: boolean;
}

/** Zoho CRM 呼び出しの最小形(@platform/zoho の Result 形と構造互換)。 */
export interface McpZohoLike {
  searchRecords(module: string, query: { word?: string; criteria?: string; email?: string }): Promise<{ ok: boolean; value?: { data?: unknown[] }; error?: unknown }>;
  getRecord(module: string, id: string): Promise<{ ok: boolean; value?: { data?: unknown[] }; error?: unknown }>;
}

/** 注入する依存。 */
export interface McpToolDeps {
  invoiceStore: { list(): Promise<McpInvoiceLike[]>; get(number: string): Promise<McpInvoiceLike | undefined> };
  partnerStore: { list(kind?: string): Promise<{ code: string; name: string; kinds: string[]; contact?: string }[]> };
  inventoryStore: { status(): Promise<{ product: { sku: string; name: string }; summary: { onHand: number }; needsReorder: boolean; suggestedOrderQty: number }[]> };
  auditLog: { query(q: { limit?: number }): Promise<{ seq: number; at: string; actor: string; action: string; target?: string }[]> };
  /** 未設定なら zoho_* ツールは「未設定」エラーを返す(サーバ自体は起動できる)。 */
  zoho?: McpZohoLike;
  /**
   * 書き込み系ツール(invoice_record_payment / invoice_cancel)。設定時のみ登録される。
   * 実行のたびに監査ログへ記録する。読み取り専用で運用したい場合は渡さない。
   */
  writes?: {
    recordPayment(number: string, amount: number): Promise<{ ok: true; balance: number } | { ok: false; error: string }>;
    cancelInvoice(number: string): Promise<{ ok: true } | { ok: false; error: string }>;
    audit(action: string, target: string, detail: Record<string, unknown>): Promise<void>;
    /** 監査に残す実行主体(API キーの id 等)。 */
    actor: string;
  };
  now?: () => Date;
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown, fallback: number, max: number): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : fallback;
};

/** 社内基盤の MCP ツール一式を組み立てる。 */
export function buildMcpTools(deps: McpToolDeps): McpToolDef[] {
  const now = deps.now ?? (() => new Date());
  const tools: McpToolDef[] = [
    {
      name: "invoice_list",
      description: "請求書の一覧(番号・宛先・発行日・状態・金額・残高)。status と limit で絞り込み可。",
      inputSchema: { type: "object", properties: { status: { type: "string", description: "状態で絞り込み(例: 未払)" }, limit: { type: "number", description: "最大件数(既定20・上限50)" } } },
      handler: async (args) => {
        const status = str(args.status);
        const limit = num(args.limit, 20, 50);
        const rows = (await deps.invoiceStore.list())
          .filter((i) => !status || i.status === status)
          .slice(0, limit)
          .map((i) => ({ number: i.number, billTo: i.billTo ?? "", issueDate: i.issueDate, status: i.status, total: i.totals?.total ?? 0, balance: i.balance ?? 0 }));
        return jsonResult(rows);
      },
    },
    {
      name: "invoice_get",
      description: "請求書1件を番号で取得。",
      inputSchema: { type: "object", properties: { number: { type: "string", description: "請求番号(例: INV-0001)" } }, required: ["number"] },
      handler: async (args) => {
        const number = str(args.number);
        if (!number) return errorResult("number は必須です");
        const inv = await deps.invoiceStore.get(number);
        return inv ? jsonResult(inv) : errorResult(`請求 ${number} は見つかりません`);
      },
    },
    {
      name: "partner_list",
      description: "取引先の一覧(コード・名称・区分)。kind で絞り込み可(customer / supplier など)。",
      inputSchema: { type: "object", properties: { kind: { type: "string" } } },
      handler: async (args) => jsonResult(await deps.partnerStore.list(str(args.kind))),
    },
    {
      name: "inventory_status",
      description: "在庫状況(SKU・在庫数・要発注・推奨発注数)。onlyReorder=true で要発注のみ。",
      inputSchema: { type: "object", properties: { onlyReorder: { type: "boolean" } } },
      handler: async (args) => {
        const rows = (await deps.inventoryStore.status())
          .filter((s) => (args.onlyReorder === true ? s.needsReorder : true))
          .map((s) => ({ sku: s.product.sku, name: s.product.name, onHand: s.summary.onHand, needsReorder: s.needsReorder, suggestedOrderQty: s.suggestedOrderQty }));
        return jsonResult(rows);
      },
    },
    {
      name: "report_sales_csv",
      description: "売上レポート(取引先別)を CSV で返す(Excel 向け BOM 付き・合計行あり)。",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const invoices = (await deps.invoiceStore.list())
          .filter((i) => !i.cancelled)
          .map((i) => ({ number: i.number, billTo: i.billTo, total: i.totals?.total ?? 0, balance: i.balance ?? 0 }));
        return textResult(reportToCsv(salesReport(invoices, now())));
      },
    },
    {
      name: "audit_recent",
      description: "監査ログの直近エントリ(誰が・いつ・何をしたか)。",
      inputSchema: { type: "object", properties: { limit: { type: "number", description: "最大件数(既定20・上限100)" } } },
      handler: async (args) => jsonResult(await deps.auditLog.query({ limit: num(args.limit, 20, 100) })),
    },
    {
      name: "zoho_search_records",
      description: "Zoho CRM のレコード検索。module(Leads / Contacts / Deals 等)と、word / criteria / email のいずれかを指定。",
      inputSchema: { type: "object", properties: { module: { type: "string" }, word: { type: "string", description: "全文検索ワード" }, criteria: { type: "string", description: "検索条件式(例: (Last_Name:equals:山田))" }, email: { type: "string" } }, required: ["module"] },
      handler: async (args) => {
        if (!deps.zoho) return errorResult("Zoho が未設定です(ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REFRESH_TOKEN を設定して再起動してください)");
        const module = str(args.module);
        if (!module) return errorResult("module は必須です");
        const query = { word: str(args.word), criteria: str(args.criteria), email: str(args.email) };
        if (!query.word && !query.criteria && !query.email) return errorResult("word / criteria / email のいずれかを指定してください");
        const r = await deps.zoho.searchRecords(module, query);
        if (!r.ok) return errorResult(`Zoho 検索に失敗しました: ${JSON.stringify(r.error)}`);
        return jsonResult(r.value?.data ?? []);
      },
    },
    {
      name: "zoho_get_record",
      description: "Zoho CRM のレコード1件を module と id で取得。",
      inputSchema: { type: "object", properties: { module: { type: "string" }, id: { type: "string" } }, required: ["module", "id"] },
      handler: async (args) => {
        if (!deps.zoho) return errorResult("Zoho が未設定です(ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REFRESH_TOKEN を設定して再起動してください)");
        const module = str(args.module);
        const id = str(args.id);
        if (!module || !id) return errorResult("module と id は必須です");
        const r = await deps.zoho.getRecord(module, id);
        if (!r.ok) return errorResult(`Zoho 取得に失敗しました: ${JSON.stringify(r.error)}`);
        const rec = r.value?.data?.[0];
        return rec !== undefined ? jsonResult(rec) : errorResult(`レコードが見つかりません: ${module}/${id}`);
      },
    },
  ];

  // 書き込み系(deps.writes を渡したときのみ登録・実行毎に監査記録)
  if (deps.writes) {
    const w = deps.writes;
    tools.push(
      {
        name: "invoice_record_payment",
        description: "請求書に入金を記録する(書き込み)。number と amount(円)を指定。実行は監査ログに残る。",
        inputSchema: { type: "object", properties: { number: { type: "string" }, amount: { type: "number", description: "入金額(円・正の数)" } }, required: ["number", "amount"] },
        scopes: ["invoice:write"],
        destructive: false,
        handler: async (args) => {
          const number = str(args.number);
          const amount = typeof args.amount === "number" ? args.amount : Number(args.amount);
          if (!number) return errorResult("number は必須です");
          if (!Number.isFinite(amount) || amount <= 0) return errorResult("amount は正の数で指定してください");
          const r = await w.recordPayment(number, amount);
          if (!r.ok) return errorResult(r.error);
          await w.audit("invoice.record_payment", number, { amount, balance: r.balance });
          return jsonResult({ number, recorded: amount, balance: r.balance });
        },
      },
      {
        name: "invoice_cancel",
        description: "請求書を取り消す(破壊的・書き込み)。number を指定。実行は監査ログに残る。",
        inputSchema: { type: "object", properties: { number: { type: "string" } }, required: ["number"] },
        scopes: ["invoice:write"],
        destructive: true,
        handler: async (args) => {
          const number = str(args.number);
          if (!number) return errorResult("number は必須です");
          const r = await w.cancelInvoice(number);
          if (!r.ok) return errorResult(r.error);
          await w.audit("invoice.cancel", number, {});
          return jsonResult({ number, cancelled: true });
        },
      },
    );
  }

  return tools;
}

/** MCP リソース(読み取り専用の参照データ)を組み立てる。 */
export function buildMcpResources(deps: Pick<McpToolDeps, "invoiceStore" | "inventoryStore">): McpResourceDef[] {
  return [
    {
      uri: "platform://invoices/summary",
      name: "請求サマリー",
      description: "請求件数と状態別の集計(スナップショット)。",
      mimeType: "application/json",
      read: async () => {
        const rows = await deps.invoiceStore.list();
        const byStatus: Record<string, number> = {};
        for (const i of rows) byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
        return JSON.stringify({ total: rows.length, byStatus }, null, 2);
      },
    },
    {
      uri: "platform://inventory/reorder",
      name: "要発注リスト",
      description: "在庫が発注点を下回っている品目。",
      mimeType: "application/json",
      read: async () => {
        const rows = (await deps.inventoryStore.status()).filter((s) => s.needsReorder).map((s) => ({ sku: s.product.sku, name: s.product.name, onHand: s.summary.onHand, suggestedOrderQty: s.suggestedOrderQty }));
        return JSON.stringify(rows, null, 2);
      },
    },
  ];
}

/** MCP プロンプト(定型プロンプト)を組み立てる。 */
export function buildMcpPrompts(): McpPromptDef[] {
  return [
    {
      name: "overdue_followup",
      description: "支払期限を過ぎた請求先への催促メール文面を作る。",
      arguments: [
        { name: "partner", description: "取引先名", required: true },
        { name: "number", description: "請求番号", required: true },
        { name: "amount", description: "金額(円)", required: false },
      ],
      build: (args) => [
        { role: "user", content: `次の未入金の請求について、丁寧で角の立たない催促メールの文面を日本語で作成してください。\n取引先: ${args.partner ?? "(不明)"}\n請求番号: ${args.number ?? "(不明)"}\n金額: ${args.amount ?? "(記載なし)"}\n入金確認のお願いと、行き違いの場合のお詫びを含め、署名欄はプレースホルダにしてください。` },
      ],
    },
    {
      name: "inventory_reorder_review",
      description: "要発注リストを見て、発注の優先順位と数量の妥当性をレビューする。",
      arguments: [{ name: "context", description: "季節・キャンペーン等の補足", required: false }],
      build: (args) => [
        { role: "user", content: `platform://inventory/reorder のリソースを参照し、発注の優先順位・数量の妥当性・リスク(欠品/過剰在庫)を簡潔にレビューしてください。補足: ${args.context ?? "特になし"}` },
      ],
    },
  ];
}
