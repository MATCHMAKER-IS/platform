/**
 * デモページで使う「基盤の型」の実在確認。文字列 union と、**戻り値の null 許容**。
 *
 * **画面には出ない。型検査のためだけに存在する。**
 *
 * lucide の名前や `RoomKind` のような union を思い込みで書くと、
 * `pnpm build` の型検査まで気づけない(dev では動く)。しかも
 * `?.kind === "direct"` のような比較は **型エラーにすらならず、画面が静かに壊れる**。
 *
 * ここに **ページで実際に書いている literal をそのまま並べる**ことで、
 * `pnpm typecheck` で一括検証できる。`Record<Union, string>` にしてあるものは
 * **値の間違いだけでなく、漏れも捕まる**(union に値が増えたら赤くなる)。
 *
 * **null を返す関数**もここで押さえる。`Money | null` / `brokenAt: number | null` のような
 * 「混ぜたら足せない」「壊れていなければ無い」を型で表す設計は基盤に多く、
 * **ページ側で null チェックを忘れると build で初めて落ちる**。
 *
 * ページで新しい union / null 許容の戻り値を使うときは、ここにも足すこと。
 * @packageDocumentation
 */
import type { RoomKind, ChatRoom } from "@platform/chat";
import type { MovementType } from "@platform/inventory";
import type { AccountType } from "@platform/zengin";
import type { LengthUnit, AreaUnit, TempUnit, VolumeUnit, WeightUnit } from "@platform/units";
import type { ResetPeriod } from "@platform/sequence";
import type { CircuitState } from "@platform/observability";
import type { DepreciationMethod } from "@platform/depreciation";
import type { Rounding, TaxRate } from "@platform/tax";
import type { ZohoDataCenter } from "@platform/zoho";
import type { PaymentStatus } from "@platform/invoice";
import type { PurchaseStatus } from "@platform/purchase";
import type { QuoteStatus } from "@platform/quote";

// /chat: ROOMS の kind
export const rooms: ChatRoom[] = [
  { id: "a", name: "情シス", kind: "group", memberIds: ["u"], createdAt: "2026-07-01T00:00:00Z" },
  { id: "b", name: "鈴木花子", kind: "dm", memberIds: ["u"], createdAt: "2026-07-01T00:00:00Z" },
];
export const kinds: RoomKind[] = ["group", "dm"];

// /inventory: TYPE_LABEL のキー
export const movementLabel: Record<MovementType, string> = { inbound: "入庫", outbound: "出庫", adjustment: "調整" };

// /zengin: ACCOUNT_TYPES
export const accountTypes: { value: AccountType; label: string }[] = [
  { value: "1", label: "普通" }, { value: "2", label: "当座" }, { value: "4", label: "貯蓄" },
];

// /converters: セレクタに並べた値
export const lengths: LengthUnit[] = ["mm", "cm", "m", "km", "in", "ft", "yd", "mi"];
export const areas: AreaUnit[] = ["cm2", "m2", "km2", "ha", "tsubo", "jo", "acre"];
export const temps: TempUnit[] = ["C", "F", "K"];
export const vols: VolumeUnit[] = ["l", "gal_us", "sho"];
export const weights: WeightUnit[] = ["kg", "lb"];

// /sequence: RESETS
export const resets: ResetPeriod[] = ["never", "yearly", "fiscalYearly", "monthly"];

// /observability: STATE_LABEL
export const stateLabel: Record<CircuitState, string> = { closed: "closed", open: "open", half_open: "half_open" };

// /depreciation
export const methods: DepreciationMethod[] = ["straight_line", "declining_balance"];

// /tax, /invoice-builder
export const roundings: Rounding[] = ["floor", "round", "ceil"];
export const rates: TaxRate[] = [10, 8, 0];

// /login: DC セレクタ
export const dcs: ZohoDataCenter[] = ["jp", "com", "eu", "in", "com.au", "ca"];

// /invoice-builder, /purchase, /quote: STATUS_LABEL の全キー
export const payLabel: Record<PaymentStatus, string> = { draft: "", issued: "", paid: "", overdue: "", cancelled: "" };
export const poLabel: Record<PurchaseStatus, string> = { draft: "", ordered: "", partially_received: "", received: "", cancelled: "" };
export const qtLabel: Record<QuoteStatus, string> = { draft: "", sent: "", accepted: "", rejected: "", expired: "" };

// ─────────────────────────── null を返す戻り値 ───────────────────────────
// **ページと同じ書き方**で受ける。型注釈だけ置いても検証にならない。

import { money, addMoney, sumMoney, totalInBaseCurrency, formatMoney } from "@platform/currency";
import { verifyChain, appendEvent, type AuditEvent, type AuditEntry } from "@platform/audit";
import { verifyEvidenceChain, appendEvidence, type EvidenceRecord } from "@platform/dencho";
import { generateApiKey, authenticateApiKey, type ApiKeyRecord, type ApiKeyStore } from "@platform/apikey";
import { parseE164, toE164 } from "@platform/phone";

/** /converters: 通貨が混ざると null。型が null チェックを強制する。 */
export const moneyNullable = {
  sumSame: sumMoney([money(1200, "JPY"), money(800, "JPY")]),
  sumMixed: sumMoney([money(1200, "JPY"), money(10, "USD")]),
  addSame: addMoney(money(1200, "JPY"), money(800, "JPY")),
  addMixed: addMoney(money(1200, "JPY"), money(10, "USD")),
  // totalInBaseCurrency は Money(レートを渡す = 換算の責任を取るので必ず返る)
  total: formatMoney(totalInBaseCurrency([money(1200, "JPY"), money(10, "USD")], "JPY", { JPY: 1, USD: 157.2 })),
};
export const moneyShown = [
  moneyNullable.sumSame !== null ? formatMoney(moneyNullable.sumSame) : "null",
  moneyNullable.sumMixed !== null ? formatMoney(moneyNullable.sumMixed) : "null",
  moneyNullable.addSame !== null ? formatMoney(moneyNullable.addSame) : "null",
  moneyNullable.addMixed !== null ? formatMoney(moneyNullable.addMixed) : "null",
];

/** /audit と /dencho: 同名 ChainVerification だが brokenAt が null と undefined で違う。 */
const auditEv: AuditEvent = { at: "2026-07-17T09:00:00Z", actor: "u", action: "a", target: "t", before: {}, after: {} };
const auditLog: AuditEntry[] = appendEvent([], auditEv);
const auditVerify = verifyChain(auditLog);
export const auditBroken = auditLog.map((e) => !auditVerify.valid && auditVerify.brokenAt !== null && e.seq >= auditVerify.brokenAt);

const denchoChain: EvidenceRecord[] = [appendEvidence([], { id: "a" }, "2026-07-17T00:00:00Z")];
const denchoVerify = verifyEvidenceChain(denchoChain);
export const denchoBroken = denchoChain.map((r) => denchoVerify.brokenAt !== undefined && r.seq >= denchoVerify.brokenAt);

/** /apikey: AuthResult(null ではない)。reason は利用者へ返さない。 */
const key = generateApiKey({ prefix: "sk_" });
const apiRecords: ApiKeyRecord[] = [{ id: "k1", hash: key.hash, scopes: ["a"] }];
const apiStore: ApiKeyStore = { findByHash: (h) => apiRecords.find((r) => r.hash === h) ?? null };
export async function apikeyShape() {
  const r = await authenticateApiKey(key.plaintext, apiStore, Date.now());
  return { ok: r.ok, scopes: r.ok ? r.record.scopes.join(",") : "—", reason: r.ok ? "—" : r.reason };
}

/** /converters: parseE164 は null を返しうる。 */
const e164 = toE164("03-1234-5678");
export const e164Parts = e164 !== null ? parseE164(e164) : null;

// ─────────────────────────── @platform/ui の型 ───────────────────────────
// **ここは React に依存するので、AI の作業環境(@types/react 無し)では検証できない。**
// ページで @platform/ui の型を使うときは、必ずここに形を書いて `pnpm typecheck` に載せること。

import type { EmailLoginValues } from "@platform/ui";

/**
 * /login: `EmailLoginValues` は **remember が必須**。
 * フォームの onSubmit からは全部来るが、「これで入る」ボタンからは email/password だけ渡したい。
 * → ページ側は `Pick<EmailLoginValues, "email" | "password">` で受ける。
 */
export const loginValues: EmailLoginValues = { email: "admin@example.co.jp", password: "Demo1234!", remember: false };
export const loginPicked: Pick<EmailLoginValues, "email" | "password"> = { email: "a@b.c", password: "x" };

// ─────────────────────────── Result 型の戻り値 ───────────────────────────
// 基盤は「失敗しうる処理」を **例外ではなく Result** で返す(ADR)。
// `{ ok: true, value }` / `{ ok: false, error }` の形が関数ごとに微妙に違う
// (`message` / `thread` / `post` / `movements` など)ので、思い込みで書くと落ちる。
// **ページと同じ書き方で全部呼んで、tsc に確かめさせる。**
//
// 例: parseJsonRpc は `JsonRpcRequest | null` ではなく Result 型で、
// 失敗時は **整形済みの JsonRpcResponse** をくれる(アプリで -32700 を組み立てなくてよい)。

