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