import { parseJsonRpc, textResult, jsonResult, errorResult } from "@platform/mcp";
import { createMessage, editMessage, createRoom, markRead } from "@platform/chat";
import { createThread, createPost, editPost, summarize } from "@platform/board";
import { createRagStore, createMemoryVectorIndex, buildContext, type RagSearchBackend } from "@platform/rag";
import { createSearch, createMemorySearch } from "@platform/search";
import { createHashEmbedder, createAiGateway, createMemoryAiLogStore, type AiProvider } from "@platform/ai";
import { applyMovement } from "@platform/inventory";
import { buildZenginTransfer, toHankakuKana, type Consignor, type TransferRecord } from "@platform/zengin";

// /mcp: parseJsonRpc は Result 型(私は null と思い込んでいた)
const parsed = parseJsonRpc('{"jsonrpc":"2.0","id":1,"method":"tools/list"}');
export const mcpOut = parsed.ok
  ? JSON.stringify({ jsonrpc: "2.0", id: parsed.value.id ?? null, result: { tools: [] } })
  : JSON.stringify(parsed.error);
export const results = [textResult("x"), jsonResult({ a: 1 }), errorResult("e")];

// /chat: createMessage も Result 型
const cm = createMessage({ id: "m1", roomId: "r1", senderId: "u", text: "x", at: "2026-07-17T00:00:00Z" });
export const chatMsgs = cm.ok ? [cm.message] : [];
export const room = createRoom({ id: "r1", name: "n", kind: "group", memberIds: ["u"] });
export const read = markRead({ userId: "u" }, "2026-07-17T00:00:00Z");
export const edited = cm.ok ? editMessage(cm.message, "y") : null;

// /board-threads
const tr = createThread({ id: "t1", title: "t", authorId: "u" });
const pr = createPost({ id: "p1", authorId: "u", body: "b" });
export const boardSum = tr.ok && pr.ok ? summarize(tr.thread, [pr.post]) : null;
export const boardEdited = pr.ok ? editPost(pr.post, "z") : null;

// /rag
const backend: RagSearchBackend = (() => {
  const se = createSearch(createMemorySearch());
  return { index: (d) => se.index(d), search: (q, l) => se.search(q, l), delete: (i) => se.delete(i) };
})();
const rag = createRagStore({ backend, embedder: createHashEmbedder(64), vectorIndex: createMemoryVectorIndex() });
export async function ragRun() {
  const ing = await rag.ingest([{ id: "d", title: "t", body: "b", acl: { public: true } }]);
  const ret = await rag.retrieve("q", { id: "u", roles: ["r"] }, 3);
  return { chunks: ing.ok ? ing.value.chunks : 0, ctx: ret.ok ? buildContext(ret.value) : "" };
}

// /ai
const fake: AiProvider = { id: "d", models: ["m"], chat: async () => ({ text: "t", usage: { inputTokens: 1, outputTokens: 1 } }) };
const gw = createAiGateway({ providers: [fake], defaultModel: "m", logStore: createMemoryAiLogStore() });
export async function aiRun() {
  const r = await gw.chat({ messages: [{ role: "user", content: "x" }] });
  return r.ok ? r.value.text : r.error.message;
}

// /inventory
export const mv = applyMovement([{ type: "inbound", quantity: 1, at: "2026-07-01" }], { type: "outbound", quantity: 1, at: "2026-07-02" });
export const mvOk = mv.ok ? mv.movements.length : 0;

// /zengin
const cons: Consignor = { code: "0", name: "n", bankCode: "0001", branchCode: "001", accountType: "1", accountNumber: "1" };
const recs: TransferRecord[] = [{ bankCode: "0005", branchCode: "123", accountType: "1", accountNumber: "7", recipientName: toHankakuKana("ヤマダ"), amount: 1 }];
const z = buildZenginTransfer(cons, recs, "0731");
export const zOut = [z.content, z.count, z.totalAmount];

// ─────────────────────────── /status-page, /analytics ───────────────────────────
import type { Bucket, AnalyticsEventType, AnalyticsEvent } from "@platform/analytics";
import type { MaintenanceConfig, MaintenanceRequestInfo, MaintenanceDecision } from "@platform/status-page";
import { createMaintenanceGate, renderMaintenancePage } from "@platform/status-page";
import { summarize as analyticsSummarize, timeSeries, topPages as analyticsTopPages, referrerBreakdown as analyticsReferrers } from "@platform/analytics";

export const buckets: Bucket[] = ["hour", "day"];
export const evTypes: AnalyticsEventType[] = ["pageview", "click", "custom"];

/** /status-page: reason は union。ラベル表を作るときに漏れると画面が空欄になる。 */
export const maintReasons: NonNullable<MaintenanceDecision["reason"]>[] = [
  "disabled", "allow_path", "allow_ip", "allow_role", "bypass_header", "out_of_window",
];

const maintConfig: MaintenanceConfig = {
  enabled: false,
  window: { start: "2026-07-20T02:00:00Z", end: "2026-07-20T04:00:00Z" },
  allowPaths: ["/api/health"], allowIps: ["203.0.113.10"], allowRoles: ["admin"],
  bypassHeader: { name: "x-maintenance-bypass", value: "let-me-in" },
  estimatedRecovery: "13:00 頃", retryAfterSeconds: 3600,
};
const maintReq: MaintenanceRequestInfo = { path: "/x", ip: "1.2.3.4", roles: ["admin"], getHeader: () => null };
export const maintDecision = createMaintenanceGate(() => maintConfig, () => new Date()).evaluate(maintReq);
export const maintHtml = renderMaintenancePage({ brand: "b", estimatedRecovery: "13:00" });

const evs: AnalyticsEvent[] = [{ type: "pageview", path: "/", sessionId: "s", at: "2026-07-17T00:00:00Z", referrer: "" }];
export const analyticsSum = analyticsSummarize(evs, { topN: 5 });
export const analyticsSeries = timeSeries(evs, "day");

/**
 * /analytics: **プロパティ名を思い込みで書いて build を落とした**。
 * `TimePoint` は `.at`/`.count` ではなく **`.bucket`/`.views`/`.visitors`**、
 * `PageStat` は `.count` ではなく **`.views`/`.visitors`**、
 * `ReferrerStat` の参照元なしは `""` ではなく **`"direct"`**。
 * ページで読むプロパティを全部ここで触っておく。
 */
export const analyticsProps = {
  sum: { pv: analyticsSum.pageViews, uv: analyticsSum.uniqueVisitors, uu: analyticsSum.uniqueUsers, br: analyticsSum.bounceRate },
  series: analyticsSeries.map((p) => ({ key: p.bucket, views: p.views, visitors: p.visitors })),
  pages: analyticsTopPages(evs, 5).map((p) => ({ path: p.path, views: p.views, visitors: p.visitors })),
  refs: analyticsReferrers(evs, 5).map((r) => ({ label: r.referrer === "direct" ? "（直接アクセス）" : r.referrer, n: r.count })),
};

// ─────────────────────────── /cron ───────────────────────────
import { createGuardedJob, createMemoryLockStore, type JobResult, type JobStats } from "@platform/cron/browser";

/** outcome は union。ラベル表が漏れると画面が空欄になる。 */
export const cronOutcomes: JobResult["outcome"][] = ["success", "failure", "skipped"];
/** reason は任意。**skipped のときだけ入る**(success には無い)。 */
export const cronReasons: NonNullable<JobResult["reason"]>[] = ["overlap", "lock"];

const cronJob = createGuardedJob({
  name: "daily-report",
  preventOverlap: true,
  handler: async () => {},
  onResult: (r: JobResult) => { void r.outcome; void r.durationMs; void r.reason; void r.error; },
  onError: (name: string, err: Error) => { void name; void err; },
});
export const cronStats: JobStats = cronJob.stats();
export const cronShown = {
  runs: cronStats.runs, ok: cronStats.successes, ng: cronStats.failures, skip: cronStats.skipped,
  err: cronStats.lastError ?? "—",
};
export const cronLocked = createGuardedJob({
  name: "nightly-batch",
  lock: { store: createMemoryLockStore(), ttlMs: 3000, key: "nightly-batch" },
  handler: async () => {},
});

// ─────────────────────────── /status-page の切り替え体験 ───────────────────────────
// 実運用の配線(DB → TTL キャッシュ → 非同期ゲート)を、ページと同じ書き方で通す。
import {
  createMemoryMaintenanceStore, createCachedConfig, createAsyncMaintenanceGate, stateToConfig,
  type MaintenanceState as MState,
} from "@platform/status-page";

const mStore = createMemoryMaintenanceStore({ enabled: false });
const mPolicy = { allowPaths: ["/api/health"], allowRoles: ["admin"], retryAfterSeconds: 1800 };
let mClock = 0;
const mGetConfig = createCachedConfig<MaintenanceConfig>(
  async () => stateToConfig(await mStore.get(), mPolicy),
  5000,
  () => mClock,
);
const mGate = createAsyncMaintenanceGate(mGetConfig, () => new Date("2026-07-20T10:00:00Z"));

export async function maintToggle(on: boolean): Promise<MState> {
  // message は string | string[]。updatedBy/updatedAt は監査用。
  await mStore.set({
    enabled: on,
    estimatedRecovery: "13:00 頃",
    message: ["調整中です。", "13:00 頃に復旧します。"],
    updatedBy: "u-admin",
    updatedAt: new Date().toISOString(),
  });
  return mStore.get();
}
export async function maintAccess() {
  const d = await mGate.evaluate({ path: "/inquiries" });
  return { active: d.active, reason: d.reason ?? "-", retry: d.retryAfterSeconds ?? 0 };
}

// ─────────────────────────── /apps/portal ───────────────────────────
// 生成物の型。**画面が壊れるのは「生成側の形が変わったのに画面が古い」とき**なので、
// ここで両者を突き合わせておく。

import { PORTAL_REFERENCE, PORTAL_TOTALS, type RefPackage, type RefEntry, type RefParam } from "./portal-reference.generated";

/** 一覧ページが使う形(Server Component が client へ渡す分)。 */
export const portalIndexShape: { name: string; category: string; summary: string; functions: number; types: number }[] =
  PORTAL_REFERENCE.map((p: RefPackage) => ({
    name: p.name, category: p.category, summary: p.summary, functions: p.functions, types: p.types,
  }));

/** 詳細ページが使う形。**params / returns / throws / example は任意**なので、必ず存在確認する。 */
export const portalDetailShape = PORTAL_REFERENCE.map((p: RefPackage) => ({
  name: p.name,
  entries: p.entries.map((e: RefEntry) => ({
    name: e.name,
    kind: e.kind,
    summary: e.summary,
    signature: e.signature ?? "—",
    params: (e.params ?? []).map((q: RefParam) => `${q.name}: ${q.description}`),
    returns: e.returns ?? "—",
    throws: (e.throws ?? []).join(" / "),
    example: e.example ?? "",
  })),
}));

export const portalTotals: { packages: number; functions: number; types: number } = PORTAL_TOTALS;

// ─────────────────────────── /flags, /fsm ───────────────────────────
import { bucketOf, evaluateFlag, selectVariant, createFlags, createStaticProvider,
         type FlagRule, type FlagContext, type FlagDefinitions } from "@platform/flags";
import { can, transition, availableEvents, isFinal, run, createStateMachine,
         type StateMachineDefinition, type Transitions, type RunResult } from "@platform/fsm";

/** /flags: FlagRule は boolean かオブジェクトの union。両方の形を押さえる。 */
export const flagRules: FlagRule[] = [
  true,
  false,
  { enabled: true, rolloutPercent: 30 },
  { enabled: true, allow: [{ role: "admin" }], deny: [{ plan: "trial" }] },
  { enabled: true, variants: [{ name: "A", weight: 50 }, { name: "B", weight: 50 }] },
];
const flagCtx: FlagContext = { key: "u-1", attributes: { role: "admin", plan: "standard" } };
export const flagChecks = flagRules.map((r) => evaluateFlag(r, flagCtx, "f"));
export const flagVariant: string | null = selectVariant(flagRules[4]!, flagCtx, "f");
export const flagBucket: number = bucketOf("u-1");
const flagDefs: FlagDefinitions = { a: true, b: { enabled: true, rolloutPercent: 50 } };
export const flagsApi = createFlags(createStaticProvider(flagDefs));

/**
 * /fsm: **ジェネリクス**なので、ページで使う S / E をそのまま通しておく。
 * 遷移表に無い状態を書くと型エラーになるのが利点だが、書き方を間違えると気づけない。
 */
type FsmState = "draft" | "submitted" | "approved" | "rejected" | "paid" | "cancelled";
type FsmEvent = "submit" | "approve" | "reject" | "pay" | "withdraw" | "cancel";
const fsmTransitions: Transitions<FsmState, FsmEvent> = {
  draft: { submit: "submitted", cancel: "cancelled" },
  submitted: { approve: "approved", reject: "rejected", withdraw: "draft" },
  approved: { pay: "paid" },
  rejected: { withdraw: "draft", cancel: "cancelled" },
};
const fsmDef: StateMachineDefinition<FsmState, FsmEvent> = {
  initial: "draft", transitions: fsmTransitions, final: ["paid", "cancelled"],
};
export const fsmCan: boolean = can(fsmDef, "draft", "submit");
export const fsmNext: FsmState | null = transition(fsmDef, "draft", "submit");
export const fsmEvents: FsmEvent[] = availableEvents(fsmDef, "submitted");
export const fsmFinal: boolean = isFinal(fsmDef, "paid");
export const fsmRun: RunResult<FsmState, FsmEvent> = run(fsmDef, ["submit", "approve", "pay"]);
export const fsmMachine = createStateMachine(fsmDef);
export const fsmLabels: Record<FsmState, string> = {
  draft: "下書き", submitted: "申請中", approved: "承認済", rejected: "差戻し", paid: "支払済", cancelled: "取消",
};
export const fsmEventLabels: Record<FsmEvent, string> = {
  submit: "申請する", approve: "承認する", reject: "差し戻す", pay: "支払う", withdraw: "取り下げる", cancel: "取り消す",
};

// ─────────────────────────── /saga ───────────────────────────
import { runSaga, sagaStep, type SagaStep, type SagaResult } from "@platform/saga";

interface SagaCtx { n: number }

/**
 * /saga: `SagaResult` の形。**compensationErrors は任意**で、`{ step, error }[]`。
 * error は `unknown` なので、そのまま描画できない(instanceof Error で絞る)。
 */
const sagaSteps: SagaStep<SagaCtx>[] = [
  sagaStep<SagaCtx>("a", (c) => { c.n += 1; }, (c) => { c.n -= 1; }),
  sagaStep<SagaCtx>("b", async () => {}), // compensate 省略可
];
export async function sagaShape() {
  const r: SagaResult = await runSaga(sagaSteps, { n: 0 });
  return {
    ok: r.ok,
    completed: r.completed.join(" → "),
    compensated: r.compensated.join(" → "),
    failed: r.failedStep ?? "—",
    error: r.error instanceof Error ? r.error.message : String(r.error),
    compErrors: (r.compensationErrors ?? []).map((e) => ({
      step: e.step,
      msg: e.error instanceof Error ? e.error.message : String(e.error),
    })),
  };
}

// ─────────────────────────── /charts のローソク足 ───────────────────────────
// **@platform/ui は React 依存なので、AI の作業環境では検証できない。**
// ここに形を書いて `pnpm typecheck` に載せる(EmailLoginValues と同じ扱い)。

import { withMovingAverage, summarizeCandles, toCandles, isBullish,
         regressionLine, fitStrength,
         type CandleRow, type CandleSummary, type Candlestick, type RegressionLine, type RegressionInput } from "@platform/ui";

const candles: CandleRow[] = [
  { label: "7/1", open: 100, high: 110, low: 95, close: 108 },
  { label: "7/2", open: 108, high: 112, low: 104, close: 106 },
];

/** `withMovingAverage` は **元と同じ長さ**で返し、`ma` は `number | null`。 */
export const candleWithMa: (CandleRow & { ma: number | null })[] = withMovingAverage(candles, 5);
/** そのまま `CandlestickChart` の `data` に渡せること(Candlestick は ma? を持つ)。 */
export const candleChartData: Candlestick[] = candleWithMa;
export const candleSummary: CandleSummary = summarizeCandles(candles);
export const candleShown = {
  bullish: candleSummary.bullish,
  bearish: candleSummary.bearish,
  high: candleSummary.high,
  low: candleSummary.low,
  change: candleSummary.changePercent.toFixed(1),
  range: candleSummary.averageRange.toFixed(1),
  // ma は null を取りうるので、描画前に必ず確認する
  firstMa: candleWithMa[0]?.ma ?? null,
  bull: isBullish(candles[0]!),
};
export const candleWeekly: CandleRow[] = toCandles([{ label: "1日", value: 42 }, { label: "2日", value: 38 }], 5);

/**
 * /charts の回帰直線。**`regressionLine` は null を返しうる**
 * (点が 2 未満 / x が全て同じ)。描画前に必ず確認する。
 */
const regInput: RegressionInput[] = [{ x: 10, y: 40 }, { x: 20, y: 55 }, { x: 30, y: 52 }];
export const regLine: RegressionLine | null = regressionLine(regInput);
export const regShown = {
  equation: regLine?.equation ?? "—",
  r2: regLine?.r2.toFixed(2) ?? "—",
  slope: regLine?.slope.toFixed(1) ?? "—",
  // points は端点 2 つ。そのまま ScatterChart の series に渡せる形。
  points: regLine?.points ?? [],
  strength: regLine ? fitStrength(regLine.r2) : "—",
};

// ─────────────────────────── /safe-html ───────────────────────────
import { escapeHtml, stripTags, embedAsText, zenkakuToHankaku, zenkakuSpaceToHankaku, nl2br, truncate, linkify } from "@platform/html";
import { isSafeUrl, isHttpUrl, isValidUrl, isExternalUrl, normalizeUrl, urlsEqual,
         getHostname, getRegistrableDomain, getSubdomain, getTld,
         parseQuery, stringifyQuery, setParams, keepParams, removeParam } from "@platform/url";

/**
 * /safe-html: **null を返すものが多い**(getHostname / getRegistrableDomain /
 * getSubdomain / getTld)。描画前に必ず `?? "—"` する。
 */
export const safeHtmlShape = {
  escaped: escapeHtml("<script>x</script>"),
  stripped: stripTags("<b>a</b>"),
  asText: embedAsText("<b>a</b>"),
  nl: nl2br(escapeHtml("a\nb")),
  trunc: truncate("あいうえお", 3),
  link: linkify("https://a.jp", { target: "_blank", rel: "noopener noreferrer" }),
  han: zenkakuToHankaku("ＡＢＣ"),
  space: zenkakuSpaceToHankaku("あ　い"),
};
export const safeUrlShape = {
  // boolean を返すもの
  safe: isSafeUrl("javascript:alert(1)"),
  http: isHttpUrl("ftp://a.jp"),
  valid: isValidUrl("https://a.jp"),
  external: isExternalUrl("https://other.jp", "example.co.jp"),
  equal: urlsEqual("https://a.jp/x", "https://a.jp/x/"),
  // string を返すもの
  normalized: normalizeUrl("HTTPS://A.jp:443/b/../c"),
  // ★null を返すもの
  host: getHostname("https://a.jp") ?? "—",
  registrable: getRegistrableDomain("https://www.example.co.jp") ?? "—",
  sub: getSubdomain("https://shop.example.co.jp") ?? "—",
  tld: getTld("https://example.co.jp") ?? "—",
  // クエリ
  parsed: parseQuery("?a=1&b=2&b=3"),
  built: stringifyQuery({ a: 1, b: ["x", "y"], c: null, d: true }),
  kept: keepParams("https://a.jp?a=1&b=2", ["a"]),
  removed: removeParam("https://a.jp?a=1&b=2", "a"),
  set: setParams("https://a.jp", { page: 2, sort: null }),
};

// ─────────────────────────── /apps/cart, /apps/landing ───────────────────────────
import { emptyCart, addToCart, clearCart, buildOrderSummary, computeDiscount, isCouponApplicable,
         shippingFeeForRegion, resolveZone, qualifiesForFreeShipping, amountUntilFreeShipping, earnPoints,
         type Cart, type Coupon, type ShippingZone, type OrderSummary, type TaxMode, type DiscountType } from "@platform/commerce";
import { visibleBlocks, blocksByType, activeBanners, rotateBanner, activeAnnouncements, topAnnouncement,
         copyrightText, moveBlockUp, moveBlockDown,
         type Page, type PageBlock, type BlockType, type Banner, type Announcement } from "@platform/site";
import { organizationJsonLd, websiteJsonLd, breadcrumbJsonLd, renderJsonLd, buildMeta, renderMetaTags } from "@platform/seo";

/** commerce の union。 */
export const taxModes: TaxMode[] = ["exclusive", "inclusive"];
export const discountTypes: DiscountType[] = ["percentage", "fixed"];
/** site の union。**12 種類**。ラベル表が漏れると画面が空欄になる。 */
export const blockTypes: BlockType[] = [
  "hero", "features", "cta", "faq", "testimonials",
  "richText", "gallery", "stats", "pricing", "logos", "contact", "steps",
];

/**
 * /apps/cart: **`emptyCart()` と `clearCart()` は引数なし**、
 * `ShippingZone` は `name` + `regions: string[]`(エリア単位・都道府県ごとではない)、
 * `earnPoints(amount, rate)` の **rate は 0.01 = 1%**(1 を渡すと 100% になる)。
 */
const cartZones: ShippingZone[] = [{ name: "本州", regions: ["東京", "大阪"], fee: 500, freeThreshold: 5000 }];
const cartCoupon: Coupon = { code: "SAVE10", type: "percentage", value: 10, minPurchase: 3000, maxDiscount: 1000 };
let sampleCart: Cart = emptyCart();
sampleCart = addToCart(sampleCart, { productId: "p1", name: "n", unitPrice: 480, quantity: 3 });
const cartSub = 1440;
export const cartShape = {
  cleared: clearCart(),
  zone: resolveZone(cartZones, "東京")?.name ?? "—",
  fee: shippingFeeForRegion(cartZones, "福井", cartSub, 800),
  free: qualifiesForFreeShipping(cartSub, 5000),
  until: amountUntilFreeShipping(cartSub, 5000),
  applicable: isCouponApplicable(cartCoupon, cartSub),
  discount: computeDiscount(cartCoupon, cartSub),
  points: earnPoints(1980, 0.01),
};
export const cartSummary: OrderSummary = buildOrderSummary({ subtotal: cartSub, discount: 0, shippingFee: 500, taxRate: 10, taxMode: "exclusive" });

/**
 * /apps/landing: `copyrightText` は **`holder`**(owner ではない)、
 * `buildMeta` は **`canonical`**(url ではない)。`visibility: "internal"` は自動で noindex。
 */
const lpPage: Page = { slug: "lp", title: "t", blocks: [{ id: "b1", type: "hero", data: {} }] };
const lpBanners: Banner[] = [{ id: "bn1", image: "/a.png", href: "/a", slot: "hero", weight: 3, sponsored: true }];
const lpAnns: Announcement[] = [{ id: "a1", message: "m", startAt: "2026-07-01T00:00:00Z", endAt: "2026-09-01T00:00:00Z", paths: ["/lp"] }];
export const lpShape = {
  visible: visibleBlocks(lpPage, new Date()) satisfies PageBlock[],
  ctas: blocksByType(lpPage, "cta").length,
  banners: activeBanners(lpBanners, "/lp", { slot: "hero" }),
  rotated: rotateBanner(lpBanners, "/lp", { slot: "hero", random: () => 0.5 })?.alt ?? "—",
  anns: activeAnnouncements(lpAnns, "/lp", { now: new Date() }),
  top: topAnnouncement(lpAnns, "/lp", { now: new Date(), dismissedIds: ["a1"] })?.message ?? "—",
  copyright: copyrightText({ holder: "株式会社サンプル", startYear: 2020, now: new Date() }),
  moved: moveBlockDown(moveBlockUp(lpPage.blocks, "b1"), "b1"),
};
export const seoShape = {
  meta: renderMetaTags(buildMeta({ title: "t", description: "d", canonical: "https://a.jp", visibility: "public" }).tags),
  ld: renderJsonLd([
    organizationJsonLd({ name: "n", url: "https://a.jp" }),
    websiteJsonLd({ name: "n", url: "https://a.jp" }),
    breadcrumbJsonLd([{ name: "h", url: "https://a.jp" }]),
  ]),
};

// ─────────────────────────── /validation ───────────────────────────
// useComposition は React フックなのでトップレベルで呼べない。型だけ押さえる。
import { inputAttrs, INPUT_KIND_LABELS, type InputKind, type InputKindAttrs, type CompositionState } from "@platform/ui";
import { zipCodeJp, phoneJp, katakana, myNumber, toHalfWidth, digitsToHalfWidth, normalizeSpace } from "@platform/validation";

/** InputKind は **8 種類**。ラベル表が漏れると Select が空になる。 */
export const inputKinds: InputKind[] = ["text", "digits", "tel", "email", "url", "search", "decimal", "kana"];
export const inputKindLabels: Record<InputKind, string> = INPUT_KIND_LABELS;
/** `inputAttrs()` は **そのまま `<Input {...attrs} />` に展開できる形**。 */
export const inputKindAttrs: InputKindAttrs = inputAttrs("digits");

/**
 * `useComposition()` の戻り。**`handlers` はそのまま `<Input {...handlers} />` に展開する**。
 * `isComposing` が true の間は検証しない(「やまだ」で弾かないため)。
 */
export const compositionShape: CompositionState = {
  isComposing: false,
  handlers: { onCompositionStart: () => {}, onCompositionEnd: () => {} },
};

/**
 * zod の `safeParse` は **`{ success, data }` か `{ success, error }`**。
 * 失敗時のメッセージは **`error.issues[0]?.message`**(`errors` ではない)。
 */
export const zodShape = (() => {
  const r = zipCodeJp.safeParse("１２３-４５６７");
  return {
    ok: r.success,
    value: r.success ? String(r.data) : "",
    msg: r.success ? "" : (r.error.issues[0]?.message ?? ""),
  };
})();
export const zodOthers = [phoneJp, katakana, myNumber].map((sc) => sc.safeParse("x").success);
export const normalizers = {
  half: toHalfWidth("ＡＢＣ"),
  digits: digitsToHalfWidth("０９０"),
  space: normalizeSpace("  あ　い  "),
};

// ─────────────────────────── /social ───────────────────────────
import { ALL_PLATFORMS, PLATFORMS, SHARE_LABELS, shareUrl, parseSocialUrl, buildProfileUrl,
         normalizeHandle, isValidHandle, oembedEndpoint, postKey, mergeSocialFeed, newPosts,
         type SocialPlatform, type SharePlatform, type SocialUrlType, type ShareTarget,
         type SocialPost, type SocialAccount, type ParsedSocialUrl } from "@platform/social";

/**
 * ★**union が 2 つあり紛らわしい**。
 * `SocialPlatform` はアカウント連携(3 種)、`SharePlatform` はシェアボタン(8 種)。
 * 混同すると `shareUrl("tiktok", ...)` のような通らないコードを書く。
 */
export const socialPlatforms: SocialPlatform[] = ["x", "tiktok", "instagram"];
export const sharePlatforms: SharePlatform[] = ["x", "facebook", "line", "hatena", "linkedin", "email", "whatsapp", "telegram"];
export const socialUrlTypes: SocialUrlType[] = ["profile", "post"];
/** ALL_PLATFORMS は SocialPlatform 側。SHARE_LABELS は SharePlatform 側。 */
export const socialConsts = { all: ALL_PLATFORMS, labels: SHARE_LABELS, specs: PLATFORMS };

/** ShareTarget は **title**(text ではない)。via は投稿元アカウント。 */
const shareTarget: ShareTarget = { url: "https://a.jp", title: "t", hashtags: ["h"], via: "sample_co" };
export const socialShape = {
  share: shareUrl("line", shareTarget),
  // ★null を返すもの
  parsed: parseSocialUrl("https://x.com/a/status/1") satisfies ParsedSocialUrl | null,
  profile: buildProfileUrl("x", "sample_co") ?? "—",
  // oembedEndpoint は **instagram で null**(トークンが要るため)。maxWidth は大文字 W。
  embed: oembedEndpoint("instagram", "https://instagram.com/p/1", { maxWidth: 400 }) ?? "—",
  handle: normalizeHandle("@Sample_Co "),
  valid: isValidHandle("x", "sample_co"),
};
/** SocialPost は **createdAt** が必須(postedAt ではない)。 */
const socialPosts: SocialPost[] = [
  { platform: "x", id: "1", url: "https://x.com/a/status/1", text: "a", createdAt: "2026-07-17T09:00:00Z", likeCount: 1 },
];
export const socialFeed = {
  key: postKey(socialPosts[0]!),
  merged: mergeSocialFeed(socialPosts),
  fresh: newPosts(socialPosts, ["x:1"]),
};
export const socialAccountShape: SocialAccount = { platform: "x", handle: "sample_co", url: "https://x.com/sample_co" };

// ─────────────────────────── /elearning ───────────────────────────
import { gradeQuiz, courseProgress, nextLesson, markLessonComplete, issueCertificate, flattenLessons,
         type Course, type Lesson, type Progress, type QuizQuestion, type Certificate } from "@platform/elearning";

/** Lesson["type"] は 3 種。ラベル表が漏れると画面が空欄になる。 */
export const lessonTypes: Lesson["type"][] = ["video", "article", "quiz"];

const elQuiz: QuizQuestion[] = [{ id: "q1", prompt: "p", choices: ["a", "b"], correct: [1] }];
const elCourse: Course = {
  id: "c1", title: "研修", completionRatio: 0.8,
  modules: [
    { id: "m1", title: "基礎", lessons: [{ id: "l1", title: "a", type: "video", estimatedMinutes: 10 }] },
    { id: "m2", title: "テスト", lessons: [{ id: "l2", title: "t", type: "quiz", quiz: elQuiz, passRatio: 0.6 }] },
  ],
};
const elProgress: Progress = { completedLessons: ["l1"] };

/**
 * ★`QuizResult` は **score/results ではなく** `total` / `correctCount` / `ratio` / `passed` / `details`。
 * `gradeQuiz` は **Result 型**(設問 0 件でエラー)。
 */
export const elQuizShape = (() => {
  const r = gradeQuiz(elQuiz, { q1: [1] }, 0.6);
  return r.ok
    ? { total: r.value.total, correct: r.value.correctCount, ratio: r.value.ratio, passed: r.value.passed,
        details: r.value.details.map((d) => ({ id: d.questionId, ok: d.correct })) }
    : { error: r.error.message };
})();

/** `courseProgress` は **時間で重み付け**(レッスン数ではない)。 */
export const elProgressShape = (() => {
  const p2 = courseProgress(elCourse, elProgress);
  return { ratio: p2.ratio, completed: p2.completed, total: p2.total,
           min: p2.completedMinutes, totalMin: p2.totalMinutes, certified: p2.certified };
})();

/** `markLessonComplete` / `issueCertificate` も **Result 型**。未修了なら発行しない。 */
export const elResultShapes = {
  marked: (() => { const r = markLessonComplete(elCourse, elProgress, "l2"); return r.ok ? r.value.completedLessons : r.error.message; })(),
  cert: (() => {
    const r = issueCertificate(elCourse, { completedLessons: ["l1", "l2"] }, "u", new Date());
    return r.ok ? (r.value satisfies Certificate) : r.error.message;
  })(),
  next: nextLesson(elCourse, elProgress)?.title ?? "—",
  lessons: flattenLessons(elCourse).length,
};

// ─────────────────────────── /image のズーム ───────────────────────────
// **@platform/ui は React 依存なので AI の作業環境では検証できない。**
// ここに形を書いて `pnpm typecheck` に載せる。

import { clampScale, clampPan, zoomAt, fitScale, formatScale, ZOOM_RESET,
         type ZoomState, type ZoomLimits } from "@platform/ui";

const zoomLimits: ZoomLimits = { min: 1, max: 8 };
export const zoomShape = {
  reset: ZOOM_RESET satisfies ZoomState,
  clamped: clampScale(99, zoomLimits),
  // ★clampPan は **等倍なら必ず {x:0, y:0}**
  panned: clampPan({ scale: 2, x: 9999, y: 9999 }, 400, 300),
  // ★zoomAt は cursor(枠の中心からの相対) と view(枠のサイズ) を取る
  zoomed: zoomAt(ZOOM_RESET, 2, { x: 100, y: 0 }, { width: 400, height: 300 }, zoomLimits),
  fit: fitScale({ width: 4000, height: 3000 }, { width: 400, height: 300 }),
  label: formatScale(1.234),
};

// ─────────────────────────── /barcode ───────────────────────────
// **qrcode / bwip-js は AI の作業環境に無いので検証できない。**
// ここに形を書いて `pnpm typecheck` に載せる。

import { qrSvg, qrDataUrl, barcodeSvg, buildAssetUrl,
         type QrLevel, type QrOptions, type BarcodeFormat, type BarcodeOptions } from "@platform/barcode";
import { isValidEan13, eanCheckDigit, janCountryPrefix, isJapaneseJan, detectBarcodeKind,
         type BarcodeKind } from "@platform/mobile";

/** QR の誤り訂正は 4 段階。ラベル表が漏れると Select が空になる。 */
export const qrLevels: QrLevel[] = ["L", "M", "Q", "H"];
/** バーコードは 5 種類。**JAN は商品識別の国際規格**なので社内採番には code128 を使う。 */
export const barcodeFormats: BarcodeFormat[] = ["ean13", "ean8", "code128", "code39", "itf14"];
/** @platform/mobile 側の union(**発行側とは別物**)。 */
export const barcodeKinds: BarcodeKind[] = ["ean13", "ean8", "unknown"];

const qrOpts: QrOptions = { level: "Q", margin: 4, width: 256, dark: "#000000", light: "#ffffff" };
const barOpts: BarcodeOptions = { format: "ean13", height: 10, includeText: true, scale: 2 };

/** すべて **Result を返す**(例外を投げない)。ok で分岐する。 */
export async function barcodeShape() {
  const svg = await qrSvg("https://a.jp/asset/A-1", qrOpts);
  const png = await qrDataUrl("otpauth://totp/x", { level: "M", width: 200 });
  const bar = await barcodeSvg("4901234567894", barOpts);
  return {
    svg: svg.ok ? svg.value.length : svg.error.message,
    png: png.ok ? png.value.slice(0, 20) : png.error.message,
    bar: bar.ok ? bar.value.length : bar.error.message,
  };
}
export const assetUrl: string = buildAssetUrl({ baseUrl: "https://a.jp/", kind: "asset", id: "A/42" });
/** 発行前の検証は @platform/mobile。**読み取り側と同じ関数**を使う。 */
export const janCheck = {
  valid: isValidEan13("4901234567894"),
  digit: eanCheckDigit("490123456789"),
  country: janCountryPrefix("4901234567894") ?? "—",
  jp: isJapaneseJan("4901234567894"),
  kind: detectBarcodeKind("4901234567894"),
};

// ─────────────────────────── /secrets ───────────────────────────
import { createSecretStore, createEnvProvider, createFetchProvider, createChainProvider,
         type SecretProvider, type SecretStore, type SecretStoreOptions } from "@platform/secrets";
import { maskPartial } from "@platform/pii";

/**
 * /secrets: `SecretStore.get()` は **`Promise<string | null>`**(無ければ null)、
 * `require()` は **例外を投げる**(Result ではない)。
 * `now` はテスト用の注入口——**これが無いと時間依存の処理はテストできない**。
 */
const secretEnv: SecretProvider = createEnvProvider({ API_KEY: "x" });
const secretRemote: SecretProvider = createFetchProvider(async () => null);
const secretChain: SecretProvider = createChainProvider([secretEnv, secretRemote]);
const secretOpts: SecretStoreOptions = { ttlMs: 5000, now: () => Date.now() };
const secretStore: SecretStore = createSecretStore(secretChain, secretOpts);

export async function secretsShape() {
  const v: string | null = await secretStore.get("API_KEY");
  secretStore.invalidate("API_KEY");
  secretStore.invalidate(); // 引数なしで全部
  return { value: v, masked: v === null ? "null" : maskPartial(v, 8) };
}
export async function secretsRequire() {
  // require は **例外**。try/catch が要る(get は null を返すだけ)
  try {
    return await secretStore.require("API_KEY");
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

// ─────────────────────────── /apps/site(ブログ+公式) ───────────────────────────
import { publishedPosts, readingTime, excerpt, extractHeadings, slugify, ensureSlug,
         adjacentPosts, relatedPosts, buildPermalink, postUrl, buildRssFeed, buildSitemap,
         buildCommentTree, approvedComments, countComments, pendingCount,
         type BlogPost, type PostStatus, type CommentStatus, type Comment, type CommentNode,
         type FeedItem, type FeedMeta, type SitemapUrl, type TocEntry, type ReadingTime } from "@platform/blog";

/** **`scheduled` が要点**。publishedAt を過ぎると自動で公開扱いになる。 */
export const postStatuses: PostStatus[] = ["draft", "published", "scheduled"];
export const commentStatuses: CommentStatus[] = ["pending", "approved", "spam", "rejected"];

type BlogDemoPost = BlogPost & { body: string; summary: string };
const blogPosts: BlogDemoPost[] = [
  { id: "p1", slug: "a", title: "A", status: "published", publishedAt: "2026-07-10T00:00:00Z", tags: ["x"], category: "お知らせ", body: "# H\n本文", summary: "s" },
];
const blogNow = new Date("2026-07-15T00:00:00Z");

/**
 * ★`FeedMeta` は **`link`**(siteUrl ではない)、`FeedItem` は **`publishedAt`**(pubDate ではない)、
 * `ExcerptOptions` は **`maxLength`**(length ではない)。
 */
const blogMeta: FeedMeta = { title: "T", link: "https://a.jp", description: "D", language: "ja" };
const blogItems: FeedItem[] = [{ title: "A", link: "https://a.jp/a", description: "d", publishedAt: "2026-07-10T00:00:00Z", guid: "p1" }];
const blogUrls: SitemapUrl[] = [{ loc: "https://a.jp/a", lastmod: "2026-07-10" }];

export const blogShape = {
  live: publishedPosts(blogPosts, blogNow),
  rt: readingTime(blogPosts[0]!.body) satisfies ReadingTime,
  ex: excerpt(blogPosts[0]!.body, { maxLength: 44, ellipsis: "…" }),
  toc: extractHeadings(blogPosts[0]!.body, { allowUnicode: true, maxLevel: 3 }) satisfies TocEntry[],
  // ★slugify は **日本語だと空文字**。ensureSlug の fallback が要る
  slug: slugify("新バージョンをリリース"),
  slugUni: slugify("新バージョンをリリース", { allowUnicode: true }),
  ensured: ensureSlug("新バージョンをリリース", "post-1"),
  adj: adjacentPosts(blogPosts, "p1", blogNow),
  related: relatedPosts(blogPosts[0]!, blogPosts, 2),
  permalink: buildPermalink("/blog/:year/:month/:slug", blogPosts[0]!, {}),
  url: postUrl(blogPosts[0]!, { pattern: "/blog/:slug", baseUrl: "https://a.jp" }),
  rss: buildRssFeed(blogMeta, blogItems),
  sitemap: buildSitemap(blogUrls),
};

const blogComments: Comment[] = [
  { id: "c1", postId: "p1", author: "山田", body: "b", status: "approved", createdAt: "2026-07-11T00:00:00Z" },
  { id: "c2", postId: "p1", author: "鈴木", body: "r", status: "approved", createdAt: "2026-07-12T00:00:00Z", parentId: "c1" },
];
const blogTree: CommentNode[] = buildCommentTree(approvedComments(blogComments));
export const blogCommentShape = {
  tree: blogTree.map((c) => ({ id: c.id, replies: (c.replies ?? []).length })),
  count: countComments(blogTree),
  pending: pendingCount(blogComments),
};

// ─────────────────────────── /cms ───────────────────────────
import { effectiveStatus, msUntilPublish, livePosts, scheduledPosts, diffRevisions,
         snapshotOf, validatePostInput, isValidSlug, buildPreviewUrl, summarizePosts,
         recentPosts, filterPosts, renameTagInPosts, mergeTagsInPosts, removeTagFromPosts,
         createMemoryPublishRequestStore, isAnnouncementLevel,
         type CmsPost, type CmsPostInput, type EffectiveStatus, type PublishRequestStatus,
         type RevisionDiff, type DiffLine, type PostFilter, type PostSummary,
         type AnnouncementLevel } from "@platform/cms";

/** ★`PostStatus` は 2 値だが `EffectiveStatus` は 3 値。**混同すると予約公開を見落とす**。 */
export const effectiveStatuses: EffectiveStatus[] = ["draft", "scheduled", "published"];
export const publishRequestStatuses: PublishRequestStatus[] = ["pending", "approved", "rejected"];
/** @platform/site の Announcement.level と同じ union に揃えた(基盤のバグを修正)。 */
export const announcementLevels: AnnouncementLevel[] = ["info", "warning", "sale"];

const cmsNow = new Date("2026-07-15T00:00:00Z");
const cmsPosts: CmsPost[] = [
  // ★status は published だが publishedAt が未来 → effectiveStatus は scheduled
  { slug: "a", title: "A", body: "b", tags: ["x"], status: "published", publishedAt: "2026-07-20T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z", categoryId: "c1" },
];
const cmsFilter: PostFilter = { status: "published", tag: "x" };

export const cmsShape = {
  eff: effectiveStatus(cmsPosts[0]!, cmsNow),
  // msUntilPublish は **number | null**
  until: msUntilPublish(cmsPosts[0]!, cmsNow) ?? 0,
  live: livePosts(cmsPosts, cmsNow),
  sched: scheduledPosts(cmsPosts, cmsNow),
  summary: summarizePosts(cmsPosts, cmsNow) satisfies PostSummary,
  recent: recentPosts(cmsPosts, 3, cmsNow),
  filtered: filterPosts(cmsPosts, cmsFilter, cmsNow),
  slug: isValidSlug("my-post"),
  preview: buildPreviewUrl("https://a.jp", "my-post", "tok"),
  level: isAnnouncementLevel("info"),
};
/** validatePostInput は **Result 風**(`{ ok, value }` / `{ ok, error }`)。error は **string**。 */
export const cmsValidated = (() => {
  const r = validatePostInput({ slug: "a", title: "A", body: "b" } satisfies CmsPostInput);
  return r.ok ? r.value.slug : r.error;
})();
/** diffRevisions の body は **DiffLine[]**。type は same/add/del。 */
const cmsDiff: RevisionDiff = diffRevisions(
  { title: "旧", body: "a\nb", status: "draft", categoryId: "c1" },
  { title: "新", body: "a\nc", status: "published" },
);
export const cmsDiffShape = {
  title: [cmsDiff.titleChanged, cmsDiff.titleFrom, cmsDiff.titleTo],
  status: [cmsDiff.statusChanged, cmsDiff.statusFrom, cmsDiff.statusTo],
  cat: [cmsDiff.categoryChanged, cmsDiff.categoryFrom ?? "—", cmsDiff.categoryTo ?? "—"],
  body: cmsDiff.body.map((l: DiffLine) => `${l.type}:${l.text}`),
  changed: cmsDiff.bodyChanged,
};
export const cmsSnapshot = snapshotOf(cmsPosts[0]!);
export const cmsTags = {
  renamed: renameTagInPosts(cmsPosts, "x", "z"),
  merged: mergeTagsInPosts(cmsPosts, ["x", "y"], "w"),
  removed: removeTagFromPosts(cmsPosts, "x"),
};
export async function cmsPublishFlow() {
  const store = createMemoryPublishRequestStore(() => "pr1", () => "2026-07-15T00:00:00Z");
  const pr = await store.request("a", "u-taro");
  // decide は **PublishRequest | undefined**(見つからないと undefined)
  const decided = await store.decide(pr.id, "approved", "u-admin", "OK");
  return { id: pr.id, status: decided?.status ?? "—", pending: (await store.list({ status: "pending" })).length };
}

// ─────────────────────────── /line ───────────────────────────
import { verifyLineSignature, parseLineWebhook, parsePostbackData, eventSourceId,
         lineRecipientType, isValidLineRecipient, textMessage, withQuickReply,
         messageAction, postbackAction, uriAction, buttonsTemplate, confirmTemplate,
         carouselTemplate, flexMessage, stickerMessage, imageMessage, locationMessage,
         type LineMessage, type LineAction, type LineRecipientType, type CarouselColumn } from "@platform/line";

export const lineRecipientTypes: LineRecipientType[] = ["user", "group", "room", "unknown"];
/** LineAction は **4 種類の union**。type で分岐する。 */
export const lineActions: LineAction[] = [
  messageAction("はい", "承認します"),
  postbackAction("承認", "action=approve&id=42", "承認しました"),
  uriAction("詳細", "https://a.jp/x"),
  { type: "datetimepicker", label: "日時", data: "d", mode: "datetime" },
];
export const lineMessages: LineMessage[] = [
  textMessage("x"),
  stickerMessage("446", "1988"),
  imageMessage("https://a.jp/x.png", "https://a.jp/s.png"),
  locationMessage({ title: "t", address: "a", latitude: 35.68, longitude: 139.76 }),
  withQuickReply(textMessage("選んで"), lineActions),
  buttonsTemplate({ altText: "a", title: "t", text: "x", actions: lineActions, thumbnailImageUrl: "https://a.jp/t.png" }),
  confirmTemplate("a", "x", lineActions[0]!, lineActions[1]!),
  carouselTemplate("a", [{ title: "t", text: "x", actions: [lineActions[0]!] }] satisfies CarouselColumn[]),
  flexMessage("a", { type: "bubble" }),
];

/**
 * ★webhook のイベントは **union**。`source` は必須、`message`/`postback` は
 * `in` で絞る。`parseLineWebhook` は **例外を投げず空配列**(TSDoc どおりに修正済み)。
 */
export const lineWebhookShape = parseLineWebhook('{"events":[]}').map((e) => ({
  type: e.type,
  srcType: e.source.type,
  src: eventSourceId(e.source) ?? "—",
  pb: "postback" in e && e.postback !== undefined ? parsePostbackData(e.postback.data) : null,
  txt: "message" in e && e.message !== undefined ? e.message.text : undefined,
}));
export const lineShape = {
  verified: verifyLineSignature("{}", "sig", "secret"),
  rt: lineRecipientType("U1234567890abcdef1234567890abcdef"),
  valid: isValidLineRecipient("U1234567890abcdef1234567890abcdef"),
  pb: parsePostbackData("action=approve&id=42"),
};

// ─────────────────────────── /ekyc ───────────────────────────
import { normalizeEkycStatus, isEkycFinal, isEkycApproved, verifyEkycSignature, parseEkycWebhook,
         createEkycClient, createTrustdockClient,
         type EkycStatus, type EkycWebhookEvent, type EkycEndpoints, type EkycClientConfig } from "@platform/ekyc";

/** ★8 値。**pending という状態は無い**(TSDoc が嘘をついていたので修正済み)。 */
export const ekycStatuses: EkycStatus[] = ["created", "submitted", "in_review", "approved", "rejected", "expired", "canceled", "unknown"];
export const ekycLabels: Record<EkycStatus, string> = {
  created: "申込作成済み", submitted: "書類提出済み", in_review: "審査中", approved: "承認",
  rejected: "却下", expired: "期限切れ", canceled: "取消", unknown: "不明",
};

/**
 * `parseEkycWebhook` は **例外を投げない**(修正済み)。戻り値は `EkycWebhookEvent`(null ではない)。
 * `applicationId` / `rawStatus` / `reason` は **任意**なので `??` が要る。
 */
const ekycEvent: EkycWebhookEvent = parseEkycWebhook('{"application_id":"a","status":"approved"}');
export const ekycShape = {
  id: ekycEvent.applicationId ?? "—",
  status: ekycEvent.status,
  raw: ekycEvent.rawStatus ?? "—",
  reason: ekycEvent.reason ?? "—",
  rawKeys: Object.keys(ekycEvent.raw),
  // 独自語彙とフィールド名の上書き
  custom: parseEkycWebhook('{"uid":"x","state":"done"}', { idField: "uid", statusField: "state", statusMapping: { done: "approved" } }).status,
  norm: normalizeEkycStatus("APPROVED"),
  unknown: normalizeEkycStatus("謎"),
  final: isEkycFinal("unknown"),
  approved: isEkycApproved("approved"),
  // 署名は hex / base64 の 2 方式
  sigHex: verifyEkycSignature("{}", "abc", "s", "hex"),
  sigB64: verifyEkycSignature("{}", "YWJj", "s", "base64"),
};

/** ★`endpoints` は **Partial**(既定値がある)。`baseUrl` が必須。 */
const ekycEndpoints: Partial<EkycEndpoints> = { getApplication: "/v2/applications/:id" };
const ekycConfig: EkycClientConfig = {
  apiKey: "k", baseUrl: "https://sandbox.example",
  authHeader: "Authorization", apiKeyPrefix: "Bearer ",
  endpoints: ekycEndpoints, fetchImpl: async () => new Response("{}"),
};
export async function ekycClientShape() {
  const c = createEkycClient(ekycConfig);
  const t = createTrustdockClient({ apiKey: "k", fetchImpl: async () => new Response("{}") });
  const r = await c.createApplication({ name: "山田" });
  const g = await t.getApplication("app_1");
  await c.listApplications({ status: "approved", limit: 10 });
  await c.cancelApplication("app_1");
  await c.getImageUrls("app_1");
  return { created: r.ok ? "ok" : r.error.message, got: g.ok ? "ok" : g.error.message };
}

// ─────────────────────────── /session ───────────────────────────
import { createLoginThrottle, createMemoryThrottleStore, stepUpRequired, markAuthenticated,
         sessionMaxAge, createLoginAudit, summarizeLoginEvent, serializeCookie, parseCookies,
         getCookie, clearCookie, createIdleTimer, bindActivityListeners,
         type LoginEventType, type LoginAuditEvent, type LoginAuditSink, type ThrottleCheck,
         type LoginThrottleConfig, type IdleTimerConfig, type IdleTimer, type ActivityTarget,
         type StepUpConfig, type RememberMeConfig, type CookieOptions, type SessionConfig } from "@platform/session";

/** ★10 種類。ラベル表が漏れると監査画面が空欄になる。 */
export const loginEventTypes: LoginEventType[] = [
  "login_success", "login_failure", "logout", "account_locked", "session_expired",
  "idle_logout", "step_up_success", "step_up_failure", "password_changed", "all_sessions_revoked",
];
/** ★`sameSite` は **大文字始まり**("lax" ではない)。 */
export const sessionCookieOpts: CookieOptions = { maxAge: 3600, httpOnly: true, secure: true, sameSite: "Lax", path: "/" };
/** ★`salt` は **必須**(固定の既定値を持たせない = 複数環境で同一鍵にしない)。 */
export const sessionConfigShape: SessionConfig = { secret: "x".repeat(32), salt: "env-unique-salt", maxAgeSec: 3600, idleTimeoutSec: 1800 };

let sessionClock = 0;
const throttleCfg: LoginThrottleConfig = {
  maxFails: 3, windowMs: 900_000, lockMs: 60_000, progressive: true, maxLockMs: 86_400_000,
  store: createMemoryThrottleStore(() => sessionClock), now: () => sessionClock,
};
const sessionThrottle = createLoginThrottle(throttleCfg);
/** ★メソッドは **`recordFailure` / `recordSuccess`**(`fail` / `success` ではない)。 */
export async function sessionThrottleShape() {
  const c: ThrottleCheck = await sessionThrottle.check("u");
  await sessionThrottle.recordFailure("u");
  await sessionThrottle.recordSuccess("u");
  return { allowed: c.allowed, retry: c.retryAfterMs ?? 0, remaining: c.remaining ?? 0 };
}

const stepCfg: StepUpConfig = { freshnessSec: 300, now: () => sessionClock };
const rememberCfg: RememberMeConfig = { defaultMaxAgeSec: 3600, rememberMaxAgeSec: 2592000 };
export const sessionStepShape = {
  required: stepUpRequired(undefined, stepCfg),
  fresh: stepUpRequired(markAuthenticated(() => sessionClock), stepCfg),
  normal: sessionMaxAge(false, rememberCfg),
  remember: sessionMaxAge(true, rememberCfg),
};

/** ★`LoginAuditSink` は **`record`**(`write` ではない)。「誰が」は **`subject`**(`userId` ではない)。 */
const sessionEvents: LoginAuditEvent[] = [];
const sessionSink: LoginAuditSink = { record: (e: LoginAuditEvent) => { sessionEvents.push(e); } };
const sessionAudit = createLoginAudit(sessionSink, { now: () => new Date(sessionClock) });
export const sessionAuditShape = {
  audit: [
    () => sessionAudit.loginSuccess({ subject: "a@b.jp", ip: "1.2.3.4", method: "password" }),
    () => sessionAudit.loginFailure({ subject: "a@b.jp", reason: "パスワード不一致" }),
    () => sessionAudit.accountLocked({ subject: "a@b.jp" }),
    () => sessionAudit.idleLogout({ subject: "a@b.jp" }),
    () => sessionAudit.stepUpSuccess({ subject: "a@b.jp", method: "totp" }),
    () => sessionAudit.allSessionsRevoked({ subject: "a@b.jp", reason: "パスワード変更" }),
  ],
  summarize: (e: LoginAuditEvent) => summarizeLoginEvent(e),
};

/** ★`IdleTimer` のメソッドは **`activity()`**(`touch()` ではない)。 */
const idleCfg: IdleTimerConfig = {
  timeoutMs: 1_800_000, warnBeforeMs: 120_000,
  onWarn: (ms: number) => { void ms; }, onIdle: () => {}, onActive: () => {},
  scheduler: { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) },
  now: () => sessionClock,
};
const sessionTimer: IdleTimer = createIdleTimer(idleCfg);
/** `bindActivityListeners` は **`ActivityTarget`**(Window 型を使わない)。戻り値の解除関数を必ず呼ぶ。 */
export const sessionTimerShape = {
  ops: [() => sessionTimer.start(), () => sessionTimer.activity(), () => sessionTimer.stop()],
  bind: (t: ActivityTarget) => bindActivityListeners(sessionTimer, t),
};
export const sessionCookieShape = {
  ser: serializeCookie("session", "v", sessionCookieOpts),
  parsed: parseCookies("a=1; b=2"),
  got: getCookie("a=1; b=2", "a") ?? "—",
  cleared: clearCookie("session", { path: "/" }),
};

// ─────────────────────────── /theme ───────────────────────────
import { builtInThemes, deriveTheme, checkTheme, checkThemeContrast, findContrastIssues,
         themeToCssVars, cssVarsToString, themeToCssBlock, buildThemeStylesheet,
         validateTheme, parseTheme, themeToJson, themesToJson, themesFromJson,
         createThemeRegistry, isValidThemeId, applySkin,
         type Theme, type ThemeMode, type ThemeSeed, type ThemeShape,
         type ContrastCheck, type ThemeContrastReport, type ThemeValidationIssue,
         type ThemeRegistry } from "@platform/theme";

export const themeModes: ThemeMode[] = ["light", "dark"];
/** ★`base` は 3 値。`ContrastCheck.level` は 3 値。 */
export const themeBases: NonNullable<ThemeSeed["base"]>[] = ["light", "warm", "cool"];
export const contrastLevels: ContrastCheck["level"][] = ["AAA", "AA", "fail"];

/** ★`deriveTheme` は **primary 1 色だけで動く**(他は任意)。 */
const themeSeed: ThemeSeed = {
  id: "my-brand", name: "自社ブランド", description: "d",
  primary: "#0057b8", accent: "#e8a33d", base: "cool",
  shape: { radius: 8, spacing: 4 } satisfies Partial<ThemeShape>,
};
export const derivedTheme: Theme = deriveTheme(themeSeed);
export const minimalTheme: Theme = deriveTheme({ id: "x", name: "x", primary: "#0057b8" });

/** `checkTheme` は **light/dark の 2 件**、`checkThemeContrast` は 1 件。 */
export const themeA11y = {
  both: checkTheme(derivedTheme) satisfies ThemeContrastReport[],
  one: checkThemeContrast(derivedTheme, "light"),
  ok: checkThemeContrast(derivedTheme, "light").passesAA,
  min: checkThemeContrast(derivedTheme, "light").minRatio,
  checks: checkThemeContrast(derivedTheme, "light").checks.map((c: ContrastCheck) => `${c.label}: ${c.ratio} ${c.level}`),
  // ★組込 11 スキンのうち **7 件が AA 未達**(実測)
  issues: findContrastIssues(builtInThemes),
};
export const themeCss = {
  vars: themeToCssVars(derivedTheme, "light"),
  str: cssVarsToString(themeToCssVars(derivedTheme, "light")),
  block: themeToCssBlock(derivedTheme, "light", '[data-skin="my-brand"]'),
  sheet: buildThemeStylesheet([derivedTheme]),
};
/** ★`validateTheme` は **不備の配列**(空なら OK)。`parseTheme` / `themesFromJson` は **例外を投げる**。 */
export const themeSerialize = {
  issues: validateTheme(derivedTheme) satisfies ThemeValidationIssue[],
  bad: validateTheme({ id: "x" }),
  json: themeToJson(derivedTheme),
  all: themesToJson(builtInThemes),
  parsed: parseTheme(JSON.parse(themeToJson(derivedTheme))),
  back: themesFromJson(themesToJson([derivedTheme])),
  validId: isValidThemeId("my-brand"),
};
export const themeRegistry: ThemeRegistry = createThemeRegistry({ themes: [...builtInThemes, derivedTheme] });
/** `applySkin` は DOM を触るので client でのみ呼ぶ。 */
export const applySkinRef = applySkin;

// ─────────────────────────── /expenses ───────────────────────────
import { extractReceiptFields, extractReceiptFieldsWithConfidence, extractTaxBreakdown,
         normalizeOcrText, parseJapaneseDate, findRegistrationNumber, findPhone,
         extractAmount, extractLineItems } from "@platform/ocr";
import { expenseJournal, salesJournal, purchaseJournal, receiptJournal, paymentJournal,
         debitTotal, creditTotal, isBalanced, trialBalance, profitAndLoss, balanceSheet,
         defaultAccountTypes, filterByPeriod, consumptionTaxSummary, journalToRows, entryKey,
         DEFAULT_ACCOUNTS,
         type JournalEntry, type JournalLine, type AccountNames, type ExpensePayment,
         type RateAmount } from "@platform/accounting";

/** ★決済方法で **貸方が変わる**(未払金 / 現金預金 / 仮払金)。 */
export const expensePayments: ExpensePayment[] = ["unpaid", "cash", "advance"];

/**
 * ★`expenseJournal` の引数は **`payment`**(TSDoc が `settlement` と書いていたので修正済み)。
 * `filterByPeriod` は **yearMonth 1 つ**(from/to ではない)。
 * `consumptionTaxSummary` は **売上と仕入の RateAmount[]**(仕訳ではない)。
 */
const expJournal: JournalEntry = expenseJournal(
  { date: "2026-01-12", description: "文具", net: 3000, tax: 300, account: "消耗品費", payment: "unpaid" },
  DEFAULT_ACCOUNTS satisfies AccountNames,
);
const expEntries: JournalEntry[] = [
  expJournal,
  salesJournal({ date: "2026-01-05", net: 10000, tax: 1000 }),
  purchaseJournal({ date: "2026-01-06", net: 5000, tax: 500 }),
  receiptJournal({ date: "2026-01-31", amount: 11000 }),
  paymentJournal({ date: "2026-02-28", amount: 5500 }),
];
export const accountingShape = {
  lines: expJournal.lines.map((l: JournalLine) => `${l.account} 借${l.debit} 貸${l.credit}`),
  debit: debitTotal(expJournal),
  credit: creditTotal(expJournal),
  balanced: isBalanced(expJournal),
  tb: trialBalance(expEntries),
  // ★未登録の科目は集計されない(勝手に費用扱いしない = 安全側)
  plDefault: profitAndLoss(expEntries),
  plExtra: profitAndLoss(expEntries, { ...defaultAccountTypes(), 消耗品費: "expense" }),
  bs: balanceSheet(expEntries),
  period: filterByPeriod(expEntries, "2026-01"),
  tax: consumptionTaxSummary([{ rate: 10, net: 10000, tax: 1000 }] satisfies RateAmount[], [{ rate: 10, net: 5000, tax: 500 }]),
  rows: journalToRows(expEntries),
  key: entryKey(expJournal),
};

/** ★`extractReceiptFieldsWithConfidence` は **オブジェクト**を取る(文字列ではない)。 */
const ocrText = "文具堂\n令和8年1月12日\n登録番号 T1234567890123\n10%対象 3,000円\n消費税 300円\n合計 ¥3,300";
export const ocrShape = {
  normalized: normalizeOcrText("合　計　¥３，３００"),
  fields: extractReceiptFields(ocrText),
  conf: extractReceiptFieldsWithConfidence({ text: ocrText, confidence: 0.82 }),
  breakdown: extractTaxBreakdown(ocrText),
  amount: extractAmount(ocrText) ?? 0,
  // ★和暦を ISO に変換する
  date: parseJapaneseDate("令和8年1月12日") ?? "—",
  reg: findRegistrationNumber(ocrText) ?? "（なし・免税事業者）",
  phone: findPhone("TEL 03-1234-5678") ?? "—",
  items: extractLineItems(ocrText),
};

// ─────────────────────────── /import-history ───────────────────────────
import { validateRows, runImport, rowsToObjects,
         type RowResult, type RowValidator, type ValidRow, type ErrorRow,
         type ValidationReport, type ImportResult, type ImportOptions } from "@platform/importer";
import { parseCsv, toCsv, csvEscape } from "@platform/csv";

interface ImpRow { date: string; vendor: string; amount: number }
type ImpRaw = Record<string, string>;

/**
 * ★`parseCsv` は **戻り値が union**(`header` の有無で `string[][]` か `Record<string,string>[]`)。
 * 呼び出し側で絞る必要がある。
 */
const impCsv = "日付,支払先,金額\n2026-02-01,文具堂,3300\n,JR東日本,1100";
const impRaw = parseCsv(impCsv) as string[][];
const impObjs = parseCsv(impCsv, { header: true }) as ImpRaw[];
export const csvShape = {
  raw: impRaw,
  objs: impObjs,
  // header: true なら rowsToObjects は要らない
  viaRowsToObjects: rowsToObjects(impRaw[0] ?? [], impRaw.slice(1)),
  out: toCsv([{ a: 1, b: "x,y" }]),
  esc: csvEscape('a"b'),
};

/** `RowValidator` は **`{ ok, value }` か `{ ok, errors }`**(Result 型とは別物)。 */
const impValidate: RowValidator<ImpRaw, ImpRow> = (raw, rowIndex): RowResult<ImpRow> => {
  void rowIndex;
  const errors: string[] = [];
  const date = (raw["日付"] ?? "").trim();
  const vendor = (raw["支払先"] ?? "").trim();
  const amount = Number(raw["金額"]);
  if (date === "") errors.push("日付が空です");
  if (vendor === "") errors.push("支払先が空です");
  if (!Number.isFinite(amount)) errors.push("金額が数値ではありません");
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: { date, vendor, amount } };
};

/** `rowIndex` は **0 始まり**(画面には +1 して出す)。 */
export const importerShape = (() => {
  const rep: ValidationReport<ImpRaw, ImpRow> = validateRows(impObjs, impValidate);
  return {
    valid: rep.valid.map((v: ValidRow<ImpRow>) => `${v.rowIndex}: ${v.value.vendor}`),
    errors: rep.errors.map((e: ErrorRow<ImpRaw>) => `${e.rowIndex}: ${e.errors.join(" / ")}`),
    allValid: rep.allValid,
    total: rep.total,
  };
})();

/** ★`partial` の既定は **false**(1 行でもエラーなら全体を中止 = 安全側)。 */
const impOpts: ImportOptions<ImpRow> = { dryRun: false, partial: true, apply: async (v) => { void v; } };
export async function importerRun(): Promise<ImportResult<ImpRaw, ImpRow>> {
  const r = await runImport(impObjs, impValidate, impOpts);
  return r;
}
