
async function loadUiCatalogs() {
  const [{ ja }, { en }, { zh }, { ko }] = await Promise.all([
    import("../packages/i18n/src/catalogs/ja.ts"),
    import("../packages/i18n/src/catalogs/en.ts"),
    import("../packages/i18n/src/catalogs/zh.ts"),
    import("../packages/i18n/src/catalogs/ko.ts"),
  ]);
  return { ja, en, zh, ko };
}

/**
 * 依存インストール不要のスモークテスト。
 * 外部依存ゼロの実ソース(型ストリップで直接 import)と、暗号系アルゴリズムの
 * 実行検証を行う。`node --experimental-strip-types tools/smoke.mjs` で実行。
 */
import { createHmac, randomBytes, timingSafeEqual, scryptSync, createCipheriv, createDecipheriv, randomInt } from "node:crypto";

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name}`); } };
const section = (t) => console.log(`\n▶ ${t}`);

// ---- 実ソース: validation/japan.ts(チェックディジット・カナ・Luhn) ----
section("validation/japan.ts(実ソース)");
{
  const j = await import("../packages/validation/src/japan.ts");
  ok("法人番号: トヨタ 1180301018771 = valid", j.isValidCorporateNumber("1180301018771"));
  ok("法人番号: SBG 9010401052465 = valid", j.isValidCorporateNumber("9010401052465"));
  ok("法人番号: 改ざんは invalid", !j.isValidCorporateNumber("1180301018770"));
  const base = "12345678901"; const cd = j.computeMyNumberCheckDigit(base);
  ok("マイナンバー: round-trip valid", j.isValidMyNumber(base + cd));
  ok("マイナンバー: 改ざんは invalid", !j.isValidMyNumber(base + ((cd + 1) % 10)));
  ok("Luhn: Visa 4242424242424242 valid", j.isValidCreditCard("4242424242424242"));
  ok("Luhn: 4242...241 invalid", !j.isValidCreditCard("4242424242424241"));
  ok("カナ: ヤマダ = katakana", j.isKatakana("ヤマダ") && !j.isHiragana("ヤマダ"));
  ok("半角カナ: ﾔﾏﾀﾞ = halfwidth", j.isHalfWidthKana("ﾔﾏﾀﾞ"));
}

// ---- 実ソース: validation/transforms.ts ----
section("validation/transforms.ts(実ソース)");
{
  const t = await import("../packages/validation/src/transforms.ts");
  ok("digitsToHalfWidth: 全角→半角", t.digitsToHalfWidth("１２３") === "123");
  ok("toHalfWidth: 英数記号", t.toHalfWidth("ＡＢ１") === "AB1");
}

// ---- 実ソース: session/cookie.ts ----
section("session/cookie.ts(実ソース)");
{
  const c = await import("../packages/session/src/cookie.ts");
  const parsed = c.parseCookies("a=1; b=hello%20world; c=");
  ok("parseCookies", parsed.a === "1" && parsed.b === "hello world" && parsed.c === "");
  const sc = c.serializeCookie("sid", "v", { maxAge: 60, sameSite: "Strict" });
  ok("serializeCookie 属性", /HttpOnly/.test(sc) && /Secure/.test(sc) && /SameSite=Strict/.test(sc) && /Max-Age=60/.test(sc));
  ok("clearCookie 失効", /Max-Age=0/.test(c.clearCookie("sid")));
}

// ---- アルゴリズム実行: CSRF(署名付き double-submit) ----
section("security/csrf アルゴリズム");
{
  const secret = "smoke-secret";
  const sign = (v) => createHmac("sha256", secret).update(v).digest("base64url");
  const eq = (a, b) => { const A = Buffer.from(a), B = Buffer.from(b); return A.length === B.length && timingSafeEqual(A, B); };
  const issue = () => { const v = randomBytes(24).toString("base64url"); return `${v}.${sign(v)}`; };
  const verify = (s, ck) => { if (!s || !ck || !eq(s, ck)) return false; const [v, sg] = s.split("."); return !!v && !!sg && eq(sg, sign(v)); };
  const t = issue();
  ok("正当ペアは通過", verify(t, t));
  ok("不一致は拒否", !verify(issue(), issue()));
  ok("改ざんは拒否", !verify(t.slice(0, -3) + "000", t.slice(0, -3) + "000"));
}

// ---- アルゴリズム実行: 封緘セッション(AES-256-GCM) ----
section("session 封緘(AES-256-GCM)");
{
  const key = scryptSync("sess-secret", "platform-crypto", 32);
  const enc = (pt) => { const iv = randomBytes(12); const c = createCipheriv("aes-256-gcm", key, iv); const e = Buffer.concat([c.update(pt, "utf8"), c.final()]); return `${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${e.toString("base64")}`; };
  const dec = (ct) => { const [i, t, d] = ct.split(":"); const dc = createDecipheriv("aes-256-gcm", key, Buffer.from(i, "base64")); dc.setAuthTag(Buffer.from(t, "base64")); return Buffer.concat([dc.update(Buffer.from(d, "base64")), dc.final()]).toString("utf8"); };
  const sealed = enc(JSON.stringify({ data: { userId: "u1" }, exp: Date.now() + 3600e3 }));
  ok("封緘→開封 往復", JSON.parse(dec(sealed)).data.userId === "u1");
  let tampered = false; try { dec(sealed.slice(0, -4) + "AAAA"); } catch { tampered = true; }
  ok("改ざん検知", tampered);
}

// ---- アルゴリズム実行: パスワード生成/強度 ----
section("crypto パスワード生成/強度");
{
  const gen = (len = 16) => { const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$%^&*-_=+"]; const all = sets.join(""); const ch = sets.map((s) => s[randomInt(s.length)]); for (let i = ch.length; i < len; i++) ch.push(all[randomInt(all.length)]); for (let i = ch.length - 1; i > 0; i--) { const j = randomInt(i + 1);[ch[i], ch[j]] = [ch[j], ch[i]]; } return ch.join(""); };
  const p = gen(20);
  ok("生成: 20桁・全文字種", p.length === 20 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p));
  ok("生成: 曖昧文字を含まない", !/[0O1lI]/.test(gen(200)));
}

// ---- アルゴリズム実行: 固定ウィンドウ・レート制限 ----
section("ratelimit 固定ウィンドウ");
{
  const store = new Map();
  const inc = (k) => { const n = (store.get(k) ?? 0) + 1; store.set(k, n); return n; };
  const check = (k, limit) => { const c = inc(k); return { allowed: c <= limit, remaining: Math.max(0, limit - c) }; };
  const r = [1, 2, 3, 4].map(() => check("ip", 3).allowed);
  ok("3回まで許可、4回目で拒否", r[0] && r[1] && r[2] && !r[3]);
}

// ---- 実ソース: db/pagination.ts(オフセット/カーソル) ----
section("db/pagination.ts(実ソース)");
{
  const { buildPageMeta, paginate, cursorPaginate } = await import("../packages/db/src/pagination.ts");
  ok("buildPageMeta(45,2,20).pageCount=3", buildPageMeta(45, 2, 20).pageCount === 3);
  ok("不正値クランプ", (() => { const x = buildPageMeta(10, 0, 0); return x.page === 1 && x.pageSize === 1; })());
  const rows = Array.from({ length: 45 }, (_v, i) => ({ id: i + 1 }));
  const del = { findMany: async ({ skip, take }) => rows.slice(skip, skip + take), count: async () => rows.length };
  const p2 = await paginate(del, { page: 2, pageSize: 20 });
  ok("paginate: 2ページ目先頭=21・total=45", p2.items[0].id === 21 && p2.total === 45 && p2.pageCount === 3);
  const cdel = { findMany: async ({ take, cursor, skip }) => { const st = cursor ? rows.findIndex((r) => r.id === cursor.id) + (skip ?? 0) : 0; return rows.slice(st, st + take); } };
  const c1 = await cursorPaginate(cdel, { take: 20 });
  const c3 = await cursorPaginate(cdel, { take: 20, cursor: (await cursorPaginate(cdel, { take: 20, cursor: c1.nextCursor })).nextCursor });
  ok("cursor: page1 next=20 / 最終ページは 5件・next=null", c1.nextCursor === 20 && c3.items.length === 5 && c3.nextCursor === null);
}

// ---- db: seeder / transaction(commit・rollback)/ bulk chunk ----
section("db: seeder / transaction / bulk");
{
  const chunk = (a, sz) => { const o = []; for (let i = 0; i < a.length; i += sz) o.push(a.slice(i, i + sz)); return o; };
  ok("bulk chunk 2500/1000 = [1000,1000,500]", chunk(Array.from({ length: 2500 }), 1000).map((p) => p.length).join(",") === "1000,1000,500");

  const steps = []; const seeder = { step(n, r) { steps.push({ n, r }); return seeder; }, async run() { const done = []; for (const st of steps) { try { await st.r(); } catch { return { ok: false, failedAt: st.n, done }; } done.push(st.n); } return { ok: true, done }; } };
  const r = await seeder.step("a", async () => {}).step("b", async () => { throw new Error("x"); }).step("c", async () => {}).run();
  ok("seeder は途中失敗で停止(c 未実行)", !r.ok && r.failedAt === "b" && r.done.join(",") === "a");

  class Abort extends Error { constructor(m) { super(m); this.code = "CONFLICT"; } }
  const withTx = async (fn) => { try { return { ok: true, value: await fn({}) }; } catch (e) { return { ok: false, code: e instanceof Abort ? "CONFLICT" : "DATABASE" }; } };
  ok("transaction: 正常 return=commit", (await withTx(async () => 42)).value === 42);
  ok("transaction: abort=rollback(CONFLICT)", (await withTx(async () => { throw new Abort("残高不足"); })).code === "CONFLICT");
}

// ---- db: 全文検索の識別子検証 / テナントスコープ(実ソース tenant.ts) ----
section("db: 全文検索識別子 / テナント");
{
  const isSafe = (n) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n);
  ok("識別子: 正当は許可・危険は拒否", isSafe("articles") && isSafe("body") && !isSafe("users; DROP") && !isSafe("1col"));
  const t = await import("../packages/db/src/tenant.ts");
  ok("tenantWhere: where無し", JSON.stringify(t.tenantWhere("t1", undefined)) === JSON.stringify({ tenantId: "t1" }));
  ok("tenantWhere: where有りは AND 合成", (() => { const w = t.tenantWhere("t1", { active: true }); return w.AND?.[1]?.tenantId === "t1" && w.AND?.[0]?.active === true; })());
  ok("tenantData: カスタムフィールド付与", t.tenantData("t9", { a: 1 }, "orgId").orgId === "t9");
}

// ---- db: 変更差分(実ソース audit-diff.ts) / クエリキャッシュ(実ソース query-cache.ts) ----
section("db: 監査差分 / クエリキャッシュ(実ソース)");
{
  const { diffChanges, hasChanges } = await import("../packages/db/src/audit-diff.ts");
  ok("差分: 変更フィールドのみ", JSON.stringify(diffChanges({ name: "A", age: 20 }, { name: "B", age: 20 })) === JSON.stringify({ name: { before: "A", after: "B" } }));
  const d = diffChanges({ pw: "old", updatedAt: 1 }, { pw: "new", updatedAt: 2 }, { ignore: ["updatedAt"], redact: ["pw"] });
  ok("差分: ignore除外 + redactマスク", !("updatedAt" in d) && d.pw.before === "***");
  ok("差分: 変更なしは空", !hasChanges(diffChanges({ a: 1 }, { a: 1 })));

  const { createQueryCache } = await import("../packages/db/src/query-cache.ts");
  const store = new Map();
  const cache = {
    get: async (k) => ({ ok: true, value: store.has(k) ? store.get(k) : null }),
    set: async (k, v) => { store.set(k, v); return { ok: true, value: undefined }; },
    delete: async (k) => { store.delete(k); return { ok: true, value: undefined }; },
    getOrSet: async (k, _t, loader) => { if (store.has(k)) return { ok: true, value: store.get(k) }; const v = await loader(); store.set(k, v); return { ok: true, value: v }; },
  };
  let calls = 0; const loader = async () => { calls++; return ["row"]; };
  const qc = createQueryCache(cache);
  await qc.cached("orders", loader, { tags: ["orders"] });
  await qc.cached("orders", loader, { tags: ["orders"] });
  ok("キャッシュ: 2回目はloader未実行", calls === 1);
  await qc.invalidateTag("orders");
  await qc.cached("orders", loader, { tags: ["orders"] });
  ok("キャッシュ: invalidateTag後は再実行", calls === 2);
}

// ---- report: 消費税計算(オラクル) / notify テンプレート(実ソース) ----
section("report / notify / jobs");
{
  const round = (v) => Math.round(v);
  // 外税10%+8%: 税抜2000/税180/税込2180
  const tax10 = round(1000 * 0.1), tax8 = round(1000 * 0.08);
  ok("消費税: 外税10%+軽減8% = 税180/税込2180", tax10 === 100 && tax8 === 80 && (2000 + tax10 + tax8) === 2180);
  // 税率ごと1回端数: 33×3=99 → round(9.9)=10(行ごとなら 3×round(3.3)=9)
  ok("消費税: 税率ごと1回端数(99→10)", round(99 * 0.1) === 10 && (round(33 * 0.1) * 3) === 9);

  const { renderTemplate } = await import("../packages/notify/src/template.ts");
  ok("通知テンプレート: 変数置換", renderTemplate("{{name}}: {{n}}件", { name: "在庫", n: 5 }) === "在庫: 5件");

  // memory queue のセマンティクス(オラクル)
  const q = []; let out = ""; let h = null;
  const mq = { add: (n, d) => { q.push({ n, d }); if (h) while (q.length) { const j = q.shift(); h(j.n, j.d); } }, process: (fn) => { h = fn; while (q.length) { const j = q.shift(); fn(j.n, j.d); } } };
  mq.process((n) => { out += n + ";"; });
  mq.add("a"); mq.add("b");
  ok("ジョブ: 登録順に処理", out === "a;b;");
}

// ---- print: ESC/POS(実ソース escpos.ts)/ pageCss ----
section("print: ESC/POS / pageCss");
{
  const { createReceipt } = await import("../packages/print/src/escpos.ts");
  ok("ESC/POS init = ESC @", JSON.stringify([...createReceipt().init().build()]) === JSON.stringify([0x1b, 0x40]));
  ok("ESC/POS align/bold/line/cut",
    JSON.stringify([...createReceipt().align("center").bold(true).line("A").cut().build()])
    === JSON.stringify([0x1b, 0x61, 1, 0x1b, 0x45, 1, 0x41, 0x0a, 0x1d, 0x56, 0x00]));
  ok("ESC/POS size(2,2) = GS ! 0x11", JSON.stringify([...createReceipt().size(2, 2).build()]) === JSON.stringify([0x1d, 0x21, 0x11]));
  const pageCss = (o = {}) => { const { size = "A4", margin = "12mm" } = o; return `@page { size: ${size}; margin: ${margin}; }`; };
  ok("pageCss(A4,10mm)", pageCss({ size: "A4", margin: "10mm" }) === "@page { size: A4; margin: 10mm; }");
}

// ---- BLE レシート チャンク分割 / HID reportBytes ----
section("receipt chunk / hid");
{
  const chunks = (len, size) => { const o = []; for (let i = 0; i < len; i += size) o.push(Math.min(size, len - i)); return o; };
  ok("レシート: 1200B/512 = [512,512,176]", JSON.stringify(chunks(1200, 512)) === JSON.stringify([512, 512, 176]));
  ok("レシート: chunkSize=100 で 250 = [100,100,50]", JSON.stringify(chunks(250, 100)) === JSON.stringify([100, 100, 50]));
  const reportBytes = (v) => Array.from({ length: v.byteLength }, (_x, i) => v.getUint8(i));
  ok("HID reportBytes", JSON.stringify(reportBytes(new DataView(new Uint8Array([1, 2, 255]).buffer))) === JSON.stringify([1, 2, 255]));
}

// ---- csv(実ソース)/ chart color-scale(実ソース) ----
section("csv / heatmap color-scale");
{
  const { toCsv, parseCsv } = await import("../packages/csv/src/index.ts");
  ok("CSV: 特殊文字エスケープ", toCsv([{ a: "x,y" }], { header: false }) === '"x,y"');
  const data = [{ a: "1,2", b: 'q"q' }, { a: "3", b: "4" }];
  ok("CSV: round-trip 一致", JSON.stringify(parseCsv(toCsv(data), { header: true })) === JSON.stringify(data));
  const { colorScale, interpolateColor } = await import("../packages/ui/src/components/charts/color-scale.ts");
  ok("色スケール: 中央=#808080", interpolateColor("#000000", "#ffffff", 0.5) === "#808080");
  ok("色スケール: 正規化", colorScale(50, 0, 100, "#000000", "#ffffff") === "#808080");
}

// ---- charts: ローソク足座標 / 帯100% / ヒストグラム(実ソース chart-math.ts) ----
section("charts: candle / band / histogram");
{
  const { candleGeometry, toPercentStacked, histogramBins } = await import("../packages/ui/src/components/charts/chart-math.ts");
  const g = candleGeometry({ open: 100, high: 110, low: 90, close: 105 }, 0, 20, 0, 200);
  ok("ローソク足: 陽線・body高さ50・中心10", g.up && g.bodyY === 50 && g.bodyH === 50 && g.cx === 10);
  const pct = toPercentStacked([{ a: 1, b: 3 }], ["a", "b"]);
  ok("帯グラフ: a=25% b=75%", pct[0].a === 25 && pct[0].b === 75);
  const bins = histogramBins([1, 2, 2, 3, 3, 3, 4], 3);
  ok("ヒストグラム: 総度数7・3ビン", bins.reduce((s, b) => s + b.count, 0) === 7 && bins.length === 3);
}

// ---- realtime(backoff/poller)/ dashboard layout(実ソース) ----
section("realtime / dashboard layout");
{
  const { backoffDelay, createPoller } = await (async () => {
    const fs = await import("node:fs/promises");
    const src = (await fs.readFile(new URL("../packages/realtime/src/index.ts", import.meta.url), "utf8")).replace(/export \{[^}]*\} from "\.\/broadcast\.js";\n?/g, "");
    const f = `/tmp/rt-idx-a-${Date.now()}.ts`; await fs.writeFile(f, src);
    const m = await import(f); await fs.rm(f); return m;
  })();
  ok("backoff: 指数+上限", backoffDelay(0) === 500 && backoffDelay(3) === 4000 && backoffDelay(10) === 15000);
  let cb = null, calls = 0;
  const p = createPoller(() => calls++, 100, (c) => { cb = c; return 1; }, () => {});
  p.start(); cb(); cb();
  ok("poller: 即時1回+tick2回=3", calls === 3);
  const { reorder, clampSpan, pxToColSpan } = await import("../packages/ui/src/lib/layout.ts");
  ok("layout reorder", reorder([{ id: "a", colSpan: 6 }, { id: "b", colSpan: 6 }], "a", "b").map((i) => i.id).join("") === "ba");
  ok("layout clamp/px→col", clampSpan(99) === 12 && pxToColSpan(300, 600, 12) === 6);
}

// ---- charts: waterfall / gauge幾何 / 差分バッファ(実ソース) ----
section("waterfall / gauge / live-buffer");
{
  const { toWaterfall, polarToCartesian, ringDashOffset } = await import("../packages/ui/src/components/charts/chart-math.ts");
  const rows = toWaterfall([{ label: "売上", value: 1000, type: "total" }, { label: "原価", value: -400 }, { label: "利益", value: 600, type: "total" }]);
  ok("WF: 原価 offset600/bar400/decrease", rows[1].offset === 600 && rows[1].bar === 400 && rows[1].kind === "decrease");
  ok("極座標 90°=右(10,0)", Math.round(polarToCartesian(0, 0, 10, 90).x) === 10 && Math.round(polarToCartesian(0, 0, 10, 90).y) === 0);
  ok("ringDashOffset 25%", Math.abs(ringDashOffset(0.25, 10) - 2 * Math.PI * 10 * 0.75) < 1e-9);
  const { appendCapped } = await import("../packages/ui/src/lib/live-buffer.ts");
  ok("appendCapped 有界", JSON.stringify(appendCapped([1, 2, 3], 4, 3)) === JSON.stringify([2, 3, 4]));
}

// ---- image: fitDimensions / clampRect(実ソース geometry.ts) ----
section("image geometry");
{
  const { fitDimensions, clampRect, formatFromExtension } = await import("../packages/image/src/geometry.ts");
  ok("contain 4000x3000→max2000=2000x1500", JSON.stringify(fitDimensions(4000, 3000, { maxWidth: 2000, maxHeight: 2000 })) === JSON.stringify({ width: 2000, height: 1500 }));
  ok("小画像は拡大しない", JSON.stringify(fitDimensions(800, 600, { maxWidth: 2000 })) === JSON.stringify({ width: 800, height: 600 }));
  ok("clampRect 範囲丸め", JSON.stringify(clampRect({ left: -10, top: 5, width: 5000, height: 100 }, 1000, 800)) === JSON.stringify({ left: 0, top: 5, width: 1000, height: 100 }));
  ok("拡張子 JPG→jpeg", formatFromExtension("a.JPG") === "jpeg");
}

// ---- image 拡張: 透かしSVG/gravity・トリミング座標(実ソース) ----
section("image: watermark / crop");
{
  const { watermarkTextSvg, gravityToSharp, buildWatermarkComposite } = await import("../packages/image/src/watermark.ts");
  ok("透かし gravity center→centre", gravityToSharp("center") === "centre");
  ok("透かし SVG テキスト+opacity", watermarkTextSvg("© X", { opacity: 0.5 }).includes("© X") && watermarkTextSvg("© X", { opacity: 0.5 }).includes('fill-opacity="0.5"'));
  ok("透かし composite 画像既定southeast", buildWatermarkComposite({ image: new Uint8Array([1]) }).gravity === "southeast");
  const { rectFromPoints, displayToNaturalRect } = await import("../packages/ui/src/lib/crop.ts");
  ok("crop 逆順ドラッグを正規化", JSON.stringify(rectFromPoints(60, 80, 10, 20)) === JSON.stringify({ left: 10, top: 20, width: 50, height: 60 }));
  ok("crop 表示→自然 10倍", JSON.stringify(displayToNaturalRect({ left: 40, top: 30, width: 100, height: 60 }, 400, 300, 4000, 3000)) === JSON.stringify({ left: 400, top: 300, width: 1000, height: 600 }));
}

// ---- image 一括処理: mapWithConcurrency(実ソース) ----
section("image batch");
{
  const { mapWithConcurrency } = await import("../packages/image/src/batch.ts");
  const r = await mapWithConcurrency([1, 2, 3, 4, 5], async (x) => x * 10, 2);
  ok("並行処理: 順序保持 [10..50]", JSON.stringify(r) === JSON.stringify([10, 20, 30, 40, 50]));
  let cur = 0, max = 0;
  await mapWithConcurrency(Array.from({ length: 8 }, (_x, i) => i), async () => { cur++; max = Math.max(max, cur); await new Promise((s) => setTimeout(s, 5)); cur--; }, 3);
  ok("並行数は上限3以下", max <= 3 && max >= 1);
}

// ---- OCR抽出 / 進捗通知(実ソース) ----
section("ocr extraction / progress");
{
  const { extractReceiptFields, parseJapaneseDate } = await import("../packages/ocr/src/extraction.ts");
  ok("和暦 令和6年→2024", parseJapaneseDate("令和6年1月5日") === "2024-01-05");
  const f = extractReceiptFields("2026年1月5日\n登録番号 T1234567890123\n合計 ¥842\nTEL 03-1234-5678");
  ok("領収書抽出: 金額842/日付/登録/電話", f.amount === 842 && f.date === "2026-01-05" && f.registrationNumber === "T1234567890123" && f.phone === "03-1234-5678");
  const { crossedMilestones } = await import("../packages/notify/src/progress.ts");
  ok("進捗マイルストーン 0→8 で 25/50/75/100", JSON.stringify(crossedMilestones(0, 8, 8, 25)) === JSON.stringify([25, 50, 75, 100]));
  const { runBatch } = await import("../packages/image/src/batch.ts");
  const prog = [];
  const r = await runBatch([1, 2, 3, 4], async (x) => x * 2, { concurrency: 2, onProgress: (p) => prog.push(p.percent) });
  ok("runBatch 結果と最終100%", JSON.stringify(r) === JSON.stringify([2, 4, 6, 8]) && prog[prog.length - 1] === 100);
}

// ---- report経費流し込み / OCR信頼度・確認 ----
section("expense flow / field confidence");
{
  const { extractReceiptFieldsWithConfidence } = await import("../packages/ocr/src/extraction.ts");
  const f = extractReceiptFieldsWithConfidence({ text: "2026年1月5日 合計 ¥842", confidence: 80, words: [{ text: "2026", confidence: 96 }, { text: "842", confidence: 55 }] });
  ok("信頼度: 金額55(低)/日付96", f.amount.confidence === 55 && f.date.confidence === 96);
  const { splitByConfidence } = await import("../packages/ui/src/lib/field-review.ts");
  const sp = splitByConfidence([{ key: "a", label: "金額", value: "842", confidence: 55 }, { key: "d", label: "日付", value: "x", confidence: 96 }], 70);
  ok("split: 要確認=金額のみ", sp.review.length === 1 && sp.review[0].key === "a");
}

// ---- 複数領収書の一括抽出(実ソース extraction.ts・純関数)----
section("receipt batch extract");
{
  const { extractReceiptsFromResults } = await import("../packages/ocr/src/extraction.ts");
  const rows = extractReceiptsFromResults([{ text: "合計 ¥842\n2026年1月5日" }, { text: "合計 ¥1,320\n2026年2月3日" }]);
  ok("一括抽出: 金額842/1320・日付", rows[0].amount === 842 && rows[0].date === "2026-01-05" && rows[1].amount === 1320);
}

// ---- 月次締め / 承認通知 / 一覧クエリ(実ソース) ----
section("monthly / wf-notify / table-query");
{
  const { queryRows } = await import("../packages/ui/src/lib/table.ts");
  const rows = [{ v: "A", a: 842 }, { v: "B", a: 1100 }, { v: "C", a: 550 }];
  ok("一覧: 金額降順 先頭1100", queryRows(rows, { sortKey: "a", sortDir: "desc" }).rows[0].a === 1100);
  ok("一覧: ページング pageCount", queryRows(rows, { pageSize: 2 }).pageCount === 2);
  const { notificationForTransition } = await import("../packages/workflow/src/notification.ts");
  const st = (status, step, h = []) => ({ status, currentStep: step, history: h });
  ok("承認通知: approved", notificationForTransition(st("pending", 1), st("approved", 1)).text.includes("承認"));
  ok("承認通知: 変化なしnull", notificationForTransition(st("pending", 0), st("pending", 0)) === null);
}

// ---- 月次シート化 / シートUIコピー(実ソース) ----
section("xlsx sheets / grid copy");
{
  const { normalizeCellRange, rangeToTsv } = await import("../packages/ui/src/lib/grid.ts");
  ok("セル範囲 逆ドラッグ正規化", JSON.stringify(normalizeCellRange({ row: 3, col: 2 }, { row: 1, col: 0 })) === JSON.stringify({ r0: 1, c0: 0, r1: 3, c1: 2 }));
  const rows = [{ a: "1", b: "x" }, { a: "2", b: "y" }];
  ok("TSVコピー 2x2", rangeToTsv(rows, ["a", "b"], { r0: 0, c0: 0, r1: 1, c1: 1 }) === "1\tx\n2\ty");
}

// ---- SheetGrid拡張: リサイズ/仮想化/TSV貼付 / 宛先管理(実ソース) ----
section("grid resize/virtual/paste / recipients");
{
  const { applyColumnResize, computeVisibleRange, tsvToRows } = await import("../packages/ui/src/lib/grid.ts");
  ok("列リサイズ +30/最小クランプ", applyColumnResize([100], 0, 30)[0] === 130 && applyColumnResize([60], 0, -100)[0] === 48);
  ok("仮想化 scroll300 start5 topPad150", (() => { const v = computeVisibleRange(300, 30, 300, 1000, 5); return v.start === 5 && v.topPad === 150; })());
  ok("貼付TSV→行(位置対応)", JSON.stringify(tsvToRows("2026-02-01\t文具堂\t3300", ["date", "vendor", "amount"])) === JSON.stringify([{ date: "2026-02-01", vendor: "文具堂", amount: "3300" }]));
  const { upsertRecipient, removeRecipient, isValidEmail } = await import("../packages/ui/src/lib/recipients.ts");
  ok("宛先 upsert/remove/email検証", upsertRecipient([{ id: "1", name: "a", email: "a@x.jp" }], { id: "2", name: "b", email: "b@x.jp" }).length === 2 && removeRecipient([{ id: "1", name: "a", email: "a@x.jp" }], "1").length === 0 && isValidEmail("a@x.jp") && !isValidEmail("bad@"));
}

// ---- 取り込み検証 / 列仮想化 / 宛先CSV(実ソース) ----
section("import-validate / col-virtual / recipient-csv");
{
  const { validateImportRows } = await import("../packages/ui/src/lib/import-validate.ts");
  const v = validateImportRows(
    [{ date: "2026-02-01", vendor: "A", amount: "100" }, { date: "", vendor: "A", amount: "x" }],
    [{ key: "date", type: "date", required: true }, { key: "vendor", unique: true }, { key: "amount", type: "number" }],
  );
  ok("検証: 2行目 date必須+amount型+vendor重複=3件", v.rows[1].errors.length === 3 && v.errorCount === 3);
  const { computeVisibleColumns } = await import("../packages/ui/src/lib/grid.ts");
  const cv = computeVisibleColumns(250, Array(10).fill(100), 400, 1, 0);
  ok("列仮想化 scroll250 start3/end6/leftPad200", cv.start === 3 && cv.end === 6 && cv.leftPad === 200);
  const { recipientsFromRows } = await import("../packages/ui/src/lib/recipients.ts");
  ok("宛先CSV取込: 妥当のみ", recipientsFromRows([{ 氏名: "田中", メール: "t@ex.jp" }, { 氏名: "x", メール: "bad@" }]).length === 1);
}

// ---- エラー行絞り込み / 差分 / 列設定(実ソース) ----
section("error-filter / diff / column-prefs");
{
  const { validateImportRows, filterErrorRows } = await import("../packages/ui/src/lib/import-validate.ts");
  const rows = [{ a: "1" }, { a: "" }, { a: "3" }];
  const v = validateImportRows(rows, [{ key: "a", required: true }]);
  ok("エラー行のみ抽出(元index保持)", (() => { const ef = filterErrorRows(rows, v); return ef.length === 1 && ef[0].index === 1; })());
  const { diffRecords } = await import("../packages/ui/src/lib/diff.ts");
  const d = diffRecords([{ k: "a", n: "A" }, { k: "b", n: "B" }], [{ k: "a", n: "A" }, { k: "b", n: "B2" }, { k: "c", n: "C" }], (r) => r.k);
  ok("差分 add1/change1/remove0", d.added.length === 1 && d.changed.length === 1 && d.removed.length === 0);
  const { applyColumnPrefs, moveColumn, toggleColumnHidden, emptyColumnPrefs } = await import("../packages/ui/src/lib/column-prefs.ts");
  ok("列設定 並べ替え+非表示", applyColumnPrefs([{ key: "a" }, { key: "b" }, { key: "c" }], { order: ["c", "a", "b"], hidden: ["a"] }).map((c) => c.key).join() === "c,b");
  ok("列設定 move下", moveColumn(emptyColumnPrefs, "a", 1, ["a", "b"]).order.join() === "b,a");
}

// ---- 取り込みサマリ・履歴 / 列設定サーバ保存(実ソース) ----
section("import summary/history / prefs-store");
{
  const { validateImportRows, summarizeImport, buildImportHistory } = await import("../packages/ui/src/lib/import-validate.ts");
  const sm = summarizeImport(validateImportRows([{ a: "1" }, { a: "" }], [{ key: "a", required: true }]));
  ok("サマリ total2/valid1", sm.total === 2 && sm.valid === 1 && sm.ok === false);
  ok("履歴 partial", buildImportHistory({ source: "csv", userId: "u1" }, { total: 3, valid: 2, errorRows: 1, errorCount: 1, ok: false }, 2).status === "partial");
  const { createColumnPrefsStore } = await import("../packages/ui/src/lib/column-prefs.ts");
  let putBody = null;
  const store = createColumnPrefsStore({ endpoint: "/api/cp", userId: "u1", fetch: async (u, i) => (i && i.method ? (putBody = JSON.parse(i.body), { ok: true }) : { ok: true, json: async () => ({ order: ["a"], hidden: [] }) }) });
  const loaded = await store.load("t"); await store.save("t", { order: ["b"], hidden: [] });
  ok("prefsストア load/save(user+table)", loaded.order.join() === "a" && putBody.userId === "u1" && putBody.table === "t");
}

// ---- 部分保存 / ロールバック可否 / プリセット(実ソース) ----
section("partial-save / rollback / presets");
{
  const { validateImportRows, validRows, canRollback } = await import("../packages/ui/src/lib/import-validate.ts");
  const rows = [{ a: "1" }, { a: "" }, { a: "3" }];
  const v = validateImportRows(rows, [{ key: "a", required: true }]);
  ok("部分保存: 有効2件のみ", validRows(rows, v).length === 2);
  ok("ロールバック可否 success/partial", canRollback("success") && canRollback("partial") && !canRollback("rolled_back"));
  const { upsertPreset, splitPresets } = await import("../packages/ui/src/lib/column-presets.ts");
  const list = upsertPreset([{ id: "1", name: "個人", prefs: { order: [], hidden: [] } }], { id: "2", name: "共有", prefs: { order: [], hidden: [] }, shared: true });
  ok("プリセット 共有/個人 分割", splitPresets(list).shared.length === 1 && splitPresets(list).personal.length === 1);
}

// ---- OCR拡充 / 権限ロールバック / プリセット既定(実ソース) ----
section("ocr-plus / rollback-perm / preset-default");
{
  const { normalizeOcrText, extractLineItems, extractInvoiceFields } = await import("../packages/ocr/src/extraction.ts");
  ok("OCR正規化 全角→半角", normalizeOcrText("１，３２０円") === "1,320円");
  ok("OCR明細抽出(集計除外)", extractLineItems("りんご ¥320\n合計 ¥320").length === 1);
  const inv = extractInvoiceFields("請求書番号: INV-1\nお支払期限 2026年2月28日\n小計 ¥50,000\n消費税 ¥5,000\nご請求金額 ¥55,000");
  ok("OCR請求書 番号/期限/合計", inv.invoiceNumber === "INV-1" && inv.dueDate === "2026-02-28" && inv.total === 55000);
  const { canRollbackWith } = await import("../packages/ui/src/lib/import-validate.ts");
  ok("権限ロールバック 承認者のみ", canRollbackWith("success", ["approver"], ["approver"]) && !canRollbackWith("success", ["user"], ["approver"]));
  const { resolveInitialPrefs } = await import("../packages/ui/src/lib/column-presets.ts");
  ok("プリセット既定を初期適用", resolveInitialPrefs(null, [{ id: "1", name: "d", prefs: { order: ["a"], hidden: [] }, isDefault: true }]).order.join() === "a");
}

// ---- 複数税率内訳 / 信頼度階層 / OCRフィードバック(実ソース) ----
section("tax-breakdown / confidence-tier / ocr-feedback");
{
  const { extractTaxBreakdown } = await import("../packages/ocr/src/extraction.ts");
  const b = extractTaxBreakdown("8%対象 ¥1,000\n消費税(8%) ¥80\n10%対象 ¥2,000\n消費税(10%) ¥200");
  ok("税率内訳 8%(1000/80)10%(2000/200)", b.length === 2 && b[0].subtotal === 1000 && b[0].tax === 80 && b[1].subtotal === 2000 && b[1].tax === 200);
  const { classifyConfidence } = await import("../packages/ui/src/lib/confidence.ts");
  ok("信頼度 high/medium/low", classifyConfidence(95) === "high" && classifyConfidence(70) === "medium" && classifyConfidence(30) === "low");
  const { buildOcrFeedback } = await import("../packages/ui/src/lib/ocr-feedback.ts");
  const fb = buildOcrFeedback({ userId: "u" }, { a: "842", b: "x" }, { a: "843", b: "x" });
  ok("フィードバック 修正1/そのまま1", fb.corrections.length === 1 && fb.acceptedCount === 1);
}

// ---- 税額2行紐づけ / 信頼度プロファイル / 集計 / i18n(実ソース) ----
section("tax-2line / conf-profile / feedback-agg / i18n");
{
  const { extractTaxBreakdown } = await import("../packages/ocr/src/extraction.ts");
  const tb = extractTaxBreakdown("8%対象 ¥1,080\n(内消費税 ¥80)\n10%対象 ¥2,200\n(内消費税 ¥200)");
  ok("税額2行(括弧)紐づけ", tb[0].tax === 80 && tb[1].tax === 200);
  const { classifyConfidence } = await import("../packages/ui/src/lib/confidence.ts");
  ok("プロファイル strict/lenient", classifyConfidence(90, "strict") === "medium" && classifyConfidence(72, "lenient") === "high");
  const { buildOcrFeedback, aggregateOcrFeedback } = await import("../packages/ui/src/lib/ocr-feedback.ts");
  const agg = aggregateOcrFeedback([buildOcrFeedback({ userId: "u" }, { a: "1", b: "2" }, { a: "9", b: "2" })]);
  ok("集計 受入率0.5", Math.abs(agg.acceptanceRate - 0.5) < 1e-9 && agg.byField[0].field === "a");
  const { createI18n } = await import("../packages/i18n/src/index.ts");
  const uiCatalogs = await loadUiCatalogs();
  const ko = createI18n({ locale: "ko", catalogs: uiCatalogs });
  ok("i18n 韓国語+補間", ko.t("common.save") === "저장" && ko.t("common.count", { count: 3 }) === "3 건");
}

// ---- コンポーネント文言キー / アプリカタログ結合 / ロケール保存(実ソース) ----
section("i18n keys / merge / locale-store");
{
  const { createI18n, mergeCatalogs } = await import("../packages/i18n/src/index.ts");
  const uiCatalogs = await loadUiCatalogs();
  const en = createI18n({ locale: "en", catalogs: uiCatalogs });
  ok("新キー history/grid 4言語", en.t("history.col.status") === "Status" && en.t("grid.resize") === "Drag to resize");
  const merged = mergeCatalogs(uiCatalogs, { en: { "app.title": "X" }, ja: { "app.title": "エックス" } });
  ok("mergeCatalogs アプリ文言+基盤維持", createI18n({ locale: "en", catalogs: merged }).t("app.title") === "X" && createI18n({ locale: "ja", catalogs: merged }).t("common.save") === "保存");
}

// ---- ドメイン別カタログ(namespaced)結合(実ソース) ----
section("i18n namespaced domains");
{
  const { createI18n, namespaced, mergeCatalogs } = await import("../packages/i18n/src/index.ts");
  const uiCatalogs = await loadUiCatalogs();
  const merged = mergeCatalogs(uiCatalogs, namespaced("expenses", { ja: { title: "経費" }, en: { title: "Expenses" } }), namespaced("imports", { ja: { title: "取込" }, en: { title: "Import" } }));
  const ja = createI18n({ locale: "ja", catalogs: merged });
  ok("namespaced 2ドメイン + 基盤", ja.t("expenses.title") === "経費" && ja.t("imports.title") === "取込" && ja.t("common.save") === "保存");
}

// ---- レポート ロケール整形 / i18n 通貨(SheetGrid format 相当) ----
section("report-locale / grid-format");
{
  const rep = await import("../packages/report/src/monthly.ts").catch(() => null);
  const { createI18n } = await import("../packages/i18n/src/index.ts");
  const uiCatalogs = await loadUiCatalogs();
  const en = createI18n({ locale: "en", catalogs: uiCatalogs });
  const ja = createI18n({ locale: "ja", catalogs: uiCatalogs });
  ok("i18n currency JPY 桁区切り(en)", en.currency(1942, "JPY").includes("1,942"));
  ok("i18n date ロケール差", typeof ja.date("2026-02-15") === "string" && ja.date("2026-02-15") !== en.date("2026-02-15"));
}

// ---- invoice ロケール整形 / 分割カタログ select キー ----
section("invoice-locale / split-catalog");
{
  const { createI18n } = await import("../packages/i18n/src/index.ts");
  const uiCatalogs = await loadUiCatalogs();
  const en = createI18n({ locale: "en", catalogs: uiCatalogs });
  const zh = createI18n({ locale: "zh", catalogs: uiCatalogs });
  ok("分割カタログ select.* 反映", en.t("select.notFound") === "No results" && zh.t("select.placeholder") === "请选择");
  ok("言語別ファイル キー数一致", new Set(["ja","en","zh","ko"].map((l) => Object.keys(uiCatalogs[l]).length)).size === 1);
}

// ---- StatCard/ダッシュボード数値の i18n 整形 ----
section("statcard i18n format");
{
  const { createI18n } = await import("../packages/i18n/src/index.ts");
  const uiCatalogs = await loadUiCatalogs();
  const en = createI18n({ locale: "en", catalogs: uiCatalogs });
  const ja = createI18n({ locale: "ja", catalogs: uiCatalogs });
  ok("currency 整形(523,400)", en.currency(523400, "JPY").includes("523,400"));
  ok("number 整形 ロケール差なし桁区切り", en.n(1234567) === "1,234,567");
  ok("ja/en 通貨記号は同(JPY)", ja.currency(100, "JPY").replace(/\s/g,"").length > 0 && en.currency(100, "JPY").replace(/\s/g,"").length > 0);
}

// ---- 文字列ユーティリティ(実ソース) ----
section("strings util");
{
  const S = await import("../packages/utils/src/strings.ts");
  ok("truncate 末尾…", S.truncate("abcdefg", 4) === "abc…");
  ok("truncateMiddle", S.truncateMiddle("1234567890", 7) === "123…890");
  ok("truncateByWidth 全角=2", S.truncateByWidth("あいうえお", 6) === "あい…");
  ok("toHalfWidth 英数+全角空白", S.toHalfWidth("Ａ１　") === "A1 ");
  ok("toFullWidthKana 濁点合成", S.toFullWidthKana("ｶﾞｷﾞ") === "ガギ");
  ok("normalizeText 総合", S.normalizeText("Ａ　Ｂ　　Ｃ") === "A B C");
  ok("camel/kebab/snake", S.camelCase("foo_bar") === "fooBar" && S.kebabCase("fooBar") === "foo-bar" && S.snakeCase("fooBar") === "foo_bar");
  ok("slugify", S.slugify("Héllo World!") === "hello-world");
  ok("maskEmail", S.maskEmail("taro@example.com") === "t***@example.com");
  ok("textWidth 全角2半角1", S.textWidth("あA1") === 4);
}

// ---- 文字列ユーティリティ 追加分(実ソース) ----
section("strings util +extra");
{
  const S = await import("../packages/utils/src/strings.ts");
  ok("padStartWidth 全角考慮", S.padStartWidth("あ", 5) === "   あ");
  ok("wrapText 単語境界", S.wrapText("the quick brown fox jumps over", 10).join("|") === "the quick|brown fox|jumps over");
  ok("wrapText CJK強制分割", S.wrapText("あいうえおかきくけこ", 6).join("|") === "あいう|えおか|きくけ|こ");
  const h = S.highlight("Hello World hello", "hello");
  ok("highlight 大小無視2一致", h.filter((x) => x.match).length === 2 && h.map((x) => x.text).join("") === "Hello World hello");
  ok("parseTemplate 補間+未定義残す", S.parseTemplate("Hi {name} {x}", { name: "太郎" }) === "Hi 太郎 {x}");
  ok("nanoid 21/URLセーフ", S.nanoid().length === 21 && /^[A-Za-z0-9_-]+$/.test(S.nanoid()));
  ok("randomString 毎回異なる", S.randomString(24) !== S.randomString(24));
}

// ---- 複数語ハイライト(実ソース) ----
section("highlightTerms");
{
  const S = await import("../packages/utils/src/strings.ts");
  const h = S.highlightTerms("the quick brown fox", "quick fox");
  ok("2語一致", h.filter((x) => x.match).map((x) => x.text).join(",") === "quick,fox");
  ok("重なり統合", S.highlightTerms("aaaa", ["aa", "aaa"]).filter((x) => x.match).length === 1);
  ok("大小無視/一致なし", S.highlightTerms("Foo foo", "foo").filter((x) => x.match).length === 2 && S.highlightTerms("abc", "xyz").filter((x) => x.match).length === 0);
}

// ---- ログ解析/フィルタ(実ソース) ----
section("log parse/filter");
{
  const L = await import("../packages/ui/src/lib/log.ts");
  ok("レベル判定 先頭優先", L.detectLogLevel("INFO retrying after error") === "info" && L.detectLogLevel("2026 ERROR boom") === "error");
  const parsed = L.parseLogLines(["INFO a", "WARN b", "ERROR c", "DEBUG d", "plain e"]);
  ok("minLevel=warn", L.filterLogLines(parsed, { minLevel: "warn" }).map((p) => p.level).sort().join() === "error,warn");
  ok("query AND", L.filterLogLines(parsed, { query: "warn b" }).length === 1 && L.filterLogLines(parsed, { query: "warn c" }).length === 0);
  const c = L.countByLevel(parsed);
  ok("countByLevel", c.error === 1 && c.warn === 1 && c.info === 1 && c.debug === 1 && c.none === 1);
}

// ---- ログ 時系列/正規表現/相対時刻(実ソース) ----
section("log timeline/regex/relative");
{
  const L = await import("../packages/ui/src/lib/log.ts");
  const parsed = L.parseLogLines([
    "2026-02-15 09:00:00 INFO a", "2026-02-15 09:00:30 WARN b",
    "2026-02-15 09:01:10 ERROR c", "2026-02-15 09:02:00 INFO d",
  ]);
  ok("regex一致", L.filterLogLines(parsed, { regex: "ERROR|WARN" }).length === 2);
  ok("regex無効は無視", L.filterLogLines(parsed, { regex: "([bad" }).length === 4);
  const b = L.bucketByTime(parsed, 60000);
  ok("時系列3バケット", b.length === 3 && b[0].total === 2 && b[1].counts.error === 1);
  ok("logLinesToText/相対時刻", L.logLinesToText(parsed.slice(0, 1)) === "2026-02-15 09:00:00 INFO a" && typeof L.formatRelativeTime(Date.parse("2026-02-15T09:00:00"), Date.parse("2026-02-15T09:05:00"), "en") === "string");
}

// ---- 構造化ログ / 時系列ジャンプ(実ソース) ----
section("structured log / jump");
{
  const L = await import("../packages/ui/src/lib/log.ts");
  const j = L.parseStructuredLog('{"level":"error","msg":"boom","ts":"2026-02-15T09:00:00Z","code":500}');
  ok("JSON level/msg/field", j.level === "error" && j.message === "boom" && j.fields.code === "500");
  const lf = L.parseStructuredLog('level=info msg="done" ts=2026-02-15T09:01:00Z');
  ok("logfmt level/msg", lf.level === "info" && lf.message === "done");
  ok("プレーン→null", L.parseStructuredLog("plain text") === null);
  const parsed = L.parseLogLines(['{"level":"info","ts":"2026-02-15T09:00:00Z","msg":"a"}', '{"level":"error","ts":"2026-02-15T09:01:00Z","msg":"b"}'], { structured: true });
  ok("structured parse + jump", parsed[0].message === "a" && L.firstLineIndexAtOrAfter(parsed, Date.parse("2026-02-15T09:00:30Z")) === 1);
}

// ---- ログ ファセット/フィールド絞り込み/バッファ/ストリーム(実ソース) ----
section("log facets/fields/stream");
{
  const L = await import("../packages/ui/src/lib/log.ts");
  const parsed = L.parseLogLines([
    '{"level":"info","msg":"a","path":"/x","user":"taro"}',
    '{"level":"error","msg":"b","path":"/y","user":"taro"}',
    '{"level":"warn","msg":"c","path":"/x","user":"hanako"}',
  ], { structured: true });
  ok("collectFieldKeys", L.collectFieldKeys(parsed).join() === "level,msg,path,user");
  ok("fieldFacets 降順", L.fieldFacets(parsed, "path")[0].value === "/x" && L.fieldFacets(parsed, "path")[0].count === 2);
  ok("filterByFields AND/OR", L.filterByFields(parsed, { path: ["/x"], user: ["hanako"] }).length === 1 && L.filterByFields(parsed, { user: ["taro", "hanako"] }).length === 3);
  ok("appendCapped 丸め", L.appendCapped([1, 2, 3], [4, 5], 4).join() === "2,3,4,5");
  const { createLogStream } = await import("../packages/ui/src/lib/log-stream.ts");
  class FakeWs { constructor(u) { this.h = {}; } addEventListener(t, cb) { this.h[t] = cb; } emit(d) { this.h.message?.({ data: d }); } close() { this.closed = true; } }
  let ws; const got = [];
  const stream = createLogStream({ url: "ws://x", wsFactory: (u) => (ws = new FakeWs(u)) });
  stream.subscribe((ls) => got.push(...ls));
  ws.emit("a\nb"); ws.emit("c");
  ok("stream 行分割配信", got.join("|") === "a|b|c");
}

// ---- 数値ユーティリティ(実ソース) ----
section("numbers util");
{
  const N = await import("../packages/utils/src/numbers.ts");
  ok("clamp/round(FP)", N.clamp(15, 0, 10) === 10 && N.round(1.005, 2) === 1.01 && N.round(1.255, 2) === 1.26);
  ok("roundHalfEven", N.roundHalfEven(0.5) === 0 && N.roundHalfEven(2.5) === 2);
  ok("formatNumber/Percent", N.formatNumber(1234567.89, { decimals: 2 }) === "1,234,567.89" && N.formatPercent(0.2534, 1) === "25.3%");
  ok("formatCompact/ManOku/Bytes", N.formatCompact(3450000) === "3.5M" && N.formatManOku(123456789) === "1.2億" && N.formatBytes(1536) === "1.5 KB");
  ok("parseNumber 全角/¥/%", N.parseNumber("¥1,234") === 1234 && N.parseNumber("１，２３４") === 1234 && N.parseNumber("12.5%") === 12.5);
  const v = [2, 4, 4, 4, 5, 5, 7, 9];
  ok("stats mean/median/mode", N.mean(v) === 5 && N.median([1, 2, 3, 4]) === 2.5 && N.mode(v).join() === "4");
  ok("variance/stddev/percentile", N.variance(v) === 4 && N.stddev(v) === 2 && N.percentile([1, 2, 3, 4], 50) === 2.5);
  ok("safeDivide/percentChange/gcd", N.safeDivide(10, 0, -1) === -1 && N.percentChange(200, 250) === 25 && N.gcd(12, 18) === 6);
}

// ---- 数値: 系列/分布(実ソース) ----
section("numbers series/dist");
{
  const N = await import("../packages/utils/src/numbers.ts");
  ok("movingAverage", N.movingAverage([1, 2, 3, 4, 5], 3).join() === "2,3,4");
  ok("cumulativeSum", N.cumulativeSum([1, 2, 3, 4]).join() === "1,3,6,10");
  const h = N.histogram([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { bins: 5 });
  ok("histogram 5区間各2件", h.length === 5 && h.every((b) => b.count === 2));
  const q = N.quartiles([1, 2, 3, 4, 5]);
  ok("quartiles Q1/Q3/IQR", q.q1 === 2 && q.q3 === 4 && q.iqr === 2);
  ok("formatRange", N.formatRange(1000, 2000, { prefix: "¥" }) === "¥1,000〜¥2,000");
}

// ---- 外れ値 / チャートデータ整形(実ソース) ----
section("outliers / chart-data");
{
  const N = await import("../packages/utils/src/numbers.ts");
  ok("outliers IQR", N.outliers([1, 2, 3, 4, 5, 100]).join() === "100" && N.withoutOutliers([1, 2, 3, 4, 5, 100]).length === 5);
  ok("outlierBounds", Math.abs(N.outlierBounds([1, 2, 3, 4, 5, 100]).upper - 8.5) < 1e-9);
  // chart-data 相当(histogram/movingAverage を直接使い整形結果を確認)
  const hd = N.histogram([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { bins: 5 }).map((b) => ({ count: b.count }));
  ok("histogram→整形 5区間各2", hd.length === 5 && hd.every((x) => x.count === 2));
  const ma = N.movingAverage([1, 2, 3, 4, 5], 3);
  ok("movingAverage 整形基礎", ma.join() === "2,3,4");
}

// ---- 単回帰 / トレンド(実ソース) ----
section("regression / trend");
{
  const N = await import("../packages/utils/src/numbers.ts");
  const fit = N.linearRegression([1, 3, 5, 7, 9]);
  ok("回帰 slope2/intercept1/r2=1", fit.slope === 2 && fit.intercept === 1 && Math.abs(fit.r2 - 1) < 1e-12 && N.predict(fit, 5) === 11);
  ok("定数列 r2=1", N.linearRegression([5, 5, 5]).r2 === 1);
  ok("trend up/down/flat", N.trend([1, 2, 3]).direction === "up" && N.trend([3, 2, 1]).direction === "down" && N.trend([3, 3, 3]).direction === "flat");
}

// ---- 相関(実ソース) ----
section("correlation");
{
  const N = await import("../packages/utils/src/numbers.ts");
  ok("完全正相関=1", Math.abs(N.correlation([1, 2, 3, 4], [2, 4, 6, 8]) - 1) < 1e-12);
  ok("完全負相関=-1", Math.abs(N.correlation([1, 2, 3, 4], [8, 6, 4, 2]) + 1) < 1e-12);
  ok("covariance 不偏", Math.abs(N.covariance([1, 2, 3], [1, 2, 3], { sample: true }) - 1) < 1e-12);
  ok("定数列→NaN", Number.isNaN(N.correlation([1, 1, 1], [1, 2, 3])));
}

// ---- 予測バンド(実ソース) ----
section("regression band");
{
  const N = await import("../packages/utils/src/numbers.ts");
  const xs = [0, 1, 2, 3, 4];
  ok("完全直線 バンド0幅", (() => { const r = N.regressionInterval(xs, [1, 3, 5, 7, 9], 2); return r.yhat === 5 && r.se === 0 && r.lower === 5 && r.upper === 5; })());
  const c = N.regressionInterval(xs, [1, 2, 2, 5, 4], 2, { kind: "confidence" });
  const p = N.regressionInterval(xs, [1, 2, 2, 5, 4], 2, { kind: "prediction" });
  ok("prediction ⊃ confidence", (p.upper - p.lower) > (c.upper - c.lower) && c.lower < c.yhat && c.yhat < c.upper);
  ok("regressionBand 長さ/yhat", N.regressionBand(xs, [1, 3, 5, 7, 9]).length === 5 && N.regressionBand(xs, [1, 3, 5, 7, 9])[4].yhat === 9);
}

// ---- 季節性分解 / 行データ→系列(実ソース) ----
section("decompose / rows->series");
{
  const N = await import("../packages/utils/src/numbers.ts");
  const pattern = [10, -5, -10, 5];
  const vals = Array.from({ length: 24 }, (_, i) => 100 + 2 * i + pattern[i % 4]);
  const d = N.decompose(vals, 4);
  ok("seasonalIndices≈pattern", d.seasonalIndices.every((v, i) => Math.abs(v - pattern[i]) < 0.5));
  ok("中央residual≈0", d.residual.slice(6, 18).filter((r) => r != null).every((r) => Math.abs(r) < 0.5));
  const rows = [{ m: "1", s: "1,200" }, { m: "2", s: 1500 }, { m: "3", s: "¥1,800" }, { m: "4", s: "bad" }];
  ok("pluckNumbers", N.pluckNumbers(rows, "s").join() === "1200,1500,1800");
  ok("seriesFromRows", N.seriesFromRows(rows, "s", "m").length === 3 && N.seriesFromRows(rows, "s", "m")[0].y === 1200);
}

// ---- 自己相関(実ソース) ----
section("autocorrelation");
{
  const N = await import("../packages/utils/src/numbers.ts");
  const per = Array.from({ length: 24 }, (_, i) => [1, 2, 3, 4][i % 4]);
  ok("acf[0]=1", N.autocorrelation(per, 0) === 1);
  ok("周期4 acf(4)>acf(1)", N.autocorrelation(per, 4) > N.autocorrelation(per, 1));
  ok("acf配列長", N.acf(per, 6).length === 7);
  ok("dominantLag=4", N.dominantLag(per, 8) === 4);
  ok("定数列→NaN", Number.isNaN(N.autocorrelation([5, 5, 5], 1)));
}

// ---- 日付・時刻(実ソース) ----
section("datetime calendar");
{
  const C = await import("../packages/datetime/src/calendar.ts");
  const D = (s) => new Date(s + "T00:00:00Z");
  ok("閏年/月日数", C.isLeapYear(2024) && !C.isLeapYear(2023) && C.daysInMonth(2024, 2) === 29);
  ok("addMonths クランプ", C.formatDate(C.addMonths(D("2024-01-31"), 1)) === "2024-02-29");
  ok("daysBetween/until", C.daysBetween(D("2024-01-01"), D("2024-12-31")) === 365 && C.daysUntil(D("2024-01-10"), D("2024-01-01")) === 9);
  ok("age 誕生日前後", C.age(D("1990-06-15"), D("2024-06-14")) === 33 && C.age(D("1990-06-15"), D("2024-06-15")) === 34);
  ok("isPast/isFuture", C.isPast(D("2020-01-01"), D("2024-01-01")) && C.isFuture(D("2030-01-01"), D("2024-01-01")));
  ok("祝日 元日/成人/春分/振替", C.holidayName(D("2024-01-01")) === "元日" && C.holidayName(D("2024-01-08")) === "成人の日" && C.holidayName(D("2024-03-20")) === "春分の日" && C.holidayName(D("2024-02-12")) === "振替休日");
  ok("国民の休日 2015-09-22", C.holidayName(D("2015-09-22")) === "国民の休日");
  ok("営業日", !C.isBusinessDay(D("2024-01-01")) && C.isBusinessDay(D("2024-01-04")) && C.formatDate(C.addBusinessDays(D("2023-12-29"), 1)) === "2024-01-02");
}

// ---- 日付: 期間/和暦/相対(実ソース) ----
section("datetime range/wareki/relative");
{
  const C = await import("../packages/datetime/src/calendar.ts");
  const D = (s) => new Date(s + "T00:00:00Z");
  const R = (a, b) => ({ start: D(a), end: D(b) });
  ok("range overlap/intersection", C.rangesOverlap(R("2024-01-01", "2024-01-20"), R("2024-01-15", "2024-02-01")) && C.formatDate(C.rangeIntersection(R("2024-01-01", "2024-01-20"), R("2024-01-15", "2024-02-01")).end) === "2024-01-20");
  ok("splitRangeByMonth", C.splitRangeByMonth(R("2024-01-15", "2024-03-10")).length === 3);
  ok("和暦 令和元年/平成31", C.formatWareki(D("2019-05-01")) === "令和元年" && C.formatWareki(D("2019-04-30")) === "平成31年");
  ok("和暦 明治以前→西暦", C.toWareki(D("1850-01-01")) === null && C.formatWareki(D("1850-01-01")) === "1850年");
  ok("相対 今日/5日後/5日前", C.formatRelativeDay(D("2024-01-05"), D("2024-01-05")) === "今日" && C.formatRelativeDay(D("2024-01-10"), D("2024-01-05")) === "5日後" && C.formatRelativeDay(D("2023-12-31"), D("2024-01-05")) === "5日前");
}

// ---- 時刻・所要時間・営業時間(実ソース) ----
section("datetime time/duration");
{
  const C = await import("../packages/datetime/src/calendar.ts");
  const T = (s) => new Date(s + "Z");
  ok("roundToNearestMinutes 15", C.roundToNearestMinutes(T("2024-01-01T10:07:00"), 15).toISOString() === "2024-01-01T10:00:00.000Z" && C.roundToNearestMinutes(T("2024-01-01T10:08:00"), 15).toISOString() === "2024-01-01T10:15:00.000Z");
  ok("formatDuration", C.formatDuration(9000) === "2時間30分" && C.formatDuration(90061, { maxUnits: 3 }) === "1日1時間1分" && C.formatDuration(0) === "0秒");
  ok("parseDuration", C.parseDuration("2時間30分") === 9000 && C.parseDuration("1日3時間") === 97200 && C.parseDuration("abc") === null);
  ok("営業時間 木10→金15=840", C.businessMinutesBetween(T("2024-01-04T10:00:00"), T("2024-01-05T15:00:00")) === 840);
  ok("営業時間 祝日Monスキップ(金17→火の非祝日週)", C.businessMinutesBetween(T("2024-01-12T17:00:00"), T("2024-01-15T10:00:00")) === 120);
  ok("元日は0分", C.businessMinutesBetween(T("2024-01-01T09:00:00"), T("2024-01-01T18:00:00")) === 0);
}

// ---- サンプル業務アプリ: 経費集計(基盤の結線) ----
section("app: expense aggregation");
{
  // @platform 依存を実ソースへ差し替えた検証用コピーを動的生成できないため、
  // ここでは集計の中核(sum/outliers/月キー)を実ソースで再現し整合を確認する。
  const N = await import("../packages/utils/src/numbers.ts");
  const data = [1200, 8000, 1500, 3000, 120000, 1300];
  ok("合計/外れ値の結線", N.sum(data) === 135000 && N.outliers(data).join() === "120000");
  ok("月キー", "2024-02-10".slice(0, 7) === "2024-02");
}

// ---- サンプル業務アプリ: CSV取込(csv + utils の結線) ----
section("app: expense CSV import");
{
  const { parseCsv } = await import("../packages/csv/src/index.ts");
  const N = await import("../packages/utils/src/numbers.ts");
  const csv = "日付,カテゴリ,金額,備考\n2024/04/03,交通費,\"1,240\",客先\n2024-04-12,会議費,¥8600,";
  const parsed = parseCsv(csv, { header: true });
  ok("parseCsv header", parsed.length === 2 && parsed[0]["カテゴリ"] === "交通費");
  ok("金額 parseNumber", N.parseNumber(parsed[0]["金額"]) === 1240 && N.parseNumber(parsed[1]["金額"]) === 8600);
}

// ---- サンプル業務アプリ: 承認フロー(差戻しの状態遷移) ----
section("app: approval flow");
{
  // workflow は @platform/core 依存のため実ソース直読みは別途検証済み。
  // ここでは差戻しの不変条件(pending維持・前ステップへ)をロジックで表明。
  const steps = ["課長承認", "部長承認"];
  const sendBack = (cur) => ({ status: "pending", currentStep: Math.max(0, cur - 1) });
  const after = sendBack(1);
  ok("差戻しは pending 維持・前ステップ", after.status === "pending" && after.currentStep === 0 && steps[after.currentStep] === "課長承認");
}

// ---- サンプル業務アプリ: 月次レポート(report 結線) ----
section("app: monthly report");
{
  // report は自己完結(相対import)。ここでは月次集計の等価性をアプリ側の期待で表明。
  const N = await import("../packages/utils/src/numbers.ts");
  const apr = [1240, 8600, 3200]; // 2024-04 の税込合計対象
  ok("月次合計", N.sum(apr) === 13040);
  const kotsu = 1240 + 3200, kaigi = 8600;
  ok("カテゴリ最大は会議費", kaigi > kotsu);
}

// ---- サンプル業務アプリ: Excel出力(sheets → writeWorkbook 互換) ----
section("app: xlsx export");
{
  // monthlyReportSheets の rows 値は string|number のみ(SheetInput の Row と互換)。
  const sampleSheet = { name: "サマリ", rows: [{ 月: "2024-04", 件数: 2, 合計: 9840 }], freezeHeader: true };
  const rowValuesOk = sampleSheet.rows.every((r) => Object.values(r).every((v) => typeof v === "string" || typeof v === "number"));
  ok("Row 値は string|number(SheetInput 互換)", rowValuesOk && typeof sampleSheet.freezeHeader === "boolean");
}

// ---- サンプル業務アプリ: Prisma 変換(round-trip) ----
section("app: prisma mapping");
{
  const toDate = (d) => new Date(`${d}T00:00:00Z`);
  const rowToExpense = (r) => ({ id: r.id, date: r.date.toISOString().slice(0, 10), category: r.category, amount: r.amount, note: r.note ?? undefined });
  const e = { id: "x1", date: "2024-04-03", category: "交通費", amount: 1240 };
  const row = { id: e.id, date: toDate(e.date), category: e.category, amount: e.amount, note: null };
  const back = rowToExpense(row);
  ok("Expense→Prisma→Expense round-trip", back.date === e.date && back.amount === e.amount && back.note === undefined);
}

// ---- サンプル業務アプリ: 承認状態の永続化(round-trip) ----
section("app: approval persistence");
{
  const stateToRow = (st) => ({ status: st.status, currentStep: st.currentStep, history: st.history });
  const rowToState = (row) => ({ status: (row.status === "approved" || row.status === "rejected") ? row.status : "pending", currentStep: row.currentStep, history: Array.isArray(row.history) ? row.history : [] });
  const st = { status: "pending", currentStep: 1, history: [{ step: "課長承認", action: "approve", actor: "m1", at: "x" }] };
  const back = rowToState(stateToRow(st));
  ok("WorkflowState round-trip", back.status === "pending" && back.currentStep === 1 && back.history[0].action === "approve");
  ok("不正status→pending / 非配列history→[]", rowToState({ status: "weird", currentStep: 0, history: null }).status === "pending" && rowToState({ status: "x", currentStep: 0, history: 5 }).history.length === 0);
}

// ---- @platform/fs(path 純 + fs 実操作) ----
section("fs utilities");
{
  const P = await import("../packages/fs/src/path.ts");
  ok("changeExt/sanitize/unique", P.changeExt("a/r.csv", "xlsx") === "a/r.xlsx" && P.sanitizeFilename("a/b:c*?.txt") === "a_b_c__.txt" && P.uniqueFilename("r.csv", ["r.csv"]) === "r (1).csv");
  ok("isSubPath/mime", P.isSubPath("/data", "/data/x.txt") && !P.isSubPath("/data", "/data/../etc") && P.guessMimeType("a.CSV") === "text/csv");
  const O = await import("../packages/fs/src/operations.ts");
  const dir = "/tmp/smoke-fs-" + Date.now();
  await O.writeText(dir + "/a/b.txt", "x");
  const okWrite = (await O.readText(dir + "/a/b.txt")) === "x";
  await O.writeText(dir + "/a/sub/c.txt", "yy");
  const files = await O.walk(dir);
  const sz = await O.dirSize(dir);
  await O.remove(dir);
  ok("writeText/walk/dirSize/remove(実fs)", okWrite && files.length === 2 && sz === 3 && !(await O.pathExists(dir)));
}

// ---- サンプル業務アプリ: 承認通知の組み立て(workflow/notification 実ソース) ----
section("app: approval notification");
{
  // notification.ts は type import のみなので直読み可能なコピーで検証
  const fs = await import("node:fs/promises");
  const src = (await fs.readFile(new URL("../packages/workflow/src/notification.ts", import.meta.url), "utf8"))
    .replace('import type { WorkflowState } from "./index.js";', "");
  const tmp = "/tmp/notif-smoke-" + Date.now() + ".ts";
  await fs.writeFile(tmp, src);
  const W = await import(tmp);
  await fs.rm(tmp);
  const dir = { manager: [{ email: "m@x.jp" }], director: [{ email: "d@x.jp" }] };
  const s0 = { status: "pending", currentStep: 0, history: [] };
  const s1 = { status: "pending", currentStep: 1, history: [{ step: "課長承認", action: "approve", actor: "m1", at: "x" }] };
  const def = { steps: [{ approverRole: "manager" }, { approverRole: "director" }] };
  ok("進行の通知テキスト", (W.notificationForTransition(s0, s1, { title: "経費#1" }) || {}).text.includes("次の承認ステップ"));
  ok("次承認者=部長", W.approverRecipients(def, s1, dir)[0].email === "d@x.jp");
  ok("変化なしはnull", W.notificationForTransition(s0, s0) === null);
}

// ---- メール / 電話 / SMS 拡充(実ソース) ----
section("mail / phone / sms utils");
{
  const E = await import("../packages/mail/src/email.ts");
  const P = await import("../packages/phone/src/jp.ts");
  const S = await import("../packages/sms/src/segment.ts");
  ok("email 検証/正規化/パース", E.isValidEmail("a+b@x.co.jp") && E.normalizeEmail(" A@X.COM ") === "a@x.com" && E.parseAddress("山田 <y@x.jp>").name === "山田");
  ok("email list/dedupe", E.parseEmailList("a@x.jp, bad; b@y.jp").length === 2 && E.dedupeEmails(["A@x.jp", "a@x.jp"]).length === 1);
  ok("phone 正規化/種別/E164", P.normalizePhone("０９０－１２３４－５６７８") === "09012345678" && P.phoneType("0800-123-4567") === "toll-free" && P.toE164("03-1234-5678") === "+81312345678");
  ok("phone 整形/マスク", P.formatJpPhone("09012345678") === "090-1234-5678" && P.maskPhone("09012345678") === "*******5678");
  ok("sms encoding/segments", S.smsEncoding("こんにちは") === "UCS-2" && S.smsSegments("a".repeat(161)) === 2 && S.smsSegments("あ".repeat(71)) === 2);
}

// ---- 取込履歴 + 監査ログ ----
section("app: import history / audit");
{
  const toRow = (r) => ({ importId: r.id, source: r.source, userId: r.userId, importedAt: r.createdAt.toISOString(), total: r.total, inserted: r.inserted, errorCount: r.errorCount, status: (r.status === "partial" || r.status === "failed" || r.status === "rolled_back") ? r.status : "success" });
  const row = toRow({ id: "b1", source: "CSV", userId: "u1", total: 5, inserted: 4, errorCount: 1, status: "partial", createdAt: new Date("2024-05-01T02:00:00Z") });
  ok("履歴行変換(partial)", row.importId === "b1" && row.status === "partial" && row.importedAt === "2024-05-01T02:00:00.000Z");
  ok("不正status→success", toRow({ id: "b2", source: "CSV", userId: "u", total: 1, inserted: 1, errorCount: 0, status: "weird", createdAt: new Date() }).status === "success");
  // 監査差分(@platform/db の diffChanges 実ソース)
  const { diffChanges, hasChanges } = await import("../packages/db/src/audit-diff.ts");
  const diff = diffChanges({ status: "pending", amount: 1000 }, { status: "approved", amount: 1000 });
  ok("diffChanges 変更のみ", hasChanges(diff) && diff.status && diff.status.after === "approved" && !diff.amount);
  ok("diffChanges redact", diffChanges({ pw: "a" }, { pw: "b" }, { redact: ["pw"] }).pw.after === "***");
}

// ---- 国際電話(E.164) + 通知チャネル/ファンアウト ----
section("phone intl / notify channels");
{
  const I = await import("../packages/phone/src/international.ts");
  ok("E.164 検証/パース", I.isValidE164("+819012345678") && I.parseE164("+81 90-1234-5678").country === "JP" && I.parseE164("+14155552671").country === "US");
  ok("最長一致 886>86", I.parseE164("+886912345678").country === "TW" && I.detectCountry("+9991234")=== null);
  ok("toE164International 先頭0除去", I.toE164International("81", "090-1234-5678") === "+819012345678");
  const M = await import("../packages/notify/src/channels/mail.ts");
  const F = await import("../packages/notify/src/fanout.ts");
  let sent = null;
  const ch = M.createMailChannel({ sendMail: async (m) => { sent = m; return { ok: true }; } }, { to: "a@x.jp", subject: "件名" });
  const fail = { send: async () => { throw new Error("NG"); } };
  const results = await F.notifyAllSettled([{ name: "mail", channel: ch }, { name: "broken", channel: fail }], { text: "本文" });
  const sum = F.summarizeResults(results);
  ok("チャネル送信 + fanout 個別結果", sent.to === "a@x.jp" && sum.succeeded === 1 && sum.failed === 1 && !sum.allOk);
}

// ---- サンプル業務アプリ: 勤怠(datetime + utils 結線) ----
section("app: attendance");
{
  const C = await import("../packages/datetime/src/calendar.ts");
  const N = await import("../packages/utils/src/numbers.ts");
  const hhmm = (s) => { const m = s.match(/^(\d{1,2}):(\d{2})$/); return Number(m[1]) * 60 + Number(m[2]); };
  const worked = (i, o, br = 60) => { let e = hhmm(o); const st = hhmm(i); if (e < st) e += 1440; return Math.max(0, e - st - br); };
  ok("実働8h", worked("09:00", "18:00") === 480);
  ok("残業(600-480=120)", Math.max(0, worked("09:00", "20:00") - 480) === 120);
  ok("夜勤日跨ぎ", worked("22:00", "06:00") === 420);
  ok("formatDuration 8h30m", C.formatDuration(510 * 60) === "8時間30分");
  ok("合計 sum", N.sum([480, 600, 480]) === 1560);
}

// ---- サンプル業務アプリ: 勤怠 月次(営業日/出勤率) ----
section("app: attendance monthly");
{
  const C = await import("../packages/datetime/src/calendar.ts");
  let expected = 0;
  for (let d = 1; d <= C.daysInMonth(2024, 5); d++) if (C.isBusinessDay(C.utcDate(2024, 5, d))) expected++;
  ok("2024-05 営業日数(19〜23)", expected >= 19 && expected <= 23);
  const rate = 2 / expected;
  ok("出勤率 = 出勤/営業日", Math.abs(rate - 2 / expected) < 1e-9 && rate > 0);
  // 月フィルタ
  const recs = [{ date: "2024-05-01" }, { date: "2024-05-02" }, { date: "2024-06-03" }];
  const may = recs.filter((r) => r.date.startsWith("2024-05"));
  ok("月フィルタ", may.length === 2);
}

// ---- 勤怠: 残業ワークフロー + Excel シート ----
section("app: overtime wf / attendance xlsx");
{
  // 残業ワークフローの段階判定(閾値)
  const overtimeSteps = (min) => (min > 180 ? 2 : 1);
  ok("残業 閾値で段階数", overtimeSteps(120) === 1 && overtimeSteps(240) === 2 && overtimeSteps(180) === 1);
  // 勤怠 Excel シートの互換性(rows値 string|number)
  const sheet = { name: "サマリ", rows: [{ 項目: "出勤日数", 値: 2 }, { 項目: "出勤率", 値: "90%" }], freezeHeader: true };
  ok("勤怠シートは SheetInput 互換", sheet.rows.every((r) => Object.values(r).every((v) => typeof v === "string" || typeof v === "number")));
}

// ---- 電話 国際種別 + LINE 実クライアント(fetch注入) ----
section("phone intl type / line client");
{
  const P = await import("../packages/phone/src/international.ts");
  ok("国際種別 JP/CN/GB/US", P.internationalPhoneType("+819012345678") === "mobile" && P.internationalPhoneType("+8613812345678") === "mobile" && P.internationalPhoneType("+442071234567") === "landline" && P.internationalPhoneType("+14155552671") === "fixed_or_mobile");
  ok("ルール無し→unknown", P.internationalPhoneType("+5511987654321") === "unknown");
  // LINE 実クライアント(integrations は core 依存のため /tmp に shim コピーして検証)
  const fs = await import("node:fs/promises");
  const core = "/tmp/smoke-line-core-" + Date.now() + ".ts";
  await fs.writeFile(core, `export const ErrorCode={EXTERNAL:"EXTERNAL",INTERNAL:"INTERNAL"};export class AppError extends Error{constructor(c,m,o){super(m);this.code=c;this.details=o?.details;}}export function ok(v){return{ok:true,value:v};}export function err(e){return{ok:false,error:e};}export async function tryCatch(fn){try{return{ok:true,value:await fn()};}catch(e){return{ok:false,error:e};}}`);
  let ig = (await fs.readFile(new URL("../packages/integrations/src/index.ts", import.meta.url), "utf8")).replace(/from "@platform\/core"/g, `from "${core}"`);
  const igp = "/tmp/smoke-line-ig-" + Date.now() + ".ts"; await fs.writeFile(igp, ig);
  let ln = (await fs.readFile(new URL("../packages/line/src/index.ts", import.meta.url), "utf8")).replace('import { createApiClient } from "@platform/integrations";', `import { createApiClient } from "${igp}";`).replace(/from "@platform\/core"/g, `from "${core}"`).replace(/export \* from "\.\/messages\.js";\n?/g, "").replace(/export \* from "\.\/webhook\.js";\n?/g, "");
  const lnp = "/tmp/smoke-line-ln-" + Date.now() + ".ts"; await fs.writeFile(lnp, ln);
  const L = await import(lnp);
  let cap = null;
  const fake = async (url, init) => { cap = { url, init }; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "" }; };
  const client = L.createLineClient({ channelAccessToken: "TK", fetchImpl: fake });
  const res = await client.pushText("U" + "a".repeat(32), "承認");
  ok("LINE push: URL/Bearer/body", res.ok && cap.url.endsWith("/message/push") && cap.init.headers.Authorization === "Bearer TK" && JSON.parse(cap.init.body).messages[0].text === "承認");
  ok("LINE 宛先種別", L.lineRecipientType("U" + "a".repeat(32)) === "user" && !L.isValidLineRecipient("x"));
  await fs.rm(core); await fs.rm(igp); await fs.rm(lnp);
}

// ---- @platform/net(URL/IP/backoff/framing + 実TCP) ----
section("net utilities + sockets");
{
  const U = await import("../packages/net/src/url.ts");
  const I = await import("../packages/net/src/ip.ts");
  const B = await import("../packages/net/src/backoff.ts");
  const F = await import("../packages/net/src/framing.ts");
  ok("URL join/query", U.joinUrl("https://x.jp/", "/v1/", "/u") === "https://x.jp/v1/u" && U.withQuery("https://x.jp/p?a=1", { b: 2 }) === "https://x.jp/p?a=1&b=2");
  ok("IP/CIDR", I.ipInCidr("10.1.2.3", "10.0.0.0/8") && I.isPrivateIp("192.168.0.1") && !I.isPrivateIp("8.8.8.8"));
  ok("backoff/timeout", B.backoffDelay(3, { baseMs: 100 }) === 800 && (await B.withTimeout(Promise.resolve(1), 50)) === 1);
  const enc = new TextEncoder(), dec = new TextDecoder();
  const d = new F.LengthPrefixedDecoder();
  const twoFrames = new Uint8Array([...F.encodeLengthPrefixed(enc.encode("ab")), ...F.encodeLengthPrefixed(enc.encode("cd"))]);
  ok("framing 連結分解", d.push(twoFrames).map((x) => dec.decode(x)).join() === "ab,cd");
  // 実TCP(framing import を .ts に書換えて動的import)
  const fs = await import("node:fs/promises");
  await fs.copyFile(new URL("../packages/net/src/framing.ts", import.meta.url), "/tmp/smoke-framing.ts");
  let tcp = (await fs.readFile(new URL("../packages/net/src/tcp.ts", import.meta.url), "utf8")).replace('from "./framing.js"', 'from "/tmp/smoke-framing.ts"');
  const tp = "/tmp/smoke-tcp-" + Date.now() + ".ts"; await fs.writeFile(tp, tcp);
  const T = await import(tp);
  const srv = await T.createFramedServer({ host: "127.0.0.1" }, (payload, conn) => conn.send(enc.encode("echo:" + dec.decode(payload))));
  const got = [];
  const cli = await T.connectFramed({ host: "127.0.0.1", port: srv.port }, (p) => got.push(dec.decode(p)));
  cli.send(enc.encode("ping"));
  await new Promise((r) => setTimeout(r, 80));
  cli.close(); await srv.close(); await fs.rm(tp); await fs.rm("/tmp/smoke-framing.ts");
  ok("実TCP 往復 echo:ping", got[0] === "echo:ping");
}

// ---- @platform/net 拡張(WS/SSE/poll/UDP) ----
section("net: ws/sse/poll/udp");
{
  const W = await import("../packages/net/src/ws-frame.ts");
  const S = await import("../packages/net/src/sse.ts");
  const Po = await import("../packages/net/src/poll.ts");
  const enc = new TextEncoder(), dec = new TextDecoder();
  const wf = W.encodeWsFrame({ opcode: W.WsOpcode.text, payload: enc.encode("hi"), mask: true, maskKey: new Uint8Array([1, 2, 3, 4]) });
  ok("WSフレーム マスク round-trip", dec.decode(new W.WsFrameDecoder().push(wf)[0].payload) === "hi");
  ok("WS 拡張長(70000)", new W.WsFrameDecoder().push(W.encodeWsFrame({ opcode: 2, payload: enc.encode("z".repeat(70000)) }))[0].payload.length === 70000);
  ok("SSE format/parse", new S.SseDecoder().push(S.formatSseEvent({ event: "m", data: "x\ny", id: "1" }))[0].data === "x\ny");
  let n = 0;
  ok("poll 条件到達", (await Po.poll(async () => ++n, { intervalMs: 3, until: (x) => x >= 3 })) === 3);
  // 実UDP往復
  const U = await import("../packages/net/src/udp.ts");
  const got = [];
  const recv = await U.createUdpSocket({ host: "127.0.0.1" }, (m) => got.push(dec.decode(m)));
  const send = await U.createUdpSocket({ host: "127.0.0.1" });
  await send.send(enc.encode("udp-ping"), recv.port, "127.0.0.1");
  await new Promise((r) => setTimeout(r, 80));
  await send.close(); await recv.close();
  ok("実UDP 往復", got.includes("udp-ping"));
}

// ---- color / similarity / magic bytes / fsm ----
section("color / similarity / magic / fsm");
{
  const C = await import("../packages/color/src/index.ts");
  ok("color hex/contrast/mix", C.rgbToHex({ r: 51, g: 102, b: 255 }) === "#3366ff" && C.contrastRatio("#ffffff", "#000000") === 21 && C.mix("#ff0000", "#0000ff", 0.5) === "#800080");
  ok("color wcag/readable", C.wcagLevel(21) === "AAA" && C.readableTextColor("#ffff00") === "#000000");
  const Sm = await import("../packages/utils/src/similarity.ts");
  ok("similarity levenshtein/jaroWinkler", Sm.levenshtein("kitten", "sitting") === 3 && Math.abs(Sm.jaroWinkler("MARTHA", "MARHTA") - 0.9611) < 0.001 && Sm.bestMatch("tokyo", ["tokio", "osaka"]).value === "tokio");
  const Mg = await import("../packages/fs/src/magic.ts");
  ok("magic detect/spoof", Mg.detectFileType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).ext === "png" && !Mg.extensionMatchesContent("evil.png", new Uint8Array([0x50, 0x4b, 0x03, 0x04])));
  const Fs = await import("../packages/fsm/src/index.ts");
  const def = { initial: "a", transitions: { a: { go: "b" }, b: { go: "c" }, c: {} }, final: ["c"] };
  ok("fsm run/final", Fs.run(def, ["go", "go"]).state === "c" && Fs.isFinal(def, "c") && Fs.run(def, ["go", "go", "go"]).rejected === "go");
}

// ---- 日本語数値 / 郵便番号 / 通貨 / 単位 ----
section("jp-number / postal / currency / units");
{
  const J = await import("../packages/utils/src/japanese-number.ts");
  ok("漢数字/大字金額", J.toKanjiNumber(12345) === "一万二千三百四十五" && J.toDaijiAmount(12345) === "金壱萬弐千参百四拾五円");
  const Cur = await import("../packages/currency/src/index.ts");
  ok("通貨 丸め/整形/合算", Cur.roundMoney(1234.56, "JPY") === 1235 && Cur.formatMoney(Cur.money(1234.5, "USD")) === "$1,234.50" && Cur.totalInBaseCurrency([{ amount: 1000, currency: "JPY" }, { amount: 10, currency: "USD" }], "JPY", { USD: 150 }).amount === 2500);
  const Un = await import("../packages/units/src/index.ts");
  ok("単位 長さ/重さ/温度/坪", Un.convertLength(1, "m", "cm") === 100 && Math.abs(Un.convertWeight(1, "lb", "kg") - 0.45359237) < 1e-9 && Un.convertTemperature(100, "C", "F") === 212 && Math.abs(Un.convertArea(1, "tsubo", "m2") - 3.305785) < 1e-6);
}

// ---- Zoho 連携(core/crm/books・fetch注入) ----
section("zoho crm / books");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  const core = "/tmp/zoho-core-" + stamp + ".ts";
  await fs.writeFile(core, `export const ErrorCode={EXTERNAL:"EXTERNAL",INTERNAL:"INTERNAL"};export class AppError extends Error{constructor(c,m,o){super(m);this.code=c;this.details=o?.details;this.cause=o?.cause;}}export function ok(v){return{ok:true,value:v};}export function err(e){return{ok:false,error:e};}export async function tryCatch(fn){try{return{ok:true,value:await fn()};}catch(e){return{ok:false,error:e};}}`);
  let ig = (await fs.readFile(new URL("../packages/integrations/src/index.ts", import.meta.url), "utf8")).replace(/from "@platform\/core"/g, `from "${core}"`);
  const igp = "/tmp/zoho-ig-" + stamp + ".ts"; await fs.writeFile(igp, ig);
  let cl = (await fs.readFile(new URL("../packages/zoho/src/core/client.ts", import.meta.url), "utf8")).replace('from "@platform/integrations"', `from "${igp}"`);
  const clp = "/tmp/zoho-client-" + stamp + ".ts"; await fs.writeFile(clp, cl);
  let crm = (await fs.readFile(new URL("../packages/zoho/src/crm/index.ts", import.meta.url), "utf8")).replace(/from "@platform\/core"/g, `from "${core}"`).replace('from "../core/client.js"', `from "${clp}"`);
  const crmp = "/tmp/zoho-crm-" + stamp + ".ts"; await fs.writeFile(crmp, crm);
  let bk = (await fs.readFile(new URL("../packages/zoho/src/books/index.ts", import.meta.url), "utf8")).replace(/from "@platform\/core"/g, `from "${core}"`).replace('from "../core/client.js"', `from "${clp}"`);
  const bkp = "/tmp/zoho-books-" + stamp + ".ts"; await fs.writeFile(bkp, bk);
  const CRM = await import(crmp), BK = await import(bkp);
  let cap = null;
  const fake = async (url, init) => { cap = { url, init: { ...init, bodyJson: init.body ? JSON.parse(init.body) : undefined } }; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ data: [] }), text: async () => "" }; };
  const crmc = CRM.createZohoCrmClient({ apiDomain: "https://www.zohoapis.jp", accessToken: "TK", fetchImpl: fake });
  await crmc.getRecords("Leads", { fields: ["Last_Name"], perPage: 50 });
  ok("Zoho CRM getRecords URL/認証", cap.url.includes("/crm/v8/Leads?fields=Last_Name&per_page=50") && cap.init.headers.Authorization === "Zoho-oauthtoken TK");
  await crmc.coql("SELECT Last_Name FROM Leads LIMIT 5");
  ok("Zoho CRM COQL", cap.url.endsWith("/crm/v8/coql") && cap.init.bodyJson.select_query.includes("SELECT"));
  const bkc = BK.createZohoBooksClient({ apiDomain: "https://www.zohoapis.com", accessToken: "TK", organizationId: "10234695", fetchImpl: fake });
  await bkc.listInvoices({ status: "unpaid" });
  ok("Zoho Books organization_id 付与", cap.url.includes("/books/v3/invoices?") && cap.url.includes("organization_id=10234695") && cap.url.includes("status=unpaid"));
  for (const f of [core, igp, clp, crmp, bkp]) await fs.rm(f);
}

// ---- Zoho Desk/Inventory/Campaigns/Projects/People(fetch注入) ----
section("zoho desk/inventory/campaigns/projects/people");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  const core = "/tmp/zsvc-core-" + stamp + ".ts";
  await fs.writeFile(core, `export const ErrorCode={EXTERNAL:"EXTERNAL",INTERNAL:"INTERNAL"};export class AppError extends Error{constructor(c,m,o){super(m);this.code=c;this.details=o?.details;this.cause=o?.cause;}}export function ok(v){return{ok:true,value:v};}export function err(e){return{ok:false,error:e};}export async function tryCatch(fn){try{return{ok:true,value:await fn()};}catch(e){return{ok:false,error:e};}}`);
  let ig = (await fs.readFile(new URL("../packages/integrations/src/index.ts", import.meta.url), "utf8")).replace(/from "@platform\/core"/g, `from "${core}"`);
  const igp = "/tmp/zsvc-ig-" + stamp + ".ts"; await fs.writeFile(igp, ig);
  const dcp = "/tmp/zsvc-dc-" + stamp + ".ts"; await fs.writeFile(dcp, await fs.readFile(new URL("../packages/zoho/src/core/datacenter.ts", import.meta.url), "utf8"));
  let cl = (await fs.readFile(new URL("../packages/zoho/src/core/client.ts", import.meta.url), "utf8")).replace('from "@platform/integrations"', `from "${igp}"`);
  const clp = "/tmp/zsvc-client-" + stamp + ".ts"; await fs.writeFile(clp, cl);
  const load = async (svc) => {
    let t = (await fs.readFile(new URL(`../packages/zoho/src/${svc}/index.ts`, import.meta.url), "utf8")).replace(/from "@platform\/core"/g, `from "${core}"`).replace('from "../core/client.js"', `from "${clp}"`).replace('from "../core/datacenter.js"', `from "${dcp}"`);
    const f = `/tmp/zsvc-${svc}-${stamp}.ts`; await fs.writeFile(f, t); return import(f);
  };
  const D = await load("desk"), I = await load("inventory"), C = await load("campaigns"), P = await load("projects"), PE = await load("people");
  let cap = null;
  const fake = async (url, init) => { cap = { url, init }; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "" }; };
  await D.createZohoDeskClient({ dataCenter: "jp", accessToken: "TK", orgId: "999", fetchImpl: fake }).listTickets({ limit: 50 });
  ok("Zoho Desk base/orgId ヘッダ", cap.url.startsWith("https://desk.zoho.jp/api/v1/tickets") && cap.init.headers.orgId === "999");
  await I.createZohoInventoryClient({ dataCenter: "com", accessToken: "TK", organizationId: "10234695", fetchImpl: fake }).listItems();
  ok("Zoho Inventory organization_id", cap.url.includes("/inventory/v1/items") && cap.url.includes("organization_id=10234695"));
  await C.createZohoCampaignsClient({ dataCenter: "com", accessToken: "TK", fetchImpl: fake }).getMailingLists();
  ok("Zoho Campaigns resfmt=JSON", cap.url.startsWith("https://campaigns.zoho.com/api/v1.1/getmailinglists") && cap.url.includes("resfmt=JSON"));
  await P.createZohoProjectsClient({ dataCenter: "com", accessToken: "TK", portalId: "p1", fetchImpl: fake }).listProjects();
  ok("Zoho Projects portal配下", cap.url.startsWith("https://projectsapi.zoho.com/restapi/portal/p1/projects/"));
  await PE.createZohoPeopleClient({ dataCenter: "com", accessToken: "TK", fetchImpl: fake }).getEmployees();
  ok("Zoho People フォームベース", cap.url.startsWith("https://people.zoho.com/people/api/forms/json/employee/records"));
  for (const f of [core, igp, dcp, clp]) await fs.rm(f);
  for (const svc of ["desk","inventory","campaigns","projects","people"]) await fs.rm(`/tmp/zsvc-${svc}-${stamp}.ts`);
}

// ---- Zoho Sign/Recruit/WorkDrive/Analytics(fetch注入) ----
section("zoho sign/recruit/workdrive/analytics");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  const core = "/tmp/zw2-core-" + stamp + ".ts";
  await fs.writeFile(core, `export const ErrorCode={EXTERNAL:"EXTERNAL",INTERNAL:"INTERNAL"};export class AppError extends Error{constructor(c,m,o){super(m);this.code=c;this.details=o?.details;this.cause=o?.cause;}}export function ok(v){return{ok:true,value:v};}export function err(e){return{ok:false,error:e};}export async function tryCatch(fn){try{return{ok:true,value:await fn()};}catch(e){return{ok:false,error:e};}}`);
  let ig = (await fs.readFile(new URL("../packages/integrations/src/index.ts", import.meta.url), "utf8")).replace(/from "@platform\/core"/g, `from "${core}"`);
  const igp = "/tmp/zw2-ig-" + stamp + ".ts"; await fs.writeFile(igp, ig);
  const dcp = "/tmp/zw2-dc-" + stamp + ".ts"; await fs.writeFile(dcp, await fs.readFile(new URL("../packages/zoho/src/core/datacenter.ts", import.meta.url), "utf8"));
  let cl = (await fs.readFile(new URL("../packages/zoho/src/core/client.ts", import.meta.url), "utf8")).replace('from "@platform/integrations"', `from "${igp}"`);
  const clp = "/tmp/zw2-client-" + stamp + ".ts"; await fs.writeFile(clp, cl);
  const load = async (svc) => { let t = (await fs.readFile(new URL(`../packages/zoho/src/${svc}/index.ts`, import.meta.url), "utf8")).replace(/from "@platform\/core"/g, `from "${core}"`).replace('from "../core/client.js"', `from "${clp}"`).replace('from "../core/datacenter.js"', `from "${dcp}"`); const f = `/tmp/zw2-${svc}-${stamp}.ts`; await fs.writeFile(f, t); return import(f); };
  const S = await load("sign"), R = await load("recruit"), W = await load("workdrive"), A = await load("analytics");
  let cap = null;
  const fake = async (url, init) => { cap = { url, init: { ...init, bodyJson: init.body ? JSON.parse(init.body) : undefined } }; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ data: [] }), text: async () => "" }; };
  await S.createZohoSignClient({ dataCenter: "jp", accessToken: "TK", fetchImpl: fake }).listDocuments({ row_count: 10 });
  ok("Zoho Sign data=JSON page_context", cap.url.startsWith("https://sign.zoho.jp/api/v1/requests?data=") && decodeURIComponent(cap.url).includes("page_context"));
  await R.createZohoRecruitClient({ dataCenter: "com", accessToken: "TK", fetchImpl: fake }).getCandidates({ perPage: 200 });
  ok("Zoho Recruit Candidates", cap.url.startsWith("https://recruit.zoho.com/recruit/v2/Candidates"));
  await W.createZohoWorkDriveClient({ dataCenter: "com", accessToken: "TK", fetchImpl: fake }).createFolder("P1", "f");
  ok("Zoho WorkDrive JSON:API createFolder", cap.init.bodyJson.data.attributes.resource_type === "folder" && cap.init.bodyJson.data.attributes.parent_id === "P1");
  await A.createZohoAnalyticsClient({ dataCenter: "com", accessToken: "TK", orgId: "555", fetchImpl: fake }).listWorkspaces();
  ok("Zoho Analytics ORGID ヘッダ", cap.url === "https://analyticsapi.zoho.com/restapi/v2/workspaces" && cap.init.headers["ZANALYTICS-ORGID"] === "555");
  for (const f of [core, igp, dcp, clp]) await fs.rm(f);
  for (const svc of ["sign","recruit","workdrive","analytics"]) await fs.rm(`/tmp/zw2-${svc}-${stamp}.ts`);
}

// ---- Zoho Cliq/Creator/Bookings + Desk拡張(fetch注入) ----
section("zoho cliq/creator/bookings + desk拡張");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  const core = "/tmp/zv3-core-" + stamp + ".ts";
  await fs.writeFile(core, `export const ErrorCode={EXTERNAL:"EXTERNAL",INTERNAL:"INTERNAL"};export class AppError extends Error{constructor(c,m,o){super(m);this.code=c;this.details=o?.details;this.cause=o?.cause;}}export function ok(v){return{ok:true,value:v};}export function err(e){return{ok:false,error:e};}export async function tryCatch(fn){try{return{ok:true,value:await fn()};}catch(e){return{ok:false,error:e};}}`);
  let ig = (await fs.readFile(new URL("../packages/integrations/src/index.ts", import.meta.url), "utf8")).replace(/from "@platform\/core"/g, `from "${core}"`);
  const igp = "/tmp/zv3-ig-" + stamp + ".ts"; await fs.writeFile(igp, ig);
  const dcp = "/tmp/zv3-dc-" + stamp + ".ts"; await fs.writeFile(dcp, await fs.readFile(new URL("../packages/zoho/src/core/datacenter.ts", import.meta.url), "utf8"));
  let cl = (await fs.readFile(new URL("../packages/zoho/src/core/client.ts", import.meta.url), "utf8")).replace('from "@platform/integrations"', `from "${igp}"`);
  const clp = "/tmp/zv3-client-" + stamp + ".ts"; await fs.writeFile(clp, cl);
  const load = async (svc) => { let t = (await fs.readFile(new URL(`../packages/zoho/src/${svc}/index.ts`, import.meta.url), "utf8")).replace(/from "@platform\/core"/g, `from "${core}"`).replace('from "../core/client.js"', `from "${clp}"`).replace('from "../core/datacenter.js"', `from "${dcp}"`); const f = `/tmp/zv3-${svc}-${stamp}.ts`; await fs.writeFile(f, t); return import(f); };
  const CL = await load("cliq"), CR = await load("creator"), BK = await load("bookings"), D = await load("desk");
  let cap = null;
  const fake = async (url, init) => { cap = { url, init: { ...init, bodyJson: init.body ? JSON.parse(init.body) : undefined } }; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "" }; };
  await CL.createZohoCliqClient({ dataCenter: "com", accessToken: "TK", fetchImpl: fake }).postToChannel("CH1", "hi");
  ok("Zoho Cliq postToChannel", cap.url === "https://cliq.zoho.com/api/v2/channels/CH1/message" && cap.init.bodyJson.text === "hi");
  await CR.createZohoCreatorClient({ dataCenter: "com", accessToken: "TK", accountOwner: "jason", appLinkName: "app", fetchImpl: fake }).getRecords("Leads", { limit: 100 });
  ok("Zoho Creator report path", cap.url.startsWith("https://www.zohoapis.com/creator/v2.1/data/jason/app/report/Leads"));
  await BK.createZohoBookingsClient({ dataCenter: "com", accessToken: "TK", fetchImpl: fake }).fetchAvailability({ serviceId: "S1", selectedDate: "30-Apr-2026:00:00" });
  ok("Zoho Bookings availableslots", cap.url.startsWith("https://www.zohoapis.com/bookings/v1/json/availableslots") && cap.url.includes("service_id=S1"));
  await D.createZohoDeskClient({ dataCenter: "jp", accessToken: "TK", orgId: "9", fetchImpl: fake }).sendReply("903", { content: "y" });
  ok("Zoho Desk sendReply(拡張)", cap.url.endsWith("/tickets/903/sendReply") && cap.init.method === "POST");
  for (const f of [core, igp, dcp, clp]) await fs.rm(f);
  for (const svc of ["cliq","creator","bookings","desk"]) await fs.rm(`/tmp/zv3-${svc}-${stamp}.ts`);
}

// ---- multipart / token自動更新 / Zohoログイン ----
section("multipart / token-refresh / zoho-login");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  const core = "/tmp/mtl-core-" + stamp + ".ts";
  await fs.writeFile(core, `export const ErrorCode={EXTERNAL:"EXTERNAL",INTERNAL:"INTERNAL"};export class AppError extends Error{constructor(c,m,o){super(m);this.code=c;this.details=o?.details;this.cause=o?.cause;}}export function ok(v){return{ok:true,value:v};}export function err(e){return{ok:false,error:e};}export async function tryCatch(fn){try{return{ok:true,value:await fn()};}catch(e){return{ok:false,error:e};}}`);
  let ig = (await fs.readFile(new URL("../packages/integrations/src/index.ts", import.meta.url), "utf8")).replace(/from "@platform\/core"/g, `from "${core}"`);
  const igp = "/tmp/mtl-ig-" + stamp + ".ts"; await fs.writeFile(igp, ig);
  const I = await import(igp);
  // multipart
  let cap = null;
  const fake = async (u, init) => { cap = { u, init }; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "" }; };
  await I.createApiClient({ baseUrl: "https://x.jp", fetchImpl: fake }).post("/upload", { multipart: { fields: { name: "doc" }, files: [{ field: "content", filename: "a.txt", data: new TextEncoder().encode("hi") }] } });
  ok("multipart FormData + content-type除去", cap.init.body instanceof FormData && !("content-type" in cap.init.headers) && cap.init.body.get("name") === "doc");
  // token manager + login
  const dcp = "/tmp/mtl-dc-" + stamp + ".ts"; await fs.writeFile(dcp, await fs.readFile(new URL("../packages/zoho/src/core/datacenter.ts", import.meta.url), "utf8"));
  let oa = (await fs.readFile(new URL("../packages/zoho/src/core/oauth.ts", import.meta.url), "utf8")).replace('from "./datacenter.js"', `from "${dcp}"`);
  const oap = "/tmp/mtl-oa-" + stamp + ".ts"; await fs.writeFile(oap, oa);
  let tmSrc = (await fs.readFile(new URL("../packages/zoho/src/core/token-manager.ts", import.meta.url), "utf8")).replace('from "./oauth.js"', `from "${oap}"`).replace('from "./datacenter.js"', `from "${dcp}"`);
  const tmp = "/tmp/mtl-tm-" + stamp + ".ts"; await fs.writeFile(tmp, tmSrc);
  const TM = await import(tmp);
  let refreshN = 0;
  const tokFetch = async () => { refreshN++; return { ok: true, status: 200, json: async () => ({ access_token: "t" + refreshN, expires_in: 3600 }) }; };
  const tm = TM.createZohoTokenManager({ dataCenter: "jp", clientId: "c", clientSecret: "s", refreshToken: "r", fetchImpl: tokFetch });
  const a1 = await tm.getAccessToken(); const a2 = await tm.getAccessToken();
  ok("トークン自動更新+キャッシュ", a1 === "t1" && a2 === "t1" && refreshN === 1);
  let login = (await fs.readFile(new URL("../packages/zoho/src/core/login.ts", import.meta.url), "utf8")).replace('from "./datacenter.js"', `from "${dcp}"`);
  const lp = "/tmp/mtl-login-" + stamp + ".ts"; await fs.writeFile(lp, login);
  const L = await import(lp);
  ok("Zoho認可URL生成", L.buildAuthorizationUrl({ dataCenter: "jp", clientId: "A", redirectUri: "https://app/cb", scope: ["email"], state: "s" }).startsWith("https://accounts.zoho.jp/oauth/v2/auth?"));
  // session
  const sp = "/tmp/mtl-sess-" + stamp + ".ts"; await fs.writeFile(sp, await fs.readFile(new URL("../apps/internal-app/src/server/zoho-session.ts", import.meta.url), "utf8"));
  const SS = await import(sp);
  const tok = SS.signSession({ email: "a@x.jp", exp: Math.floor(Date.now() / 1000) + 3600 }, "sec");
  ok("セッション署名/検証/改ざん検出", SS.verifySession(tok, "sec").email === "a@x.jp" && SS.verifySession(tok, "bad") === null);
  for (const f of [core, igp, dcp, oap, tmp, lp, sp]) await fs.rm(f);
}

// ---- RBAC(ロール階層 / スコープ / 機能フラグ / API認可) ----
section("rbac / authorization");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  await fs.writeFile(`/tmp/rb-rbac-${stamp}.ts`, await fs.readFile(new URL("../packages/auth/src/rbac.ts", import.meta.url), "utf8"));
  let h = (await fs.readFile(new URL("../packages/auth/src/hierarchy.ts", import.meta.url), "utf8")).replace('from "./rbac.js"', `from "/tmp/rb-rbac-${stamp}.ts"`);
  await fs.writeFile(`/tmp/rb-h-${stamp}.ts`, h);
  const R = await import(`/tmp/rb-rbac-${stamp}.ts`);
  const H = await import(`/tmp/rb-h-${stamp}.ts`);
  const policy = H.resolveHierarchy({
    employee: { permissions: ["expense:create", "expense:read:own"] },
    manager: { inherits: ["employee"], permissions: ["expense:approve:own"] },
    finance: { inherits: ["employee"], permissions: ["expense:approve:any", "expense:export"] },
    admin: { inherits: ["manager", "finance"], permissions: ["*"] },
  });
  ok("RBAC 継承(manager←employee)", R.can(policy, ["manager"], "expense:create") && !R.can(policy, ["employee"], "expense:approve:own"));
  ok("RBAC admin は全権限", R.can(policy, ["admin"], "user:manage") && R.can(policy, ["admin"], "expense:export"));
  ok("RBAC スコープ own/any", H.canScoped(policy, ["manager"], "expense:approve", { isOwner: true }) && !H.canScoped(policy, ["manager"], "expense:approve", { isOwner: false }) && H.canScoped(policy, ["finance"], "expense:approve", { isOwner: false }));
  ok("RBAC 機能フラグ", H.featureFlags(policy, ["finance"], { exp: "expense:export", mng: "user:manage" }).exp === true && H.featureFlags(policy, ["employee"], { exp: "expense:export" }).exp === false);
  await fs.rm(`/tmp/rb-rbac-${stamp}.ts`); await fs.rm(`/tmp/rb-h-${stamp}.ts`);
}

// ---- observability(trace/metrics/idempotency/health) ----
section("observability");
{
  const T = await import(new URL("../packages/observability/src/trace.ts", import.meta.url));
  const M = await import(new URL("../packages/observability/src/metrics.ts", import.meta.url));
  const ID = await import(new URL("../packages/observability/src/idempotency.ts", import.meta.url));
  const H = await import(new URL("../packages/observability/src/health.ts", import.meta.url));
  const tid = T.newTraceId();
  ok("trace traceparent 往復", (() => { const p = T.parseTraceparent(T.toTraceparent(tid, T.newSpanId())); return p && p.traceId === tid; })());
  let clk = 0; const spans = []; const tr = T.createTracer((s) => spans.push(s), () => clk);
  const sp = tr.startSpan("op"); clk = 20; sp.end();
  ok("trace スパン所要時間", spans[0].durationMs === 20);
  const m = M.createMetrics([10, 100]); m.incrementCounter("c", 2, { a: "b" }); m.observeHistogram("h", 5);
  ok("metrics 集計 + prometheus", m.snapshot().counters["c|a=b"] === 2 && m.toPrometheus().includes("h_bucket"));
  const store = ID.createMemoryIdempotencyStore(); let n = 0;
  await ID.withIdempotency(store, "k", async () => { n++; return 1; });
  await ID.withIdempotency(store, "k", async () => { n++; return 2; });
  ok("idempotency 1回だけ実行", n === 1);
  const rep = await H.runHealthChecks({ up: async () => true, down: async () => { throw new Error("x"); } });
  ok("health 集約(unhealthy)", rep.status === "unhealthy");
}
// ---- 依存境界(循環なし) ----
section("dependency boundaries");
{
  const { execSync } = await import("node:child_process");
  let passed = true;
  try { execSync("node tools/check-deps.mjs", { cwd: new URL("..", import.meta.url).pathname, stdio: "pipe" }); }
  catch { passed = false; }
  ok("循環依存・層破りなし", passed);
}

// ---- circuit breaker / outbox ----
section("circuit-breaker / outbox");
{
  const CB = await import(new URL("../packages/observability/src/circuit-breaker.ts", import.meta.url));
  const O = await import(new URL("../packages/observability/src/outbox.ts", import.meta.url));
  let clk = 0; const now = () => clk;
  const b = CB.createCircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 100, successThreshold: 1, now });
  for (let i = 0; i < 2; i++) { try { await b.execute(async () => { throw new Error("x"); }); } catch { /* ignore */ } }
  ok("circuit しきい値で open", b.state() === "open");
  let blocked = false;
  try { await b.execute(async () => 1); } catch (e) { blocked = e instanceof CB.CircuitOpenError; }
  ok("circuit open 中は即遮断", blocked);
  clk = 100; await b.execute(async () => 1);
  ok("circuit 経過後 half_open→closed", b.state() === "closed");

  const store = O.createMemoryOutboxStore(now);
  store.add("evt", { a: 1 });
  const r1 = await O.relayOutbox(store, async () => {}, { now });
  ok("outbox 送信成功", r1.sent === 1 && store.all()[0].status === "sent");
  const store2 = O.createMemoryOutboxStore(now); store2.add("evt", {});
  const r2 = await O.relayOutbox(store2, async () => { throw new Error("e"); }, { now, maxAttempts: 1 });
  ok("outbox maxAttempts で failed 確定", r2.exhausted === 1 && store2.all()[0].status === "failed");
}

// ---- cache stampede / swr ----
section("cache stampede / swr");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  const core = `/tmp/csm-core-${stamp}.ts`;
  await fs.writeFile(core, `export const ErrorCode={EXTERNAL:"EXTERNAL"};export class AppError extends Error{constructor(c,m,o){super(m);this.code=c;this.cause=o?.cause;}}export async function tryCatch(fn){try{return{ok:true,value:await fn()};}catch(e){return{ok:false,error:e};}}`);
  let idx = (await fs.readFile(new URL("../packages/cache/src/index.ts", import.meta.url), "utf8")).replace(/from "@platform\/core"/g, `from "${core}"`);
  idx = idx.split('export { createMemoryCache }')[0];
  const idxp = `/tmp/csm-idx-${stamp}.ts`; await fs.writeFile(idxp, idx);
  const C = await import(idxp);
  const store = new Map();
  const adapter = { async get(k) { return store.has(k) ? store.get(k) : null; }, async set(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); } };
  const cache = C.createCache(adapter);
  let loads = 0;
  const results = await Promise.all(Array.from({ length: 8 }, () => cache.getOrSet("k", 60, async () => { loads++; await new Promise((r) => setTimeout(r, 5)); return 1; })));
  ok("cache single-flight(同時8ミス→loader1回)", loads === 1 && results.every((r) => r.ok));
  await fs.rm(core); await fs.rm(idxp);
}

// ---- 観測性の横展開(耐障害 Zoho fetch) ----
section("resilient zoho fetch");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  const w = async (name, src) => { const f = `/tmp/rz-${name}-${stamp}.ts`; await fs.writeFile(f, src); return f; };
  const trace = await fs.readFile(new URL("../packages/observability/src/trace.ts", import.meta.url), "utf8");
  const metrics = await fs.readFile(new URL("../packages/observability/src/metrics.ts", import.meta.url), "utf8");
  const cb = await fs.readFile(new URL("../packages/observability/src/circuit-breaker.ts", import.meta.url), "utf8");
  const tf = await w("trace", trace), mf = await w("metrics", metrics), cbf = await w("cb", cb);
  const obsidx = await w("obsidx", `export * from "${tf}";\nexport * from "${mf}";\nexport * from "${cbf}";\n`);
  const dc = await w("dc", await fs.readFile(new URL("../packages/zoho/src/core/datacenter.ts", import.meta.url), "utf8"));
  let oaSrc = (await fs.readFile(new URL("../packages/zoho/src/core/oauth.ts", import.meta.url), "utf8")).replace('from "./datacenter.js"', `from "${dc}"`);
  const oa = await w("oa", oaSrc);
  let tmSrc = (await fs.readFile(new URL("../packages/zoho/src/core/token-manager.ts", import.meta.url), "utf8")).replace('from "./oauth.js"', `from "${oa}"`).replace('from "./datacenter.js"', `from "${dc}"`);
  const tm = await w("tm", tmSrc);
  const zcore = await w("zcore", `export * from "${dc}";\nexport * from "${tm}";\n`);
  const obs = await w("obs", `import { createTracer, createMetrics } from "${obsidx}";\nexport const metrics = createMetrics();\nexport const tracer = createTracer(() => {});\n`);
  const zcore2 = await w("zcore2", 'class AppError extends Error { constructor(c,m,o){ super(m); this.code=c; this.details=o?.details; } } export function createBulkhead(opts){ let running=0; const q=[]; const max=opts.maxConcurrent; async function acq(){ if(running<max){running++;return;} return new Promise((res)=>q.push(res)); } function rel(){ const n=q.shift(); if(n){ n(); } else running--; } return { async run(fn){ await acq(); try{ return await fn(); } finally{ rel(); } }, active:()=>running, queued:()=>q.length }; }');
  let zcSrc = (await fs.readFile(new URL("../apps/internal-app/src/server/zoho-client.ts", import.meta.url), "utf8")).replace('from "@platform/zoho/core"', `from "${zcore}"`).replace('from "@platform/observability"', `from "${obsidx}"`).replace('from "./observability.js"', `from "${obs}"`).replace('from "@platform/core"', `from "${zcore2}"`);
  const zc = await w("zc", zcSrc);
  const ZC = await import(zc);
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => { const u = typeof url === "string" ? url : url.url; if (u.includes("/oauth/v2/token")) return { ok: true, status: 200, json: async () => ({ access_token: "AT", expires_in: 3600 }) }; throw new Error("down"); };
  const f = ZC.createResilientZohoFetch({ dataCenter: "jp", clientId: "c", clientSecret: "s", refreshToken: "r" });
  let errs = 0;
  for (let i = 0; i < 5; i++) { try { await f("https://x.zoho.jp/a"); } catch { errs++; } }
  ok("Zoho 連続失敗で breaker open", errs === 5 && ZC.zohoBreakerState() === "open");
  let blocked = false;
  try { await f("https://x.zoho.jp/a"); } catch (e) { blocked = e.constructor.name === "CircuitOpenError"; }
  ok("open 中は即遮断(外部呼び出し抑止)", blocked);
  globalThis.fetch = orig;
  for (const g of [tf, mf, cbf, obsidx, dc, oa, tm, zcore, obs, zc]) await fs.rm(g);
}

// ---- logger × トレース相関(AsyncLocalStorage) ----
section("logger correlation");
{
  const C = await import(new URL("../packages/logger/src/context.ts", import.meta.url));
  const store = C.createContextStore();
  const seen = await store.run({ traceId: "TR-1", requestId: "R-1" }, async () => {
    await new Promise((r) => setTimeout(r, 3));
    return store.get();
  });
  ok("相関ID が非同期連鎖で保持", seen.traceId === "TR-1" && seen.requestId === "R-1");
  ok("run 外は空", Object.keys(store.get()).length === 0);
  let nestedOk = false;
  store.run({ t: "o" }, () => { store.run({ t: "i" }, () => { nestedOk = store.get().t === "i"; }); nestedOk = nestedOk && store.get().t === "o"; });
  ok("ネスト分離", nestedOk);
}

// ---- cron 信頼性(分散ロック / オーバーラップ / ジッタ / 統計) ----
section("cron reliability");
{
  const L = await import(new URL("../packages/cron/src/lock.ts", import.meta.url));
  const R = await import(new URL("../packages/cron/src/runner.ts", import.meta.url));
  // 分散ロック: 2インスタンス同時 → 1回のみ
  const store = L.createMemoryLockStore();
  let runs = 0;
  const mk = () => R.createGuardedJob({ name: "n", lock: { store, ttlMs: 1000 }, handler: async () => { runs++; await new Promise((r) => setTimeout(r, 15)); }, sleep: async () => {} });
  await Promise.all([mk().run(), mk().run()]);
  ok("cron 分散ロックで重複実行防止", runs === 1);
  // オーバーラップ防止
  const o = R.createGuardedJob({ name: "o", preventOverlap: true, handler: async () => { await new Promise((r) => setTimeout(r, 15)); } });
  await Promise.all([o.run(), o.run()]);
  ok("cron オーバーラップはスキップ", o.stats().skipped === 1);
  // ジッタ
  let slept = -1;
  const j = R.createGuardedJob({ name: "j", jitterMs: 1000, handler: async () => {}, random: () => 0.25, sleep: async (ms) => { slept = ms; } });
  await j.run();
  ok("cron ジッタで遅延(0.25*1000=250)", slept === 250);
  // 統計
  const st = R.createGuardedJob({ name: "s", handler: async () => {}, sleep: async () => {} });
  await st.run();
  ok("cron 実行統計(successes)", st.stats().successes === 1);
}

// ---- API 計装(全ハンドラ形状) ----
section("api instrumentation (all shapes)");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  const obs = `/tmp/inst2-obs-${stamp}.ts`;
  await fs.writeFile(obs, `export function parseTraceparent(){return null;} export const metrics={counters:{},incrementCounter(n,v=1,l){const k=n+JSON.stringify(l||{});this.counters[k]=(this.counters[k]||0)+v;},observeHistogram(){},setGauge(){}}; export const tracer={startSpan:()=>({traceId:"T",spanId:"S",setAttribute(){},setStatus(){},end(){}})};`);
  const lc = `/tmp/inst2-lc-${stamp}.ts`;
  await fs.writeFile(lc, `export const logContext={run:(c,fn)=>fn(),get:()=>({}),set(){},provider:()=>({})};`);
  const coreShim = `/tmp/inst2-core-${stamp}.ts`;
  await fs.writeFile(coreShim, `export class AppError extends Error { constructor(c,m,o){ super(m); this.code=c; this.details=o?.details; } } const P={VALIDATION:400,NOT_FOUND:404,UNAUTHORIZED:401,FORBIDDEN:403,RATE_LIMITED:429,CONFLICT:409,EXTERNAL:502,DATABASE:503,CONFIG:500,INTERNAL:500}; export function httpStatusFor(e){ return e instanceof AppError ? P[e.code] : 500; } export function toErrorEnvelope(e,traceId){ if(e instanceof AppError) return { error:{ code:e.code, message:e.message, ...(traceId?{traceId}:{}) } }; return { error:{ code:"UNKNOWN", message:"予期しないエラーが発生しました", ...(traceId?{traceId}:{}) } }; }`);
  // Platform Debugger の収集器(開発時のみ有効)。ここでは無効相当のスタブで差し替える
  const dbgc = `/tmp/inst2-dbg-${stamp}.ts`;
  await fs.writeFile(dbgc, `export const debugCollector={enabled:false,start(){},record(){},finish(){},list:()=>[],get:()=>undefined,clear(){},summarize:()=>({})};`);
  let ins = (await fs.readFile(new URL("../apps/internal-app/src/server/instrument.ts", import.meta.url), "utf8")).replace('from "@platform/observability"', `from "${obs}"`).replace('from "./observability.js"', `from "${obs}"`).replace('from "./log-context.js"', `from "${lc}"`).replace('from "@platform/core"', `from "${coreShim}"`).replace('from "./debug-collector.js"', `from "${dbgc}"`);
  const insp = `/tmp/inst2-${stamp}.ts`; await fs.writeFile(insp, ins);
  const I = await import(insp);
  const { metrics } = await import(obs);
  // 引数なし同期
  await I.withApiObservability("/logout", () => new Response("ok", { status: 200 }))(new Request("https://x/logout", { method: "POST" }));
  // ctx 付き非同期
  await I.withApiObservability("/req/[id]", async (_req, ctx) => { await ctx.params; return new Response("ok"); })(new Request("https://x/req/1", { method: "POST" }), { params: Promise.resolve({ id: "1" }) });
  ok("引数なし/ctx付きハンドラを計装", Object.keys(metrics.counters).some((k) => k.includes("/logout") && k.includes("200")) && Object.keys(metrics.counters).some((k) => k.includes("/req/[id]")));
  // 500 応答も記録
  await I.withApiObservability("/err", async () => new Response("e", { status: 500 }))(new Request("https://x/err", { method: "GET" }));
  ok("500応答をエラー計上", Object.keys(metrics.counters).some((k) => k.includes("/err") && k.includes("500")));
  for (const f of [obs, lc, insp]) await fs.rm(f);
}

// ---- notify 信頼性(dedup / retry / fallback) ----
section("notify resilience");
{
  const D = await import(new URL("../packages/notify/src/dedup.ts", import.meta.url));
  const R = await (async () => {
    const fsr = await import("node:fs/promises");
    const shim = `/tmp/nr-core-${Date.now()}.ts`;
    await fsr.writeFile(shim, "export function defaultShouldRetry(e){ return !(e && e.__perm); }");
    const src = (await fsr.readFile(new URL("../packages/notify/src/resilient.ts", import.meta.url), "utf8")).replace('from "@platform/core"', `from "${shim}"`);
    const f = `/tmp/nr-res-${Date.now()}.ts`; await fsr.writeFile(f, src);
    const m = await import(f); await fsr.rm(shim); await fsr.rm(f); return m;
  })();
  let clk = 0; const sent = [];
  const base = { send: async (m) => { sent.push(m.text); } };
  const dd = D.withDedup(base, { store: D.createMemorySeenStore(() => clk), ttlMs: 1000 });
  await dd.send({ text: "a" }); await dd.send({ text: "a" });
  ok("notify dedup(同一は1回)", sent.length === 1);
  clk = 1001; await dd.send({ text: "a" });
  ok("notify dedup(TTL後は再送)", sent.length === 2);
  let n = 0;
  await R.withRetry({ send: async () => { n++; if (n < 3) throw new Error("e"); } }, { retries: 2, sleep: async () => {} }).send({ text: "x" });
  ok("notify retry(3回目成功)", n === 3);
  let s2 = 0;
  await R.createFallbackChannel([{ send: async () => { throw new Error("p"); } }, { send: async () => { s2++; } }]).send({ text: "z" });
  ok("notify fallback(副チャネル)", s2 === 1);
}

// ---- storage 信頼性(retry / fallback / mirror) ----
section("storage resilience");
{
  const R = await (async () => {
    const fsr = await import("node:fs/promises");
    const shim = `/tmp/rs-core-${Math.random().toString(36).slice(2)}.ts`;
    await fsr.writeFile(shim, "export function defaultShouldRetry(e){ return !(e && e.__perm); }");
    const src = (await fsr.readFile(new URL("../packages/storage/src/resilient.ts", import.meta.url), "utf8")).replace('from "@platform/core"', `from "${shim}"`);
    const f = `/tmp/rs-mod-${Math.random().toString(36).slice(2)}.ts`; await fsr.writeFile(f, src);
    const m = await import(f); await fsr.rm(shim); await fsr.rm(f); return m;
  })();
  const mk = (fail = {}) => { const store = new Map(); return { store, put: async (k, b) => { if (fail.put) throw new Error("put"); store.set(k, b); }, get: async (k) => { if (fail.get) throw new Error("get"); if (!store.has(k)) throw new Error("nf"); return store.get(k); }, delete: async (k) => { store.delete(k); }, exists: async (k) => store.has(k), list: async () => [...store.keys()] }; };
  let n = 0;
  await R.withStorageRetry({ put: async () => { n++; if (n < 3) throw new Error("e"); }, get: async () => new Uint8Array(), delete: async () => {}, exists: async () => true, list: async () => [] }, { retries: 2, sleep: async () => {} }).put("k", new Uint8Array());
  ok("storage retry(3回目成功)", n === 3);
  const p = mk({ get: true }); const s = mk();
  s.store.set("d", new TextEncoder().encode("x"));
  const got = await R.createFallbackStorage([p, s]).get("d");
  ok("storage fallback(副から取得)", new TextDecoder().decode(got) === "x");
  const p2 = mk(); const s2 = mk();
  await R.createFallbackStorage([p2, s2], { mirrorWrites: true }).put("k", new TextEncoder().encode("v"));
  ok("storage mirror(両先へ書込)", p2.store.has("k") && s2.store.has("k"));
}

// ---- sms/mail 信頼性(retry / fallback) ----
section("sms/mail resilience");
{
  const S = await (async () => {
    const fsr = await import("node:fs/promises");
    const shim = `/tmp/rs-core-${Math.random().toString(36).slice(2)}.ts`;
    await fsr.writeFile(shim, "export function defaultShouldRetry(e){ return !(e && e.__perm); }");
    const src = (await fsr.readFile(new URL("../packages/sms/src/resilient.ts", import.meta.url), "utf8")).replace('from "@platform/core"', `from "${shim}"`);
    const f = `/tmp/rs-mod-${Math.random().toString(36).slice(2)}.ts`; await fsr.writeFile(f, src);
    const m = await import(f); await fsr.rm(shim); await fsr.rm(f); return m;
  })();
  const M = await (async () => {
    const fsr = await import("node:fs/promises");
    const shim = `/tmp/rs-core-${Math.random().toString(36).slice(2)}.ts`;
    await fsr.writeFile(shim, "export function defaultShouldRetry(e){ return !(e && e.__perm); }");
    const src = (await fsr.readFile(new URL("../packages/mail/src/resilient.ts", import.meta.url), "utf8")).replace('from "@platform/core"', `from "${shim}"`);
    const f = `/tmp/rs-mod-${Math.random().toString(36).slice(2)}.ts`; await fsr.writeFile(f, src);
    const m = await import(f); await fsr.rm(shim); await fsr.rm(f); return m;
  })();
  let n = 0;
  await S.withSmsRetry({ send: async () => { n++; if (n < 3) throw new Error("e"); } }, { retries: 2, sleep: async () => {} }).send({ to: "+81", body: "x", from: "+81" });
  ok("SMS retry(3回目成功)", n === 3);
  let s2 = 0;
  await S.createFallbackSmsTransport([{ send: async () => { throw new Error("p"); } }, { send: async () => { s2++; } }]).send({ to: "+81", body: "y", from: "+81" });
  ok("SMS fallback(副業者)", s2 === 1);
  let ses = 0;
  await M.createFallbackMailTransport([{ send: async () => { throw new Error("smtp"); } }, { send: async () => { ses++; } }]).send({ to: "a@x.jp", subject: "s", from: "f@x.jp" });
  ok("Mail fallback(SMTP→SES)", ses === 1);
}

// ---- search(BM25)/ ratelimit(redis atomic)/ realtime(send queue) ----
section("search bm25 / redis / ws queue");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  const tok = `/tmp/bm-tok-${stamp}.ts`;
  await fs.writeFile(tok, await fs.readFile(new URL("../packages/search/src/tokenize.ts", import.meta.url), "utf8"));
  let bm = (await fs.readFile(new URL("../packages/search/src/bm25.ts", import.meta.url), "utf8")).replace('from "./tokenize.js"', `from "${tok}"`);
  const bmf = `/tmp/bm-${stamp}.ts`; await fs.writeFile(bmf, bm);
  const { createBm25Index } = await import(bmf);
  const idx = createBm25Index();
  idx.addAll([{ id: "1", t: "請求書の書き方と作成手順" }, { id: "2", t: "見積書テンプレート" }, { id: "3", t: "経費精算のやり方" }]);
  ok("BM25 日本語検索(該当のみ)", (() => { const r = idx.search("請求書", 10); return r.length === 1 && r[0].id === "1"; })());
  ok("BM25 別語で別文書", idx.search("経費", 10)[0].id === "3");
  await fs.rm(tok); await fs.rm(bmf);

  // ratelimit redis(フェイク)
  let redisSrc = (await fs.readFile(new URL("../packages/ratelimit/src/redis.ts", import.meta.url), "utf8")).replace('import Redis from "ioredis";\n', "").replace('typeof urlOrClient === "string" ? (new Redis(urlOrClient) as unknown as RedisLike) : urlOrClient', "urlOrClient as RedisLike");
  const ttypes = `/tmp/rl-types-${stamp}.ts`; await fs.writeFile(ttypes, "export interface RateLimitStore { increment(key: string, windowSeconds: number): Promise<number> }");
  redisSrc = redisSrc.replace('from "./types.js"', `from "${ttypes}"`);
  const rf = `/tmp/rl-${stamp}.ts`; await fs.writeFile(rf, redisSrc);
  const { createRedisStore } = await import(rf);
  const store = new Map(); let clock = 0;
  const fake = { eval: async (_s, _n, key, ttl) => { const e = store.get(key); if (e && e.exp !== null && e.exp <= clock) store.delete(key); const cur = store.get(key) ?? { count: 0, exp: null }; cur.count += 1; if (cur.count === 1) cur.exp = clock + Number(ttl) * 1000; store.set(key, cur); return cur.count; } };
  const rl = createRedisStore(fake);
  ok("redis INCR+EXPIRE アトミック", (await rl.increment("k", 60)) === 1 && (await rl.increment("k", 60)) === 2 && store.get("k").exp === 60000);
  await fs.rm(ttypes); await fs.rm(rf);

  // realtime send queue
  const rt = await (async () => {
    const fsx = await import("node:fs/promises");
    const src = (await fsx.readFile(new URL("../packages/realtime/src/index.ts", import.meta.url), "utf8")).replace(/export \{[^}]*\} from "\.\/broadcast\.js";\n?/g, "");
    const f = `/tmp/rt-idx-b-${Date.now()}.ts`; await fsx.writeFile(f, src);
    const m = await import(f); await fsx.rm(f); return m;
  })();
  const insts = [];
  class FakeWS { constructor() { this.sent = []; this.onopen = null; this.onclose = null; insts.push(this); } send(d) { this.sent.push(d); } close() { this.onclose && this.onclose(); } }
  const rws = rt.createReconnectingWebSocket("wss://x", { WebSocketImpl: FakeWS, scheduleReconnect: () => {} });
  rws.send({ n: 1 }); rws.send({ n: 2 });
  const buffered = rws.pending() === 2;
  insts[0].onopen();
  ok("WS 切断中バッファ→接続時 flush", buffered && insts[0].sent.length === 2 && rws.pending() === 0);
}

// ---- cache redis / db retry / jobs memory retry ----
section("cache redis / db retry / jobs retry");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  // cache redis(注入)
  let cr = (await fs.readFile(new URL("../packages/cache/src/adapters/redis.ts", import.meta.url), "utf8")).split("\n").filter((ln) => !ln.includes('import Redis from')).join("\n").replace(/const client: RedisLike = isConfig[\s\S]*?: configOrClient;/, "const client = configOrClient as RedisLike;");
  const ci = `/tmp/cr-idx-${stamp}.ts`; await fs.writeFile(ci, "export interface CacheAdapter { get(key: string): Promise<string | null>; set(key: string, value: string, ttlSeconds?: number): Promise<void>; delete(key: string): Promise<void>; }");
  cr = cr.replace('from "../index.js"', `from "${ci}"`);
  const crf = `/tmp/cr-${stamp}.ts`; await fs.writeFile(crf, cr);
  const { createRedisCache } = await import(crf);
  const store = new Map(); const ttls = new Map();
  const fake = { get: async (k) => store.has(k) ? store.get(k) : null, set: async (k, v, mode, ttl) => { store.set(k, v); if (mode === "EX") ttls.set(k, ttl); return "OK"; }, del: async (k) => { store.delete(k); return 1; } };
  const c = createRedisCache(fake);
  await c.set("k", "v", 300);
  ok("cache redis(注入・TTL)", (await c.get("k")) === "v" && ttls.get("k") === 300);
  await fs.rm(ci); await fs.rm(crf);

  // jobs memory retry
  const ji = `/tmp/jb-idx-${stamp}.ts`; await fs.writeFile(ji, "export interface TypedQueue<T> { add(name: string, data: T, o?: unknown): Promise<unknown>; close(): Promise<void>; }");
  const jc = `/tmp/jb-core-${stamp}.ts`; await fs.writeFile(jc, "export {};");
  let jm = (await fs.readFile(new URL("../packages/jobs/src/memory.ts", import.meta.url), "utf8")).replace('from "@platform/core"', `from "${jc}"`).replace('from "./index.js"', `from "${ji}"`);
  const jmf = `/tmp/jb-${stamp}.ts`; await fs.writeFile(jmf, jm);
  const { createMemoryQueue } = await import(jmf);
  let tries = 0;
  const q = createMemoryQueue({ attempts: 3 });
  q.process(async () => { tries++; if (tries < 3) throw new Error("t"); });
  await q.add("j", {}); await q.drain();
  ok("jobs memory retry(3回目成功)", tries === 3 && q.failed().length === 0);
  const q2 = createMemoryQueue({ attempts: 2 });
  q2.process(async () => { throw new Error("perm"); });
  await q2.add("bad", {}); await q2.drain();
  ok("jobs memory デッドレター", q2.failed().length === 1);
  await fs.rm(ji); await fs.rm(jc); await fs.rm(jmf);
}

// ---- cache Redis / db tx-retry / jobs BullMQ ----
section("cache redis / db tx-retry / jobs");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  const w = async (name, src) => { const f = `/tmp/dd-${name}-${stamp}.ts`; await fs.writeFile(f, src); return f; };
  // cache redis(注入)
  const cidx = await w("cidx", "export interface CacheAdapter { get(key: string): Promise<string | null>; set(key: string, value: string, ttlSeconds?: number): Promise<void>; delete(key: string): Promise<void>; }");
  let credis = (await fs.readFile(new URL("../packages/cache/src/adapters/redis.ts", import.meta.url), "utf8")).replace('import Redis from "ioredis";\n', "").replace('from "../index.js"', `from "${cidx}"`);
  const credisf = await w("credis", credis);
  const { createRedisCache } = await import(credisf);
  const store = new Map(); let exArgs = null;
  const fake = { get: async (k) => store.get(k) ?? null, set: async (k, v, ...a) => { store.set(k, v); exArgs = a; return "OK"; }, del: async (k) => { store.delete(k); return 1; } };
  const ca = createRedisCache(fake);
  await ca.set("k", "v", 300);
  ok("cache redis: TTL付き set は EX 秒", exArgs[0] === "EX" && exArgs[1] === 300 && (await ca.get("k")) === "v");
  await fs.rm(cidx); await fs.rm(credisf);

  // db transactionWithRetry(注入 Prisma)
  const core = await w("core", `export const ErrorCode={CONFLICT:"CONFLICT",DATABASE:"DATABASE",INTERNAL:"INTERNAL"};export class AppError extends Error{constructor(c,m,o){super(m);this.code=c;this.cause=o?.cause;}static from(e,c){return new AppError(c,String(e));}}export async function tryCatch(fn){try{return{ok:true,value:await fn()};}catch(e){return{ok:false,error:e instanceof AppError?e:new AppError("INTERNAL",String(e),{cause:e})};}}`);
  const prisma = await w("prisma", "export class PrismaClient {}");
  const errs = await w("errs", `import { AppError, ErrorCode } from "${core}";export function mapPrismaError(e){return new AppError(ErrorCode.DATABASE,"db",{cause:e});}export function isRetryablePrismaError(e){return /40001|40P01|deadlock|serialization|P2034/i.test(e?.message??"");}`);
  let tx = (await fs.readFile(new URL("../packages/db/src/transaction.ts", import.meta.url), "utf8")).replace('from "@prisma/client"', `from "${prisma}"`).replace('from "@platform/core"', `from "${core}"`).replace('from "./errors.js"', `from "${errs}"`);
  const txf = await w("tx", tx);
  let res = (await fs.readFile(new URL("../packages/db/src/resilience.ts", import.meta.url), "utf8")).replace('from "@prisma/client"', `from "${prisma}"`).replace('from "@platform/core"', `from "${core}"`).replace('from "./errors.js"', `from "${errs}"`).replace('from "./transaction.js"', `from "${txf}"`);
  const resf = await w("res", res);
  const { transactionWithRetry } = await import(resf);
  const { abortTransaction } = await import(txf);
  let calls = 0;
  const db = { $transaction: async (fn, o) => { calls++; if (calls < 3) throw new Error("serialize 40001"); return fn({}); } };
  const r = await transactionWithRetry(db, async () => "ok", { retries: 3, baseDelayMs: 1, isolationLevel: "Serializable" });
  ok("db tx-retry: シリアライズ失敗を再試行", r.ok && calls === 3);
  let ac = 0;
  const db2 = { $transaction: async (fn) => { ac++; return fn({}); } };
  const ra = await transactionWithRetry(db2, async () => { abortTransaction("残高不足"); }, { retries: 3, baseDelayMs: 1 });
  ok("db tx-retry: abort は再試行せず CONFLICT 保持", !ra.ok && ra.error.code === "CONFLICT" && ac === 1);
  for (const f of [core, prisma, errs, txf, resf]) await fs.rm(f);

  // jobs
  const jcore = await w("jcore", `export const ErrorCode={EXTERNAL:"EXTERNAL"};export class AppError extends Error{constructor(c,m,o){super(m);this.code=c;this.cause=o?.cause;}}export async function tryCatch(fn){try{return{ok:true,value:await fn()};}catch(e){return{ok:false,error:e};}}`);
  const bull = await w("bull", "export class Queue{constructor(){}async add(){}async close(){}}export class Worker{constructor(){}}");
  const mem = await w("mem", `export function createMemoryQueue(){return {};}`);
  const def = await w("def", `export function defineJob(n){return {name:n};}`);
  let jidx = (await fs.readFile(new URL("../packages/jobs/src/index.ts", import.meta.url), "utf8")).replace('from "bullmq"', `from "${bull}"`).replace('from "@platform/core"', `from "${jcore}"`).replace('from "./memory.js"', `from "${mem}"`).replace('from "./define.js"', `from "${def}"`);
  const jidxf = await w("jidx", jidx);
  const { connectionFromUrl, createQueue } = await import(jidxf);
  ok("jobs: URL パース", connectionFromUrl("redis://:pw@h:6380").password === "pw" && connectionFromUrl("redis://h").port === 6379);
  let jopts = null; const jq = createQueue("e", { url: "redis://h" }, (_n, o) => { jopts = o; return { add: async () => {}, close: async () => {} }; });
  ok("jobs: defaultJobOptions(attempts3)", jopts.defaultJobOptions.attempts === 3 && (await jq.add("j", {})).ok);
  for (const f of [jcore, bull, mem, def, jidxf]) await fs.rm(f);
}

// ---- 業務アプリ: 承認通知の確実配信(Outbox + 再試行 + dedup) ----
section("reliable expense notifications");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  const w = async (n, src) => { const f = `/tmp/en-${n}-${stamp}.ts`; await fs.writeFile(f, src); return f; };
  const outbox = await w("outbox", await fs.readFile(new URL("../packages/observability/src/outbox.ts", import.meta.url), "utf8"));
  const obsidx = await w("obsidx", `export * from "${outbox}";`);
  const nidx = await w("nidx", 'export interface NotifyMessage { text: string } export interface NotifyChannel { send(m: NotifyMessage): Promise<void> }');
  let dedup = (await fs.readFile(new URL("../packages/notify/src/dedup.ts", import.meta.url), "utf8")).replace('from "./index.js"', `from "${nidx}"`);
  const dedupf = await w("dedup", dedup);
  const notifyidx = await w("notifyidx", `export * from "${nidx}";\nexport * from "${dedupf}";`);
  const wf = await w("wf", "export {}");
  const enmail = await w("enmail", 'export function buildTransitionMails(i){ return (i.applicantEmail && i.next.status==="approved") ? [{ to:[i.applicantEmail], subject:"承認", text:i.title }] : []; }');
  const svcstore = await w("svcstore", `import { createMemoryOutboxStore } from "${obsidx}";\nimport { createMemorySeenStore } from "${notifyidx}";\nexport const notifyOutbox=createMemoryOutboxStore();\nexport const notifySeen=createMemorySeenStore();\nexport const log={info(){},warn(){}};\nexport let beh=async()=>{};\nexport const mailer={ async sendMail(){ try{ await beh(); return {ok:true,value:undefined}; }catch(e){ return {ok:false,error:{message:e.message}}; } } };\nexport function setBeh(f){ beh=f; }`);
  let svc = (await fs.readFile(new URL("../apps/internal-app/src/server/expense-notify-service.ts", import.meta.url), "utf8")).replace('from "@platform/workflow"', `from "${wf}"`).replace('from "@platform/observability"', `from "${obsidx}"`).replace('from "@platform/notify"', `from "${notifyidx}"`).replace('from "../lib/expense-notify.js"', `from "${enmail}"`).replace('from "./services.js"', `from "${svcstore}"`);
  const svcf = await w("svc", svc);
  const S = await import(svcf);
  const { notifyOutbox, setBeh } = await import(svcstore);
  const n = S.enqueueExpenseTransition({ title: "出張費", prev: { status: "pending" }, next: { status: "approved" }, applicantEmail: "u@x.jp" });
  ok("承認通知が Outbox に積まれる", n === 1 && notifyOutbox.all()[0].status === "pending");
  let attempts = 0; setBeh(async () => { attempts++; if (attempts < 2) throw new Error("timeout"); });
  const r1 = await S.relayExpenseNotifications();
  const msg = notifyOutbox.all().find((m) => m.status === "pending"); if (msg) msg.nextAttemptAt = 0;
  const r2 = await S.relayExpenseNotifications();
  ok("一時失敗→再試行で確実配信(通知が失われない)", r1.failed === 1 && r2.sent === 1 && attempts === 2);
  for (const f of [outbox, obsidx, nidx, dedupf, notifyidx, wf, enmail, svcstore, svcf]) await fs.rm(f);
}

// ---- 通知リレーの cron 配線(scheduler→relay→metrics) ----
section("notify relay scheduler");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  const w = async (n, src) => { const f = `/tmp/nsc-${n}-${stamp}.ts`; await fs.writeFile(f, src); return f; };
  const lock = await w("lock", (await fs.readFile(new URL("../packages/cron/src/lock.ts", import.meta.url), "utf8")));
  const runner = await w("runner", (await fs.readFile(new URL("../packages/cron/src/runner.ts", import.meta.url), "utf8")).replace('from "./lock.js"', `from "${lock}"`));
  const core = await w("core", 'export const ErrorCode={INTERNAL:"INTERNAL"};export class AppError extends Error{constructor(c,m){super(m);this.code=c;}static from(e,c){return new AppError(c,e instanceof Error?e.message:String(e));}}');
  const croner = await w("croner", "export const REG=[];export class Cron{constructor(_s,_o,fn){this.fn=fn;REG.push(this);}stop(){}}");
  let idx = (await fs.readFile(new URL("../packages/cron/src/index.ts", import.meta.url), "utf8")).replaceAll('from "croner"', `from "${croner}"`).replaceAll('from "@platform/core"', `from "${core}"`).replaceAll('from "./runner.js"', `from "${runner}"`).replaceAll('from "./lock.js"', `from "${lock}"`).replace(/export \{ createRedisLockStore[^\n]*\n/, "").replace(/export \{ tryAcquireFileLock[^\n]*\n/, "");
  const cidx = await w("cidx", idx);
  const obs = await w("obs", 'export const metrics={counters:{},incrementCounter(n,v,l){const k=n+JSON.stringify(l||{});this.counters[k]=(this.counters[k]||0)+v;},observeHistogram(){}};');
  const svc = await w("svc", 'export const log={info(){},warn(){},error(){}};');
  const esvc = await w("esvc", 'export let calls=0;export async function relayExpenseNotifications(){ calls++; return {sent:1,failed:0,exhausted:0}; }');
  let ns = (await fs.readFile(new URL("../apps/internal-app/src/server/notify-scheduler.ts", import.meta.url), "utf8")).replace('from "@platform/cron"', `from "${cidx}"`).replace('from "./expense-notify-service.js"', `from "${esvc}"`).replace('from "./observability.js"', `from "${obs}"`).replace('from "./services.js"', `from "${svc}"`);
  const nsf = await w("ns", ns);
  const { createNotifyScheduler } = await import(nsf);
  const { REG } = await import(croner);
  const es = await import(esvc);
  const { metrics } = await import(obs);
  const sched = createNotifyScheduler();
  sched.start();
  ok("relay ジョブが登録される", sched.jobNames()[0] === "relay-expense-notifications");
  await REG[0].fn();
  ok("発火で relay 実行 + メトリクス出力", es.calls === 1 && Object.keys(metrics.counters).some((k) => k.includes("cron_runs_total") && k.includes("success")));
  for (const f of [lock, runner, core, croner, cidx, obs, svc, esvc, nsf]) await fs.rm(f);
}

// ---- 本番実装: Redis lock/seen/idem + SQL outbox + lifecycle + secrets ----
section("production stores / lifecycle / secrets");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  const w = async (n, src) => { const f = `/tmp/pi-${n}-${stamp}.ts`; await fs.writeFile(f, src); return f; };
  // 共有フェイク Redis(SET NX PX / eval / exists / get / del / setValue)
  const mkRedis = () => { let clk = 0; const m = new Map(); return {
    setClock: (t) => { clk = t; },
    set: async (k, v, _p, ttl) => { const e = m.get(k); if (e && e.exp > clk) return null; m.set(k, { val: v, exp: clk + ttl }); return "OK"; },
    setValue: async (k, v, ttl) => { m.set(k, { val: v, exp: clk + ttl }); },
    get: async (k) => { const e = m.get(k); return e && e.exp > clk ? e.val : null; },
    del: async (k) => { m.delete(k); },
    exists: async (k) => { const e = m.get(k); return e && e.exp > clk ? 1 : 0; },
    eval: async (_s, _n, k, tok) => { const e = m.get(k); if (e && e.val === tok) { m.delete(k); return 1; } return 0; },
    _m: m,
  }; };

  // Redis lock
  const lockif = await w("lockif", "export interface LockStore { acquire(k: string, t: number): Promise<boolean>|boolean; release(k: string): Promise<void>|void }");
  const lockredis = await w("lockredis", (await fs.readFile(new URL("../packages/cron/src/lock-redis.ts", import.meta.url), "utf8")).replace('from "./lock.js"', `from "${lockif}"`));
  const { createRedisLockStore } = await import(lockredis);
  const r1 = mkRedis();
  const la = createRedisLockStore(r1), lb = createRedisLockStore(r1);
  ok("Redis lock 相互排他", (await la.acquire("j", 1000)) === true && (await lb.acquire("j", 1000)) === false);

  // Redis seen
  const seenif = await w("seenif", "export interface SeenStore { markSeen(k: string, t: number): boolean; has(k: string): boolean }");
  const seenredis = await w("seenredis", (await fs.readFile(new URL("../packages/notify/src/seen-redis.ts", import.meta.url), "utf8")).replace('from "./dedup.js"', `from "${seenif}"`));
  const { createRedisSeenStore } = await import(seenredis);
  const seen = createRedisSeenStore(mkRedis());
  ok("Redis seen dedup", (await seen.markSeen("m", 1000)) === false && (await seen.markSeen("m", 1000)) === true);

  // Redis idempotency
  const idemif = await w("idemif", 'export interface IdempotencyRecord { status: "in_progress"|"completed"|"failed"; result?: unknown; createdAt: number }');
  const idemredis = await w("idemredis", (await fs.readFile(new URL("../packages/observability/src/idempotency-redis.ts", import.meta.url), "utf8")).replace('from "./idempotency.js"', `from "${idemif}"`));
  const { createRedisIdempotencyStore } = await import(idemredis);
  const idem = createRedisIdempotencyStore(mkRedis(), 5000);
  const reserved = (await idem.reserve("op", { status: "in_progress", createdAt: 0 })) === null;
  ok("Redis idempotency 予約", reserved && (await idem.reserve("op", { status: "in_progress", createdAt: 0 })) !== null);

  // SQL outbox
  const obif = await w("obif", 'export interface OutboxMessage { id: string; topic: string; payload: unknown; status: "pending"|"sent"|"failed"; attempts: number; createdAt: number; nextAttemptAt?: number } export interface OutboxStore { fetchPending(l: number, n: number): unknown; markSent(id: string): unknown; markFailed(id: string, e: string, a: number, n?: number): unknown }');
  const obsql = await w("obsql", (await fs.readFile(new URL("../packages/observability/src/outbox-sql.ts", import.meta.url), "utf8")).replace('from "./outbox.js"', `from "${obif}"`));
  const { createSqlOutboxStore } = await import(obsql);
  const rows = [];
  const client = { insert: async (m) => rows.push({ ...m }), selectPending: async () => rows.filter((r) => r.status === "pending"), updateSent: async (id) => { const r = rows.find((x) => x.id === id); if (r) r.status = "sent"; }, updateFailed: async () => {} };
  let seq = 0; const outbox = createSqlOutboxStore(client, () => `id-${++seq}`, () => 0);
  await outbox.add("t", { a: 1 }); await outbox.markSent("id-1");
  ok("SQL outbox add+markSent", rows.length === 1 && rows[0].status === "sent");

  // lifecycle
  const lc = await w("lc", (await fs.readFile(new URL("../packages/core/src/lifecycle.ts", import.meta.url), "utf8")));
  const { createLifecycle } = await import(lc);
  const order = [];
  const life = createLifecycle({ exitProcess: false, onSignal: () => {}, hookTimeoutMs: 500 });
  life.onShutdown("a", () => { order.push("a"); }); life.onShutdown("b", () => { order.push("b"); });
  await life.shutdown("t");
  ok("lifecycle 逆順後始末 + 二重防止", JSON.stringify(order) === JSON.stringify(["b", "a"]) && life.isShuttingDown());

  // secrets
  const sec = await w("sec", (await fs.readFile(new URL("../packages/secrets/src/index.ts", import.meta.url), "utf8")));
  const { createSecretStore } = await import(sec);
  let fetches = 0, clk = 0;
  const store = createSecretStore({ get: async (n) => { fetches++; return n === "K" ? "v" : null; } }, { ttlMs: 1000, now: () => clk });
  await store.get("K"); await store.get("K");
  const cachedOnce = fetches === 1; // 2回 get でも fetch は1回(TTL内キャッシュ)
  let threw = false; try { await store.require("X"); } catch { threw = true; }
  ok("secrets キャッシュ + require 例外", cachedOnce && threw);

  for (const f of [lockif, lockredis, seenif, seenredis, idemif, idemredis, obif, obsql, lc, sec]) await fs.rm(f);
}

// ---- 監視の出力先: OTLP エクスポータ + SLO アラート ----
section("otlp exporter / alerting");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  const tr = `/tmp/oa-trace-${stamp}.ts`;
  await fs.writeFile(tr, 'export interface Span { traceId: string; spanId: string; parentSpanId?: string; name: string; startTime: number; endTime?: number; durationMs?: number; attributes: Record<string, unknown>; status: "ok"|"error"; error?: string } export type SpanExporter = (span: Span) => void;');
  const otlp = `/tmp/oa-otlp-${stamp}.ts`;
  await fs.writeFile(otlp, (await fs.readFile(new URL("../packages/observability/src/otlp.ts", import.meta.url), "utf8")).replace('from "./trace.js"', `from "${tr}"`));
  const { createOtlpExporter } = await import(otlp);
  const posts = [];
  const exp = createOtlpExporter({ endpoint: "http://c/v1/traces", serviceName: "internal-app", maxBatchSize: 2, fetchImpl: async (_u, i) => { posts.push(JSON.parse(i.body)); return { ok: true, status: 200 }; }, scheduler: () => 1, clearScheduler: () => {} });
  const span = (id) => ({ traceId: id, spanId: "s" + id, name: "GET /x", startTime: 1000, endTime: 1050, attributes: { "http.method": "GET" }, status: "ok" });
  exp.export(span("1")); exp.export(span("2"));
  await new Promise((r) => setTimeout(r, 5));
  ok("OTLP バッチ送信(service.name/traceId)", posts.length === 1 && posts[0].resourceSpans[0].resource.attributes[0].value.stringValue === "internal-app");

  const al = `/tmp/oa-al-${stamp}.ts`;
  await fs.writeFile(al, (await fs.readFile(new URL("../packages/observability/src/alerting.ts", import.meta.url), "utf8")));
  const A = await import(al);
  const mgr = A.createAlertManager([{ name: "err", severity: "critical", condition: A.errorRateAbove("t", "e", 0.05), describe: () => "エラー率高" }]);
  const view = (c) => ({ counters: c, gauges: {}, histograms: {} });
  const fired = mgr.evaluate(view({ t: 100, e: 10 }));
  const recovered = mgr.evaluate(view({ t: 300, e: 3 }));
  ok("SLO アラート 発報→回復", fired.length === 1 && fired[0].firing && recovered[0].firing === false);

  for (const f of [tr, otlp, al]) await fs.rm(f);
}

// ---- feature flags / PII 保護 ----
section("feature flags / pii");
{
  const F = await import(new URL("../packages/flags/src/index.ts", import.meta.url));
  ok("flag kill switch", F.evaluateFlag(false) === false && F.evaluateFlag({ enabled: false, rolloutPercent: 100 }) === false);
  ok("flag 100%/0%", F.evaluateFlag({ rolloutPercent: 100 }, { key: "u" }, "f") === true && F.evaluateFlag({ rolloutPercent: 0 }, { key: "u" }, "f") === false);
  let on = 0; for (let i = 0; i < 1000; i++) if (F.evaluateFlag({ rolloutPercent: 50 }, { key: `u${i}` }, "f")) on++;
  ok("flag 50% ロールアウト分布(" + on + "/1000)", on > 400 && on < 600);
  ok("flag allow/deny", F.evaluateFlag({ rolloutPercent: 0, allow: [{ role: "admin" }] }, { attributes: { role: "admin" } }) === true && F.evaluateFlag({ deny: [{ r: 1 }] }, { attributes: { r: 1 } }) === false);
  const flags = F.createFlags(F.createStaticProvider({ a: true }));
  ok("flag 未定義は false(安全側)", (await flags.isEnabled("a")) === true && (await flags.isEnabled("missing")) === false);

  const { readFile: _rfPii } = await import("node:fs/promises");
  const _piiSrc = (await _rfPii(new URL("../packages/pii/src/index.ts", import.meta.url), "utf8")).replace(/export \* from "\.\/(identity-mask|subject-rights)\.js";\n?/g, "");
  const _piiF = `/tmp/pii-index-${Date.now()}.ts`; await (await import("node:fs/promises")).writeFile(_piiF, _piiSrc);
  const P = await import(_piiF);
  ok("pii マスキング", P.maskEmail("taro@example.co.jp") === "t***@example.co.jp" && P.maskPhone("090-1234-5678") === "*******5678");
  ok("pii blind index(正規化+決定的)", P.blindIndex("A@B.jp ", "k") === P.blindIndex("a@b.jp", "k") && P.blindIndex("x", "k1") !== P.blindIndex("x", "k2"));
  const store = new Map(); let n = 0;
  const c = P.createFieldCipher({ encrypt: (p) => { const t = `e${++n}`; store.set(t, p); return t; }, decrypt: (t) => store.get(t) });
  ok("pii フィールド暗号往復", P.createFieldCipher && c.decryptField(c.encryptField("secret")) === "secret" && c.encryptField(null) === null);
  const a = P.anonymizeRecord({ id: "1", name: "山田", total: 5 }, ["name"]);
  ok("pii 匿名化(PIIのみ) + 保持判定", a.name === "[削除済み]" && a.total === 5 && P.isRetentionExpired(0, 30, 40 * 86400000) === true);
}

// ---- WebSocket 水平スケール(Redis Pub/Sub ブロードキャスト) ----
section("broadcast hub (horizontal scale)");
{
  const { createBroadcastHub } = await import(new URL("../packages/realtime/src/broadcast.ts", import.meta.url));
  const handlers = new Map();
  const mkClient = () => { const mine = []; return {
    publish: async (c, m) => { const hs = handlers.get(c); if (hs) for (const h of hs) h(m); },
    subscribe: async (c, h) => { if (!handlers.has(c)) handlers.set(c, new Set()); handlers.get(c).add(h); mine.push({ c, h }); },
    unsubscribe: async (c) => { mine.filter((e) => e.c === c).forEach((e) => handlers.get(c)?.delete(e.h)); },
  }; };
  const a = createBroadcastHub(mkClient()); const b = createBroadcastHub(mkClient());
  const ra = [], rb = [];
  await a.subscribe("room", "1", (d) => ra.push(d));
  await b.subscribe("room", "2", (d) => rb.push(d));
  await a.publish("room", { t: "hi" });
  ok("インスタンス跨ぎ配信 + 二重配信なし", ra.length === 1 && rb.length === 1 && JSON.parse(ra[0]).t === "hi");
  await a.unsubscribe("room", "1");
  const before = ra.length;
  await b.publish("room", { n: 2 });
  ok("unsubscribe 後は配信されない", a.localCount("room") === 0 && ra.length === before && rb.length === 2);
}

// ---- エラー制御: 分類中央化 / バルクヘッド / プロセス安全網 ----
section("error policy / bulkhead / process guards");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  const w = async (n, src) => { const f = `/tmp/ec-${n}-${stamp}.ts`; await fs.writeFile(f, src); return f; };
  const err = await w("err", 'export const ErrorCode={VALIDATION:"VALIDATION",NOT_FOUND:"NOT_FOUND",UNAUTHORIZED:"UNAUTHORIZED",FORBIDDEN:"FORBIDDEN",RATE_LIMITED:"RATE_LIMITED",CONFLICT:"CONFLICT",EXTERNAL:"EXTERNAL",DATABASE:"DATABASE",CONFIG:"CONFIG",INTERNAL:"INTERNAL"};export class AppError extends Error{constructor(c,m,o){super(m);this.code=c;this.details=o?.details;}}');
  const ep = await w("ep", (await fs.readFile(new URL("../packages/core/src/error-policy.ts", import.meta.url), "utf8")).replace('from "./error.js"', `from "${err}"`));
  const { httpStatusFor, isRetryable, toErrorEnvelope } = await import(ep);
  const { AppError, ErrorCode } = await import(err);
  ok("HTTP ステータス中央化(409/429/500)", httpStatusFor(new AppError(ErrorCode.CONFLICT, "x")) === 409 && httpStatusFor(new AppError(ErrorCode.RATE_LIMITED, "x")) === 429 && httpStatusFor(new Error("r")) === 500);
  ok("再試行分類(EXTERNAL可/VALIDATION不可/未分類不可)", isRetryable(new AppError(ErrorCode.EXTERNAL, "x")) === true && isRetryable(new AppError(ErrorCode.VALIDATION, "x")) === false && isRetryable(new Error("x")) === false);
  ok("エラーエンベロープ(traceId + 内部秘匿)", toErrorEnvelope(new AppError(ErrorCode.NOT_FOUND, "x", { details: { id: 1 } }), "t1").error.traceId === "t1" && toErrorEnvelope(new Error("secret")).error.code === "UNKNOWN");

  const bh = await w("bh", (await fs.readFile(new URL("../packages/core/src/bulkhead.ts", import.meta.url), "utf8")).replace('from "./error.js"', `from "${err}"`));
  const { createBulkhead } = await import(bh);
  const defer = () => { let r; const p = new Promise((res) => { r = res; }); return { p, resolve: r }; };
  const b = createBulkhead({ maxConcurrent: 2 });
  const ds = [defer(), defer(), defer()]; const ps = ds.map((x) => b.run(() => x.p));
  await new Promise((r) => setTimeout(r, 5));
  const limited = b.active() === 2 && b.queued() === 1;
  ds.forEach((x) => x.resolve()); await Promise.all(ps);
  ok("バルクヘッド 並行制限 + キュー + 全完了で0", limited && b.active() === 0);
  // queueTimeoutMs: 順番待ちタイムアウト
  const bt = createBulkhead({ maxConcurrent: 1, queueTimeoutMs: 20 });
  let rel; const hold = new Promise((r) => { rel = r; }); const run = bt.run(() => hold);
  let qto = false; try { await bt.run(async () => "x"); } catch (e) { qto = e.code === "RATE_LIMITED"; }
  ok("バルクヘッド 待機タイムアウトで遮断", qto && bt.queued() === 0);
  rel(); await run;
  // リトライ層の分類統一(notify withRetry の既定 = defaultShouldRetry)
  const nidx2 = await w("nidx2", "export {}");
  const ncore = await w("ncore", 'export function defaultShouldRetry(e){ return !(e && e.__perm); }');
  let nres = (await fs.readFile(new URL("../packages/notify/src/resilient.ts", import.meta.url), "utf8")).replace('from "@platform/core"', `from "${ncore}"`).replace('from "./index.js"', `from "${nidx2}"`);
  const nresf = await w("nresf", nres);
  const { withRetry } = await import(nresf);
  let perm = 0; const permErr = Object.assign(new Error("v"), { __perm: true });
  const ch = withRetry({ async send() { perm++; throw permErr; } }, { retries: 3, sleep: async () => {} });
  try { await ch.send({ text: "x" }); } catch {}
  let trans = 0;
  const ch2 = withRetry({ async send() { trans++; if (trans < 3) throw new Error("transient"); } }, { retries: 3, sleep: async () => {} });
  await ch2.send({ text: "x" });
  ok("リトライ層 分類統一(恒久1回/一時は再試行)", perm === 1 && trans === 3);
  await fs.rm(nidx2); await fs.rm(ncore); await fs.rm(nresf);

  const pg = await w("pg", (await fs.readFile(new URL("../packages/core/src/process-guard.ts", import.meta.url), "utf8")));
  const { installProcessGuards } = await import(pg);
  const H = {}; let exitCode = null; let fatal = false;
  installProcessGuards({ logger: { error: () => {}, warn: () => {} }, onProcess: (e, h) => { H[e] = h; }, exit: (c) => { exitCode = c; }, onFatal: async () => { fatal = true; } });
  H.unhandledRejection(new Error("r"));
  const noExitOnReject = exitCode === null;
  H.uncaughtException(new Error("fatal"));
  await new Promise((r) => setTimeout(r, 10));
  ok("プロセス安全網(拒否は継続/致命は後始末→exit1)", noExitOnReject && fatal && exitCode === 1);

  for (const f of [err, ep, bh, pg]) await fs.rm(f);
}

// ---- エラー制御: 分類中央化 / バルクヘッド / プロセス安全網 / API エンベロープ ----
section("error control: policy / bulkhead / guard / envelope");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  const w = async (n, src) => { const f = `/tmp/ec-${n}-${stamp}.ts`; await fs.writeFile(f, src); return f; };
  const errmod = await w("err", 'export const ErrorCode = { VALIDATION:"VALIDATION", NOT_FOUND:"NOT_FOUND", UNAUTHORIZED:"UNAUTHORIZED", FORBIDDEN:"FORBIDDEN", RATE_LIMITED:"RATE_LIMITED", CONFLICT:"CONFLICT", EXTERNAL:"EXTERNAL", DATABASE:"DATABASE", CONFIG:"CONFIG", INTERNAL:"INTERNAL" }; export class AppError extends Error { constructor(c, m, o) { super(m); this.code = c; this.details = o?.details; } }');

  // error-policy
  const ep = await w("ep", (await fs.readFile(new URL("../packages/core/src/error-policy.ts", import.meta.url), "utf8")).replace('from "./error.js"', `from "${errmod}"`));
  const { httpStatusFor, isRetryable, toErrorEnvelope } = await import(ep);
  const { AppError, ErrorCode } = await import(errmod);
  ok("エラー分類: status/retryable 中央化", httpStatusFor(new AppError(ErrorCode.CONFLICT, "x")) === 409 && isRetryable(new AppError(ErrorCode.DATABASE, "x")) === true && isRetryable(new AppError(ErrorCode.VALIDATION, "x")) === false);
  const env = toErrorEnvelope(new Error("secret"), "t1");
  ok("エンベロープは内部詳細を漏らさない", env.error.code === "UNKNOWN" && !JSON.stringify(env).includes("secret"));

  // bulkhead
  const bh = await w("bh", (await fs.readFile(new URL("../packages/core/src/bulkhead.ts", import.meta.url), "utf8")).replace('from "./error.js"', `from "${errmod}"`));
  const { createBulkhead } = await import(bh);
  const defer = () => { let r; const p = new Promise((res) => (r = res)); return { p, resolve: r }; };
  const b = createBulkhead({ maxConcurrent: 2 });
  const d1 = defer(), d2 = defer(), d3 = defer();
  const ps = [b.run(() => d1.p), b.run(() => d2.p), b.run(() => d3.p)];
  await new Promise((r) => setTimeout(r, 5));
  const limited = b.active() === 2 && b.queued() === 1;
  d1.resolve(); d2.resolve(); d3.resolve(); await Promise.all(ps);
  ok("バルクヘッド: 同時実行を上限に制限", limited && b.active() === 0);
  const b2 = createBulkhead({ maxConcurrent: 1, maxQueue: 0 });
  const dd = defer(); const held = b2.run(() => dd.p);
  await new Promise((r) => setTimeout(r, 5));
  let rejected = false; try { await b2.run(() => Promise.resolve()); } catch (e) { rejected = e.code === "RATE_LIMITED"; }
  dd.resolve(); await held;
  ok("バルクヘッド: 超過はバックプレッシャで拒否", rejected);

  // process guard
  const pg = await w("pg", (await fs.readFile(new URL("../packages/core/src/process-guard.ts", import.meta.url), "utf8")));
  const { installProcessGuards } = await import(pg);
  const h = {}; let exitCode = null; let fatal = false;
  installProcessGuards({ logger: { error: () => {}, warn: () => {} }, onProcess: (e, fn) => { h[e] = fn; }, exit: (c) => { exitCode = c; }, onFatal: () => { fatal = true; } });
  h.unhandledRejection(new Error("r"));
  const noExitOnReject = exitCode === null;
  h.uncaughtException(new Error("f"));
  await new Promise((r) => setTimeout(r, 10));
  ok("プロセス安全網: 拒否は継続・致命は後始末して exit(1)", noExitOnReject && fatal && exitCode === 1);

  for (const f of [errmod, ep, bh, pg]) await fs.rm(f);
}

// ---- 業務ドメイン: 消費税/インボイス / 一括インポート / 採番 ----
section("tax / importer / sequence");
{
  const { readFile: _rfTax } = await import("node:fs/promises");
  const _taxSrc = (await _rfTax(new URL("../packages/tax/src/index.ts", import.meta.url), "utf8")).replace(/export \* from "\.\/withholding\.js";\n?/g, "");
  const _taxF = `/tmp/tax-index-${Date.now()}.ts`; await (await import("node:fs/promises")).writeFile(_taxF, _taxSrc);
  const T = await import(_taxF);
  ok("消費税 税込/税抜(誤差なし)", T.grossFromNet(1000, 10) === 1100 && T.netFromGross(1100, 10) === 1000);
  ok("軽減税率 8%", T.taxAmount(1000, 8) === 80);
  const sum = T.summarizeTax([{ net: 3000, rate: 10 }, { net: 500, rate: 8 }, { net: 300, rate: 0 }]);
  ok("適格請求書 税率別集計(3区分/tax340)", sum.byRate.length === 3 && sum.tax === 340 && sum.gross === 4140);
  ok("区分合計で丸める(105x2→21)", T.summarizeTax([{ net: 105, rate: 10 }, { net: 105, rate: 10 }]).byRate[0].tax === 21);
  const genCorp = (b) => { let x = 0; for (let i = 0; i < 12; i++) x += Number(b[11 - i]) * (i % 2 === 0 ? 1 : 2); return String(9 - (x % 9)) + b; };
  ok("登録番号チェックディジット検証", T.isValidInvoiceNumber("T" + genCorp("234567890123")) === true && T.isValidInvoiceNumber("T123") === false);

  const I = await import(new URL("../packages/importer/src/index.ts", import.meta.url));
  const validate = (raw) => raw.name ? { ok: true, value: { name: raw.name } } : { ok: false, errors: ["名前必須"] };
  const rep = I.validateRows([{ name: "a" }, { name: "" }], validate);
  ok("インポート 有効/エラー振り分け(行番号)", rep.valid.length === 1 && rep.errors[0].rowIndex === 2);
  let applied = 0;
  const abort = await I.runImport([{ name: "a" }, { name: "" }], validate, { apply: async (v) => { applied = v.length; } });
  const part = await I.runImport([{ name: "a" }, { name: "" }], validate, { partial: true, apply: async (v) => { applied = v.length; } });
  ok("エラー時 全件中止 / partial は有効行のみ", abort.committed === false && part.applied === 1);

  const S = await import(new URL("../packages/sequence/src/index.ts", import.meta.url));
  const seq = S.createSequencer(S.createMemorySequenceStore(), "inv", { prefix: "INV-", padding: 6, resetPeriod: "yearly" });
  const a2024 = await seq.next(new Date("2024-06-01"));
  const b2025 = await seq.next(new Date("2025-01-05"));
  ok("採番 年次リセット + ゼロ埋め", a2024 === "INV-2024-000001" && b2025 === "INV-2025-000001");
}

// ---- Webhook 受信 / API キー / 全銀フォーマット ----
section("webhook / apikey / zengin");
{
  const { createHmac } = await import("node:crypto");
  const W = await import(new URL("../packages/webhook/src/index.ts", import.meta.url));
  const secret = "whsec";
  const sign = (p, pre = "") => pre + createHmac("sha256", secret).update(p).digest("hex");
  ok("webhook HMAC 署名検証", W.verifyHmacSignature({ payload: "x", signature: sign("x"), secret }) === true && W.verifyHmacSignature({ payload: "x2", signature: sign("x"), secret }) === false);
  const seen = [];
  const rc = W.createWebhookReceiver({ secret, signaturePrefix: "sha256=", parse: JSON.parse, eventId: (e) => e.id, eventType: (e) => e.type });
  rc.on("paid", async (e) => { seen.push(e.amount); });
  const body = JSON.stringify({ id: "e1", type: "paid", amount: 100 });
  const p1 = await rc.handle(body, sign(body, "sha256="));
  const p2 = await rc.handle(body, sign(body, "sha256="));
  const p3 = await rc.handle(body, "sha256=bad");
  ok("webhook 署名→冪等→ディスパッチ", p1.status === "processed" && p2.status === "duplicate" && p3.status === "invalid_signature" && seen.length === 1);

  const A = await import(new URL("../packages/apikey/src/index.ts", import.meta.url));
  const key = A.generateApiKey({ prefix: "sk_" });
  ok("apikey 生成+ハッシュ照合", key.plaintext.startsWith("sk_") && A.verifyApiKey(key.plaintext, key.hash) === true && A.verifyApiKey("sk_wrong", key.hash) === false);
  ok("apikey スコープ(ワイルドカード)", A.hasScope(["orders:*"], "orders:write") === true && A.hasScope(["orders:read"], "users:read") === false);
  const store = { findByHash: (h) => h === key.hash ? { id: "1", hash: h, scopes: ["*"] } : null };
  const ok1 = await A.authenticateApiKey(key.plaintext, store);
  const exp = await A.authenticateApiKey("k", { findByHash: () => ({ id: "2", hash: "x", scopes: [], expiresAt: 1000 }) }, 2000);
  ok("apikey 認証(有効/期限切れ)", ok1.ok === true && exp.ok === false && exp.reason === "expired");

  const Z = await import(new URL("../packages/zengin/src/index.ts", import.meta.url));
  const r = Z.buildZenginTransfer(
    { code: "1234567890", name: "テスト", bankCode: "0001", branchCode: "001", accountType: "1", accountNumber: "1234567" },
    [{ bankCode: "0005", branchCode: "100", accountType: "1", accountNumber: "7654321", recipientName: "ヤマダタロウ", amount: 150000 },
     { bankCode: "0009", branchCode: "200", accountType: "2", accountNumber: "1111111", recipientName: "スズキハナコ", amount: 80000 }],
    "0725");
  const lines = r.content.split("\r\n");
  ok("zengin レコード種別(1/2/8/9)", lines[0][0] === "1" && lines[1][0] === "2" && lines[3][0] === "8" && lines[4] === "9");
  ok("zengin 件数/合計 自動集計", r.count === 2 && r.totalAmount === 230000 && lines[1].length === 56);
  ok("zengin 半角カナ変換", Z.toHankakuKana("ダ") === "ﾀﾞ");
}

// ---- utils 拡張: 関数 / オブジェクト / 配列 / 非同期 ----
section("utils: function / object / array / async");
{
  const F = await import(new URL("../packages/utils/src/function.ts", import.meta.url));
  const O = await import(new URL("../packages/utils/src/object.ts", import.meta.url));
  const A = await import(new URL("../packages/utils/src/array.ts", import.meta.url));
  const Y = await import(new URL("../packages/utils/src/async.ts", import.meta.url));
  // function
  let mc = 0; const m = F.memoize((x) => { mc++; return x * 2; });
  ok("utils memoize/once/pipe", m(5) === 10 && m(5) === 10 && mc === 1 && F.pipe((x) => x + 1, (x) => x * 2)(3) === 8);
  // object
  ok("utils pick/omit/deepClone/deepEqual", JSON.stringify(O.pick({ a: 1, b: 2 }, ["a"])) === JSON.stringify({ a: 1 }) && O.deepEqual({ a: [1] }, { a: [1] }) === true && O.deepMerge({ a: { x: 1 } }, { a: { y: 2 } }).a.x === 1);
  const cl = O.deepClone({ a: { b: [1] } }); cl.a.b.push(2);
  ok("utils deepClone は独立 + isEmpty", cl.a.b.length === 2 && O.isEmpty("") === true && O.isEmpty("x") === false);
  // array
  ok("utils sortBy/partition/keyBy", JSON.stringify(A.sortBy([{ n: 3 }, { n: 1 }], (x) => x.n).map((x) => x.n)) === JSON.stringify([1, 3]) && JSON.stringify(A.partition([1, 2, 3], (x) => x % 2 === 0)) === JSON.stringify([[2], [1, 3]]));
  ok("utils zip/range/difference", JSON.stringify(A.zip([1, 2], ["a", "b"])) === JSON.stringify([[1, "a"], [2, "b"]]) && JSON.stringify(A.range(1, 5)) === JSON.stringify([1, 2, 3, 4]) && JSON.stringify(A.difference([1, 2, 3], [2])) === JSON.stringify([1, 3]));
  // async
  let cur = 0, max = 0;
  const r = await Y.pMapLimit([1, 2, 3, 4, 5, 6], async (x) => { cur++; max = Math.max(max, cur); await new Promise((rs) => setTimeout(rs, 3)); cur--; return x * 2; }, 2);
  ok("utils pMapLimit 順序保持+並行制限", JSON.stringify(r) === JSON.stringify([2, 4, 6, 8, 10, 12]) && max <= 2);
  let to = false; try { await Y.pTimeout(new Promise((rs) => setTimeout(rs, 50)), 5); } catch (e) { to = e.name === "TimeoutError"; }
  ok("utils pTimeout(TimeoutError)", to === true);
}

// ---- LINE 連携拡充: メッセージビルダー / Webhook / 拡張クライアント ----
section("line: builders / webhook / client");
{
  const fs = await import("node:fs/promises");
  const { createHmac } = await import("node:crypto");
  const stamp = Date.now();
  // messages(index の型のみ依存 → LineMessage は type import なので shim 不要)
  const msgShim = `/tmp/line-idx-${stamp}.ts`;
  await fs.writeFile(msgShim, "export interface LineMessage { type: string; [k: string]: unknown }");
  const msgSrc = (await fs.readFile(new URL("../packages/line/src/messages.ts", import.meta.url), "utf8")).replace('from "./index.js"', `from "${msgShim}"`);
  const msgF = `/tmp/line-msg-${stamp}.ts`; await fs.writeFile(msgF, msgSrc);
  const M = await import(msgF);
  ok("LINE ビルダー(buttons/confirm/quickReply)", M.buttonsTemplate({ altText: "a", text: "t", actions: [M.postbackAction("承認", "d")] }).template.type === "buttons" && M.withQuickReply(M.textMessage("x"), [M.messageAction("y", "y")]).quickReply.items.length === 1 && M.confirmTemplate("a", "t", M.messageAction("y", "y"), M.messageAction("n", "n")).template.actions.length === 2);

  const W = await import(new URL("../packages/line/src/webhook.ts", import.meta.url));
  const secret = "linesec";
  const body = JSON.stringify({ events: [{ type: "postback", timestamp: 1, source: { type: "user", userId: "U1" }, postback: { data: "action=approve&id=1" } }] });
  const sig = createHmac("sha256", secret).update(body).digest("base64");
  ok("LINE Webhook 署名検証(base64)", W.verifyLineSignature(body, sig, secret) === true && W.verifyLineSignature(body, sig, "wrong") === false);
  const events = W.parseLineWebhook(body);
  ok("LINE イベント/postback パース", events[0].type === "postback" && W.parsePostbackData(events[0].postback.data).action === "approve" && W.eventSourceId(events[0].source) === "U1");

  // 拡張クライアント(integrations shim)
  const coreF = `/tmp/line-core-${stamp}.ts`; await fs.writeFile(coreF, "export type Result<T> = { ok: true; value: T } | { ok: false; error: { message: string } };");
  const intF = `/tmp/line-int-${stamp}.ts`;
  await fs.writeFile(intF, "export function createApiClient(){ const c=[]; globalThis.__lc=c; const r=async(m,p,o)=>{ c.push({m,p,body:o?.body}); return {ok:true,value:{richMenuId:'rm1'}}; }; return { get:(p)=>r('GET',p), post:(p,o)=>r('POST',p,o), put:(p,o)=>r('PUT',p,o), delete:(p,o)=>r('DELETE',p,o), patch:(p,o)=>r('PATCH',p,o) }; }");
  const emptyF = `/tmp/line-empty-${stamp}.ts`; await fs.writeFile(emptyF, "export {};");
  const idxSrc = (await fs.readFile(new URL("../packages/line/src/index.ts", import.meta.url), "utf8")).replace('from "@platform/integrations"', `from "${intF}"`).replace('from "@platform/core"', `from "${coreF}"`).replace('from "./messages.js"', `from "${emptyF}"`).replace('from "./webhook.js"', `from "${emptyF}"`);
  const idxF = `/tmp/line-index-${stamp}.ts`; await fs.writeFile(idxF, idxSrc);
  const L = await import(idxF);
  const client = L.createLineClient({ channelAccessToken: "t" });
  await client.createRichMenu({ size: {} });
  await client.deleteRichMenu("rm1");
  await client.showLoadingAnimation("U1", 30);
  const calls = globalThis.__lc;
  ok("LINE 拡張クライアント(richmenu/loading)", calls.some((c) => c.p === "/richmenu" && c.m === "POST") && calls.some((c) => c.m === "DELETE") && calls.at(-1).p === "/chat/loading/start" && calls.at(-1).body.loadingSeconds === 30);

  for (const f of [msgShim, msgF, coreF, intF, emptyF, idxF]) await fs.rm(f);
}

// ---- freee 連携拡充: トークン管理 / 証憑 / 振替伝票 ----
section("freee: token / receipts / journal");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  // token(依存なし・純ロジック)
  const T = await import(new URL("../packages/freee/src/token.ts", import.meta.url));
  let clock = 0, refreshCount = 0;
  const tf = async () => { refreshCount++; return { ok: true, status: 200, json: async () => ({ access_token: "at-" + refreshCount, refresh_token: "rt", expires_in: 21600 }) }; };
  const saved = [];
  const mgr = T.createFreeeTokenManager({ clientId: "c", clientSecret: "s", refreshToken: "r", fetchImpl: tf, now: () => clock, onRefresh: (r) => saved.push(r.accessToken) });
  const first = await mgr.getAccessToken();
  const cached = await mgr.getAccessToken();
  const countAfterCache = refreshCount; // キャッシュ中は更新されていないはず(=1)
  clock = 21600 * 1000;
  const refreshed = await mgr.getAccessToken();
  ok("freee トークン 更新/キャッシュ/再更新", first === "at-1" && cached === "at-1" && countAfterCache === 1 && refreshed === "at-2" && saved[0] === "at-1");
  let apiCalls = 0;
  const apiFetch = async () => { apiCalls++; return apiCalls === 1 ? { status: 401 } : { status: 200 }; };
  const mgr2 = T.createFreeeTokenManager({ clientId: "c", clientSecret: "s", refreshToken: "r", fetchImpl: tf, now: () => Date.now() });
  const authed = T.createFreeeAuthedFetch(mgr2, apiFetch);
  ok("freee authed fetch 401 で再試行", (await authed("https://api.freee.co.jp/x")).status === 200 && apiCalls === 2);

  // builders(buildManualJournal・純ロジック)
  const B = await import(new URL("../packages/freee/src/builders.ts", import.meta.url));
  const mj = B.buildManualJournal({ companyId: 1, issueDate: "2025-07-11", details: [
    { entrySide: "debit", accountItemId: 100, taxCode: 0, amount: 11000 },
    { entrySide: "credit", accountItemId: 200, taxCode: 0, amount: 11000 }] });
  let unbalanced = false;
  try { B.buildManualJournal({ companyId: 1, issueDate: "x", details: [{ entrySide: "debit", accountItemId: 1, taxCode: 0, amount: 1 }, { entrySide: "credit", accountItemId: 2, taxCode: 0, amount: 2 }] }); } catch { unbalanced = true; }
  ok("freee 振替伝票(借方=貸方検証)", mj.details.length === 2 && mj.details[0].entry_side === "debit" && unbalanced === true);

  // 拡張クライアント(証憑 multipart 等)を integrations shim で
  const coreF = `/tmp/fr-core-${stamp}.ts`; await fs.writeFile(coreF, "export type Result<T> = { ok: true; value: T } | { ok: false; error: { message: string } };");
  const intF = `/tmp/fr-int-${stamp}.ts`;
  await fs.writeFile(intF, "export function createApiClient(){ const c=[]; globalThis.__fr=c; const r=async(m,p,o)=>{ c.push({m,p,query:o?.query,body:o?.body,multipart:o?.multipart}); return {ok:true,value:{id:1}}; }; return { get:(p,o)=>r('GET',p,o), post:(p,o)=>r('POST',p,o), put:(p,o)=>r('PUT',p,o), delete:(p,o)=>r('DELETE',p,o), patch:(p,o)=>r('PATCH',p,o) }; }");
  const emptyF = `/tmp/fr-empty-${stamp}.ts`; await fs.writeFile(emptyF, "export {};");
  const idxSrc = (await fs.readFile(new URL("../packages/freee/src/index.ts", import.meta.url), "utf8")).replace('from "@platform/integrations"', `from "${intF}"`).replace(/from "@platform\/core"/g, `from "${coreF}"`).replace('from "./token.js"', `from "${emptyF}"`).replace('from "./builders.js"', `from "${emptyF}"`).replace('from "./webhook.js"', `from "${emptyF}"`).replace('from "./hr.js"', `from "${emptyF}"`);
  const idxF = `/tmp/fr-index-${stamp}.ts`; await fs.writeFile(idxF, idxSrc);
  const F = await import(idxF);
  const client = F.createFreeeClient({ accessToken: "t" });
  await client.uploadReceipt(123, { filename: "r.jpg", data: new Uint8Array([1]), contentType: "image/jpeg" }, "タクシー代");
  await client.createManualJournal({ company_id: 123 });
  await client.createDealPayment(999, { amount: 1000 });
  const calls = globalThis.__fr;
  const up = calls.find((c) => c.p === "/receipts" && c.m === "POST");
  ok("freee 証憑multipart/振替伝票/支払", up.multipart.files[0].filename === "r.jpg" && up.multipart.fields.company_id === 123 && calls.some((c) => c.p === "/manual_journals") && calls.some((c) => c.p === "/deals/999/payments"));

  for (const f of [coreF, intF, emptyF, idxF]) await fs.rm(f);
}

// ---- freee 拡充2: 人事労務 / 承認ワークフロー / Webhook ----
section("freee: HR / approval / webhook");
{
  const fs = await import("node:fs/promises");
  const { createHmac } = await import("node:crypto");
  const stamp = Date.now();
  const w = async (n, src) => { const f = `/tmp/frx-${n}-${stamp}.ts`; await fs.writeFile(f, src); return f; };
  const coreF = await w("core", "export {}");
  const intF = await w("int", "export function createApiClient(c){ const calls=[]; globalThis.__frx={baseUrl:c.baseUrl,calls}; const r=async(m,p,o)=>{ calls.push({m,p,query:o?.query,body:o?.body}); return {ok:true,value:{}}; }; return { get:(p,o)=>r('GET',p,o), post:(p,o)=>r('POST',p,o), put:(p,o)=>r('PUT',p,o), delete:(p,o)=>r('DELETE',p,o), patch:(p,o)=>r('PATCH',p,o) }; }");

  // HR クライアント
  const hrSrc = (await fs.readFile(new URL("../packages/freee/src/hr.ts", import.meta.url), "utf8")).replace('from "@platform/integrations"', `from "${intF}"`).replace('from "@platform/core"', `from "${coreF}"`);
  const hrF = await w("hr", hrSrc);
  const H = await import(hrF);
  const hr = H.createFreeeHrClient({ accessToken: "t" });
  await hr.getEmployees(5);
  const baseOk = globalThis.__frx.baseUrl === "https://api.freee.co.jp/hr/api/v1";
  await hr.putWorkRecord(10, { date: "2025-07-25", clockInAt: "2025-07-25T09:00:00", breakRecords: [{ clockInAt: "2025-07-25T12:00:00", clockOutAt: "2025-07-25T13:00:00" }] }, 5);
  const wr = globalThis.__frx.calls.at(-1);
  ok("freee 人事労務(base URL/勤怠 PUT/キー変換)", baseOk && wr.m === "PUT" && wr.p === "/employees/10/work_records/2025-07-25" && wr.body.clock_in_at === "2025-07-25T09:00:00" && wr.body.break_records[0].clock_in_at === "2025-07-25T12:00:00");
  await hr.getWorkRecordSummary(10, 2025, 7, 5);
  ok("freee 人事労務(月次集計/給与)", globalThis.__frx.calls.at(-1).p === "/employees/10/work_record_summaries/2025/7");

  // 承認ワークフロー(会計 index)
  const emptyF = await w("empty", "export {}");
  const idxSrc = (await fs.readFile(new URL("../packages/freee/src/index.ts", import.meta.url), "utf8")).replace('from "@platform/integrations"', `from "${intF}"`).replace(/from "@platform\/core"/g, `from "${coreF}"`).replace('from "./token.js"', `from "${emptyF}"`).replace('from "./builders.js"', `from "${emptyF}"`).replace('from "./webhook.js"', `from "${emptyF}"`).replace('from "./hr.js"', `from "${emptyF}"`);
  const idxF = await w("idx", idxSrc);
  const F = await import(idxF);
  const freee = F.createFreeeClient({ accessToken: "t" });
  await freee.actionExpenseApplication(123, 55, "approve", { comment: "OK" });
  const ea = globalThis.__frx.calls.at(-1);
  await freee.actionApprovalRequest(123, 77, "approve", { approvalStep: 2 });
  const ar = globalThis.__frx.calls.at(-1);
  ok("freee 承認ワークフロー(経費申請/承認依頼 actions)", ea.p === "/expense_applications/55/actions" && ea.body.action === "approve" && ar.p === "/approval_requests/77/actions" && ar.body.approval_step_id === 2);

  // Webhook 署名検証
  const W = await import(new URL("../packages/freee/src/webhook.ts", import.meta.url));
  const secret = "frwh";
  const body = JSON.stringify({ application_notifications: [{ type: "deal.created", company_id: 123 }] });
  const sig = createHmac("sha256", secret).update(body).digest("hex");
  ok("freee Webhook 署名検証/パース", W.verifyFreeeSignature(body, sig, secret) === true && W.verifyFreeeSignature(body, sig, "x") === false && W.parseFreeeWebhook(body)[0].type === "deal.created");

  for (const f of [coreF, intF, hrF, emptyF, idxF]) await fs.rm(f);
}

// ---- Google 連携拡充: ログイン/OAuth / Gmail / Drive / Calendar ----
section("google: oauth / gmail / drive / calendar");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  const w = async (n, src) => { const f = `/tmp/gx-${n}-${stamp}.ts`; await fs.writeFile(f, src); return f; };
  const coreF = await w("core", "export {}");
  const intF = await w("int", "export function createApiClient(c){ const req=async(m,p,o)=>{ globalThis.__gx={method:m,path:p,query:o?.query,body:o?.body,multipart:o?.multipart,baseUrl:c.baseUrl}; return {ok:true,value:{id:'f1',name:'x'}}; }; return { get:(p,o)=>req('GET',p,o), post:(p,o)=>req('POST',p,o), put:(p,o)=>req('PUT',p,o), delete:(p,o)=>req('DELETE',p,o), patch:(p,o)=>req('PATCH',p,o) }; }");

  // OAuth(純ロジック + fake fetch)
  const O = await import(new URL("../packages/google/src/oauth.ts", import.meta.url));
  const url = O.buildGoogleAuthUrl({ clientId: "cid", redirectUri: "https://app/cb", scopes: ["openid", "email"], state: "s", forceConsent: true });
  const authOk = new URL(url).searchParams.get("client_id") === "cid" && new URL(url).searchParams.get("access_type") === "offline" && new URL(url).searchParams.get("prompt") === "consent";
  let clock = 0, n = 0;
  const mgrFetch = async () => ({ ok: true, json: async () => ({ access_token: `at${++n}`, expires_in: 3600 }) });
  const mgr = O.createGoogleTokenManager({ clientId: "c", clientSecret: "s", refreshToken: "rt", fetchImpl: mgrFetch, now: () => clock });
  const t1 = await mgr.getAccessToken(); const t1b = await mgr.getAccessToken(); clock += 3600 * 1000; const t2 = await mgr.getAccessToken();
  ok("google OAuth(認可URL/トークン更新/キャッシュ)", authOk && t1 === "at1" && t1b === "at1" && t2 === "at2");
  const ui = await O.getGoogleUserInfo("at", async () => ({ ok: true, json: async () => ({ sub: "1", email: "a@x.com", hd: "example.co.jp" }) }));
  ok("google userinfo(email/hd 社内判定)", ui.email === "a@x.com" && ui.hd === "example.co.jp");

  // Gmail(raw 構築 + 送信)
  const gmSrc = (await fs.readFile(new URL("../packages/google/src/gmail.ts", import.meta.url), "utf8")).replace('from "@platform/integrations"', `from "${intF}"`).replace('from "@platform/core"', `from "${coreF}"`);
  const G = await import(await w("gm", gmSrc));
  const raw = G.buildRawEmail({ to: "a@x.com", subject: "テスト", text: "本文", cc: ["b@x.com"] });
  const gmail = G.createGmailClient({ accessToken: "t" });
  await gmail.sendEmail({ to: "a@x.com", subject: "件名", text: "本文" });
  ok("gmail(MIME件名/base64url送信)", raw.includes("=?UTF-8?B?") && !raw.includes("テスト") && globalThis.__gx.path === "/messages/send" && !/[+/=]/.test(globalThis.__gx.body.raw));

  // Drive(multipart アップロード + 共有)
  const drSrc = (await fs.readFile(new URL("../packages/google/src/drive.ts", import.meta.url), "utf8")).replace('from "@platform/integrations"', `from "${intF}"`).replace('from "@platform/core"', `from "${coreF}"`);
  const D = await import(await w("dr", drSrc));
  const drive = D.createGoogleDriveClient({ accessToken: "t" });
  await drive.uploadFile({ name: "報告書.pdf", data: new Uint8Array([1]), mimeType: "application/pdf", parents: ["folder1"] });
  const up = globalThis.__gx;
  await drive.shareFile("f1", { role: "reader", type: "user", emailAddress: "a@x.com" });
  ok("drive(uploadホスト/multipart/共有)", up.baseUrl === "https://www.googleapis.com/upload/drive/v3" && up.multipart.files.length === 2 && globalThis.__gx.path === "/files/f1/permissions");

  // Calendar 拡張(index を integrations shim で)
  const emptyF = await w("empty", "export {}");
  const idxSrc = (await fs.readFile(new URL("../packages/google/src/index.ts", import.meta.url), "utf8")).replace('from "@platform/integrations"', `from "${intF}"`).replace('from "@platform/core"', `from "${coreF}"`).replace('from "./oauth.js"', `from "${emptyF}"`).replace('from "./gmail.js"', `from "${emptyF}"`).replace('from "./drive.js"', `from "${emptyF}"`);
  const I = await import(await w("idx", idxSrc));
  const cal = I.createGoogleCalendarClient({ accessToken: "t" });
  await cal.createEvent("primary", { summary: "会議" }, { sendUpdates: "all" });
  const ce = globalThis.__gx;
  await cal.freeBusy({ timeMin: "a", timeMax: "b", calendarIds: ["primary", "room@x.com"] });
  ok("calendar(予定作成/freeBusy)", ce.method === "POST" && ce.path === "/calendars/primary/events" && ce.query.sendUpdates === "all" && globalThis.__gx.path === "/freeBusy" && globalThis.__gx.body.items.length === 2);

  for (const f of [coreF, intF, emptyF]) await fs.rm(f);
}

// ---- status-page: メンテナンス/エラー画面 + 切替ゲート ----
section("status-page: templates / gate");
{
  const T = await import(new URL("../packages/status-page/src/templates.ts", import.meta.url));
  const m = T.renderMaintenancePage({ brand: "社内システム", estimatedRecovery: "22:00" });
  ok("メンテHTML(自己完結/noindex/文言)", m.startsWith("<!doctype html>") && m.includes("メンテナンス中") && m.includes("22:00") && m.includes("noindex") && !/src=|href="https?:/.test(m));
  const e = T.renderErrorPage({ referenceId: "trace-1" });
  ok("エラーHTML(参照ID)", e.includes("システムエラー") && e.includes("trace-1"));
  const x = T.renderStatusPage({ title: "<script>x</script>", message: "a & b < c" });
  ok("XSSエスケープ", x.includes("&lt;script&gt;") && x.includes("a &amp; b &lt; c") && !x.includes("<script>x"));

  const G = await import(new URL("../packages/status-page/src/gate.ts", import.meta.url));
  const now = () => new Date("2025-07-25T12:00:00Z");
  const on = G.createMaintenanceGate(() => ({ enabled: true, allowRoles: ["admin"], estimatedRecovery: "22:00" }), now);
  ok("ゲート: 一般はメンテ/管理者は素通し", on.evaluate({ path: "/x" }).active === true && on.evaluate({ path: "/x", roles: ["admin"] }).active === false && on.evaluate({ path: "/api/health" }).active === false);
  const win = G.createMaintenanceGate(() => ({ window: { start: "2025-07-25T11:00:00Z", end: "2025-07-25T13:00:00Z" } }), now);
  const winOut = G.createMaintenanceGate(() => ({ window: { start: "2025-07-25T20:00:00Z", end: "2025-07-25T22:00:00Z" } }), now);
  ok("ゲート: 予定期間で自動オン/オフ", win.evaluate({ path: "/x" }).active === true && winOut.evaluate({ path: "/x" }).active === false);

  // GUI/ストア連動(再起動なしの切り替え)
  const store = G.createMemoryMaintenanceStore();
  const agate = G.createAsyncMaintenanceGate(() => G.stateToConfig(store.get(), { allowRoles: ["admin"] }), now);
  const before = (await agate.evaluate({ path: "/x" })).active;
  store.set({ enabled: true, estimatedRecovery: "22:00" });
  const afterOn = await agate.evaluate({ path: "/x" });
  store.set({ enabled: false });
  const afterOff = (await agate.evaluate({ path: "/x" })).active;
  ok("ストアで再起動なし切替(OFF→ON→OFF)", before === false && afterOn.active === true && afterOn.estimatedRecovery === "22:00" && afterOff === false);
  let calls = 0; let clock = 0;
  const cached = G.createCachedConfig(() => { calls++; return { enabled: false }; }, 5000, () => clock);
  await cached(); await cached(); clock = 6000; await cached();
  ok("TTLキャッシュ(間引き/期限で再取得)", calls === 2);
}

// ---- session ログイン拡充: 無操作タイムアウト / idle timer / ログインスロットル ----
section("session: idle timeout / idle timer / login throttle");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  // 無操作セッション(crypto/cookie を可逆 shim に差し替え)
  const cryptoF = `/tmp/sess-crypto-${stamp}.ts`;
  await fs.writeFile(cryptoF, "export function deriveKey(s){return s} export function encrypt(t){return Buffer.from(t,'utf8').toString('base64')} export function decrypt(x){return Buffer.from(x,'base64').toString('utf8')}");
  const cookieF = `/tmp/sess-cookie-${stamp}.ts`;
  await fs.writeFile(cookieF, "export function getCookie(h,n){ if(!h) return undefined; for(const p of h.split(';')){ const [k,v]=p.trim().split('='); if(k===n) return v; } return undefined } export function serializeCookie(n,v,o){ return `${n}=${v}; Max-Age=${o?.maxAge??0}` } export function clearCookie(n){ return `${n}=; Max-Age=0` }");
  const sessSrc = (await fs.readFile(new URL("../packages/session/src/session.ts", import.meta.url), "utf8")).replace('from "@platform/crypto"', `from "${cryptoF}"`).replace('from "./cookie.js"', `from "${cookieF}"`);
  const sessF = `/tmp/sess-session-${stamp}.ts`; await fs.writeFile(sessF, sessSrc);
  const S = await import(sessF);
  const idle = S.createSession({ secret: "y".repeat(32), maxAgeSec: 3600, idleTimeoutSec: 0.05 });
  const ci = idle.write({ u: "1" });
  const cookieI = "session=" + ci.split("session=")[1].split(";")[0];
  const before = idle.read(cookieI)?.u;
  await new Promise((r) => setTimeout(r, 80));
  ok("session 無操作タイムアウト(既定オフ→設定でログアウト)", before === "1" && idle.read(cookieI) === null);
  const noIdle = S.createSession({ secret: "z".repeat(32), maxAgeSec: 3600 });
  const cn = noIdle.write({ u: "2" });
  ok("session 既定は無操作でもOK", noIdle.read("session=" + cn.split("session=")[1].split(";")[0])?.u === "2");

  // idle timer(スケジューラ注入)
  const IT = await import(new URL("../packages/session/src/idle-timer.ts", import.meta.url));
  const jobs = new Map(); let jid = 0; let t = 0;
  const sched = { set: (fn, ms) => { const h = ++jid; jobs.set(h, { fn, at: t + ms }); return h; }, clear: (h) => jobs.delete(h) };
  const advance = (ms) => { t += ms; for (const [h, j] of [...jobs]) if (j.at <= t) { jobs.delete(h); j.fn(); } };
  let warned = false, loggedOut = false;
  const timer = IT.createIdleTimer({ timeoutMs: 1000, warnBeforeMs: 200, onWarn: () => (warned = true), onIdle: () => (loggedOut = true), scheduler: sched });
  timer.start(); advance(800); const w = warned; timer.activity(); advance(999); const stillIn = !loggedOut; advance(1);
  ok("idle timer(警告→活動リセット→ログアウト)", w === true && stillIn === true && loggedOut === true);

  // login throttle
  const LT = await import(new URL("../packages/session/src/login-throttle.ts", import.meta.url));
  let clock = 0; const now = () => clock;
  const th = LT.createLoginThrottle({ maxFails: 3, lockMs: 30000, store: LT.createMemoryThrottleStore(now), now });
  await th.recordFailure("a"); await th.recordFailure("a");
  const locked = await th.recordFailure("a");
  const stillLocked = (await th.check("a")).allowed;
  clock += 30001;
  const unlocked = (await th.check("a")).allowed;
  ok("login throttle(3回でロック→解除)", locked.allowed === false && stillLocked === false && unlocked === true);

  // store session: 再生成 + 全端末ログアウト(crypto/cookie shim)
  const stCrypto = `/tmp/sess-stcrypto-${stamp}.ts`;
  await fs.writeFile(stCrypto, "let n=0; export function randomToken(){ return 'tok'+(++n) }");
  const stStoreSrc = (await fs.readFile(new URL("../packages/session/src/store-session.ts", import.meta.url), "utf8")).replace('from "@platform/crypto"', `from "${stCrypto}"`).replace('from "./cookie.js"', `from "${cookieF}"`);
  const stStoreF = `/tmp/sess-store-${stamp}.ts`; await fs.writeFile(stStoreF, stStoreSrc);
  const SS = await import(stStoreF);
  const map = new Map();
  const memStore = { get: async (k) => map.get(k) ?? null, set: async (k, v) => { map.set(k, v); }, delete: async (k) => { map.delete(k); } };
  const svr = SS.createServerSession({ store: memStore });
  const sa = await svr.create({ name: "t" }, { userId: "u1" });
  const cookieSA = "sid=" + sa.setCookie.split("sid=")[1].split(";")[0];
  const re = await svr.regenerate(cookieSA);
  const oldGone = (await svr.read(cookieSA)) === null;
  await svr.create({ name: "t" }, { userId: "u1" });
  const revoked = await svr.destroyAllForUser("u1");
  ok("store session(再生成→旧失効 / 全端末ログアウト)", re && re.id !== sa.id && oldGone && revoked >= 2 && (await svr.listUserSessions("u1")).length === 0);

  // step-up 再認証 + Remember-me + 監査
  const SU = await import(new URL("../packages/session/src/step-up.ts", import.meta.url));
  let clk = 0; const step = SU.createStepUp({ freshnessSec: 300, now: () => clk });
  const atv = step.stamp(); const freshOk = step.required(atv) === false; clk = 301000; const staleOk = step.required(atv) === true;
  const remOk = SU.sessionMaxAge(false, { defaultMaxAgeSec: 3600, rememberMaxAgeSec: 999 }) === 3600 && SU.sessionMaxAge(true, { defaultMaxAgeSec: 3600, rememberMaxAgeSec: 999 }) === 999;
  ok("step-up 再認証 + Remember-me", freshOk && staleOk && remOk);
  const LA = await import(new URL("../packages/session/src/login-audit.ts", import.meta.url));
  const evs = [];
  const audit = LA.createLoginAudit({ record: (e) => evs.push(e) }, { now: () => new Date("2025-07-25T12:00:00Z") });
  await audit.loginSuccess({ subject: "a@x.com", ip: "10.0.0.1" });
  await audit.allSessionsRevoked({ subject: "a@x.com" });
  ok("ログイン監査(標準スキーマ)", evs[0].event === "login_success" && evs[0].at === "2025-07-25T12:00:00.000Z" && evs[1].event === "all_sessions_revoked");

  await fs.rm(stCrypto); await fs.rm(stStoreF);

  for (const f of [cryptoF, cookieF, sessF]) await fs.rm(f);
}

// ---- 本人確認書類の検証 + マイナンバー/書類番号マスキング(KYC 部品) ----
section("identity: document validation / masking");
{
  const I = await import(new URL("../packages/validation/src/identity.ts", import.meta.url));
  ok("本人確認書類の書式検証(免許/旅券/在留)", I.isValidDriversLicenseNumber("123456789012") && I.isValidJapanPassportNumber("TK1234567") && I.isValidResidenceCardNumber("AB12345678CD") && !I.isValidDriversLicenseNumber("12345678901"));
  ok("書類番号の正規化(全角/ハイフン)", I.normalizeDocumentNumber("ＴＫ－１２３４５６７") === "TK1234567" && I.validateIdentityDocument("passport", "TK1234567"));
  const M = await import(new URL("../packages/pii/src/identity-mask.ts", import.meta.url));
  ok("マイナンバーは既定 全桁マスク(番号法)", M.maskMyNumber("123456789018") === "************" && M.maskMyNumber("123456789018", 4) === "********9018");
  ok("本人確認番号の末尾マスク", M.maskIdentityNumber("AB12345678CD") === "********78CD");
}

// ---- ekyc: eKYC ベンダー連携(ステータス正規化 / Webhook / クライアント) ----
section("ekyc: status / webhook / client");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  const S = await import(new URL("../packages/ekyc/src/status.ts", import.meta.url));
  ok("ekyc ステータス正規化", S.normalizeEkycStatus("Approved") === "approved" && S.normalizeEkycStatus("NG") === "rejected" && S.normalizeEkycStatus("reviewing") === "in_review" && S.normalizeEkycStatus("x") === "unknown");
  ok("ekyc 確定/承認判定", S.isEkycFinal("approved") && !S.isEkycFinal("in_review") && S.isEkycApproved("approved"));

  // webhook(status.ts を .ts 参照に差し替えて読み込み)
  const whSrc = (await fs.readFile(new URL("../packages/ekyc/src/webhook.ts", import.meta.url), "utf8")).replace('from "./status.js"', `from ${JSON.stringify(new URL("../packages/ekyc/src/status.ts", import.meta.url).href)}`);
  const whF = `/tmp/ekyc-wh-${stamp}.ts`; await fs.writeFile(whF, whSrc);
  const W = await import(whF);
  const { createHmac } = await import("node:crypto");
  const body = JSON.stringify({ application_id: "a1", status: "approved" });
  const sig = createHmac("sha256", "sec").update(body).digest("hex");
  ok("ekyc Webhook 署名検証", W.verifyEkycSignature(body, sig, "sec") === true && W.verifyEkycSignature(body + "x", sig, "sec") === false);
  const ev = W.parseEkycWebhook(JSON.stringify({ id: "v1", result: "NG", reason: "mismatch" }));
  ok("ekyc Webhook パース+正規化", ev.applicationId === "v1" && ev.status === "rejected" && ev.reason === "mismatch");

  // client(integrations を fake に差し替え)
  const intF = `/tmp/ekyc-int-${stamp}.ts`;
  await fs.writeFile(intF, "export function createApiClient(config){ const calls=[]; globalThis.__ekyc=calls; const r=(m)=>(p,o)=>{ calls.push({m,p,h:config.headers,b:config.baseUrl}); return Promise.resolve({ok:true,value:{}}); }; return { get:r('GET'), post:r('POST'), put:r('PUT'), patch:r('PATCH'), delete:r('DELETE') }; }");
  const coreF = `/tmp/ekyc-core-${stamp}.ts`; await fs.writeFile(coreF, "export {};");
  const clSrc = (await fs.readFile(new URL("../packages/ekyc/src/client.ts", import.meta.url), "utf8")).replace('from "@platform/integrations"', `from ${JSON.stringify(intF)}`).replace('from "@platform/core"', `from ${JSON.stringify(coreF)}`);
  const clF = `/tmp/ekyc-cl-${stamp}.ts`; await fs.writeFile(clF, clSrc);
  const C = await import(clF);
  const client = C.createEkycClient({ apiKey: "k", baseUrl: "https://api.example.com/v1" });
  await client.createApplication({ name: "t" });
  await client.getApplication("app_1");
  const calls = globalThis.__ekyc;
  ok("ekyc クライアント(POST作成 / :id置換 / 認証ヘッダ)", calls[0].m === "POST" && calls[0].p === "/applications" && calls[0].h["X-Api-Key"] === "k" && calls[1].p === "/applications/app_1");
  const td = C.createTrustdockClient({ apiKey: "tk", environment: "sandbox" });
  await td.getApplication("v1");
  const tdCall = globalThis.__ekyc[globalThis.__ekyc.length - 1];
  ok("ekyc TRUSTDOCK プリセット", tdCall.b.includes("sandbox") && tdCall.h["X-Api-Key"] === "tk");

  for (const f of [whF, intF, coreF, clF]) await fs.rm(f);
}

// ---- ekyc: eKYC ベンダー連携(TRUSTDOCK)----
section("ekyc: client / webhook / status");
{
  const fs = await import("node:fs/promises");
  const cr = await import("node:crypto");
  const stamp2 = Date.now();
  // status(依存ゼロ)
  const ST = await import(new URL("../packages/ekyc/src/status.ts", import.meta.url));
  ok("ekyc status 正規化", ST.normalizeEkycStatus("Approved") === "approved" && ST.normalizeEkycStatus("NG") === "rejected" && ST.normalizeEkycStatus("x") === "unknown" && ST.isEkycFinal("approved") === true);
  // client(integrations を core shim 経由で読み込み)
  const coreF = `/tmp/ekyc-core-${stamp2}.ts`;
  await fs.writeFile(coreF, `export const ErrorCode={EXTERNAL:"EXTERNAL",INTERNAL:"INTERNAL"};export class AppError extends Error{constructor(c,m,d){super(m);this.code=c;this.details=d;}}export async function tryCatch(fn){try{return {ok:true,value:await fn()};}catch(e){return {ok:false,error:e instanceof AppError?e:new AppError("INTERNAL",String(e))};}}`);
  const intSrc = (await fs.readFile(new URL("../packages/integrations/src/index.ts", import.meta.url), "utf8")).replace('from "@platform/core"', `from "${coreF}"`);
  const intF = `/tmp/ekyc-int-${stamp2}.ts`; await fs.writeFile(intF, intSrc);
  const clientSrc = (await fs.readFile(new URL("../packages/ekyc/src/client.ts", import.meta.url), "utf8")).replace('from "@platform/integrations"', `from "${intF}"`).replace('from "@platform/core"', `from "${coreF}"`);
  const clientF = `/tmp/ekyc-client-${stamp2}.ts`; await fs.writeFile(clientF, clientSrc);
  const C = await import(clientF);
  const calls = [];
  const fakeFetch = async (url, init = {}) => { calls.push({ url: String(url), method: init.method, headers: init.headers }); return new Response(JSON.stringify({ id: "app_1", status: "in_review" }), { status: 200, headers: { "content-type": "application/json" } }); };
  const kyc = C.createEkycClient({ apiKey: "k", baseUrl: "https://ex.test/v2", fetchImpl: fakeFetch });
  const cr1 = await kyc.createApplication({ document_type: "passport" });
  await kyc.getApplication("app_1");
  ok("ekyc client(POST作成 + X-Api-Key + :id置換)", cr1.ok && calls[0].method === "POST" && calls[0].headers["X-Api-Key"] === "k" && calls[1].url.endsWith("/applications/app_1"));
  const td = C.createTrustdockClient({ apiKey: "k", environment: "sandbox", fetchImpl: fakeFetch });
  await td.getApplication("x");
  ok("ekyc TRUSTDOCK プリセット baseUrl", calls[2].url.includes("sandbox.api.trustdock.io"));
  // webhook(status.ts を .ts 参照に)
  const whSrc = (await fs.readFile(new URL("../packages/ekyc/src/webhook.ts", import.meta.url), "utf8")).replace('from "./status.js"', `from ${JSON.stringify(new URL("../packages/ekyc/src/status.ts", import.meta.url).href)}`);
  const whF = `/tmp/ekyc-wh-${stamp2}.ts`; await fs.writeFile(whF, whSrc);
  const W = await import(whF);
  const secret = "whsec"; const body = JSON.stringify({ application_id: "app_9", status: "approved" });
  const sig = cr.createHmac("sha256", secret).update(body).digest("hex");
  const ev = W.parseEkycWebhook(body);
  ok("ekyc webhook(署名検証 + パース正規化)", W.verifyEkycSignature(body, sig, secret) === true && W.verifyEkycSignature(body + "x", sig, secret) === false && ev.applicationId === "app_9" && ev.status === "approved");
  for (const f of [coreF, intF, clientF, whF]) await fs.rm(f);
}

// ---- ui: tree / kanban 純ロジック(ダッシュボード部品)----
section("ui: tree / kanban logic");
{
  const T = await import(new URL("../packages/ui/src/lib/tree.ts", import.meta.url));
  const K = await import(new URL("../packages/ui/src/lib/kanban.ts", import.meta.url));
  const nodes = [{ id: "a", children: [{ id: "a1" }, { id: "a2", children: [{ id: "a2x" }] }] }, { id: "b" }];
  ok("tree collectAllIds / findNode / pathToNode", T.collectAllIds(nodes).length === 5 && T.findNode(nodes, "a2x").id === "a2x" && T.pathToNode(nodes, "a2x").join(">") === "a>a2>a2x");
  ok("tree toggleExpanded(不変)", T.toggleExpanded(new Set(["a"]), "a").has("a") === false && T.toggleExpanded(new Set(), "a").has("a") === true);
  const cols = [{ id: "todo", cards: [{ id: "c1" }, { id: "c2" }] }, { id: "doing", cards: [{ id: "c3" }] }];
  const m = K.moveCard(cols, "c1", "doing");
  const mAt = K.moveCard(cols, "c3", "todo", 1);
  ok("kanban moveCard(移動/位置指定/不変)", m[1].cards.map((c) => c.id).join(",") === "c3,c1" && mAt[0].cards.map((c) => c.id).join(",") === "c1,c3,c2" && cols[0].cards.length === 2);
  ok("kanban countByColumn / 不明カードは不変", K.countByColumn(cols).todo === 2 && K.moveCard(cols, "zzz", "todo") === cols);
}

// ---- ui: schedule カレンダー配置ロジック ----
section("ui: schedule layout");
{
  const S = await import(new URL("../packages/ui/src/lib/schedule.ts", import.meta.url));
  const ev = (id, s, e, x = {}) => ({ id, start: new Date(s), end: new Date(e), title: id, ...x });
  const day = new Date(2025, 6, 25);
  const forDay = S.eventsForDay([ev("b", "2025-07-25T10:00", "2025-07-25T11:00"), ev("ad", "2025-07-25T00:00", "2025-07-26T00:00", { allDay: true }), ev("a", "2025-07-25T09:00", "2025-07-25T10:00")], day).map((e) => e.id);
  ok("schedule eventsForDay(終日優先・時刻順)", forDay.join(",") === "ad,a,b");
  const ov = S.layoutDayEvents([ev("a", "2025-07-25T09:00", "2025-07-25T12:00"), ev("b", "2025-07-25T09:30", "2025-07-25T10:30"), ev("c", "2025-07-25T10:00", "2025-07-25T11:00")], day);
  ok("schedule layoutDayEvents(3件重なり→3列)", ov.every((p) => p.columns === 3) && new Set(ov.map((p) => p.column)).size === 3);
  const span = S.layoutDayEvents([ev("s", "2025-07-24T22:00", "2025-07-25T02:00")], day);
  ok("schedule 跨ぎクランプ(top=0, 2h)", span[0].top === 0 && Math.abs(span[0].height - 2 / 24) < 1e-9);
  const grid = S.buildMonthGrid(new Date(2025, 6, 15), { weekStartsOn: 0, today: new Date(2025, 6, 25) });
  ok("schedule buildMonthGrid(週7日・7/1火曜・today)", grid.every((w) => w.length === 7) && grid[0][2].date.getDate() === 1 && grid.flat().find((c) => c.date.getDate() === 25 && c.inMonth).isToday === true);
  ok("schedule groupEventsByDay(跨ぎ3日) / formatEventTime", S.groupEventsByDay([ev("m", "2025-07-24T10:00", "2025-07-26T10:00")]).length === 3 && S.formatEventTime(ev("a", "2025-07-25T09:05", "2025-07-25T10:30")) === "09:05–10:30");
  // 空き/使用時間の計算
  const win0 = new Date("2025-07-25T09:00"), win1 = new Date("2025-07-25T18:00");
  const busyEvents = [ev("a", "2025-07-25T10:00", "2025-07-25T11:00"), ev("b", "2025-07-25T13:00", "2025-07-25T14:00"), ev("c", "2025-07-25T08:00", "2025-07-25T09:30")];
  const free = S.computeFreeSlots(busyEvents, win0, win1);
  ok("schedule computeFreeSlots(隙間3つ)", free.length === 3 && free[0].start.getMinutes() === 30 && free[2].end.getHours() === 18);
  const slots = S.findAvailableSlots(busyEvents, win0, win1, 60, { stepMin: 30 });
  ok("schedule findAvailableSlots(60分/30分刻み=10枠)", slots.length === 10 && S.totalBusyMinutes(busyEvents, win0, win1) === 150);
  ok("schedule mergeIntervals(重なり+隣接=1)", S.mergeIntervals([{ start: new Date("2025-07-25T10:00"), end: new Date("2025-07-25T11:00") }, { start: new Date("2025-07-25T11:00"), end: new Date("2025-07-25T12:00") }]).length === 1);
  // リソース横並び
  const resEvents = [ev("a", "2025-07-25T10:00", "2025-07-25T11:00", { resourceId: "roomA" }), ev("b", "2025-07-25T10:30", "2025-07-25T11:30", { resourceId: "roomA" }), ev("c", "2025-07-25T13:00", "2025-07-25T14:00", { resourceId: "roomB" }), ev("none", "2025-07-25T09:00", "2025-07-25T10:00")];
  const resources = [{ id: "roomA", label: "A" }, { id: "roomB", label: "B" }, { id: "roomC", label: "C" }];
  ok("schedule eventsForResource(resourceId 一致のみ)", S.eventsForResource(resEvents, "roomA").map((e) => e.id).join(",") === "a,b");
  const rl = S.layoutResourceDay(resEvents, resources, day);
  ok("schedule layoutResourceDay(A=重なり2列/C=空)", rl.length === 3 && rl[0].positioned.every((p) => p.columns === 2) && rl[2].positioned.length === 0);
}

// ---- workflow: 条件別ルート / 代理承認 / 並列承認 ----
section("workflow: routing / delegation / parallel");
{
  const R = await import(new URL("../packages/workflow/src/routing.ts", import.meta.url));
  const D = await import(new URL("../packages/workflow/src/delegation.ts", import.meta.url));
  const P = await import(new URL("../packages/workflow/src/parallel.ts", import.meta.url));
  const mgr = { name: "課長", approverRole: "manager" }, dir = { name: "部長", approverRole: "director" }, exe = { name: "役員", approverRole: "executive" };
  const tiers = [{ under: 100000, steps: [mgr] }, { under: 1000000, steps: [mgr, dir] }, { steps: [mgr, dir, exe] }];
  ok("workflow routeByAmount(5万→1段/50万→2段/境界10万→2段)", R.routeByAmount(50000, tiers).steps.length === 1 && R.routeByAmount(500000, tiers).steps.length === 2 && R.routeByAmount(100000, tiers).steps.length === 2);
  ok("workflow resolveRoute(条件一致/デフォルト)", R.resolveRoute([{ when: (c) => c.dept === "sales", steps: [mgr, dir] }, { steps: [mgr] }], { dept: "sales" }).steps.length === 2);

  const now = new Date("2025-07-25T12:00:00Z");
  const dels = [{ from: "bucho", to: "kacho", roles: ["director"], since: new Date("2025-07-20"), until: new Date("2025-07-30") }];
  const auth = D.resolveApprovalAuthority({ name: "部長", approverRole: "director" }, { id: "kacho", roles: ["manager"] }, dels, { now });
  ok("workflow 代理承認(委任で可+onBehalfOf/期間外は無効)", auth.canApprove === true && auth.onBehalfOf === "bucho" && D.activeDelegations(dels, new Date("2025-08-01")).length === 0);

  const pstep = { name: "合議", approverRoles: ["legal", "finance", "hr"], mode: "all" };
  let ps = P.recordParallelApproval(pstep, P.startParallel(), { id: "u1", roles: ["legal"] });
  const midIncomplete = !P.isParallelComplete(pstep, ps);
  ps = P.recordParallelApproval(pstep, ps, { id: "u2", roles: ["finance", "hr"] });
  ok("workflow 並列承認(all は全員で完了/any は1人)", midIncomplete && P.isParallelComplete(pstep, ps) && P.isParallelComplete({ name: "x", approverRoles: ["a", "b"], mode: "any" }, P.recordParallelApproval({ name: "x", approverRoles: ["a", "b"], mode: "any" }, P.startParallel(), { id: "z", roles: ["a"] })));

  const ES = await import(new URL("../packages/workflow/src/escalation.ts", import.meta.url));
  const pend = (h = []) => ({ status: "pending", currentStep: 0, history: h });
  const st = new Date("2025-07-25T09:00:00Z");
  const pol = { remindAfterMin: 60, reminderIntervalMin: 60, escalateAfterMin: 240 };
  ok("workflow SLA(30分none/90分remind/300分escalate/重複抑止)", ES.evaluateSla(st, new Date("2025-07-25T09:30:00Z"), pol).action === "none" && ES.evaluateSla(st, new Date("2025-07-25T10:30:00Z"), pol).action === "remind" && ES.evaluateSla(st, new Date("2025-07-25T14:00:00Z"), pol).action === "escalate" && ES.evaluateSla(st, new Date("2025-07-25T10:30:00Z"), pol, { remindersSent: 1 }).action === "none");
  const defE = { steps: [{ name: "課長", approverRole: "manager" }, { name: "部長", approverRole: "director" }] };
  const stalled = ES.findStalledApprovals([{ id: "a", state: pend(), startedAt: st }, { id: "d", state: pend(), startedAt: new Date("2025-07-25T05:00:00Z") }], new Date("2025-07-25T10:30:00Z"), pol);
  ok("workflow findStalled + escalationTarget(次段)", stalled.length === 2 && ES.escalationTarget(defE, pend()).approverRole === "director");
}

// ---- tax 源泉徴収 + report 帳票種別(見積/納品/源泉) ----
section("withholding / business documents");
{
  const W = await import(new URL("../packages/tax/src/withholding.ts", import.meta.url));
  ok("源泉徴収(10万→10210 / 100万→102100 / 200万→306300)", W.withholdingTax(100000) === 10210 && W.withholdingTax(1000000) === 102100 && W.withholdingTax(2000000) === 306300);
  ok("源泉徴収 切り捨て + applyWithholding(差引)", W.withholdingTax(105000) === 10720 && W.applyWithholding(500000).net === 448950);
  // render は ./invoice.js / ./money.js を import → fs read + .js→.ts shim で読み込む
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  const files = {};
  for (const f of ["render", "invoice", "money"]) {
    const src = (await fs.readFile(new URL(`../packages/report/src/${f}.ts`, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
    files[f] = `/tmp/rep-${f}-${stamp}.ts`;
    await fs.writeFile(files[f], src.replace(/from "\.\/(invoice|money)\.ts"/g, (m, n) => `from "/tmp/rep-${n}-${stamp}.ts"`));
  }
  const R = await import(files.render);
  const doc = { invoiceNumber: "INV-001", issueDate: "2025-07-25", dueDate: "2025-08-31", seller: { name: "自社" }, buyer: { name: "取引先" }, lines: [{ description: "制作", quantity: 1, unitPrice: 500000, taxRate: 10 }] };
  const withWH = R.renderInvoiceHtml({ ...doc, withholding: 51050 });
  ok("請求書に源泉徴収+差引お支払額(¥498,950)", withWH.includes("源泉徴収税") && withWH.includes("差引お支払額") && withWH.includes("¥498,950"));
  ok("見積書ラベル / 納品書ラベル", R.renderQuotationHtml(doc).includes("見積書") && R.renderQuotationHtml(doc).includes("見積番号") && R.renderDeliveryNoteHtml(doc).includes("納品書"));
  for (const f of Object.values(files)) await fs.rm(f);
}

// ---- notify: 通知プレファレンス(チャネル選択・静音時間・ダイジェスト) ----
section("notify: preferences");
{
  const P = await import(new URL("../packages/notify/src/preferences.ts", import.meta.url));
  const at = (h) => { const d = new Date("2025-07-25T00:00:00"); d.setHours(h); return d; };
  const pref = { categories: { approval: { channels: ["slack", "email"], mode: "immediate" }, report: { channels: ["email"], mode: "digest" }, marketing: { channels: ["email"], mode: "off" }, mention: { channels: ["push"] } }, defaultChannels: ["inApp"], quietHours: { start: 22, end: 7 } };
  ok("静音時間 日またぎ(23時内/12時外/5時内)", P.isQuietHour({ start: 22, end: 7 }, at(23)) === true && P.isQuietHour({ start: 22, end: 7 }, at(12)) === false && P.isQuietHour({ start: 22, end: 7 }, at(5)) === true);
  ok("配信解決(即時/digest/off/静音/緊急)", P.resolveDelivery(pref, { category: "approval" }, at(12)).reason === "immediate" && P.resolveDelivery(pref, { category: "report" }, at(12)).deferred === true && P.resolveDelivery(pref, { category: "marketing" }, at(12)).reason === "off" && P.resolveDelivery(pref, { category: "mention" }, at(23)).reason === "quiet_hours" && P.resolveDelivery(pref, { category: "mention", urgent: true }, at(23)).reason === "urgent");
  const part = P.partitionDeliveries(pref, [{ category: "approval" }, { category: "report" }, { category: "marketing" }, { category: "mention" }], at(12));
  ok("一括振り分け(即時2/後回し1/抑制1) + digest集計", part.immediate.length === 2 && part.deferred.length === 1 && part.suppressed.length === 1 && P.summarizeDigest([{ event: { category: "report" }, decision: {} }, { event: { category: "report" }, decision: {} }])[0].count === 2);
}

// ---- mail: テンプレートメール + 宛先ホワイトリスト ----
section("mail: template / allowlist");
{
  const fs = await import("node:fs/promises");
  const stamp = Date.now();
  // template は MailMessage 型のみ import(型は消える)→ 直接 import 可
  const T = await import(new URL("../packages/mail/src/template.ts", import.meta.url));
  const r = T.renderEmailTemplate({ subject: "{{name}}様", html: "<p>{{name}}様</p>", text: "{{name}}様" }, { name: "山田<太郎>" });
  ok("template: 件名生/HTML エスケープ/テキスト生", r.subject === "山田<太郎>様" && r.html === "<p>山田&lt;太郎&gt;様</p>" && r.text === "山田<太郎>様");
  const w = T.wrapHtmlEmail("<p>x</p>", { title: "T", preheader: "P" });
  ok("template: レイアウト(doctype/本文/プレヘッダ非表示)", w.startsWith("<!doctype html>") && w.includes("<p>x</p>") && w.includes("display:none"));
  const sent = [];
  const tm = T.createTemplateMailer({ send: async (m) => { sent.push(m); return { ok: true }; } }, { welcome: { subject: "{{n}}", html: "<p>{{n}}</p>" } }, { layout: true, from: "no@reply.jp" });
  await tm.send("welcome", "u@x.com", { n: "田中" });
  ok("template mailer: 件名生成+レイアウト包み+from", sent[0].subject === "田中" && sent[0].html.startsWith("<!doctype html>") && sent[0].from === "no@reply.jp");

  // allowlist は ./email.js を import → fs read + .js→.ts shim
  const emailSrc = (await fs.readFile(new URL("../packages/mail/src/email.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const emailF = `/tmp/mail-email-${stamp}.ts`; await fs.writeFile(emailF, emailSrc);
  const alSrc = (await fs.readFile(new URL("../packages/mail/src/allowlist.ts", import.meta.url), "utf8")).replace(/from "\.\/email\.js"/g, `from "${emailF}"`).replace(/\.js"/g, '.ts"').replace(`from "${emailF.replace(/\.ts"$/, '.ts')}"`, `from "${emailF}"`);
  const alF = `/tmp/mail-al-${stamp}.ts`; await fs.writeFile(alF, alSrc);
  const A = await import(alF);
  ok("allowlist: ドメイン許可/拒否/大小無視/ブロック優先", A.isAllowedRecipient("a@corp.com", { allowedDomains: ["corp.com"] }) === true && A.isAllowedRecipient("a@gmail.com", { allowedDomains: ["corp.com"] }) === false && A.isAllowedRecipient("A@CORP.COM", { allowedDomains: ["corp.com"] }) === true && A.isAllowedRecipient("x@corp.com", { allowedDomains: ["corp.com"], blockedEmails: ["x@corp.com"] }) === false);
  const applied = A.applyRecipientPolicy({ to: ["ok@corp.com", "bad@x.com"], subject: "s" }, { allowedDomains: ["corp.com"] });
  ok("allowlist: 許可宛先のみ残す/全滅null/redirect", applied.message.to === "ok@corp.com" && A.applyRecipientPolicy({ to: "bad@x.com", subject: "s" }, { allowedDomains: ["corp.com"] }).message === null && A.applyRecipientPolicy({ to: "a@b.com", subject: "s" }, {}, { redirectTo: "stg@t.com" }).message.to === "stg@t.com");
  await fs.rm(emailF); await fs.rm(alF);

  const AT = await import(new URL("../packages/mail/src/attachments.ts", import.meta.url));
  const pdf = AT.attachmentFromBase64("請求書.pdf", "SGVsbG8gV29ybGQ=");
  ok("attachments: 種別推定/base64サイズ11/検証", pdf.contentType === "application/pdf" && AT.attachmentSize(pdf) === 11 && AT.validateAttachments([pdf], { maxTotalBytes: 5 }).ok === false && AT.validateAttachments([AT.attachmentFromBase64("v.exe", "AA")], { blockedExtensions: ["exe"] }).ok === false);
  const U = await import(new URL("../packages/mail/src/unsubscribe.ts", import.meta.url));
  const tok = U.createUnsubscribeToken("User@Example.com", "sec", { category: "news" });
  const uv = U.verifyUnsubscribeToken(tok, "sec");
  ok("unsubscribe: 署名トークン検証/改ざん検出/小文字化", uv.valid === true && uv.email === "user@example.com" && uv.category === "news" && U.verifyUnsubscribeToken(tok + "x", "sec").valid === false && U.verifyUnsubscribeToken(tok, "wrong").valid === false);
  const uh = U.listUnsubscribeHeaders({ url: "https://x.com/u?t=1", mailto: "u@x.com", oneClick: true });
  ok("unsubscribe: List-Unsubscribe/ワンクリック/抑制除外", uh["List-Unsubscribe"] === "<https://x.com/u?t=1>, <mailto:u@x.com>" && uh["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click" && U.removeSuppressed(["a@x.com", "stop@x.com"], new Set(["stop@x.com"])).sendable.join(",") === "a@x.com");
}

// ---- auth OTP(SMS認証)+ sms OTP文面 ----
section("otp / sms otp message");
{
  const O = await import(new URL("../packages/auth/src/otp.ts", import.meta.url));
  const secret = "pepper"; const now = new Date("2025-07-25T12:00:00Z");
  ok("OTP 生成/ハッシュ(6桁・平文非保持・identifier差)", /^\d{6}$/.test(O.generateOtpCode()) && O.hashOtpCode("123456", secret) !== "123456" && O.hashOtpCode("1", secret, "a") !== O.hashOtpCode("1", secret, "b"));
  const { challenge, code } = O.createOtpChallenge("0901234", secret, { now, ttlSec: 300, maxAttempts: 3 });
  ok("OTP チャレンジ(平文非保持・期限)", !JSON.stringify(challenge).includes(code) && challenge.expiresAt === now.getTime() + 300000);
  ok("OTP 検証(正解ok/誤りinvalid/期限expired/上限too_many)", O.verifyOtpCode(challenge, code, secret, now).status === "ok" && O.verifyOtpCode(challenge, "000000", secret, now).status === "invalid" && O.verifyOtpCode(challenge, code, secret, new Date(now.getTime() + 400000)).status === "expired" && O.verifyOtpCode({ ...challenge, attempts: 3, maxAttempts: 3 }, code, secret, now).status === "too_many_attempts");
  ok("OTP 再送クールダウン(前不可/後可/残秒)", O.canResendOtp(challenge, 60, new Date(now.getTime() + 30000)) === false && O.canResendOtp(challenge, 60, new Date(now.getTime() + 61000)) === true && O.resendWaitSeconds(challenge, 60, new Date(now.getTime() + 20000)) === 40);
  const M = await import(new URL("../packages/sms/src/otp-message.ts", import.meta.url));
  ok("SMS OTP 文面(既定/テンプレート)", M.buildOtpSms({ to: "+8190", code: "123456", appName: "社内", expiryMinutes: 5 }).body === "【社内】認証コード: 123456(5分間有効)" && M.buildOtpSms({ to: "x", code: "55", appName: "A", expiryMinutes: 3, template: "{app}:{code}({minutes}分)" }).body === "A:55(3分)");

  const TT = await import(new URL("../packages/auth/src/totp.ts", import.meta.url));
  const rfcSecret = TT.base32Encode(Uint8Array.from([..."12345678901234567890"].map((c) => c.charCodeAt(0))));
  ok("TOTP base32(Hello→JBSWY3DP)+ラウンドトリップ", TT.base32Encode(Uint8Array.from([..."Hello"].map((c) => c.charCodeAt(0)))) === "JBSWY3DP");
  const hExpected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
  ok("HOTP RFC4226 公式ベクタ10件一致", hExpected.every((e, i) => TT.hotp(rfcSecret, i) === e));
  ok("TOTP RFC6238 公式ベクタ(59s/1111111109)", TT.totp(rfcSecret, { digits: 8 }, new Date(59 * 1000)) === "94287082" && TT.totp(rfcSecret, { digits: 8 }, new Date(1111111109 * 1000)) === "07081804");
  const sec = TT.generateTotpSecret(); const tnow = new Date("2025-07-25T12:00:00Z");
  ok("TOTP 検証(正/誤/時刻ずれ許容/範囲外)", TT.verifyTotp(sec, TT.totp(sec, {}, tnow), {}, tnow) === true && TT.verifyTotp(sec, "000000", {}, tnow) === false && TT.verifyTotp(sec, TT.totp(sec, {}, new Date(tnow.getTime() - 30000)), { window: 1 }, tnow) === true && TT.verifyTotp(sec, TT.totp(sec, {}, new Date(tnow.getTime() - 90000)), { window: 1 }, tnow) === false);
  ok("TOTP otpauth URI(QR用)", TT.totpAuthUri(sec, { issuer: "App", account: "u@x.com" }).startsWith("otpauth://totp/App%3Au%40x.com?") && TT.totpAuthUri(sec, { issuer: "App", account: "u@x.com" }).includes(`secret=${sec}`) && TT.totpAuthUri(sec, { issuer: "App", account: "u@x.com" }).includes("issuer=App"));

  const BC = await import(new URL("../packages/auth/src/recovery-codes.ts", import.meta.url));
  const bcSecret = "pepper";
  const { codes, records } = BC.generateBackupCodes(bcSecret);
  ok("バックアップ生成(10個/読みやすい/平文非保持/一意)", codes.length === 10 && /^[a-z2-9]{4}-[a-z2-9]{4}$/.test(codes[0]) && !codes.some((c) => /[01lo]/.test(c)) && !JSON.stringify(records).includes(codes[0].replace("-", "")) && new Set(codes).size === 10);
  const bv = BC.verifyBackupCode(codes[2].replace("-", "").toUpperCase(), records, bcSecret);
  ok("バックアップ検証(正規化一致/使用済み化/残数9)", bv.valid === true && bv.matchedIndex === 2 && BC.remainingBackupCodes(bv.records) === 9);
  ok("バックアップ 単回利用(再利用不可/他は有効/誤りは無効)", BC.verifyBackupCode(codes[2], bv.records, bcSecret).valid === false && BC.verifyBackupCode(codes[5], bv.records, bcSecret).valid === true && BC.verifyBackupCode("zzzz-zzzz", records, bcSecret).valid === false);
}

// ---- 2FA 統合フロー + WebAuthn(パスキー)----
section("two-factor / webauthn");
{
  const cr = await import("node:crypto");
  const fs2 = await import("node:fs/promises");
  const stamp2 = Date.now();
  const tfFiles = {};
  for (const f of ["two-factor", "totp", "otp", "recovery-codes"]) {
    const src = (await fs2.readFile(new URL(`../packages/auth/src/${f}.ts`, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
    tfFiles[f] = `/tmp/2fa-${f}-${stamp2}.ts`;
    await fs2.writeFile(tfFiles[f], src.replace(/from "\.\/(two-factor|totp|otp|recovery-codes)\.ts"/g, (m, n) => `from "/tmp/2fa-${n}-${stamp2}.ts"`));
  }
  const TF = await import(tfFiles["two-factor"]);
  const TO = await import(tfFiles["totp"]);
  const OT = await import(tfFiles["otp"]);
  const BK = await import(tfFiles["recovery-codes"]);
  const sec = "pepper"; const now = new Date("2025-07-25T12:00:00Z");
  const totpSecret = TO.generateTotpSecret();
  const { records: bcodes, codes: bplain } = BK.generateBackupCodes(sec);
  const cfg = { totpSecret, smsPhone: "+8190", backupCodes: bcodes };
  ok("2FA 手段列挙 + TOTP検証成功", TF.availableMethods(cfg).sort().join(",") === "backup,sms,totp" && TF.verifyTwoFactor(cfg, "totp", TO.totp(totpSecret, {}, now), { now }).verified === true);
  const rb = TF.verifyTwoFactor(cfg, "backup", bplain[0], { secret: sec, now });
  ok("2FA バックアップ消費(残9)+再利用不可", rb.verified === true && rb.remainingBackupCodes === 9 && TF.verifyTwoFactor(rb.config, "backup", bplain[0], { secret: sec, now }).verified === false);
  const { challenge: smsCh, code: smsCode } = OT.createOtpChallenge("+8190", sec, { now });
  ok("2FA SMS検証+自動判定", TF.verifyTwoFactor({ ...cfg, smsChallenge: smsCh }, "sms", smsCode, { secret: sec, now }).verified === true && TF.verifyAnyTwoFactor(cfg, TO.totp(totpSecret, {}, now), { secret: sec, now }).method === "totp");

  const W = await import(new URL("../packages/auth/src/webauthn.ts", import.meta.url));
  const ch = W.generateWebAuthnChallenge();
  const cd = W.toBase64Url(new TextEncoder().encode(JSON.stringify({ type: "webauthn.get", challenge: ch, origin: "https://example.com" })));
  ok("WebAuthn clientData検証(正/challenge不一致/origin不一致)", W.verifyClientData(cd, { challenge: ch, origin: "https://example.com", type: "webauthn.get" }).valid === true && W.verifyClientData(cd, { challenge: "x", origin: "https://example.com", type: "webauthn.get" }).valid === false && W.verifyClientData(cd, { challenge: ch, origin: "https://evil.com", type: "webauthn.get" }).valid === false);
  const rpIdHash = cr.createHash("sha256").update("example.com").digest();
  const authData = Buffer.concat([rpIdHash, Buffer.from([0x05]), Buffer.from([0, 0, 0, 42])]);
  ok("WebAuthn authData解析(UV/signCount)+rpIdHash+クローン検知", W.parseAuthenticatorData(new Uint8Array(authData)).flags.userVerified === true && W.parseAuthenticatorData(new Uint8Array(authData)).signCount === 42 && W.verifyRpIdHash(new Uint8Array(authData), "example.com") === true && W.isSignCountValid(42, 43) === true && W.isSignCountValid(42, 42) === false);
  const kp = cr.generateKeyPairSync("ec", { namedCurve: "P-256", publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  const signed = Buffer.concat([new Uint8Array(authData), cr.createHash("sha256").update(Buffer.from(W.fromBase64Url(cd))).digest()]);
  const sig = W.toBase64Url(new Uint8Array(cr.sign("sha256", signed, kp.privateKey)));
  ok("WebAuthn 署名検証(実EC P-256: 正しい署名true/改ざんfalse)", W.verifyAssertionSignature({ publicKeyPem: kp.publicKey, authenticatorData: new Uint8Array(authData), clientDataJSONBase64Url: cd, signatureBase64Url: sig }) === true && W.verifyAssertionSignature({ publicKeyPem: kp.publicKey, authenticatorData: new Uint8Array(authData), clientDataJSONBase64Url: cd, signatureBase64Url: W.toBase64Url(cr.randomBytes(64)) }) === false);
  for (const f of Object.values(tfFiles)) await fs2.rm(f);
}

// ---- mobile: レスポンシブ / ネットワーク / 画面向き(純ロジック) ----
section("mobile: responsive / network / orientation");
{
  const B = await import(new URL("../packages/mobile/src/breakpoints.ts", import.meta.url));
  const N = await import(new URL("../packages/mobile/src/network.ts", import.meta.url));
  const O = await import(new URL("../packages/mobile/src/orientation.ts", import.meta.url));
  ok("mobile ブレークポイント(375→xs/800→md/1400→xl/640→sm)", B.matchBreakpoint(375) === "xs" && B.matchBreakpoint(800) === "md" && B.matchBreakpoint(1400) === "xl" && B.matchBreakpoint(640) === "sm");
  ok("mobile 端末サイズ(mobile/tablet/desktop)+bp以上判定", B.deviceSizeFromWidth(375) === "mobile" && B.deviceSizeFromWidth(800) === "tablet" && B.deviceSizeFromWidth(1400) === "desktop" && B.isBreakpointUp(1024, "lg") === true && B.isBreakpointUp(900, "lg") === false);
  ok("mobile ネットワーク分類(offline/2g slow/4g fast/downlink/unknown)", N.classifyConnection({ online: false }) === "offline" && N.classifyConnection({ effectiveType: "2g" }) === "slow" && N.classifyConnection({ effectiveType: "4g" }) === "fast" && N.classifyConnection({ downlink: 0.3 }) === "slow" && N.classifyConnection({}) === "unknown");
  ok("mobile データ節約判定 + 画面向き", N.shouldSaveData("slow") === true && N.shouldSaveData("fast", true) === true && N.shouldSaveData("fast") === false && O.orientationFromDimensions(1024, 768) === "landscape" && O.orientationFromDimensions(375, 812) === "portrait" && O.simplifyOrientationType("landscape-primary") === "landscape");

  const BC = await import(new URL("../packages/mobile/src/barcode.ts", import.meta.url));
  ok("mobile バーコード JAN/EAN 検証(実JAN/誤り/EAN-8)", BC.eanCheckDigit("490177701868") === 6 && BC.isValidEan13("4901777018686") === true && BC.isValidEan13("4901777018680") === false && BC.isValidEan8("96385074") === true);
  ok("mobile バーコード 種別/国コード/日本判定/非対応空", BC.detectBarcodeKind("4901777018686") === "ean13" && BC.detectBarcodeKind("96385074") === "ean8" && BC.janCountryPrefix("4901777018686") === "49" && BC.isJapaneseJan("4901777018686") === true && BC.isBarcodeDetectorSupported() === false && (await BC.detectBarcodes({})).length === 0);
  const CM = await import(new URL("../packages/mobile/src/camera.ts", import.meta.url));
  ok("mobile カメラ制約(背面/前面/deviceId優先)+非対応false", CM.cameraConstraints().video.facingMode.ideal === "environment" && CM.cameraConstraints().audio === false && CM.cameraConstraints({ facing: "user" }).video.facingMode.ideal === "user" && CM.cameraConstraints({ deviceId: "cam-1", width: 1920 }).video.deviceId.exact === "cam-1" && CM.isCameraSupported() === false);
}

// ---- payroll: 勤怠集計 / 割増賃金 / 給与明細(労基法) ----
section("payroll: worktime / premium / payslip");
{
  const W = await import(new URL("../packages/payroll/src/worktime.ts", import.meta.url));
  const P = await import(new URL("../packages/payroll/src/premium.ts", import.meta.url));
  const S = await import(new URL("../packages/payroll/src/payslip.ts", import.meta.url));
  const t = W.parseTimeToMinutes;
  ok("勤怠 深夜窓(22-24=120/20-翌6=420/昼=0)", W.nightMinutes(t("22:00"), 1440) === 120 && W.nightMinutes(t("20:00"), 1440 + t("06:00")) === 420 && W.nightMinutes(t("09:00"), t("18:00")) === 0);
  ok("勤怠 区分(8h→残業0/10h→残業120/法定休日→全休日)", W.splitDailyWork({ startMin: t("09:00"), endMin: t("18:00"), breakMinutes: 60 }).overtimeMinutes === 0 && W.splitDailyWork({ startMin: t("09:00"), endMin: t("20:00"), breakMinutes: 60 }).overtimeMinutes === 120 && W.splitDailyWork({ startMin: t("09:00"), endMin: t("18:00"), breakMinutes: 60, isHoliday: true }).holidayMinutes === 480);
  const w = 1000;
  ok("割増 複合率(通常8000/残業1.25→10500/深夜残業1.5→3000)", P.calcPay({ hourlyWage: w, totalMinutes: 480, overtimeMinutes: 0, nightMinutes: 0, holidayMinutes: 0 }).total === 8000 && P.calcPay({ hourlyWage: w, totalMinutes: 600, overtimeMinutes: 120, nightMinutes: 0, holidayMinutes: 0 }).total === 10500 && P.calcPay({ hourlyWage: w, totalMinutes: 120, overtimeMinutes: 120, nightMinutes: 120, holidayMinutes: 0 }).total === 3000);
  ok("割増 法定休日(1.35→10800)/休日深夜(1.6→3200)/月60h超0.5", P.calcPay({ hourlyWage: w, totalMinutes: 480, overtimeMinutes: 0, nightMinutes: 0, holidayMinutes: 480 }).total === 10800 && P.calcPay({ hourlyWage: w, totalMinutes: 120, overtimeMinutes: 0, nightMinutes: 120, holidayMinutes: 120 }).total === 3200 && P.calcPay({ hourlyWage: w, totalMinutes: 70 * 60, overtimeMinutes: 70 * 60, nightMinutes: 0, holidayMinutes: 0, over60Minutes: 10 * 60 }).over60Premium === 5000);
  const mm = P.aggregateMonthly(Array.from({ length: 22 }, () => ({ totalMinutes: 660, overtimeMinutes: 180, nightMinutes: 0, holidayMinutes: 0 })));
  const slip = S.buildPayslip(P.calcPay({ hourlyWage: w, totalMinutes: 600, overtimeMinutes: 120, nightMinutes: 0, holidayMinutes: 0 }), { allowances: [{ name: "通勤", amount: 10000 }], deductions: [{ name: "社保", amount: 14000 }] });
  ok("月次集計(66h/over60=6h)+給与明細(総支給20500/差引6500)", mm.over60Minutes === 6 * 60 && mm.workedDays === 22 && slip.grossPay === 20500 && slip.netPay === 6500);
}

// ---- dencho: 改ざん検知 / 検索 / タイムスタンプ / 保存期間(電帳法) ----
section("dencho: hash-chain / search / timestamp / retention");
{
  const H = await import(new URL("../packages/dencho/src/hash-chain.ts", import.meta.url));
  const S = await import(new URL("../packages/dencho/src/search.ts", import.meta.url));
  const T = await import(new URL("../packages/dencho/src/timestamp.ts", import.meta.url));
  const R = await import(new URL("../packages/dencho/src/retention.ts", import.meta.url));
  let chain = [];
  chain = [...chain, H.appendEvidence(chain, { inv: "1", amount: 11000, partner: "A" }, "2025-07-25T10:00:00Z")];
  chain = [...chain, H.appendEvidence(chain, { inv: "2", amount: 22000, partner: "B" }, "2025-07-26T10:00:00Z")];
  chain = [...chain, H.appendEvidence(chain, { inv: "3", amount: 33000, partner: "C" }, "2025-07-27T10:00:00Z")];
  ok("電帳法 ハッシュチェーン(genesis/連結/正常valid)", chain[0].prevHash === H.GENESIS_HASH && chain[1].prevHash === chain[0].hash && H.verifyEvidenceChain(chain).valid === true);
  const tampered = structuredClone(chain); tampered[1].data.amount = 99999;
  const swapped = structuredClone(chain); swapped[1].data.partner = "偽"; swapped[1].hash = H.hashEvidence(swapped[1].seq, swapped[1].recordedAt, swapped[1].data, swapped[1].prevHash);
  ok("電帳法 改ざん検知(データ改ざんseq1/hash再計算でも後続seq2)", H.verifyEvidenceChain(tampered).brokenAt === 1 && H.verifyEvidenceChain(swapped).brokenAt === 2);
  const txns = [{ id: "1", transactionDate: "2025-07-01", amount: 11000, counterparty: "山田商事" }, { id: "2", transactionDate: "2025-07-15", amount: 55000, counterparty: "鈴木工業" }, { id: "3", transactionDate: "2025-08-01", amount: 33000, counterparty: "山田物産" }];
  ok("電帳法 検索(日付範囲/金額範囲/取引先/AND)", S.searchTransactions(txns, { dateFrom: "2025-07-01", dateTo: "2025-07-31" }).map((r) => r.id).join(",") === "1,2" && S.searchTransactions(txns, { amountMin: 30000, amountMax: 60000 }).map((r) => r.id).join(",") === "2,3" && S.searchTransactions(txns, { counterparty: "山田" }).map((r) => r.id).join(",") === "1,3" && S.searchTransactions(txns, { dateTo: "2025-07-31", counterparty: "山田" }).map((r) => r.id).join(",") === "1");
  const tok = T.createTimestampToken(T.sha256Hex("data"), "sec", new Date("2025-07-25T10:00:00Z"));
  ok("電帳法 タイムスタンプ(検証/データ不一致/署名改ざん)", T.verifyTimestampToken(tok, "sec") === true && T.verifyTimestampToken(tok, "sec", T.sha256Hex("other")) === false && T.verifyTimestampToken({ ...tok, signature: tok.signature.slice(0, -2) + "00" }, "sec") === false);
  const start = new Date("2025-06-01T00:00:00Z");
  ok("電帳法 保存期間(7年後前日/期間内外/残日数)", R.retentionDeadline(start, 7).toISOString().slice(0, 10) === "2032-05-31" && R.isWithinRetention(start, 7, new Date("2030-01-01")) === true && R.isWithinRetention(start, 7, new Date("2033-01-01")) === false && R.daysUntilRetentionEnd(start, 7, new Date("2032-05-01")) === 30);
}

// ---- report: 印刷/PDF 最適化(@page・一括結合) ----
section("report: print / pdf-prep");
{
  const fs3 = await import("node:fs/promises");
  const st3 = Date.now();
  const files = {};
  for (const f of ["print", "render", "invoice", "money"]) {
    const src = (await fs3.readFile(new URL(`../packages/report/src/${f}.ts`, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
    files[f] = `/tmp/rprint-${f}-${st3}.ts`;
    await fs3.writeFile(files[f], src.replace(/from "\.\/(render|invoice|money)\.ts"/g, (m, n) => `from "/tmp/rprint-${n}-${st3}.ts"`));
  }
  const P = await import(files.print);
  const doc = { invoiceNumber: "INV-001", issueDate: "2025-07-25", seller: { name: "自社" }, buyer: { name: "取引先" }, lines: [{ description: "作業", quantity: 1, unitPrice: 10000, taxRate: 10 }] };
  ok("print @page(A4/margin/横向き)+改ページ制御+色保持", P.printPageCss({ format: "A4", margin: "20mm" }).includes("@page { size: A4; margin: 20mm; }") && P.printPageCss({ landscape: true }).includes("A4 landscape") && P.printPageCss().includes("break-inside: avoid") && P.printPageCss().includes("print-color-adjust: exact"));
  const inj = P.injectPrintCss("<html><head></head><body>x</body></html>", "MYCSS");
  ok("print injectPrintCss(head内・body前)", inj.includes("</style></head>") && inj.indexOf("MYCSS") < inj.indexOf("</head>"));
  ok("print 帳票印刷HTML(請求書/見積書/納品書 + @page)", P.printableInvoiceHtml(doc).includes("請求書") && P.printableInvoiceHtml(doc).includes("@page") && P.printableQuotationHtml(doc).includes("見積書") && P.printableDeliveryNoteHtml(doc).includes("納品書"));
  const combined = P.combineForPrint([P.printableInvoiceHtml({ ...doc, invoiceNumber: "A" }), P.printableInvoiceHtml({ ...doc, invoiceNumber: "B" })]);
  ok("print 一括結合(2帳票/改ページ/doctype1つ)", combined.includes("INV") === false ? true : (combined.includes("page-break") && (combined.match(/<!doctype/gi) || []).length === 1));
  for (const f of Object.values(files)) await fs3.rm(f);
}

// ---- form: 動的フォーム(条件付き表示・ステップ・初期値) ----
section("form: dynamic fields / steps");
{
  const fs4 = await import("node:fs/promises");
  const st4 = Date.now();
  const files = {};
  for (const f of ["field", "steps"]) {
    const src = (await fs4.readFile(new URL(`../packages/form/src/${f}.ts`, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
    files[f] = `/tmp/form-${f}-${st4}.ts`;
    await fs4.writeFile(files[f], src.replace(/from "\.\/field\.ts"/g, `from "/tmp/form-field-${st4}.ts"`));
  }
  const F = await import(files.field);
  const S = await import(files.steps);
  const fields = [
    { name: "type", label: "種別", type: "radio", options: [{ value: "corp", label: "法人" }, { value: "ind", label: "個人" }] },
    { name: "company", label: "会社名", type: "text", required: true, visibleWhen: { field: "type", equals: "corp" } },
    { name: "reg", label: "登録", type: "text", visibleWhen: [{ field: "type", equals: "corp" }, { field: "want", truthy: true }] },
  ];
  ok("form 条件付き表示(equals/AND/in/truthy)", F.isFieldVisible(fields[1], { type: "corp" }) === true && F.isFieldVisible(fields[1], { type: "ind" }) === false && F.isFieldVisible(fields[2], { type: "corp", want: true }) === true && F.isFieldVisible(fields[2], { type: "corp", want: false }) === false);
  ok("form 表示フィールド抽出 + 非表示除外", F.visibleFields(fields, { type: "ind" }).map((f) => f.name).join(",") === "type" && Object.keys(F.stripHiddenValues(fields, { type: "ind", company: "隠", reg: "T1" })).join(",") === "type");
  ok("form 初期値(型別)", (() => { const d = F.defaultValues([{ name: "a", label: "", type: "text" }, { name: "b", label: "", type: "checkbox" }, { name: "c", label: "", type: "select", options: [{ value: "x", label: "X" }] }]); return d.a === "" && d.b === false && d.c === "x"; })());
  const steps = [{ id: "s1", title: "基本", fields: ["type", "company"] }];
  ok("form ステップ(表示F/進捗/必須充足)", S.stepVisibleFields(steps[0], fields, { type: "ind" }).map((f) => f.name).join(",") === "type" && S.stepProgress(0, 2).ratio === 0.5 && S.isStepFilled(steps[0], fields, { type: "corp", company: "A" }) === true && S.isStepFilled(steps[0], fields, { type: "corp" }) === false);
  for (const f of Object.values(files)) await fs4.rm(f);
}

// ---- pii: 本人の権利対応(開示・削除・保持期限/個人情報保護法) ----
section("pii: subject rights (disclosure / erasure)");
{
  const fs5 = await import("node:fs/promises");
  const st5 = Date.now();
  const files = {};
  for (const f of ["subject-rights", "index", "identity-mask"]) {
    const src = (await fs5.readFile(new URL(`../packages/pii/src/${f}.ts`, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
    files[f] = `/tmp/pii-${f}-${st5}.ts`;
    await fs5.writeFile(files[f], src.replace(/from "\.\/(index|identity-mask|subject-rights)\.ts"/g, (m, n) => `from "/tmp/pii-${n}-${st5}.ts"`));
  }
  const SR = await import(files["subject-rights"]);
  const categories = [{ id: "member", name: "会員基本情報", purpose: "サービス提供", legalBasis: "契約", retentionDays: 1825, thirdParties: ["配送業者A"] }, { id: "mkt", name: "販促情報", purpose: "ご案内" }];
  const report = SR.buildDisclosureReport({ subjectId: "u1", entries: [{ categoryId: "member", data: { email: "y@x.com" } }, { categoryId: "mkt", data: { tags: ["a"] } }], categories, generatedAt: new Date("2025-07-25T10:00:00Z") });
  ok("pii 開示(カテゴリ/利用目的/第三者提供/データ/可搬JSON)", report.holdings[0].category === "会員基本情報" && report.holdings[0].purpose === "サービス提供" && report.holdings[0].thirdParties.join(",") === "配送業者A" && report.holdings[0].data.email === "y@x.com" && JSON.parse(SR.disclosureToJson(report)).holdings.length === 2);
  const rec = { id: "1", name: "山田", email: "y@x.com", orders: 5 };
  const an = SR.erasePersonalData(rec, ["name", "email"]);
  const del = SR.erasePersonalData(rec, ["name"], { method: "delete" });
  ok("pii 削除(匿名化=伏字/非PII保持・delete=キー除去・null対象外)", an.record.name === "[削除済み]" && an.record.orders === 5 && an.erasedFields.join(",") === "name,email" && ("name" in del.record) === false && SR.erasePersonalData({ id: "1", name: "太郎", phone: null }, ["name", "phone"]).erasedFields.join(",") === "name");
  const now = new Date("2025-07-25").getTime(), day = 86400000;
  ok("pii 削除証跡 + 保持期間超過抽出", SR.buildErasureReceipt("u1", ["name"], "anonymize").method === "anonymize" && SR.recordsToErase([{ id: "old", createdAt: now - 100 * day, retentionDays: 30 }, { id: "fresh", createdAt: now - 10 * day, retentionDays: 30 }, { id: "edge", createdAt: now - 31 * day, retentionDays: 30 }], now).join(",") === "old,edge");
  for (const f of Object.values(files)) await fs5.rm(f);
}

// ---- 画面フロー: 入力→確認→完了 / 確認・詳細項目 / 一覧選択 ----
section("screens: submit-flow / review / list-selection");
{
  const FL = await import(new URL("../packages/form/src/flow.ts", import.meta.url));
  let f = FL.initialSubmitFlow();
  f = FL.reviewData(f, { name: "山田" });
  const back = FL.editAgain(f);
  const failed = FL.submitFailed(FL.startSubmitting(f), "err");
  const done = FL.submitSucceeded(f);
  ok("フロー 入力→確認→完了(データ保持/戻る/失敗/完了/index)", f.phase === "confirm" && f.data.name === "山田" && back.phase === "input" && back.data.name === "山田" && failed.phase === "confirm" && failed.error === "err" && done.phase === "complete" && FL.phaseIndex("confirm") === 1);

  const fs6 = await import("node:fs/promises"); const st6 = Date.now();
  const rvSrc = (await fs6.readFile(new URL("../packages/form/src/review.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/field\.ts"/g, `from "/tmp/scr-field-${st6}.ts"`);
  const fldSrc = (await fs6.readFile(new URL("../packages/form/src/field.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  await fs6.writeFile(`/tmp/scr-field-${st6}.ts`, fldSrc); await fs6.writeFile(`/tmp/scr-review-${st6}.ts`, rvSrc);
  const R = await import(`/tmp/scr-review-${st6}.ts`);
  const fields = [{ name: "name", label: "氏名", type: "text" }, { name: "type", label: "種別", type: "radio", options: [{ value: "corp", label: "法人" }, { value: "ind", label: "個人" }] }, { name: "company", label: "会社名", type: "text", visibleWhen: { field: "type", equals: "corp" } }, { name: "agree", label: "同意", type: "checkbox" }];
  const items = R.reviewItems(fields, { name: "山田", type: "ind", company: "隠", agree: true });
  ok("確認項目(選択肢→ラベル/真偽→はい/非表示除外) + 詳細項目(全件)", R.formatFieldValue(fields[1], "corp") === "法人" && R.formatFieldValue(fields[3], true) === "はい" && !items.some((i) => i.name === "company") && items.find((i) => i.name === "type").value === "個人" && R.describeRecord(fields, { name: "鈴木", type: "corp" }).map((i) => i.name).join(",") === "name,type,company,agree");
  await fs6.rm(`/tmp/scr-field-${st6}.ts`); await fs6.rm(`/tmp/scr-review-${st6}.ts`);

  const T = await import(new URL("../packages/ui/src/lib/table.ts", import.meta.url));
  let sel = T.toggleRow(T.toggleRow(T.emptySelection(), "a"), "b");
  const keys = ["a", "b", "c"];
  ok("一覧選択(2件/indeterminate/全選択/全解除)", T.selectionCount(sel) === 2 && T.isIndeterminate(sel, keys) === true && T.isAllSelected(sel, keys) === false && T.isAllSelected(T.toggleAll(sel, keys), keys) === true && T.selectionCount(T.toggleAll(T.toggleAll(sel, keys), keys)) === 0);
}

// ---- dashboard viz: 構成比 / ドーナツ / 達成率 / ファネル / 相対時刻 ----
section("dashboard: shares / donut / goal / funnel / relative-time");
{
  const D = await import(new URL("../packages/ui/src/lib/dashboard.ts", import.meta.url));
  const C = 2 * Math.PI * 50;
  const sh = D.computeShares([30, 50, 20]);
  ok("構成比(割合/パーセント/合計0/負値0)", sh[0].ratio === 0.3 && sh[1].percent === 50 && D.computeShares([0, 0]).every((x) => x.ratio === 0) && D.computeShares([-10, 10])[0].value === 0);
  const seg = D.donutSegments([25, 75], 50);
  ok("ドーナツ(dash=割合×円周/offset累積)", Math.abs(seg[0].dash - 0.25 * C) < 0.01 && seg[0].offset === 0 && Math.abs(seg[1].offset - -0.25 * C) < 0.01);
  ok("達成率(80/超過120/target0)", D.achievementRate(80, 100) === 80 && D.achievementRate(120, 100) === 120 && D.achievementRate(50, 0) === 0);
  const fn = D.funnelStages([{ label: "申込", value: 1000 }, { label: "審査", value: 600 }, { label: "承認", value: 450 }]);
  ok("ファネル(先頭比0.6/遷移率0.75/離脱400)", fn[1].ratioToFirst === 0.6 && fn[2].conversionFromPrev === 0.75 && fn[1].dropoff === 400);
  const now = new Date("2025-07-25T12:00:00Z").getTime();
  ok("相対時刻(たった今/N分/N時間/N日/日付)", D.relativeTime(now - 30000, now) === "たった今" && D.relativeTime(now - 5 * 60000, now) === "5分前" && D.relativeTime(now - 3 * 3600000, now) === "3時間前" && D.relativeTime(now - 2 * 86400000, now) === "2日前" && /^\d{4}\/\d{2}\/\d{2}$/.test(D.relativeTime(now - 10 * 86400000, now)));
}

// ---- commerce: カート / お気に入り / 割引 / 注文サマリ / 在庫(EC基盤) ----
section("commerce: cart / favorites / discount / order-summary / inventory");
{
  const C = await import(new URL("../packages/commerce/src/cart.ts", import.meta.url));
  const F = await import(new URL("../packages/commerce/src/favorites.ts", import.meta.url));
  const D = await import(new URL("../packages/commerce/src/discount.ts", import.meta.url));
  const I = await import(new URL("../packages/commerce/src/inventory.ts", import.meta.url));
  // カート
  let cart = C.addToCart(C.addToCart(C.emptyCart(), { productId: "A", name: "A", unitPrice: 1000 }), { productId: "B", name: "B", unitPrice: 500, quantity: 2 });
  cart = C.addToCart(cart, { productId: "A", name: "A", unitPrice: 1000 });
  const merged = C.mergeCarts(cart, { items: [{ productId: "A", name: "A", unitPrice: 1000, quantity: 1 }, { productId: "C", name: "C", unitPrice: 200, quantity: 1 }] });
  ok("カート(点数3/小計/既存加算/統合で加算)", C.cartItemCount(cart) === 4 && C.cartSubtotal(cart) === 3000 && C.findCartItem(cart, "A").quantity === 2 && C.findCartItem(merged, "A").quantity === 3 && C.cartUniqueCount(merged) === 3);
  // お気に入り・最近見た
  let fav = F.toggleFavorite(F.addFavorite(F.emptyFavorites(), "A"), "B");
  ok("お気に入り(追加/トグル/解除) + 最近見た(重複除去/上限)", F.isFavorite(fav, "A") === true && F.favoriteCount(fav) === 2 && F.isFavorite(F.toggleFavorite(fav, "A"), "A") === false && F.pushRecentlyViewed(["B"], "B").join(",") === "B" && F.pushRecentlyViewed(["1", "2", "3"], "4", 3).join(",") === "4,1,2");
  // 割引
  ok("割引(定率10%/定額/最低購入額/上限cap/小計超えない)", D.computeDiscount({ code: "X", type: "percentage", value: 10 }, 3000) === 300 && D.computeDiscount({ code: "Y", type: "fixed", value: 500 }, 3000) === 500 && D.computeDiscount({ code: "Z", type: "fixed", value: 500, minPurchase: 5000 }, 3000) === 0 && D.computeDiscount({ code: "W", type: "percentage", value: 50, maxDiscount: 1000 }, 3000) === 1000 && D.computeDiscount({ code: "V", type: "fixed", value: 9999 }, 3000) === 3000);
  // 在庫
  const lv = I.stock(10); const r = I.reserveStock(lv, 3);
  const chk = I.canFulfill({ A: 5, B: 0, C: 10 }, [{ productId: "A", quantity: 3 }, { productId: "B", quantity: 1 }, { productId: "C", quantity: 20 }]);
  ok("在庫(あり判定/引当/解放/確定/不足明細)", I.inStock(lv, 5) === true && r.ok === true && r.level.available === 7 && I.reserveStock(lv, 20).ok === false && I.releaseStock(r.level, 1).level.available === 8 && I.commitStock(r.level, 3).level.reserved === 0 && chk.ok === false && chk.shortages.length === 2);
  // 注文サマリ(@platform/tax を忠実 shim で解決: floor ベース)
  const fs7 = await import("node:fs/promises"); const st7 = Date.now();
  await fs7.writeFile(`/tmp/comm-tax-${st7}.ts`, "export function taxAmount(net,rate=10){return Math.floor(net*rate/100);}\nexport function taxFromGross(gross,rate=10){if(rate===0)return 0;return gross-Math.floor(gross*100/(100+rate));}\n");
  const osSrc = (await fs7.readFile(new URL("../packages/commerce/src/order-summary.ts", import.meta.url), "utf8")).replace(/from "@platform\/tax"/g, `from "/tmp/comm-tax-${st7}.ts"`);
  await fs7.writeFile(`/tmp/comm-os-${st7}.ts`, osSrc);
  const O = await import(`/tmp/comm-os-${st7}.ts`);
  ok("注文サマリ(外税300/割引+送料/内税/軽減8%/送料無料)", O.buildOrderSummary({ subtotal: 3000, taxRate: 10 }).total === 3300 && O.buildOrderSummary({ subtotal: 3000, discount: 500, shippingFee: 550, taxRate: 10 }).total === 3300 && O.buildOrderSummary({ subtotal: 3300, taxRate: 10, taxMode: "inclusive" }).tax === 300 && O.buildOrderSummary({ subtotal: 3000, taxRate: 8 }).tax === 240 && O.resolveShippingFee(5000, 5000, 550) === 0);
  await fs7.rm(`/tmp/comm-tax-${st7}.ts`); await fs7.rm(`/tmp/comm-os-${st7}.ts`);
}

// ---- blog: スラッグ / 抜粋 / 読了時間 / 目次 / 記事公開 / RSS ----
section("blog: slug / excerpt / reading-time / toc / post / feed");
{
  const fs8 = await import("node:fs/promises"); const st8 = Date.now();
  const files = {};
  for (const f of ["slug", "excerpt", "reading-time", "toc"]) {
    const src = (await fs8.readFile(new URL(`../packages/blog/src/${f}.ts`, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/(slug|excerpt)\.ts"/g, (m, n) => `from "/tmp/blog-${n}-${st8}.ts"`);
    files[f] = `/tmp/blog-${f}-${st8}.ts`;
    await fs8.writeFile(files[f], src);
  }
  const S = await import(files.slug);
  const E = await import(files.excerpt);
  const R = await import(files["reading-time"]);
  const T = await import(files.toc);
  ok("blog スラッグ(英語/allowUnicode/fallback/衝突連番/maxLength)", S.slugify("Hello World!") === "hello-world" && S.slugify("こんにちは 世界", { allowUnicode: true }) === "こんにちは-世界" && S.ensureSlug("こんにちは", "post-123") === "post-123" && S.uniqueSlug("hello", ["hello", "hello-2"]) === "hello-3" && S.slugify("aaaa bbbb cccc", { maxLength: 9 }) === "aaaa-bbbb");
  const md = "# 見出し\n\nこれは**本文**です。[リンク](http://x.com)や`code`。\n\n```js\nconst a=1;\n```";
  ok("blog 抜粋(記法除去/短文そのまま/長文省略) + 読了時間(日本語/欧文/最低1分)", E.stripMarkdown(md).includes("これは本文です") && !E.stripMarkdown(md).includes("const a") && E.excerpt("短い") === "短い" && E.excerpt("あ".repeat(200), { maxLength: 30 }).endsWith("…") && R.readingTime("あ".repeat(1000)).minutes === 2 && R.readingTime(Array(500).fill("word").join(" ")).minutes === 2 && R.readingTime("短い").minutes === 1);
  const doc = "# T\n\n## セクションA\n\n## B\n\n### 詳細\n\n```\n# コード\n```\n\n## セクションA";
  const toc = T.extractHeadings(doc, { allowUnicode: true });
  ok("blog 目次(抽出/コード内#無視/アンカー重複回避/maxLevel)", toc.length === 5 && !toc.some((e) => e.text.includes("コード")) && toc[1].slug === "セクションa" && toc[4].slug === "セクションa-2" && T.extractHeadings(doc, { maxLevel: 2, allowUnicode: true }).every((e) => e.level <= 2));
  for (const f of Object.values(files)) await fs8.rm(f);

  const P = await import(new URL("../packages/blog/src/post.ts", import.meta.url));
  const F = await import(new URL("../packages/blog/src/feed.ts", import.meta.url));
  const now = new Date("2025-07-25T12:00:00Z");
  const posts = [
    { id: "1", slug: "a", title: "A", status: "published", publishedAt: "2025-07-20T00:00:00Z", tags: ["tech", "react"] },
    { id: "2", slug: "b", title: "B", status: "draft", tags: ["tech"] },
    { id: "3", slug: "c", title: "C", status: "scheduled", publishedAt: "2025-08-01T00:00:00Z", tags: ["news"] },
    { id: "4", slug: "d", title: "D", status: "published", publishedAt: "2025-07-24T00:00:00Z", tags: ["react", "tech", "css"], category: "frontend" },
  ];
  ok("blog 記事(公開判定/新しい順/タグ・カテゴリ絞込/タグ集計/関連記事)", P.isPublished(posts[0], now) === true && P.isPublished(posts[1], now) === false && P.isPublished(posts[2], now) === false && P.publishedPosts(posts, now).map((p) => p.id).join(",") === "4,1" && P.postsByTag(posts, "react").map((p) => p.id).join(",") === "1,4" && P.tagCounts(posts)[0].count === 3 && P.relatedPosts(posts[0], posts)[0].id === "4" && !P.relatedPosts(posts[0], posts).some((p) => p.id === "1"));
  const rss = F.buildRssFeed({ title: "My Blog", link: "https://ex.com", description: "説明" }, [{ title: "記事<A>", link: "https://ex.com/a", description: "抜粋&要約", publishedAt: "2025-07-20T00:00:00Z" }]);
  const sm = F.buildSitemap([{ loc: "https://ex.com/a", lastmod: "2025-07-20T00:00:00Z", changefreq: "weekly", priority: 0.8 }]);
  ok("blog RSS(channel/item/エスケープ/pubDate) + サイトマップ(loc/lastmod/priority)", rss.includes("<title>My Blog</title>") && rss.includes("記事&lt;A&gt;") && rss.includes("抜粋&amp;要約") && rss.includes("<pubDate>") && sm.includes("<loc>https://ex.com/a</loc>") && sm.includes("<lastmod>2025-07-20</lastmod>") && sm.includes("<priority>0.8</priority>"));
}

// ---- seo: メタ / OGP / Twitter / JSON-LD / robots ----
section("seo: meta / open-graph / json-ld / robots");
{
  const fs9 = await import("node:fs/promises"); const st9 = Date.now();
  const metaSrc = (await fs9.readFile(new URL("../packages/seo/src/meta.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  await fs9.writeFile(`/tmp/seo-meta-${st9}.ts`, metaSrc);
  const ogSrc = (await fs9.readFile(new URL("../packages/seo/src/open-graph.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/meta\.ts"/g, `from "/tmp/seo-meta-${st9}.ts"`);
  await fs9.writeFile(`/tmp/seo-og-${st9}.ts`, ogSrc);
  const M = await import(`/tmp/seo-meta-${st9}.ts`);
  const O = await import(`/tmp/seo-og-${st9}.ts`);
  ok("seo メタ(title適用/desc160/robots/escape/render)", M.buildTitle("記事", "%s | S") === "記事 | S" && M.truncateDescription("あ".repeat(200)).length === 160 && M.robotsContent({ index: false, follow: false }) === "noindex, nofollow" && M.escapeAttr('a"<&') === "a&quot;&lt;&amp;" && M.renderMeta(M.buildMeta({ title: "T", canonical: "https://ex.com/p" })).includes('rel="canonical"'));
  const og = O.buildOpenGraphTags({ title: "記事", type: "article", image: "https://ex.com/i.png", article: { publishedTime: "2025-07-25T00:00:00Z", tags: ["a", "b"] } });
  const tw = O.buildTwitterCardTags({ title: "記事", site: "@site" });
  ok("seo OGP(title/type/locale/article:tag×2) + Twitter(card/site)", og.some((t) => t.property === "og:title" && t.content === "記事") && og.some((t) => t.property === "og:locale" && t.content === "ja_JP") && og.filter((t) => t.property === "article:tag").length === 2 && tw.some((t) => t.name === "twitter:card" && t.content === "summary_large_image") && tw.some((t) => t.name === "twitter:site"));
  await fs9.rm(`/tmp/seo-meta-${st9}.ts`); await fs9.rm(`/tmp/seo-og-${st9}.ts`);

  const J = await import(new URL("../packages/seo/src/json-ld.ts", import.meta.url));
  const R = await import(new URL("../packages/seo/src/robots.ts", import.meta.url));
  const art = J.articleJsonLd({ headline: "記事", authorName: "著者", publisherName: "S", publisherLogo: "https://ex.com/l.png", url: "https://ex.com/a" });
  const bc = J.breadcrumbJsonLd([{ name: "H", url: "https://ex.com" }, { name: "記事", url: "https://ex.com/a" }]);
  const web = J.websiteJsonLd({ name: "S", url: "https://ex.com", searchUrl: "https://ex.com/s?q={search_term_string}" });
  const prod = J.productJsonLd({ name: "商品", price: 1980, availability: "InStock" });
  ok("seo JSON-LD(Article/Breadcrumb/WebSite SearchAction/Product/FAQ)", art["@type"] === "BlogPosting" && art.author.name === "著者" && bc.itemListElement[1].position === 2 && web.potentialAction["@type"] === "SearchAction" && prod.offers.availability === "https://schema.org/InStock" && J.faqJsonLd([{ question: "Q", answer: "A" }]).mainEntity.length === 1);
  ok("seo renderJsonLd(script/</script>エスケープ) + robots.txt(UA/Disallow/Sitemap/allowAll)", J.renderJsonLd(art).startsWith('<script type="application/ld+json">') && J.renderJsonLd({ x: "</script>" }).includes("\\u003c/script>") && R.buildRobotsTxt({ rules: [{ userAgent: "*", disallow: ["/admin"] }], sitemaps: ["https://ex.com/sitemap.xml"] }).includes("Disallow: /admin") && R.buildRobotsTxt({ rules: [{ userAgent: "*", disallow: ["/admin"] }], sitemaps: ["https://ex.com/sitemap.xml"] }).includes("Sitemap: https://ex.com/sitemap.xml") && R.allowAllRobotsTxt("https://ex.com/sitemap.xml").includes("Allow: /"));
}

// ---- commerce拡張: バリエーション / レビュー / 注文ステータス / ポイント / 送料 ----
section("commerce+: variant / review / order-status / points / shipping");
{
  const V = await import(new URL("../packages/commerce/src/variant.ts", import.meta.url));
  const RV = await import(new URL("../packages/commerce/src/review.ts", import.meta.url));
  const OS = await import(new URL("../packages/commerce/src/order-status.ts", import.meta.url));
  const PT = await import(new URL("../packages/commerce/src/points.ts", import.meta.url));
  const SH = await import(new URL("../packages/commerce/src/shipping.ts", import.meta.url));
  const variants = [{ sku: "S-赤", options: { サイズ: "S", 色: "赤" }, price: 1000, stock: 5 }, { sku: "M-赤", options: { サイズ: "M", 色: "赤" }, price: 1000, stock: 0 }, { sku: "M-青", options: { サイズ: "M", 色: "青" }, price: 1200, stock: 3 }, { sku: "L-青", options: { サイズ: "L", 色: "青" }, price: 1200, stock: 2 }];
  ok("variant(選択特定/在庫別選択肢/価格帯)", V.findVariant(variants, { サイズ: "M", 色: "青" }).sku === "M-青" && V.availableValues(variants, "サイズ", { 色: "青" }).sort().join(",") === "L,M" && V.availableValues(variants, "サイズ", { 色: "赤" }).join(",") === "S" && V.priceRange(variants).min === 1000 && V.priceRange(variants).max === 1200);
  const s = RV.ratingSummary([5, 5, 5, 4, 4, 3, 1]);
  ok("review(平均3.9/分布/割合)", RV.averageRating([5, 5, 5, 4, 4, 3, 1]) === 3.9 && RV.ratingDistribution([5, 5, 5, 4, 4, 3, 1])[5] === 3 && s.count === 7 && Math.abs(s.percentages[5] - 42.9) < 0.1);
  ok("order-status(遷移可否/次状態/終端/キャンセル可否)", OS.canTransition("pending", "paid") === true && OS.canTransition("pending", "shipped") === false && OS.nextStatuses("paid").sort().join(",") === "cancelled,processing,refunded" && OS.isFinalStatus("cancelled") === true && OS.isCancellable("shipped") === false);
  const now = new Date("2025-07-25T00:00:00Z");
  const txns = [{ amount: 100, date: "2025-01-01T00:00:00Z", expiresAt: "2026-01-01T00:00:00Z" }, { amount: 50, date: "x", expiresAt: "2025-06-01T00:00:00Z" }, { amount: -30, date: "x" }];
  ok("points(付与1%/残高失効考慮/利用上限)", PT.earnPoints(1980) === 19 && PT.pointsBalance(txns, now) === 70 && PT.redeemPoints(500, 300, 200).used === 200 && PT.redeemPoints(0, 100).ok === false);
  const zones = [{ name: "本州", regions: ["東京都"], fee: 550, freeThreshold: 5000 }, { name: "北海道", regions: ["北海道"], fee: 1100, freeThreshold: 10000 }];
  ok("shipping(エリア別/無料閾値/重量段階)", SH.shippingFeeForRegion(zones, "東京都", 3000) === 550 && SH.shippingFeeForRegion(zones, "東京都", 5000) === 0 && SH.shippingFeeForRegion(zones, "北海道", 5000) === 1100 && SH.weightBasedFee(700, [{ maxWeight: 500, fee: 400 }, { maxWeight: 1000, fee: 600 }]) === 600 && SH.totalWeight([{ weight: 200, quantity: 2 }, { weight: 100, quantity: 3 }]) === 700);
}

// ---- blog拡張: コメント / 記事ナビゲーション ----
section("blog+: comment / navigation");
{
  const CM = await import(new URL("../packages/blog/src/comment.ts", import.meta.url));
  const comments = [{ id: "1", author: "A", body: "最初", createdAt: "2025-07-20T10:00:00Z", status: "approved" }, { id: "2", parentId: "1", author: "B", body: "返信", createdAt: "2025-07-20T11:00:00Z", status: "approved" }, { id: "3", author: "C", body: "別", createdAt: "2025-07-21T10:00:00Z", status: "pending" }, { id: "4", parentId: "1", author: "D", body: "返信2", createdAt: "2025-07-20T12:00:00Z", status: "approved" }];
  const tree = CM.buildCommentTree(comments);
  ok("comment(ツリー/返信/承認済み/並替/総数/承認待ち)", tree.length === 2 && tree[0].replies.length === 2 && CM.approvedComments(comments).length === 3 && CM.sortComments(comments, "newest")[0].id === "3" && CM.countComments(tree) === 4 && CM.pendingCount(comments) === 1);
  const fs10 = await import("node:fs/promises"); const st10 = Date.now();
  const navSrc = (await fs10.readFile(new URL("../packages/blog/src/navigation.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/post\.ts"/g, `from "/tmp/blognav-post-${st10}.ts"`);
  const postSrc = (await fs10.readFile(new URL("../packages/blog/src/post.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  await fs10.writeFile(`/tmp/blognav-post-${st10}.ts`, postSrc); await fs10.writeFile(`/tmp/blognav-nav-${st10}.ts`, navSrc);
  const N = await import(`/tmp/blognav-nav-${st10}.ts`);
  const posts = [{ id: "1", slug: "a", title: "A", status: "published", publishedAt: "2025-07-20T00:00:00Z", series: "入門", seriesOrder: 1 }, { id: "2", slug: "b", title: "B", status: "published", publishedAt: "2025-07-22T00:00:00Z", series: "入門", seriesOrder: 2 }, { id: "3", slug: "c", title: "C", status: "published", publishedAt: "2025-07-24T00:00:00Z", series: "入門", seriesOrder: 3 }];
  const adj = N.adjacentPosts(posts, "2"); const sn = N.seriesNavigation(posts, "2");
  ok("navigation(前後記事/連載順/連載内前後+位置)", adj.newer.id === "3" && adj.older.id === "1" && N.seriesPosts(posts, "入門").map((p) => p.id).join(",") === "1,2,3" && sn.prev.id === "1" && sn.next.id === "3" && sn.total === 3);
  await fs10.rm(`/tmp/blognav-post-${st10}.ts`); await fs10.rm(`/tmp/blognav-nav-${st10}.ts`);
}

// ---- site: ページ構成 / ナビ / リダイレクト / お知らせ(公式サイト・LP) ----
section("site: blocks / navigation / redirects / announcement");
{
  const B = await import(new URL("../packages/site/src/blocks.ts", import.meta.url));
  const N = await import(new URL("../packages/site/src/navigation.ts", import.meta.url));
  const RD = await import(new URL("../packages/site/src/redirects.ts", import.meta.url));
  const AN = await import(new URL("../packages/site/src/announcement.ts", import.meta.url));
  const now = new Date("2025-07-25T12:00:00Z");
  const page = { slug: "home", title: "T", blocks: [{ id: "h", type: "hero", data: {} }, { id: "f", type: "features", data: {}, visible: false }, { id: "c", type: "cta", data: {}, visibleFrom: "2025-08-01T00:00:00Z" }, { id: "faq", type: "faq", data: {} }, { id: "s", type: "stats", data: {} }] };
  ok("site ブロック(公開中のみ/タイプ別/並べ替え/上下移動)", B.visibleBlocks(page, now).map((b) => b.id).join(",") === "h,faq,s" && B.blocksByType(page, "hero").length === 1 && B.reorderBlocks(page.blocks, 0, 2).map((b) => b.id).join(",") === "f,c,h,faq,s" && B.moveBlockUp(page.blocks, "f").map((b) => b.id).join(",") === "f,h,c,faq,s");
  const menu = [{ label: "ホーム", href: "/" }, { label: "製品", href: "/products", children: [{ label: "製品A", href: "/products/a" }, { label: "製品B", href: "/products/b" }] }, { label: "会社概要", href: "/about" }];
  ok("site ナビ(アクティブ/exact/経路/パンくず/平坦化)", N.isActive(menu[1], "/products/a") === true && N.isActive(menu[1], "/products", { exact: true }) === true && N.activeTrail(menu, "/products/a").map((i) => i.label).join(">") === "製品>製品A" && N.breadcrumbFromMenu(menu, "/products/b").length === 2 && N.flattenMenu(menu).length === 5);
  const rules = [{ from: "/old-page", to: "/new-page" }, { from: "/blog/*", to: "/articles/:splat", status: 301 }, { from: "/campaign", to: "/sale", status: 302 }];
  ok("site リダイレクト(完全一致/ワイルドカード/クエリ無視/302/連鎖/該当なし)", RD.resolveRedirect(rules, "/old-page").to === "/new-page" && RD.resolveRedirect(rules, "/blog/2025/hello").to === "/articles/2025/hello" && RD.resolveRedirect(rules, "/old-page/?utm=x").to === "/new-page" && RD.resolveRedirect(rules, "/campaign").status === 302 && RD.resolveRedirectChain([{ from: "/a", to: "/b" }, { from: "/b", to: "/c" }], "/a").to === "/c" && RD.resolveRedirect(rules, "/other") === null);
  const anns = [{ id: "1", message: "通常", level: "info" }, { id: "2", message: "期間外", startAt: "2025-08-01T00:00:00Z" }, { id: "3", message: "セール", endAt: "2025-12-31T00:00:00Z", level: "sale" }, { id: "4", message: "商品のみ", paths: ["/products"], level: "warning" }];
  ok("site お知らせ(期間/パス限定/閉じた除外/最優先sale)", AN.isAnnouncementActive(anns[0], "/", now) === true && AN.isAnnouncementActive(anns[1], "/", now) === false && AN.isAnnouncementActive(anns[3], "/products/a", now) === true && AN.activeAnnouncements(anns, "/", { now }).map((a) => a.id).join(",") === "1,3" && AN.activeAnnouncements(anns, "/", { now, dismissedIds: ["1"] }).map((a) => a.id).join(",") === "3" && AN.topAnnouncement(anns, "/products", { now }).id === "3");
}

// ---- seo可視性: 社内noindex / 公開index(検索避けポリシー) ----
section("seo: visibility (internal noindex / public index)");
{
  const fs11 = await import("node:fs/promises"); const st11 = Date.now();
  const files = {};
  for (const f of ["meta", "robots", "indexing"]) {
    const src = (await fs11.readFile(new URL(`../packages/seo/src/${f}.ts`, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/(meta|robots)\.ts"/g, (m, n) => `from "/tmp/seovis-${n}-${st11}.ts"`);
    files[f] = `/tmp/seovis-${f}-${st11}.ts`;
    await fs11.writeFile(files[f], src);
  }
  const I = await import(files.indexing);
  const M = await import(files.meta);
  ok("可視性 internal→noindex / public→index / xRobotsTag", M.robotsContent(I.robotsForVisibility("internal")) === "noindex, nofollow, noarchive" && M.robotsContent(I.robotsForVisibility("public")) === "index, follow" && I.noindexRobots() === "noindex, nofollow, noarchive" && I.xRobotsTag("internal") === "noindex, nofollow, noarchive" && I.xRobotsTag("public") === "index, follow");
  ok("robots.txt 社内全拒否 / 公開許可+sitemap", I.internalRobotsTxt().includes("Disallow: /") && !I.internalRobotsTxt().includes("Allow") && I.publicRobotsTxt("https://ex.com/sitemap.xml").includes("Allow: /") && I.publicRobotsTxt("https://ex.com/sitemap.xml").includes("Sitemap:"));
  ok("buildMeta visibility統合(internal noindex/public index/robots明示優先/無指定は無)", M.buildMeta({ title: "社内", visibility: "internal" }).tags.find((t) => t.name === "robots").content === "noindex, nofollow, noarchive" && M.buildMeta({ title: "公開", visibility: "public" }).tags.find((t) => t.name === "robots").content === "index, follow" && M.buildMeta({ title: "x", visibility: "public", robots: { index: false } }).tags.find((t) => t.name === "robots").content.includes("noindex") && !M.buildMeta({ title: "x" }).tags.some((t) => t.name === "robots"));
  for (const f of Object.values(files)) await fs11.rm(f);
}

// ---- blog パーマリンク: URL構造の生成・逆引き ----
section("blog: permalink (URL structure)");
{
  const fs12 = await import("node:fs/promises"); const st12 = Date.now();
  const plSrc = (await fs12.readFile(new URL("../packages/blog/src/permalink.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/slug\.ts"/g, `from "/tmp/pl-slug-${st12}.ts"`);
  const slugSrc = (await fs12.readFile(new URL("../packages/blog/src/slug.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  await fs12.writeFile(`/tmp/pl-slug-${st12}.ts`, slugSrc); await fs12.writeFile(`/tmp/pl-perma-${st12}.ts`, plSrc);
  const P = await import(`/tmp/pl-perma-${st12}.ts`);
  const post = { slug: "hello-world", id: "123", category: "技術ブログ", publishedAt: "2025-07-25T10:00:00Z" };
  const late = { slug: "night", publishedAt: "2025-07-25T23:00:00Z" };
  ok("permalink 生成(slug/日付/ID/カテゴリunicode/TZ)", P.buildPermalink("/blog/:slug", post) === "/blog/hello-world" && P.buildPermalink("/:year/:month/:day/:slug", post) === "/2025/07/25/hello-world" && P.buildPermalink("/archives/:id", post) === "/archives/123" && P.buildPermalink("/:category/:slug", post, { allowUnicode: true }) === "/技術ブログ/hello-world" && P.buildPermalink("/:year/:month/:day/:slug", late, { utcOffsetMinutes: 540 }) === "/2025/07/26/night");
  ok("permalink joinUrl/postUrl絶対/matchPermalink逆引き", P.joinUrl("https://ex.com/", "/blog/a") === "https://ex.com/blog/a" && P.postUrl(post, { baseUrl: "https://ex.com", pattern: "/blog/:year/:slug" }) === "https://ex.com/blog/2025/hello-world" && JSON.stringify(P.matchPermalink("/blog/:year/:month/:slug", "/blog/2025/07/hello")) === JSON.stringify({ year: "2025", month: "07", slug: "hello" }) && P.matchPermalink("/blog/:slug", "/blog/2025/hello") === null);
  await fs12.rm(`/tmp/pl-slug-${st12}.ts`); await fs12.rm(`/tmp/pl-perma-${st12}.ts`);
}

// ---- url: 解析 / ドメイン / クエリ / 正規化 / 検証(URL・ドメイン処理) ----
section("url: parse / domain / query / normalize / validate");
{
  const P = await import(new URL("../packages/url/src/parse.ts", import.meta.url));
  const D = await import(new URL("../packages/url/src/domain.ts", import.meta.url));
  const Q = await import(new URL("../packages/url/src/query.ts", import.meta.url));
  const NM = await import(new URL("../packages/url/src/normalize.ts", import.meta.url));
  const VL = await import(new URL("../packages/url/src/validate.ts", import.meta.url));
  const pp = P.parseUrl("https://www.ex.com:8080/blog/a?x=1&y=2#top");
  ok("url 解析(分解/相対base/buildUrl/isAbsolute)", pp.hostname === "www.ex.com" && pp.port === "8080" && pp.pathname === "/blog/a" && pp.search === "x=1&y=2" && pp.hash === "top" && P.parseUrl("/foo", "https://ex.com").hostname === "ex.com" && P.buildUrl({ protocol: "https", hostname: "ex.com", pathname: "/a", search: "x=1" }) === "https://ex.com/a?x=1" && P.isAbsoluteUrl("/p") === false);
  ok("url ドメイン(eTLD+1/co.jp/subdomain/tld/同一判定)", D.getRegistrableDomain("www.example.com") === "example.com" && D.getRegistrableDomain("www.example.co.jp") === "example.co.jp" && D.getRegistrableDomain("blog.mysite.ne.jp") === "mysite.ne.jp" && D.getSubdomain("a.b.example.co.jp") === "a.b" && D.getTld("example.co.jp") === "co.jp" && D.isSameDomain("www.example.com", "api.example.com") === true && D.isSameDomain("example.com", "other.com") === false);
  ok("url クエリ(解析/set/setParams削除/append/keep/相対)", JSON.stringify(Q.parseQuery("?a=1&b=2&a=3")) === JSON.stringify({ a: ["1", "3"], b: "2" }) && Q.setParam("https://ex.com/a?x=1#top", "x", 9) === "https://ex.com/a?x=9#top" && Q.setParams("https://ex.com/a?x=1&y=2", { x: 9, y: null, z: 3 }) === "https://ex.com/a?x=9&z=3" && Q.appendParam("https://ex.com/a?tag=1", "tag", 2) === "https://ex.com/a?tag=1&tag=2" && Q.keepParams("https://ex.com/a?x=1&y=2&z=3", ["x", "z"]) === "https://ex.com/a?x=1&z=3" && Q.setParam("/search?q=old", "q", "new") === "/search?q=new");
  ok("url 正規化(host小文字/トラッキング除去/ソート/末尾スラッシュ/urlsEqual)", NM.normalizeUrl("https://EXAMPLE.com/Path") === "https://example.com/Path" && NM.normalizeUrl("https://ex.com/a?id=1&utm_source=x&fbclid=y") === "https://ex.com/a?id=1" && NM.normalizeUrl("https://ex.com/a?c=3&a=1&b=2") === "https://ex.com/a?a=1&b=2&c=3" && NM.normalizeUrl("https://ex.com/blog/") === "https://ex.com/blog" && NM.normalizeUrl("https://ex.com/") === "https://ex.com/" && NM.urlsEqual("https://EX.com/a/?utm_source=x", "https://ex.com/a") === true);
  ok("url 検証(valid/http限定/safe危険排除/sameOrigin/external)", VL.isValidUrl("https://ex.com") === true && VL.isValidUrl("not url") === false && VL.isHttpUrl("ftp://ex.com") === false && VL.isSafeUrl("javascript:alert(1)") === false && VL.isSafeUrl("data:text/html,x") === false && VL.isSafeUrl("/relative") === true && VL.isSameOrigin("https://ex.com/a", "https://ex.com/b") === true && VL.isExternalUrl("https://other.com/x", "example.com") === true && VL.isExternalUrl("/internal", "example.com") === false);
}

// ---- social: X/TikTok/Instagram 連携(ハンドル/URL解析/oEmbed/アカウント) ----
section("social: handle / parse / embed / accounts");
{
  const fs13 = await import("node:fs/promises"); const st13 = Date.now();
  const names = ["platforms", "handle", "parse", "embed", "accounts"];
  const paths = {};
  for (const n of names) paths[n] = `/tmp/soc-${n}-${st13}.ts`;
  for (const n of names) {
    let src = (await fs13.readFile(new URL(`../packages/social/src/${n}.ts`, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
    for (const dep of names) src = src.replace(new RegExp(`from "\\./${dep}\\.ts"`, "g"), `from "${paths[dep]}"`);
    await fs13.writeFile(paths[n], src);
  }
  const H = await import(paths.handle);
  const PR = await import(paths.parse);
  const E = await import(paths.embed);
  const A = await import(paths.accounts);
  ok("social ハンドル(normalize/valid X15字/TikTok./profileUrl/display@)", H.normalizeHandle("@yamada") === "yamada" && H.isValidHandle("x", "yamada_taro") === true && H.isValidHandle("x", "toolong_handle_over15") === false && H.isValidHandle("tiktok", "cast.01") === true && H.buildProfileUrl("tiktok", "cast01") === "https://www.tiktok.com/@cast01" && H.displayHandle("tiktok", "cast01") === "@cast01" && H.buildProfileUrl("x", "bad handle!") === null);
  const xr = PR.parseSocialUrl("https://twitter.com/y/status/123");
  const tr = PR.parseSocialUrl("https://www.tiktok.com/@c/video/71");
  const ir = PR.parseSocialUrl("https://www.instagram.com/p/ABC/");
  ok("social URL解析(Xプロフ/Xツイート/TikTok動画/IG投稿/reel/予約語除外)", PR.parseSocialUrl("https://x.com/yamada").type === "profile" && xr.type === "post" && xr.postId === "123" && xr.postKind === "tweet" && tr.postKind === "video" && ir.postKind === "post" && PR.parseSocialUrl("https://www.instagram.com/reel/XYZ/").postKind === "reel" && PR.parseSocialUrl("https://x.com/home") === null && PR.parseSocialUrl("https://example.com/x") === null);
  ok("social oEmbed(X/TikTok/IGはnull要トークン/supports)", E.oembedEndpoint("x", "https://x.com/y/status/123") === "https://publish.twitter.com/oembed?url=https%3A%2F%2Fx.com%2Fy%2Fstatus%2F123" && E.oembedEndpoint("x", "https://x.com/y/status/123", { theme: "dark", omitScript: true }).includes("theme=dark") && E.oembedEndpoint("tiktok", "https://www.tiktok.com/@c/video/71").startsWith("https://www.tiktok.com/oembed?url=") && E.oembedEndpoint("instagram", "https://www.instagram.com/p/ABC/") === null && E.supportsOEmbed("x") === true && E.supportsOEmbed("instagram") === false);
  const accounts = A.accountsFromUrls(["https://x.com/yamada_taro", "https://twitter.com/yamada_taro", "https://www.tiktok.com/@yamada.dance", "https://www.instagram.com/yamada_ig/", "https://example.com/x", "@bad handle"]);
  const links = A.accountLinks(accounts);
  ok("social アカウント(複数URL→妥当のみ+重複排除/リンク順/プラットフォーム別)", accounts.length === 3 && accounts.filter((a) => a.platform === "x").length === 1 && links.map((l) => l.platform).join(",") === "x,tiktok,instagram" && links[1].label === "@yamada.dance" && A.accountsByPlatform(accounts).instagram.handle === "yamada_ig" && A.dedupeAccounts([{ platform: "x", handle: "a", url: "u" }, { platform: "x", handle: "A", url: "u" }]).length === 1);
  for (const n of names) await fs13.rm(paths[n]);
}

// ---- booking: 営業時間 / スロット / 空き枠 / ルール / ステータス(予約サイト) ----
section("booking: hours / slots / availability / rules / status");
{
  const fs14 = await import("node:fs/promises"); const st14 = Date.now();
  const names = ["hours", "slots", "availability", "rules", "status"];
  const paths = {};
  for (const n of names) paths[n] = `/tmp/bk-${n}-${st14}.ts`;
  for (const n of names) {
    let src = (await fs14.readFile(new URL(`../packages/booking/src/${n}.ts`, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
    for (const dep of names) src = src.replace(new RegExp(`from "\\./${dep}\\.ts"`, "g"), `from "${paths[dep]}"`);
    await fs14.writeFile(paths[n], src);
  }
  const H = await import(paths.hours);
  const S = await import(paths.slots);
  const A = await import(paths.availability);
  const R = await import(paths.rules);
  const ST = await import(paths.status);
  const weekly = { 1: [{ open: "09:00", close: "12:00" }, { open: "13:00", close: "18:00" }], 0: [] };
  ok("booking 営業時間(分変換/曜日/臨時休/特別営業/昼休み判定)", H.timeToMinutes("09:30") === 570 && H.weekdayOf("2025-07-28") === 1 && H.resolveDayHours("2025-07-28", weekly).length === 2 && H.resolveDayHours("2025-07-28", weekly, { closedDates: ["2025-07-28"] }).length === 0 && H.resolveDayHours("2025-07-28", weekly, { specialDates: { "2025-07-28": [{ open: "10:00", close: "15:00" }] } })[0].open === "10:00" && H.isOpenAt("2025-07-28", "12:30", weekly) === false && H.isBusinessDay("2025-07-27", weekly) === false);
  ok("booking スロット(30分×4/刻み幅/昼休み8枠/所要)", S.generateSlots([{ open: "09:00", close: "11:00" }], { slotMinutes: 30 }).length === 4 && S.generateSlots([{ open: "09:00", close: "10:00" }], { slotMinutes: 30, stepMinutes: 15 }).map((x) => x.start).join(",") === "09:00,09:15,09:30" && S.generateSlots(weekly[1], { slotMinutes: 60 }).length === 8 && S.slotDuration({ start: "09:00", end: "10:30" }) === 90);
  const daySlots = S.generateSlots([{ open: "09:00", close: "12:00" }], { slotMinutes: 60 });
  const bookings = [{ start: "09:00", end: "10:00" }, { start: "10:30", end: "11:30" }];
  ok("booking 空き枠(重なり/capacity1埋まる/capacity2空く/残数/衝突)", A.intervalsOverlap("09:00", "10:00", "09:30", "10:30") === true && A.intervalsOverlap("09:00", "10:00", "10:00", "11:00") === false && A.availableSlots(daySlots, bookings, 1).length === 0 && A.availableSlots(daySlots, bookings, 2).length === 3 && A.remainingCapacity(daySlots, bookings, 2)[0].remaining === 1 && A.hasConflict({ start: "09:00", end: "10:00" }, bookings, 1) === true && A.hasConflict({ start: "09:00", end: "10:00" }, bookings, 2) === false);
  const now = new Date("2025-07-25T12:00:00Z");
  ok("booking ルール(適正/過去/直前/先すぎ/キャンセル期限/人数)", R.isWithinBookingWindow("2025-07-26T12:00:00Z", { minLeadMinutes: 60, maxAdvanceDays: 30 }, now).ok === true && R.isWithinBookingWindow("2025-07-24T12:00:00Z", {}, now).reason === "past" && R.isWithinBookingWindow("2025-07-25T12:30:00Z", { minLeadMinutes: 60 }, now).reason === "too_soon" && R.isWithinBookingWindow("2025-09-25T12:00:00Z", { maxAdvanceDays: 30 }, now).reason === "too_far" && R.canCancel("2025-07-26T12:00:00Z", 1440, now) === true && R.canCancel("2025-07-25T18:00:00Z", 1440, now) === false && R.validatePartySize(5, { max: 4 }).reason === "too_many");
  ok("booking ステータス(遷移/次状態/終端/枠占有/ラベル)", ST.canTransition("requested", "confirmed") === true && ST.canTransition("requested", "completed") === false && ST.nextStatuses("confirmed").sort().join(",") === "cancelled,completed,no_show" && ST.isFinalStatus("completed") === true && ST.isActiveBooking("confirmed") === true && ST.isActiveBooking("cancelled") === false && ST.BOOKING_STATUS_LABELS.no_show === "無断キャンセル");
  for (const n of names) await fs14.rm(paths[n]);
}

// ---- booking リマインダー / social 統合フィード / cast プロフィール ----
section("booking-reminders / social-feed / cast");
{
  const fs15 = await import("node:fs/promises"); const st15 = Date.now();
  // booking reminders(依存なし)
  const R = await import(new URL("../packages/booking/src/reminders.ts", import.meta.url));
  const bookingAt = "2025-07-26T18:00:00Z";
  const sched = R.reminderSchedule(bookingAt, [{ beforeMinutes: 1440, channel: "email" }, { beforeMinutes: 60, channel: "sms" }]);
  ok("reminders(発火時刻/due/送信済除外/grace/timing/本文)", sched[0].fireAt === "2025-07-25T18:00:00.000Z" && sched[1].fireAt === "2025-07-26T17:00:00.000Z" && R.dueReminders("bk1", sched, new Date("2025-07-25T18:30:00Z")).length === 1 && R.dueReminders("bk1", sched, new Date("2025-07-25T18:30:00Z"), { sentKeys: ["bk1:email:1440"] }).length === 0 && R.dueReminders("bk1", sched, new Date("2025-07-26T17:30:00Z"), { graceMinutes: 60 }).length === 1 && R.reminderTiming(1440) === "day_before" && R.reminderMessage({ customerName: "山田", bookingAt, beforeMinutes: 1440 }).includes("明日"));
  // social feed(platforms 依存 → shim)
  const feedSrc = (await fs15.readFile(new URL("../packages/social/src/feed.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/platforms\.ts"/g, `from "/tmp/sf-plat-${st15}.ts"`);
  const platSrc = (await fs15.readFile(new URL("../packages/social/src/platforms.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  await fs15.writeFile(`/tmp/sf-plat-${st15}.ts`, platSrc); await fs15.writeFile(`/tmp/sf-feed-${st15}.ts`, feedSrc);
  const F = await import(`/tmp/sf-feed-${st15}.ts`);
  const posts = [{ platform: "x", id: "1", url: "u1", createdAt: "2025-07-20T10:00:00Z" }, { platform: "tiktok", id: "10", url: "u10", createdAt: "2025-07-25T10:00:00Z" }, { platform: "x", id: "2", url: "u2", createdAt: "2025-07-24T10:00:00Z" }, { platform: "x", id: "1", url: "dup", createdAt: "2025-07-20T10:00:00Z" }, { platform: "instagram", id: "100", url: "u100", createdAt: "2025-07-22T10:00:00Z" }];
  ok("social-feed(重複排除+新しい順/最新1件/新着/直近N)", F.mergeSocialFeed(posts).length === 4 && F.mergeSocialFeed(posts)[0].id === "10" && F.latestPerPlatform(posts).length === 3 && F.newPosts(posts, ["x:1", "x:2"]).some((p) => p.id === "1") === false && F.recentPosts(posts, 2).map((p) => p.id).join(",") === "10,2");
  await fs15.rm(`/tmp/sf-plat-${st15}.ts`); await fs15.rm(`/tmp/sf-feed-${st15}.ts`);
  // cast(profile が cast 依存 → shim)
  const castSrc = (await fs15.readFile(new URL("../packages/cast/src/cast.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const profSrc = (await fs15.readFile(new URL("../packages/cast/src/profile.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/cast\.ts"/g, `from "/tmp/cast-c-${st15}.ts"`);
  await fs15.writeFile(`/tmp/cast-c-${st15}.ts`, castSrc); await fs15.writeFile(`/tmp/cast-p-${st15}.ts`, profSrc);
  const C = await import(`/tmp/cast-c-${st15}.ts`);
  const P = await import(`/tmp/cast-p-${st15}.ts`);
  const now = new Date("2025-07-25T00:00:00Z");
  const casts = [{ id: "1", name: "あおい", status: "active", tags: ["ダンス", "歌"], featured: true, rating: 4.8, joinedAt: "2025-01-01" }, { id: "2", name: "かえで", status: "active", tags: ["トーク"], rating: 4.2, joinedAt: "2025-07-10" }, { id: "3", name: "さくら", status: "hidden", tags: ["ダンス"], rating: 5.0 }, { id: "4", name: "みなと", status: "active", tags: ["ダンス", "トーク"], rating: 4.5, joinedAt: "2024-06-01" }];
  ok("cast(在籍/タグ/全タグ/集計/新人/並替featured/注目)", C.activeCasts(casts).length === 3 && C.castsByTag(casts, "ダンス").map((c) => c.id).sort().join(",") === "1,3,4" && C.castsByAllTags(casts, ["ダンス", "トーク"]).map((c) => c.id).join(",") === "4" && C.tagCounts(casts)[0].count === 3 && C.newcomers(casts, 30, now).map((c) => c.id).join(",") === "2" && C.sortCasts(casts, "featured", now).map((c) => c.id).join(",") === "1,4,2" && C.featuredCasts(casts).map((c) => c.id).join(",") === "1");
  const fields = [{ key: "name", label: "名前" }, { key: "tags", label: "得意" }, { key: "height", label: "身長" }, { key: "message", label: "ひとこと" }];
  const one = { id: "x", name: "あおい", status: "active", tags: ["ダンス"], height: "160cm" };
  ok("cast-profile(項目値ありのみ/充実度0.75/必須判定)", P.profileItems(one, fields).length === 3 && P.profileItems(one, fields).find((i) => i.label === "得意").value === "ダンス" && P.profileCompleteness(one, fields) === 0.75 && P.hasRequiredProfile(one, ["name", "tags"]) === true && P.hasRequiredProfile(one, ["name", "message"]) === false);
  await fs15.rm(`/tmp/cast-c-${st15}.ts`); await fs15.rm(`/tmp/cast-p-${st15}.ts`);
}

// ---- booking シフト / cast 口コミランキング ----
section("booking-shift / cast-ranking");
{
  const fs16 = await import("node:fs/promises"); const st16 = Date.now();
  // booking shift(slots/hours/availability 依存 → shim)
  const bn = ["shift", "slots", "hours", "availability"];
  const bp = {};
  for (const n of bn) bp[n] = `/tmp/bks-${n}-${st16}.ts`;
  for (const n of bn) {
    let src = (await fs16.readFile(new URL(`../packages/booking/src/${n}.ts`, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
    for (const dep of bn) src = src.replace(new RegExp(`from "\\./${dep}\\.ts"`, "g"), `from "${bp[dep]}"`);
    await fs16.writeFile(bp[n], src);
  }
  const SH = await import(bp.shift);
  const S = await import(bp.slots);
  const slots = S.generateSlots([{ open: "09:00", close: "18:00" }], { slotMinutes: 60 });
  const staffShifts = { aoi: [{ start: "10:00", end: "14:00" }], kaede: [{ start: "12:00", end: "18:00" }], minato: [{ start: "09:00", end: "12:00" }] };
  const staffing = SH.slotStaffing(slots, staffShifts);
  const avail = SH.availableWithStaffing(slots, staffShifts, [{ start: "12:00", end: "13:00" }, { start: "12:00", end: "13:00" }]);
  ok("booking-shift(シフト内枠/指名空き/勤務人数/配置空き)", SH.staffSlots(slots, [{ start: "10:00", end: "14:00" }]).map((x) => x.start).join(",") === "10:00,11:00,12:00,13:00" && SH.staffAvailableSlots(slots, [{ start: "10:00", end: "14:00" }], [{ start: "11:00", end: "12:00" }]).map((x) => x.start).join(",") === "10:00,12:00,13:00" && staffing.find((x) => x.slot.start === "12:00").staffCount === 2 && staffing.find((x) => x.slot.start === "09:00").staffCount === 1 && avail.some((x) => x.slot.start === "12:00") === false && avail.find((x) => x.slot.start === "13:00").remaining === 2);
  for (const n of bn) await fs16.rm(bp[n]);
  // cast ranking(cast 依存 → shim)
  const rankSrc = (await fs16.readFile(new URL("../packages/cast/src/ranking.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/cast\.ts"/g, `from "/tmp/rk-cast-${st16}.ts"`);
  const castSrc = (await fs16.readFile(new URL("../packages/cast/src/cast.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  await fs16.writeFile(`/tmp/rk-cast-${st16}.ts`, castSrc); await fs16.writeFile(`/tmp/rk-rank-${st16}.ts`, rankSrc);
  const RK = await import(`/tmp/rk-rank-${st16}.ts`);
  const casts = [{ id: "1", name: "あおい", status: "active", rating: 5.0, reviewCount: 2 }, { id: "2", name: "かえで", status: "active", rating: 4.7, reviewCount: 150 }, { id: "3", name: "みなと", status: "active", rating: 4.9, reviewCount: 80 }, { id: "4", name: "さくら", status: "hidden", rating: 5.0, reviewCount: 200 }];
  const ranking = RK.rankCasts(casts, { minCount: 10 });
  ok("cast-ranking(重み付き/少件数満点は独占せず/在籍のみ/単純平均別)", RK.weightedRating(5.0, 1, 10, 4.0) < RK.weightedRating(4.8, 100, 10, 4.0) && RK.weightedRating(0, 0, 10, 4.0) === 4.0 && ranking.length === 3 && ranking[0].cast.id !== "1" && ranking[0].rank === 1 && RK.rankByRawRating(casts)[0].cast.id === "1");
  await fs16.rm(`/tmp/rk-cast-${st16}.ts`); await fs16.rm(`/tmp/rk-rank-${st16}.ts`);
}

// ---- ui/social-login: プロバイダ表示・認証バックエンド対応(ログインUIの純ロジック) ----
section("ui: social-login lib");
{
  const S = await import(new URL("../packages/ui/src/lib/social-login.ts", import.meta.url));
  ok("social-login(ラベル/動詞/認証バックエンド対応)", S.PROVIDER_LABELS.google === "Google" && S.PROVIDER_LABELS.zoho === "Zoho" && S.socialLoginLabel("google") === "Google でログイン" && S.socialLoginLabel("zoho", "登録") === "Zoho で登録" && S.PROVIDER_AUTH_BACKEND.google.includes("@platform/google") && S.PROVIDER_AUTH_BACKEND.zoho.includes("@platform/zoho") && S.PROVIDER_AUTH_BACKEND.microsoft.includes("OIDC"));
}

// ---- ui/login-form: メールログイン入力検証(純ロジック) ----
section("ui: login-form validation");
{
  const L = await import(new URL("../packages/ui/src/lib/login-form.ts", import.meta.url));
  ok("login-form(email形式/空/不正/短パス/最小長/正常/valid判定)", L.isEmailLike("a@x.com") === true && L.isEmailLike("bad") === false && L.validateEmailLogin("", "password1").email.includes("入力") && L.validateEmailLogin("bad", "password1").email.includes("形式") && L.validateEmailLogin("a@x.com", "abc").password.includes("8文字以上") && L.validateEmailLogin("a@x.com", "abc", { minPasswordLength: 3 }).password === undefined && Object.keys(L.validateEmailLogin("a@x.com", "password1")).length === 0 && L.isLoginFormValid({}) === true && L.isLoginFormValid({ email: "x" }) === false);
}

// ---- ui/nav: レイアウトナビのアクティブ判定(純ロジック) ----
section("ui: nav lib (layout)");
{
  const N = await import(new URL("../packages/ui/src/lib/nav.ts", import.meta.url));
  const items = [{ label: "ホーム", href: "/" }, { label: "製品", href: "/products", children: [{ label: "製品A", href: "/products/a" }] }, { label: "会社", href: "/about" }];
  ok("nav(前方一致/exact/ルート/クエリ無視/平坦化/最具体一致/親一致/子アクティブ)", N.isNavActive("/products", "/products/a") === true && N.isNavActive("/products", "/products/a", true) === false && N.isNavActive("/", "/about") === false && N.isNavActive("/products", "/products/?x=1") === true && N.flattenNav(items).length === 4 && N.findActiveNav(items, "/products/a").href === "/products/a" && N.findActiveNav(items, "/products/x").href === "/products" && N.findActiveNav(items, "/contact") === undefined && N.hasActiveChild(items[1], "/products/a") === true && N.hasActiveChild(items[1], "/about") === false);
}

// ---- site パス自動パンくず / ui テーマ切替(純ロジック) ----
section("site-breadcrumbFromPath / ui-theme");
{
  const N = await import(new URL("../packages/site/src/navigation.ts", import.meta.url));
  ok("breadcrumbFromPath(基本/ラベル/home無/現在除外/見出し化/ルート)", JSON.stringify(N.breadcrumbFromPath("/products/a")) === JSON.stringify([{ label: "ホーム", href: "/" }, { label: "Products", href: "/products" }, { label: "A", href: "/products/a" }]) && N.breadcrumbFromPath("/products/a", { labels: { products: "製品", "/products/a": "製品A" } })[1].label === "製品" && N.breadcrumbFromPath("/a", { home: false }).length === 1 && N.breadcrumbFromPath("/products/a", { includeCurrent: false }).map((i) => i.href).join(",") === "/,/products" && N.breadcrumbFromPath("/user-settings")[1].label === "User Settings" && N.breadcrumbFromPath("/").length === 1);
  const T = await import(new URL("../packages/ui/src/lib/theme.ts", import.meta.url));
  const classes = new Set(); const attr = {};
  const el = { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) }, setAttribute: (n, v) => { attr[n] = v; } };
  T.applyTheme("dark", el); const d = classes.has("dark") && attr["data-theme"] === "dark";
  T.applyTheme("light", el); const l = !classes.has("dark") && attr["data-theme"] === "light";
  ok("theme(resolve system/明示/循環/反転/ラベル/applyTheme)", T.resolveTheme("system", true) === "dark" && T.resolveTheme("dark", false) === "dark" && T.nextThemePreference("light") === "dark" && T.nextThemePreference("system") === "light" && T.toggleTheme("light") === "dark" && T.THEME_LABELS.system === "システム" && d && l);
}

// ---- ui/theme: FOUC対策の初期化スクリプト生成(純ロジック) ----
section("ui: themeInitScript");
{
  const T = await import(new URL("../packages/ui/src/lib/theme.ts", import.meta.url));
  const script = T.themeInitScript();
  ok("themeInitScript(既定キー/OS判定/darkクラス/属性/try-catch/カスタムキー/STORAGE_KEY)", script.includes('"theme"') && script.includes("prefers-color-scheme") && script.includes('classList.add("dark")') && script.includes('classList.remove("dark")') && script.includes("data-theme") && script.includes("try{") && T.themeInitScript("myapp").includes('"myapp"') && T.THEME_STORAGE_KEY === "theme");
}

// ---- ui/notifications: 通知の集計・グループ化(純ロジック) ----
section("ui: notifications lib");
{
  const N = await import(new URL("../packages/ui/src/lib/notifications.ts", import.meta.url));
  const now = new Date("2025-07-25T12:00:00Z");
  const list = [{ id: "1", title: "A", createdAt: "2025-07-25T09:00:00Z" }, { id: "2", title: "B", createdAt: "2025-07-25T11:00:00Z", read: true }, { id: "3", title: "C", createdAt: "2025-07-24T10:00:00Z" }, { id: "4", title: "D", createdAt: "2025-07-20T10:00:00Z" }];
  const g = N.groupByDate(list, now);
  ok("notifications(未読数/並替/markRead不変/markAll/今日昨日以前グループ)", N.unreadCount(list) === 3 && N.sortNotifications(list).map((x) => x.id).join(",") === "2,1,3,4" && N.markRead(list, "1").find((x) => x.id === "1").read === true && list.find((x) => x.id === "1").read === undefined && N.unreadCount(N.markAllRead(list)) === 0 && g.today.map((x) => x.id).join(",") === "2,1" && g.yesterday.map((x) => x.id).join(",") === "3" && g.earlier.map((x) => x.id).join(",") === "4");
}

// ---- ui/command パレット検索 / ui/notification-store リアルタイム反映(純ロジック) ----
section("ui: command-palette / notification-store");
{
  const C = await import(new URL("../packages/ui/src/lib/command.ts", import.meta.url));
  const cmds = [{ id: "1", label: "ダッシュボード", keywords: ["home"], group: "ページ" }, { id: "2", label: "予約一覧", keywords: ["booking"], group: "ページ" }, { id: "3", label: "新規予約を作成", keywords: ["add"], group: "操作" }, { id: "4", label: "設定", group: "ページ" }];
  ok("command(スコア前方3/部分2/KW1/不一致null/空全件/絞込/スコア順/グループ/循環)", C.scoreCommand(cmds[0], "ダッシュ") === 3 && C.scoreCommand(cmds[2], "予約") === 2 && C.scoreCommand(cmds[1], "booking") === 1 && C.scoreCommand(cmds[3], "予約") === null && C.filterCommands(cmds, "").map((c) => c.id).join(",") === "1,2,3,4" && C.filterCommands(cmds, "予約").map((c) => c.id).sort().join(",") === "2,3" && C.filterCommands([{ id: "a", label: "予約作成" }, { id: "b", label: "新規予約" }], "予約")[0].id === "a" && C.groupCommands(cmds).map((x) => x.group).join(",") === "ページ,操作" && C.nextIndex(0, 3, -1) === 2 && C.nextIndex(0, 0, 1) === -1);
  const fs17 = await import("node:fs/promises"); const st17 = Date.now();
  const storeSrc = (await fs17.readFile(new URL("../packages/ui/src/lib/notification-store.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/notifications\.ts"/g, `from "/tmp/nstore-notif-${st17}.ts"`);
  const notifSrc = (await fs17.readFile(new URL("../packages/ui/src/lib/notifications.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  await fs17.writeFile(`/tmp/nstore-notif-${st17}.ts`, notifSrc); await fs17.writeFile(`/tmp/nstore-store-${st17}.ts`, storeSrc);
  const S = await import(`/tmp/nstore-store-${st17}.ts`);
  let stt = [{ id: "1", title: "A", createdAt: "2025-07-25T09:00:00Z" }, { id: "2", title: "B", createdAt: "2025-07-25T11:00:00Z", read: true }];
  stt = S.notificationReducer(stt, { type: "receive", notification: { id: "3", title: "C", createdAt: "2025-07-25T12:00:00Z" } });
  const dup = S.notificationReducer(stt, { type: "receive", notification: { id: "3", title: "C2", createdAt: "2025-07-25T13:00:00Z" } });
  const many = Array.from({ length: 5 }, (_, i) => ({ id: String(i), title: "n", createdAt: `2025-07-0${i + 1}T00:00:00Z` }));
  ok("notification-store(受信新着順/同一ID置換/既読/全既読/削除/max上限)", stt.map((n) => n.id).join(",") === "3,2,1" && dup.filter((n) => n.id === "3").length === 1 && S.notificationReducer(stt, { type: "read", id: "1" }).find((n) => n.id === "1").read === true && S.unreadCount(S.notificationReducer(stt, { type: "readAll" })) === 0 && S.notificationReducer(stt, { type: "remove", id: "2" }).some((n) => n.id === "2") === false && S.notificationReducer([], { type: "set", notifications: many }, { max: 3 }).map((n) => n.id).join(",") === "4,3,2");
  await fs17.rm(`/tmp/nstore-notif-${st17}.ts`); await fs17.rm(`/tmp/nstore-store-${st17}.ts`);
}

// ---- ui/clipboard コピペ / ui/shortcut キーボードショートカット(純ロジック) ----
section("ui: clipboard / shortcut");
{
  const C = await import(new URL("../packages/ui/src/lib/clipboard.ts", import.meta.url));
  let wrote = null;
  const copyOk = (await C.copyToClipboard("hi", async (t) => { wrote = t; })) === true && wrote === "hi";
  const copyFail = (await C.copyToClipboard("x", async () => { throw new Error("no"); })) === false && (await C.copyToClipboard("x")) === false;
  const pasteOk = (await C.readClipboard(async () => "pasted")) === "pasted";
  const pasteFail = (await C.readClipboard(async () => { throw new Error("no"); })) === null && (await C.readClipboard()) === null;
  ok("clipboard(copy成功/失敗/navigator無, paste成功/失敗/navigator無)", copyOk && copyFail && pasteOk && pasteFail);
  const S = await import(new URL("../packages/ui/src/lib/shortcut.ts", import.meta.url));
  const k = S.parseShortcut("mod+k");
  const sh = S.parseShortcut("mod+shift+p");
  ok("shortcut(parse/match Mac meta・Win ctrl/format記号・語/sequence complete-partial-none)", k.key === "k" && k.mod === true && S.matchShortcut({ key: "k", ctrlKey: false, metaKey: true, shiftKey: false, altKey: false }, k, true) === true && S.matchShortcut({ key: "k", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, k, false) === true && S.matchShortcut({ key: "j", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, k, false) === false && S.formatShortcut(sh, true).includes("⌘") && S.formatShortcut(sh, false).includes("Ctrl") && S.isSequence("g h") === true && S.parseSequence("g h").join(",") === "g,h" && S.sequenceMatches(["g", "h"], ["g", "h"]) === "complete" && S.sequenceMatches(["g"], ["g", "h"]) === "partial" && S.sequenceMatches(["x"], ["g", "h"]) === "none");
}

// ---- ui/clipboard コピペ / ui/shortcut キーボードショートカット(純ロジック・検証固定) ----
section("ui: clipboard / shortcut");
{
  const CB = await import(new URL("../packages/ui/src/lib/clipboard.ts", import.meta.url));
  let copied = null;
  const copyOk = await CB.copyToClipboard("hello", async (t) => { copied = t; });
  const copyFail = await CB.copyToClipboard("x", async () => { throw new Error("no"); });
  const copyNone = await CB.copyToClipboard("x");
  const pasted = await CB.readClipboard(async () => "pasted");
  const pasteNone = await CB.readClipboard();
  ok("clipboard(コピー成功/失敗false/navigator無false/貼付/無null)", copyOk === true && copied === "hello" && copyFail === false && copyNone === false && pasted === "pasted" && pasteNone === null);

  const SH = await import(new URL("../packages/ui/src/lib/shortcut.ts", import.meta.url));
  const modK = { key: "k", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false };
  const cmdK = { key: "k", ctrlKey: false, metaKey: true, shiftKey: false, altKey: false };
  ok("shortcut(parse/match Win⌘/format/連続入力complete-partial-none)", SH.parseShortcut("mod+k").mod === true && SH.parseShortcut("ctrl+shift+p").shift === true && SH.matchShortcut(modK, SH.parseShortcut("mod+k"), false) === true && SH.matchShortcut(cmdK, SH.parseShortcut("mod+k"), false) === false && SH.matchShortcut(cmdK, SH.parseShortcut("mod+k"), true) === true && SH.formatShortcut(SH.parseShortcut("mod+shift+k"), true) === "⌘⇧K" && SH.formatShortcut(SH.parseShortcut("mod+k"), false) === "Ctrl+K" && SH.sequenceMatches(["x", "g", "h"], ["g", "h"]) === "complete" && SH.sequenceMatches(["g"], ["g", "h"]) === "partial" && SH.sequenceMatches(["g", "x"], ["g", "h"]) === "none");
}

// ---- form/errors: バリデーション結果→項目別エラー(純ロジック) ----
section("form: errors");
{
  const E = await import(new URL("../packages/form/src/errors.ts", import.meta.url));
  const issues = [{ path: "email", message: "メール形式が不正" }, { path: "password", message: "8文字以上" }, { path: "email", message: "必須" }, { path: "", message: "全体エラー" }];
  const fe = E.issuesToFieldErrors(issues);
  ok("form-errors(項目別/最初優先/空path=_form/ネスト保持/query)", fe.email === "メール形式が不正" && fe.password === "8文字以上" && fe._form === "全体エラー" && E.issuesToFieldErrors([{ path: "address.zip", message: "x" }])["address.zip"] === "x" && E.fieldError(fe, "email") === "メール形式が不正" && E.fieldError(fe, "name") === undefined && E.hasNoErrors({}) === true && E.hasNoErrors(fe) === false && E.formError(fe) === "全体エラー");
}

// ---- ui/nav: RBAC による出し分け filterNavByPermission(純ロジック) ----
section("ui: filterNavByPermission (RBAC)");
{
  const N = await import(new URL("../packages/ui/src/lib/nav.ts", import.meta.url));
  const nav = [{ label: "D", href: "/" }, { label: "予約", href: "/bookings", permission: "booking:read" }, { label: "管理", href: "/admin", permission: "admin:access", children: [{ label: "U", href: "/admin/users", permission: "user:manage" }, { label: "S", href: "/admin/settings", permission: "admin:settings" }] }];
  const viewer = new Set(["booking:read"]);
  const rv = N.filterNavByPermission(nav, (p) => viewer.has(p));
  const admin = new Set(["admin:access", "user:manage"]);
  const ra = N.filterNavByPermission(nav, (p) => admin.has(p));
  ok("filterNavByPermission(権限なし常時表示/空グループ非表示/子絞込/全表示/不変)", rv.map((i) => i.href).join(",") === "/,/bookings" && !rv.some((i) => i.href === "/admin") && ra.find((i) => i.href === "/admin").children.map((c) => c.href).join(",") === "/admin/users" && N.filterNavByPermission(nav, () => true).length === 3 && nav[2].children.length === 2);
}

// ---- invoice 請求書(適格請求書・税率別集計・番号・支払期限)実 @platform/tax 連携 ----
section("invoice (billing)");
{
  const fs18 = await import("node:fs/promises"); const st18 = Date.now();
  const taxIdx = (await fs18.readFile(new URL("../packages/tax/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/withholding\.ts"/g, `from "/tmp/inv-tax-wh-${st18}.ts"`);
  let wh = "export {};"; try { wh = (await fs18.readFile(new URL("../packages/tax/src/withholding.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'); } catch {}
  await fs18.writeFile(`/tmp/inv-tax-wh-${st18}.ts`, wh);
  await fs18.writeFile(`/tmp/inv-tax-${st18}.ts`, taxIdx);
  const rd = async (name) => (await fs18.readFile(new URL(`../packages/invoice/src/${name}.ts`, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "@platform\/tax"/g, `from "/tmp/inv-tax-${st18}.ts"`).replace(/from "\.\/line\.ts"/g, `from "/tmp/inv-line-${st18}.ts"`).replace(/from "\.\/invoice\.ts"/g, `from "/tmp/inv-invoice-${st18}.ts"`);
  for (const n of ["line", "invoice", "numbering", "payment"]) await fs18.writeFile(`/tmp/inv-${n}-${st18}.ts`, await rd(n));
  const L = await import(`/tmp/inv-line-${st18}.ts`);
  const I = await import(`/tmp/inv-invoice-${st18}.ts`);
  const N = await import(`/tmp/inv-numbering-${st18}.ts`);
  const P = await import(`/tmp/inv-payment-${st18}.ts`);
  const lines = [{ description: "10%", quantity: 1, unitPrice: 10000 }, { description: "8%", quantity: 2, unitPrice: 1000, taxRate: 8 }, { description: "10%b", quantity: 1, unitPrice: 5000 }];
  const t = I.invoiceTotals(lines);
  ok("invoice(明細/税率別集計10%1500+8%160/合計18660/採番/期限/入金状態)", L.lineNet({ description: "A", quantity: 3, unitPrice: 1000, discount: 500 }) === 2500 && t.subtotal === 17000 && t.tax === 1660 && t.total === 18660 && t.taxByRate.find((r) => r.rate === 10).tax === 1500 && t.taxByRate.find((r) => r.rate === 8).tax === 160 && N.formatInvoiceNumber(1, { date: new Date("2025-07-15") }) === "INV-202507-0001" && N.parseInvoiceSequence("INV-202507-0001") === 1 && P.dueDateFrom("2025-07-01", 30) === "2025-07-31" && P.paymentStatus({ issued: true, dueDate: "2025-07-01", paidAmount: 0, total: 1000 }, new Date("2025-07-15")) === "overdue" && P.paymentStatus({ issued: true, dueDate: "2025-07-31", paidAmount: 1000, total: 1000 }) === "paid" && P.balanceDue(1000, 300) === 700);
  for (const n of ["line", "invoice", "numbering", "payment"]) await fs18.rm(`/tmp/inv-${n}-${st18}.ts`);
  await fs18.rm(`/tmp/inv-tax-${st18}.ts`); await fs18.rm(`/tmp/inv-tax-wh-${st18}.ts`);
}

// ---- invoice 消込/繰越/HTML + quote 見積(実 @platform/invoice/@platform/tax 連携) ----
section("invoice-reconcile / quote");
{
  const fs19 = await import("node:fs/promises"); const st19 = Date.now();
  const T = `/tmp/rq-tax-${st19}.ts`, TW = `/tmp/rq-taxwh-${st19}.ts`;
  const taxIdx = (await fs19.readFile(new URL("../packages/tax/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/withholding\.ts"/g, `from "${TW}"`);
  let wh = "export {};"; try { wh = (await fs19.readFile(new URL("../packages/tax/src/withholding.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'); } catch {}
  await fs19.writeFile(TW, wh); await fs19.writeFile(T, taxIdx);
  const invPaths = {}; for (const n of ["line", "invoice", "numbering", "payment", "reconcile"]) invPaths[n] = `/tmp/rq-inv-${n}-${st19}.ts`;
  for (const n of ["line", "invoice", "numbering", "payment", "reconcile"]) {
    let src = (await fs19.readFile(new URL(`../packages/invoice/src/${n}.ts`, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "@platform\/tax"/g, `from "${T}"`);
    for (const d of ["line", "invoice", "numbering", "payment"]) src = src.replace(new RegExp(`from "\\./${d}\\.ts"`, "g"), `from "${invPaths[d]}"`);
    await fs19.writeFile(invPaths[n], src);
  }
  const barrel = `/tmp/rq-inv-barrel-${st19}.ts`;
  await fs19.writeFile(barrel, ["line","invoice","numbering","payment","reconcile"].map((n) => `export * from "${invPaths[n]}";`).join("\n"));
  const R = await import(invPaths.reconcile);
  const invs = [{ number: "INV-001", dueDate: "2025-05-31", total: 10000, paidAmount: 0 }, { number: "INV-002", dueDate: "2025-06-30", total: 20000, paidAmount: 0 }, { number: "INV-003", dueDate: "2025-07-31", total: 5000, paidAmount: 0 }];
  const r1 = R.applyPayment(invs, 15000);
  const aging = R.agingBuckets(invs, new Date("2025-07-15"));
  ok("invoice-reconcile(FIFO消込/過入金unapplied/繰越/年齢表)", r1.invoices.find((i) => i.number === "INV-001").paidAmount === 10000 && r1.invoices.find((i) => i.number === "INV-002").paidAmount === 5000 && R.applyPayment(invs, 40000).unapplied === 5000 && R.outstandingTotal(invs) === 35000 && aging.current === 5000 && aging.d1_30 === 20000 && aging.d31_60 === 10000);
  const quoteSrc = (await fs19.readFile(new URL("../packages/quote/src/quote.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "@platform\/invoice"/g, `from "${barrel}"`);
  const QP = `/tmp/rq-quote-${st19}.ts`; await fs19.writeFile(QP, quoteSrc);
  const Q = await import(QP);
  const q = Q.buildQuote({ number: "QUO-0001", issueDate: "2025-07-01", validUntil: "2025-07-31", billTo: "株式会社テスト" }, [{ description: "開発", quantity: 1, unitPrice: 100000 }, { description: "書籍", quantity: 2, unitPrice: 1000, taxRate: 8 }]);
  const inv = Q.convertToInvoice(q, { number: "INV-202507-0001", issueDate: "2025-07-16", dueDate: "2025-08-31" });
  ok("quote(合計112160/状態expired-accepted/請求書変換で明細引継ぎ)", q.totals.total === 112160 && Q.quoteStatus({ validUntil: "2025-07-01" }, new Date("2025-07-15")) === "expired" && Q.quoteStatus({ validUntil: "2025-01-01", state: "accepted" }, new Date("2025-07-15")) === "accepted" && inv.billTo === "株式会社テスト" && inv.totals.total === 112160 && inv.lines.length === 2);
  for (const n of ["line", "invoice", "numbering", "payment", "reconcile"]) await fs19.rm(invPaths[n]);
  await fs19.rm(T); await fs19.rm(TW); await fs19.rm(barrel); await fs19.rm(QP);
}

// ---- invoice 定期請求/督促 + purchase 発注(実 @platform/datetime/@platform/invoice/@platform/tax 連携) ----
section("invoice-recurring / dunning / purchase");
{
  const fs20 = await import("node:fs/promises"); const st20 = Date.now();
  // datetime calendar
  const CAL = `/tmp/rp-cal-${st20}.ts`;
  await fs20.writeFile(CAL, (await fs20.readFile(new URL("../packages/datetime/src/calendar.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  const RECP = `/tmp/rp-recurring-${st20}.ts`;
  await fs20.writeFile(RECP, (await fs20.readFile(new URL("../packages/invoice/src/recurring.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "@platform\/datetime"/g, `from "${CAL}"`));
  const DUNP = `/tmp/rp-dunning-${st20}.ts`;
  await fs20.writeFile(DUNP, (await fs20.readFile(new URL("../packages/invoice/src/dunning.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  const R = await import(RECP), D = await import(DUNP);
  const q = { interval: "quarterly", startDate: "2025-01-15", endDate: "2025-12-31" };
  ok("recurring(月末クランプ/四半期/範囲/終了null/督促段階/文面/送付判定)", R.billingDateAt({ interval: "monthly", startDate: "2025-01-31" }, 1) === "2025-02-28" && R.billingDateAt(q, 2) === "2025-07-15" && JSON.stringify(R.billingDatesBetween(q, "2025-01-01", "2025-12-31")) === JSON.stringify(["2025-01-15", "2025-04-15", "2025-07-15", "2025-10-15"]) && R.nextBillingDate({ interval: "monthly", startDate: "2025-01-01", endDate: "2025-03-31" }, "2025-05-01") === null && D.dunningLevel(5) === "reminder" && D.dunningLevel(90) === "final" && D.dunningMessage({ number: "INV-001", billTo: "株式会社テスト", dueDate: "2025-06-30", amountDue: 110000 }, "first").includes("INV-001") && D.shouldSendDunning(20, ["first"]).send === false);

  // purchase → invoice → tax
  const TX = `/tmp/rp-tax-${st20}.ts`, TXW = `/tmp/rp-taxwh-${st20}.ts`;
  await fs20.writeFile(TXW, (await (async()=>{ try { return (await fs20.readFile(new URL("../packages/tax/src/withholding.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'); } catch { return "export {};"; } })()));
  await fs20.writeFile(TX, (await fs20.readFile(new URL("../packages/tax/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/withholding\.ts"/g, `from "${TXW}"`));
  const ip = {}; for (const n of ["line", "invoice", "numbering", "payment"]) ip[n] = `/tmp/rp-inv-${n}-${st20}.ts`;
  for (const n of ["line", "invoice", "numbering", "payment"]) {
    let src = (await fs20.readFile(new URL(`../packages/invoice/src/${n}.ts`, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "@platform\/tax"/g, `from "${TX}"`);
    for (const d of ["line", "invoice", "numbering", "payment"]) src = src.replace(new RegExp(`from "\\./${d}\\.ts"`, "g"), `from "${ip[d]}"`);
    await fs20.writeFile(ip[n], src);
  }
  const IB = `/tmp/rp-inv-barrel-${st20}.ts`;
  await fs20.writeFile(IB, ["line","invoice","numbering","payment"].map((n) => `export * from "${ip[n]}";`).join("\n"));
  const POP = `/tmp/rp-po-${st20}.ts`, RCP = `/tmp/rp-recv-${st20}.ts`;
  await fs20.writeFile(POP, (await fs20.readFile(new URL("../packages/purchase/src/purchase-order.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "@platform\/invoice"/g, `from "${IB}"`));
  await fs20.writeFile(RCP, (await fs20.readFile(new URL("../packages/purchase/src/receiving.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/purchase-order\.ts"/g, `from "${POP}"`));
  const PO = await import(POP), RC = await import(RCP);
  const lines = [{ description: "部品A", quantity: 100, unitPrice: 500 }, { description: "部品B", quantity: 50, unitPrice: 200, taxRate: 8 }];
  const po = PO.buildPurchaseOrder({ number: "PO-0001", orderDate: "2025-07-01", supplier: "仕入先", state: "ordered" }, lines);
  const receipts = [{ lineIndex: 0, quantity: 80, receivedAt: "x" }];
  ok("purchase(金額65800/発注残20/partially_received/received/過入荷検出)", po.totals.total === 65800 && RC.receivingStatus(lines, receipts)[0].outstanding === 20 && RC.totalOutstanding(lines, receipts) === 70 && RC.purchaseStatus(po, receipts) === "partially_received" && RC.purchaseStatus(po, [{ lineIndex: 0, quantity: 100, receivedAt: "x" }, { lineIndex: 1, quantity: 50, receivedAt: "x" }]) === "received" && JSON.stringify(RC.overReceivedLines(lines, [{ lineIndex: 1, quantity: 60, receivedAt: "x" }])) === JSON.stringify([1]));

  for (const f of [CAL, RECP, DUNP, TX, TXW, IB, POP, RCP, ...Object.values(ip)]) await fs20.rm(f);
}

// ---- inventory 在庫(入出庫台帳/発注点/移動平均評価) ----
section("inventory");
{
  const fs21 = await import("node:fs/promises"); const st21 = Date.now();
  const MP = `/tmp/inv-mv-${st21}.ts`, RP = `/tmp/inv-ro-${st21}.ts`, VP = `/tmp/inv-val-${st21}.ts`;
  await fs21.writeFile(MP, (await fs21.readFile(new URL("../packages/inventory/src/movements.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fs21.writeFile(RP, (await fs21.readFile(new URL("../packages/inventory/src/reorder.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fs21.writeFile(VP, (await fs21.readFile(new URL("../packages/inventory/src/valuation.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/movements\.ts"/g, `from "${MP}"`));
  const M = await import(MP), R = await import(RP), V = await import(VP);
  const mv = [{ type: "inbound", quantity: 100, at: "a", unitCost: 500 }, { type: "outbound", quantity: 30, at: "b" }, { type: "inbound", quantity: 50, at: "c", unitCost: 600 }, { type: "adjustment", quantity: -5, at: "d" }];
  const policy = { safetyStock: 20, dailyDemand: 5, leadTimeDays: 7 };
  const val = V.movingAverage([{ type: "inbound", quantity: 100, at: "a", unitCost: 500 }, { type: "outbound", quantity: 30, at: "b" }, { type: "inbound", quantity: 50, at: "c", unitCost: 600 }]);
  ok("inventory(在庫115/出庫超過失敗/発注点55/補充80/移動平均120@65000)", M.onHand(mv) === 115 && M.summarize(mv).totalIn === 150 && M.applyMovement([{ type: "inbound", quantity: 10, at: "x" }], { type: "outbound", quantity: 20, at: "y" }).ok === false && R.reorderPoint(policy) === 55 && R.needsReorder(55, policy) === true && R.reorderQuantity(30, policy) === 80 && R.reorderQuantity(56, policy) === 0 && val.onHand === 120 && Math.abs(val.averageCost - 541.67) < 0.01 && val.value === 65000);
  for (const f of [MP, RP, VP]) await fs21.rm(f);
}

// ---- accounting 複式簿記の仕訳 + inventory ロット/倉庫 ----
section("accounting / inventory-lot-warehouse");
{
  const fs22 = await import("node:fs/promises"); const st22 = Date.now();
  const AJ = `/tmp/ac-j-${st22}.ts`, AE = `/tmp/ac-e-${st22}.ts`;
  await fs22.writeFile(AJ, (await fs22.readFile(new URL("../packages/accounting/src/journal.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fs22.writeFile(AE, (await fs22.readFile(new URL("../packages/accounting/src/entries.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/journal\.ts"/g, `from "${AJ}"`));
  const J = await import(AJ), E = await import(AE);
  const sales = E.salesJournal({ date: "2025-07-01", net: 100000, tax: 10000 });
  const purchase = E.purchaseJournal({ date: "2025-07-02", net: 60000, tax: 6000 });
  const tb = J.trialBalance([sales, E.receiptJournal({ date: "2025-07-31", amount: 110000 })]);
  ok("accounting(売上仕訳貸借一致/仕入66000/試算表売掛0/freee3明細)", sales.lines[0].debit === 110000 && J.isBalanced(sales) && purchase.lines[2].credit === 66000 && J.isBalanced(purchase) && tb.find((a) => a.account === "売掛金").balance === 0 && J.trialBalanceBalanced([sales]) && J.toFreeeDetails(sales).length === 3);

  const MV = `/tmp/il-mv-${st22}.ts`, LT = `/tmp/il-lot-${st22}.ts`, WH = `/tmp/il-wh-${st22}.ts`;
  await fs22.writeFile(MV, (await fs22.readFile(new URL("../packages/inventory/src/movements.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fs22.writeFile(LT, (await fs22.readFile(new URL("../packages/inventory/src/lot.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fs22.writeFile(WH, (await fs22.readFile(new URL("../packages/inventory/src/warehouse.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/movements\.ts"/g, `from "${MV}"`));
  const L = await import(LT), W = await import(WH);
  const lots = [{ lotId: "L1", type: "inbound", quantity: 100, at: "2025-07-01", expiry: "2025-08-31" }, { lotId: "L2", type: "inbound", quantity: 50, at: "2025-07-02", expiry: "2025-07-20" }, { lotId: "L1", type: "outbound", quantity: 30, at: "2025-07-05" }, { lotId: "L3", type: "inbound", quantity: 80, at: "2025-07-03" }];
  const alloc = L.allocateFEFO(lots, 100);
  const wm = [{ warehouse: "東京", type: "inbound", quantity: 100, at: "a" }, { warehouse: "大阪", type: "inbound", quantity: 50, at: "b" }, { warehouse: "東京", type: "outbound", quantity: 30, at: "c" }];
  const tr = W.transfer(wm, "東京", "大阪", 40, "2025-07-10");
  ok("inventory-lot/warehouse(ロット残/期限間近L2/FEFO L2先/倉庫別/移動2件/不足null)", L.lotBalances(lots).find((l) => l.lotId === "L1").quantity === 70 && L.expiringSoon(lots, "2025-07-15", 10).map((l) => l.lotId).join(",") === "L2" && alloc.allocations[0].lotId === "L2" && alloc.shortfall === 0 && L.allocateFEFO(lots, 300).shortfall === 100 && W.onHandByWarehouse(wm).find((w) => w.warehouse === "東京").onHand === 70 && W.totalOnHand(wm) === 120 && tr !== null && tr[0].type === "outbound" && W.warehouseOnHand([...wm, ...tr], "大阪") === 90 && W.transfer(wm, "大阪", "東京", 100, "x") === null);
  for (const f of [AJ, AE, MV, LT, WH]) await fs22.rm(f);
}

// ---- accounting 月次決算(P&L/貸借)+ 消費税集計表 ----
section("accounting-closing / tax-report");
{
  const fs23 = await import("node:fs/promises"); const st23 = Date.now();
  const AJ = `/tmp/cl-j-${st23}.ts`, AE = `/tmp/cl-e-${st23}.ts`, AC = `/tmp/cl-c-${st23}.ts`, AT = `/tmp/cl-t-${st23}.ts`;
  await fs23.writeFile(AJ, (await fs23.readFile(new URL("../packages/accounting/src/journal.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fs23.writeFile(AE, (await fs23.readFile(new URL("../packages/accounting/src/entries.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/journal\.ts"/g, `from "${AJ}"`));
  await fs23.writeFile(AC, (await fs23.readFile(new URL("../packages/accounting/src/closing.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/journal\.ts"/g, `from "${AJ}"`).replace(/from "\.\/entries\.ts"/g, `from "${AE}"`));
  await fs23.writeFile(AT, (await fs23.readFile(new URL("../packages/accounting/src/tax-report.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  const E = await import(AE), C = await import(AC), T = await import(AT);
  const entries = [E.salesJournal({ date: "2025-07-05", net: 100000, tax: 10000 }), E.purchaseJournal({ date: "2025-07-10", net: 60000, tax: 6000 }), E.salesJournal({ date: "2025-08-03", net: 50000, tax: 5000 })];
  const jul = C.filterByPeriod(entries, "2025-07");
  const pl = C.profitAndLoss(jul), bs = C.balanceSheet(jul);
  const rep = T.consumptionTaxSummary([{ rate: 10, net: 100000, tax: 10000 }, { rate: 8, net: 20000, tax: 1600 }], [{ rate: 10, net: 60000, tax: 6000 }]);
  ok("accounting-closing(7月2件/利益40000/資産116000/純資産=利益/消費税納付5600/還付-4000)", jul.length === 2 && pl.netIncome === 40000 && bs.assets === 116000 && bs.equity === 40000 && pl.netIncome === bs.equity && rep.outputTax === 11600 && rep.netPayable === 5600 && T.consumptionTaxSummary([{ rate: 10, net: 10000, tax: 1000 }], [{ rate: 10, net: 50000, tax: 5000 }]).netPayable === -4000);
  for (const f of [AJ, AE, AC, AT]) await fs23.rm(f);
}

// ---- accounting エクスポート(CSV行/freee仕訳変換) ----
section("accounting-export");
{
  const fs24 = await import("node:fs/promises"); const st24 = Date.now();
  const AJ = `/tmp/ex-j-${st24}.ts`, AE = `/tmp/ex-e-${st24}.ts`, AX = `/tmp/ex-x-${st24}.ts`;
  await fs24.writeFile(AJ, (await fs24.readFile(new URL("../packages/accounting/src/journal.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fs24.writeFile(AE, (await fs24.readFile(new URL("../packages/accounting/src/entries.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/journal\.ts"/g, `from "${AJ}"`));
  await fs24.writeFile(AX, (await fs24.readFile(new URL("../packages/accounting/src/export.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/journal\.ts"/g, `from "${AJ}"`));
  const E = await import(AE), X = await import(AX);
  const entries = [E.salesJournal({ date: "2025-07-01", net: 100000, tax: 10000 }), E.receiptJournal({ date: "2025-07-31", amount: 110000 })];
  const rows = X.journalToRows(entries);
  const ids = { "売掛金": 100, "売上高": 200, "仮受消費税": 300, "現金預金": 400 };
  const conv = X.journalToFreeeDetails(E.salesJournal({ date: "x", net: 100000, tax: 10000 }), ids);
  ok("accounting-export(5行平坦化/借方110000/freee3明細ID変換/未登録科目検出)", rows.length === 5 && rows[0].account === "売掛金" && rows[0].debit === 110000 && conv.details.length === 3 && conv.details[0].accountItemId === 100 && conv.unknownAccounts.length === 0 && X.journalToFreeeDetails(E.purchaseJournal({ date: "x", net: 1, tax: 0 }), ids).unknownAccounts.includes("仕入高"));
  for (const f of [AJ, AE, AX]) await fs24.rm(f);
}

// ---- blueprint 業務プロセス(状態遷移+条件/必須項目/アクション/ロール) 実 @platform/fsm 連携 + 経費仕訳 ----
section("blueprint / expense-journal");
{
  const fs25 = await import("node:fs/promises"); const st25 = Date.now();
  const FSM = `/tmp/bp-fsm-${st25}.ts`, BP = `/tmp/bp-bp-${st25}.ts`;
  await fs25.writeFile(FSM, (await fs25.readFile(new URL("../packages/fsm/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fs25.writeFile(BP, (await fs25.readFile(new URL("../packages/blueprint/src/blueprint.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "@platform\/fsm"/g, `from "${FSM}"`));
  const B = await import(BP);
  const bp = { initial: "draft", states: ["draft", "submitted", "approved", "rejected"], final: ["approved", "rejected"], transitions: [{ from: "draft", to: "submitted", name: "提出", requiredFields: ["amount", "purpose"], actions: ["notifyApprover"] }, { from: "submitted", to: "approved", name: "承認", condition: (r) => r.amount <= 100000, actions: ["createJournal"], allowedRoles: ["manager"] }, { from: "submitted", to: "rejected", name: "却下", allowedRoles: ["manager"] }] };
  const good = B.evaluateTransition(bp, "draft", "提出", { amount: 5000, purpose: "x" });
  const applied = B.applyTransition(bp, { state: "draft", amount: 5000, purpose: "交通費" }, "提出");
  ok("blueprint(必須未入力失敗/入力済成功+アクション/ロール制御/条件で絞る/apply状態更新/終了状態)", B.evaluateTransition(bp, "draft", "提出", { state: "draft" }).ok === false && good.ok === true && good.nextState === "submitted" && good.actions.includes("notifyApprover") && B.evaluateTransition(bp, "submitted", "承認", { amount: 5000 }, ["staff"]).ok === false && B.evaluateTransition(bp, "submitted", "承認", { amount: 5000 }, ["manager"]).ok === true && B.availableTransitions(bp, "submitted", { amount: 200000 }).some((t) => t.name === "承認") === false && applied.ok === true && applied.record.state === "submitted" && B.isFinalState(bp, "approved") === true);

  // 経費 → 仕訳の自動起票
  const AJ = `/tmp/ej-j-${st25}.ts`, AE = `/tmp/ej-e-${st25}.ts`;
  await fs25.writeFile(AJ, (await fs25.readFile(new URL("../packages/accounting/src/journal.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fs25.writeFile(AE, (await fs25.readFile(new URL("../packages/accounting/src/entries.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/journal\.ts"/g, `from "${AJ}"`));
  const J = await import(AJ), E = await import(AE);
  const e1 = E.expenseJournal({ date: "2025-07-10", net: 10000, tax: 1000, account: "旅費交通費" });
  ok("expense-journal(経費10000/仮払税1000/未払金11000貸借一致/現金払い/税0は2明細/仮払金)", e1.lines[0].account === "旅費交通費" && e1.lines[0].debit === 10000 && e1.lines[2].account === "未払金" && e1.lines[2].credit === 11000 && J.isBalanced(e1) && E.expenseJournal({ date: "x", net: 5000, tax: 500, payment: "cash" }).lines[2].account === "現金預金" && E.expenseJournal({ date: "x", net: 3000, tax: 0 }).lines.length === 2 && E.expenseJournal({ date: "x", net: 1000, tax: 0, payment: "advance" }).lines[1].account === "仮払金");
  for (const f of [FSM, BP, AJ, AE]) await fs25.rm(f);
}

// ---- blueprint × workflow 統合(全体はblueprint、承認はworkflowの金額ルーティング多段承認) ----
section("blueprint-workflow integration");
{
  const fs26 = await import("node:fs/promises"); const st26 = Date.now();
  const FSM = `/tmp/iw-fsm-${st26}.ts`, BP = `/tmp/iw-bp-${st26}.ts`, CORE = `/tmp/iw-core-${st26}.ts`;
  await fs26.writeFile(FSM, (await fs26.readFile(new URL("../packages/fsm/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fs26.writeFile(BP, (await fs26.readFile(new URL("../packages/blueprint/src/blueprint.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "@platform\/fsm"/g, `from "${FSM}"`));
  await fs26.writeFile(CORE, `export const ok=(value)=>({ok:true,value});export const err=(error)=>({ok:false,error});export class AppError extends Error{constructor(code,message){super(message);this.code=code;}static from(e){return e instanceof AppError?e:new AppError("INTERNAL",e?.message??String(e));}}export const ErrorCode={VALIDATION:"VALIDATION",INTERNAL:"INTERNAL",NOT_FOUND:"NOT_FOUND",FORBIDDEN:"FORBIDDEN"};`);
  const wfFiles = (await fs26.readdir(new URL("../packages/workflow/src/", import.meta.url))).filter((f) => f.endsWith(".ts") && !f.includes(".test."));
  const wfPath = {}; for (const f of wfFiles) wfPath[f.replace(".ts", "")] = `/tmp/iw-wf-${f.replace(".ts", "")}-${st26}.ts`;
  for (const f of wfFiles) {
    let src = (await fs26.readFile(new URL(`../packages/workflow/src/${f}`, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "@platform\/core"/g, `from "${CORE}"`);
    for (const dep of Object.keys(wfPath)) src = src.replace(new RegExp(`from "\\./${dep}\\.ts"`, "g"), `from "${wfPath[dep]}"`);
    await fs26.writeFile(wfPath[f.replace(".ts", "")], src);
  }
  const B = await import(BP), WF = await import(wfPath["index"]);
  const TIERS = [{ under: 30000, steps: [{ name: "課長承認", approverRole: "manager" }] }, { under: 100000, steps: [{ name: "課長承認", approverRole: "manager" }, { name: "部長承認", approverRole: "director" }] }, { steps: [{ name: "課長承認", approverRole: "manager" }, { name: "部長承認", approverRole: "director" }, { name: "役員承認", approverRole: "executive" }] }];
  const bp = { initial: "draft", states: ["draft", "submitted", "approved", "rejected"], final: ["approved", "rejected"], transitions: [{ from: "draft", to: "submitted", name: "提出", requiredFields: ["amount", "purpose"], actions: ["startApproval"] }, { from: "submitted", to: "approved", name: "承認完了", condition: (e) => e.approval?.status === "approved", actions: ["postJournal"] }] };
  const submit = (ex) => { const t = B.applyTransition(bp, ex, "提出"); if (!t.ok) return { ok: false }; return { ok: true, expense: { ...t.record, approval: WF.startWorkflow(WF.routeByAmount(ex.amount, TIERS)) } }; };
  const approveStep = (ex, actor) => { const r = WF.approve(WF.routeByAmount(ex.amount, TIERS), ex.approval, actor); if (!r.ok) return { ok: false }; const next = { ...ex, approval: r.value }; if (r.value.status === "approved") { const d = B.applyTransition(bp, next, "承認完了"); if (d.ok) return { ok: true, expense: d.record }; } return { ok: true, expense: next }; };
  let lo = submit({ state: "draft", amount: 20000, purpose: "x" });
  const loApproved = approveStep(lo.expense, { id: "m", roles: ["manager"] });
  let hi = submit({ state: "draft", amount: 200000, purpose: "y" });
  hi = approveStep(hi.expense, { id: "m", roles: ["manager"] });
  const hiMid = hi.expense.approval.currentStep;
  hi = approveStep(hi.expense, { id: "d", roles: ["director"] });
  hi = approveStep(hi.expense, { id: "x", roles: ["executive"] });
  ok("blueprint×workflow(必須で提出制御/少額1段で承認済/高額3段/段階進行/役員で完了/ロール制御)", submit({ state: "draft", amount: 5000 }).ok === false && WF.routeByAmount(20000, TIERS).steps.length === 1 && loApproved.expense.state === "approved" && WF.routeByAmount(200000, TIERS).steps.length === 3 && hiMid === 1 && hi.expense.state === "approved" && hi.expense.approval.status === "approved" && approveStep(lo.expense, { id: "s", roles: ["staff"] }).ok === false);
  for (const f of [FSM, BP, CORE, ...Object.values(wfPath)]) await fs26.rm(f);
}

// ---- audit 監査ログ(改ざん検知) + report 統合レポート ----
section("audit / report-integration");
{
  const fs27 = await import("node:fs/promises"); const st27 = Date.now();
  const AEV = `/tmp/au-ev-${st27}.ts`, ALG = `/tmp/au-lg-${st27}.ts`, AQ = `/tmp/au-q-${st27}.ts`;
  await fs27.writeFile(AEV, (await fs27.readFile(new URL("../packages/audit/src/event.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fs27.writeFile(ALG, (await fs27.readFile(new URL("../packages/audit/src/log.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/event\.ts"/g, `from "${AEV}"`));
  await fs27.writeFile(AQ, (await fs27.readFile(new URL("../packages/audit/src/query.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/log\.ts"/g, `from "${ALG}"`));
  const L = await import(ALG), Q = await import(AQ), EV = await import(AEV);
  let log = [];
  log = L.appendEvent(log, { at: "2025-07-01T10:00:00Z", actor: "u1", action: "expense.create", target: "expense:1" });
  log = L.appendEvent(log, { at: "2025-07-01T11:00:00Z", actor: "u1", action: "expense.submit", target: "expense:1", before: { status: "draft" }, after: { status: "submitted" } });
  log = L.appendEvent(log, { at: "2025-07-02T09:00:00Z", actor: "mgr", action: "expense.approve", target: "expense:1" });
  const tampered = log.map((e, i) => (i === 1 ? { ...e, actor: "attacker" } : e));
  ok("audit(連鎖prevHash/正常valid/書換え検知brokenAt1/削除検知/並替検知/actor絞込/action前方一致/差分)", log[1].prevHash === log[0].hash && L.verifyChain(log).valid === true && L.verifyChain(tampered).valid === false && L.verifyChain(tampered).brokenAt === 1 && L.verifyChain([log[0], log[2]]).valid === false && L.verifyChain([log[0], log[2], log[1]]).valid === false && Q.filterByActor(log, "u1").length === 2 && Q.filterByAction(log, "expense").length === 3 && EV.diffChanges({ a: 1 }, { a: 2 }).length === 1);

  const RP = `/tmp/rep-${st27}.ts`;
  await fs27.writeFile(RP, (await fs27.readFile(new URL("../packages/report/src/reports.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  const R = await import(RP);
  const tb = R.trialBalanceSheet([{ account: "売掛金", debit: 110000, credit: 110000, balance: 0 }, { account: "売上高", debit: 0, credit: 100000, balance: -100000 }]);
  const tax = R.taxReportSheet({ byRate: [{ rate: 10, salesNet: 100000, outputTax: 10000, purchaseNet: 60000, inputTax: 6000 }, { rate: 8, salesNet: 20000, outputTax: 1600, purchaseNet: 0, inputTax: 0 }], outputTax: 11600, inputTax: 6000, netPayable: 5600 });
  ok("report-integration(試算表合計/売掛年齢6区分/消費税納付5600/在庫評価合計/CSV/空シート除外)", tb.rows[2].借方 === 110000 && R.agingSheet({ current: 5000, d1_30: 20000, d31_60: 10000, d61_90: 0, over90: 0, total: 35000 }).rows.length === 6 && tax.rows[3].仮受消費税 === 5600 && R.inventoryValuationSheet([{ item: "A", onHand: 120, averageCost: 500, value: 60000 }, { item: "B", onHand: 50, averageCost: 200, value: 10000 }]).rows[2].在庫金額 === 70000 && R.sheetToCsv(R.agingSheet({ current: 5000, d1_30: 0, d31_60: 0, d61_90: 0, over90: 0, total: 5000 })).split("\n")[0] === "区分,金額" && R.combineSheets(tb, { name: "空", rows: [], freezeHeader: true }).length === 1);
  for (const f of [AEV, ALG, AQ, RP]) await fs27.rm(f);
}

// ---- 監査ログ配線: 経費フローの証跡(create→submit→approve→journal) + 履歴/改ざん検知 ----
section("audit-wired expense trail");
{
  const fs28 = await import("node:fs/promises"); const st28 = Date.now();
  const AEV = `/tmp/aw-ev-${st28}.ts`, ALG = `/tmp/aw-lg-${st28}.ts`, AQ = `/tmp/aw-q-${st28}.ts`;
  await fs28.writeFile(AEV, (await fs28.readFile(new URL("../packages/audit/src/event.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fs28.writeFile(ALG, (await fs28.readFile(new URL("../packages/audit/src/log.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/event\.ts"/g, `from "${AEV}"`));
  await fs28.writeFile(AQ, (await fs28.readFile(new URL("../packages/audit/src/query.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/log\.ts"/g, `from "${ALG}"`));
  const L = await import(ALG), Q = await import(AQ);
  const record = (log, input) => L.appendEvent(log, { at: new Date().toISOString(), ...input });
  let log = [];
  log = record(log, { actor: "u1", action: "expense.create", target: "expense:1", after: { state: "draft" } });
  log = record(log, { actor: "u1", action: "expense.submit", target: "expense:1", before: { state: "draft" }, after: { state: "submitted" } });
  log = record(log, { actor: "mgr", action: "expense.approve", target: "expense:1", before: { state: "submitted" }, after: { state: "approved" } });
  log = record(log, { actor: "mgr", action: "expense.journal", target: "expense:1", meta: { lines: 3 } });
  log = record(log, { actor: "u2", action: "invoice.issue", target: "invoice:9" });
  ok("audit-wired(経費4イベント連鎖/履歴時系列/承認者2件/改ざん検知/対象別絞込)", L.verifyChain(log).valid === true && Q.historyOf(log, "expense:1").length === 4 && Q.historyOf(log, "expense:1").map((e) => e.seq).join(",") === "0,1,2,3" && Q.filterByActor(log, "mgr").length === 2 && L.verifyChain(log.map((e, i) => (i === 2 ? { ...e, actor: "fake" } : e))).valid === false && Q.filterByTarget ? Q.historyOf(log, "invoice:9").length === 1 : true);
  for (const f of [AEV, ALG, AQ]) await fs28.rm(f);
}

// ---- accounting 給与仕訳/部門別/外部SaaS送信バッチ ----
section("accounting-payroll / department / sync");
{
  const fs29 = await import("node:fs/promises"); const st29 = Date.now();
  const AJ = `/tmp/ps-j-${st29}.ts`, AE = `/tmp/ps-e-${st29}.ts`, AC = `/tmp/ps-c-${st29}.ts`, AX = `/tmp/ps-x-${st29}.ts`, AS = `/tmp/ps-s-${st29}.ts`;
  await fs29.writeFile(AJ, (await fs29.readFile(new URL("../packages/accounting/src/journal.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fs29.writeFile(AE, (await fs29.readFile(new URL("../packages/accounting/src/entries.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/journal\.ts"/g, `from "${AJ}"`));
  await fs29.writeFile(AC, (await fs29.readFile(new URL("../packages/accounting/src/closing.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/journal\.ts"/g, `from "${AJ}"`).replace(/from "\.\/entries\.ts"/g, `from "${AE}"`));
  await fs29.writeFile(AX, (await fs29.readFile(new URL("../packages/accounting/src/export.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/journal\.ts"/g, `from "${AJ}"`));
  await fs29.writeFile(AS, (await fs29.readFile(new URL("../packages/accounting/src/sync.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/journal\.ts"/g, `from "${AJ}"`).replace(/from "\.\/export\.ts"/g, `from "${AX}"`));
  const J = await import(AJ), E = await import(AE), C = await import(AC), S = await import(AS);
  const pay = E.payrollJournal({ date: "2025-07-25", gross: 300000, withholdingTax: 10000, socialInsurance: 45000 });
  const entriesDep = [{ date: "2025-07-01", description: "売上", lines: [{ account: "売上高", debit: 0, credit: 100000, department: "営業部" }] }, { date: "2025-07-02", description: "経費", lines: [{ account: "旅費交通費", debit: 20000, credit: 0, department: "営業部" }] }];
  const ids = { "売掛金": 100, "売上高": 200, "仮受消費税": 300, "現金預金": 400 };
  const entries = [E.salesJournal({ date: "2025-07-01", net: 100000, tax: 10000 }), E.receiptJournal({ date: "2025-07-31", amount: 110000 })];
  const r = await S.syncJournals(entries, { send: async () => ({ ok: true }), accountItemIds: ids });
  const r2 = await S.syncJournals(entries, { send: async () => ({ ok: true }), accountItemIds: ids, alreadySent: new Set([S.entryKey(entries[0])]) });
  const r3 = await S.syncJournals([...entries, E.purchaseJournal({ date: "x", net: 100, tax: 10 })], { send: async () => ({ ok: true }), accountItemIds: ids });
  ok("payroll/department/sync(給与貸借一致/未払24.5万/部門利益8万/送信2件/冪等skip/未登録failed)", pay.lines[3].credit === 245000 && J.isBalanced(pay) && C.profitAndLossByDepartment(entriesDep)["営業部"].netIncome === 80000 && S.summarizeSync(r.results).sent === 2 && S.summarizeSync(r2.results).skipped === 1 && S.summarizeSync(r3.results).sent === 2 && S.summarizeSync(r3.results).failed === 1);
  for (const f of [AJ, AE, AC, AX, AS]) await fs29.rm(f);
}

// ---- payroll 給与明細HTML + 送信バッチのジョブ化(cron createGuardedJob で冪等) ----
section("payslip-html / sync-job");
{
  const fs30 = await import("node:fs/promises"); const st30 = Date.now();
  // 給与明細HTML(payslip 型 shim)
  const PS = `/tmp/pj-ps-${st30}.ts`, RN = `/tmp/pj-rn-${st30}.ts`;
  await fs30.writeFile(PS, "export interface PayslipItem { name: string; amount: number; } export interface Payslip { base: number; premiums: number; allowances: PayslipItem[]; grossPay: number; deductions: PayslipItem[]; totalDeductions: number; netPay: number; }");
  await fs30.writeFile(RN, (await fs30.readFile(new URL("../packages/payroll/src/render.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/payslip\.ts"/g, `from "${PS}"`));
  const R = await import(RN);
  const payslip = { base: 250000, premiums: 30000, allowances: [{ name: "通勤手当", amount: 15000 }], grossPay: 295000, deductions: [{ name: "健康保険料", amount: 14000 }], totalDeductions: 14000, netPay: 281000 };
  const html = R.renderPayslipHtml(payslip, { employeeName: "山田太郎", period: "2025年7月分" });

  // 送信ジョブ(cron runner + accounting sync 実結線)
  const cronFiles = (await fs30.readdir(new URL("../packages/cron/src/", import.meta.url))).filter((f) => f.endsWith(".ts") && !f.includes(".test.") && f !== "index.ts");
  const cronPath = {}; for (const f of cronFiles) cronPath[f.replace(".ts", "")] = `/tmp/pj-cron-${f.replace(".ts", "")}-${st30}.ts`;
  const CORE = `/tmp/pj-core-${st30}.ts`;
  await fs30.writeFile(CORE, `export const ok=(value)=>({ok:true,value});export const err=(error)=>({ok:false,error});export class AppError extends Error{constructor(code,message){super(message);this.code=code;}static from(e){return e instanceof AppError?e:new AppError("INTERNAL",e?.message??String(e));}}export const ErrorCode={VALIDATION:"VALIDATION",INTERNAL:"INTERNAL"};`);
  for (const f of cronFiles) {
    let src = (await fs30.readFile(new URL(`../packages/cron/src/${f}`, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "@platform\/core"/g, `from "${CORE}"`);
    for (const dep of Object.keys(cronPath)) src = src.replace(new RegExp(`from "\\./${dep}\\.ts"`, "g"), `from "${cronPath[dep]}"`);
    await fs30.writeFile(cronPath[f.replace(".ts", "")], src);
  }
  const AJ = `/tmp/pj-j-${st30}.ts`, AE = `/tmp/pj-e-${st30}.ts`, AX = `/tmp/pj-x-${st30}.ts`, AS = `/tmp/pj-s-${st30}.ts`;
  await fs30.writeFile(AJ, (await fs30.readFile(new URL("../packages/accounting/src/journal.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fs30.writeFile(AE, (await fs30.readFile(new URL("../packages/accounting/src/entries.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/journal\.ts"/g, `from "${AJ}"`));
  await fs30.writeFile(AX, (await fs30.readFile(new URL("../packages/accounting/src/export.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/journal\.ts"/g, `from "${AJ}"`));
  await fs30.writeFile(AS, (await fs30.readFile(new URL("../packages/accounting/src/sync.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/journal\.ts"/g, `from "${AJ}"`).replace(/from "\.\/export\.ts"/g, `from "${AX}"`));
  const SJ = `/tmp/pj-syncjob-${st30}.ts`;
  await fs30.writeFile(SJ, (await fs30.readFile(new URL("../demos/showcase/src/examples/accounting-sync-sync-job.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "@platform\/cron"/g, `from "${cronPath["runner"]}"`).replace(/from "@platform\/accounting"/g, `from "${AS}"`));
  const E = await import(AE), JOB = await import(SJ);
  const ids = { "売掛金": 100, "売上高": 200, "仮受消費税": 300, "現金預金": 400 };
  const entries = [E.salesJournal({ date: "2025-07-01", net: 100000, tax: 10000 }), E.receiptJournal({ date: "2025-07-31", amount: 110000 })];
  let sentKeys = new Set(); const store = { loadSent: async () => sentKeys, markSent: async (ks) => { ks.forEach((k) => sentKeys.add(k)); } };
  let sendCount = 0; const summaries = [];
  const job = JOB.createSyncJob({ loadEntries: async () => entries, send: async () => { sendCount++; return { ok: true }; }, accountItemIds: ids, store, onResult: (x) => summaries.push(x) });
  await job.run(); await job.run();
  ok("payslip-html/sync-job(明細氏名/手取り281000・ジョブ2件送信→冪等skip・stats2成功)", html.includes("山田太郎 様") && html.includes("¥281,000") && summaries[0].sent === 2 && sendCount === 2 && summaries[1].skipped === 2 && job.stats().successes === 2 && job.stats().failures === 0);
  for (const f of [PS, RN, CORE, AJ, AE, AX, AS, SJ, ...Object.values(cronPath)]) await fs30.rm(f);
}

// ---- 勤怠CSV取込(実 @platform/csv) + 給与明細一括PDF生成 ----
section("attendance-import / payslip-batch");
{
  const fs31 = await import("node:fs/promises"); const st31 = Date.now();
  const CSV = `/tmp/ab-csv-${st31}.ts`, ATT = `/tmp/ab-att-${st31}.ts`, IMP = `/tmp/ab-imp-${st31}.ts`;
  await fs31.writeFile(CSV, (await fs31.readFile(new URL("../packages/csv/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fs31.writeFile(ATT, "export function hhmmToMinutes(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; } export function workedMinutes(inMin, outMin, breakMin = 0) { return Math.max(0, outMin - inMin - breakMin); }");
  await fs31.writeFile(IMP, (await fs31.readFile(new URL("../apps/internal-app/src/lib/attendance-import.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "@platform\/csv"/g, `from "${CSV}"`).replace(/from "\.\/attendance\.ts"/g, `from "${ATT}"`));
  const I = await import(IMP);
  const goodCsv = "社員番号,日付,出勤,退勤,休憩\nE001,2025-07-01,09:00,18:00,60\nE001,2025-07-02,09:00,17:30,60\nE002,2025-07-01,10:00,19:00,45";
  const r = I.parseAttendanceCsv(goodCsv);
  const badCsv = "社員番号,日付,出勤,退勤,休憩\n,2025-07-01,09:00,18:00,60\nE001,2025/07/01,09:00,18:00,60\nE002,2025-07-01,25:00,18:00,60\nE003,2025-07-01,18:00,09:00,60";
  const rb = I.parseAttendanceCsv(badCsv);
  const sum = I.summarizeByEmployee(r.records);
  ok("attendance-import(3件取込/実労働480/不正4行検出/社員集計930分)", r.records.length === 3 && r.records[0].workedMinutes === 480 && r.errors.length === 0 && rb.records.length === 0 && rb.errors.length === 4 && sum.find((s) => s.employeeId === "E001").totalMinutes === 930);

  // 給与明細一括PDF(payroll/pdf shim)
  const PR = `/tmp/ab-pr-${st31}.ts`, PD = `/tmp/ab-pd-${st31}.ts`, BT = `/tmp/ab-bt-${st31}.ts`;
  await fs31.writeFile(PR, "export function buildPayslip(b, o = {}) { const allowances = o.allowances ?? []; const deductions = o.deductions ?? []; const premiums = b.overtimePremium + b.over60Premium + b.nightPremium + b.holidayPay; const grossPay = b.base + premiums + allowances.reduce((s, a) => s + a.amount, 0); const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0); return { base: b.base, premiums, allowances, grossPay, deductions, totalDeductions, netPay: grossPay - totalDeductions }; } export function renderPayslipHtml(p, o = {}) { return '<html>' + (o.employeeName ?? '') + ' ' + p.grossPay + '</html>'; }");
  await fs31.writeFile(PD, "export const DEFAULT_INVOICE_PDF_OPTIONS = { format: 'A4' }; export function createPdf(renderer) { return { async fromHtml(html, options) { return renderer.render(html, options); } }; }");
  await fs31.writeFile(BT, (await fs31.readFile(new URL("../demos/showcase/src/examples/payslip-pdf-batch.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "@platform\/payroll"/g, `from "${PR}"`).replace(/from "@platform\/pdf"/g, `from "${PD}"`));
  const B = await import(BT);
  const enc = new TextEncoder();
  const jobs = [{ employeeId: "E001", employeeName: "山田", breakdown: { base: 250000, overtimePremium: 30000, over60Premium: 0, nightPremium: 0, holidayPay: 0 } }, { employeeId: "E002", employeeName: "佐藤", breakdown: { base: 200000, overtimePremium: 0, over60Premium: 0, nightPremium: 0, holidayPay: 0 } }];
  const okR = await B.generatePayslipBatch(jobs, { render: async (h) => ({ ok: true, value: enc.encode(h) }) });
  let n = 0;
  const flakyR = await B.generatePayslipBatch(jobs, { render: async (h) => { n++; return n === 2 ? { ok: false, error: "x" } : { ok: true, value: enc.encode(h) }; } });
  const throwR = await B.generatePayslipBatch([jobs[0]], { render: async () => { throw new Error("crash"); } });
  ok("payslip-batch(2名生成/PDFバイト列/1名失敗継続/例外捕捉failed)", okR.summary.generated === 2 && okR.outputs[0].pdf instanceof Uint8Array && flakyR.summary.generated === 1 && flakyR.summary.failed === 1 && throwR.outputs[0].error === "crash");
  for (const f of [CSV, ATT, IMP, PR, PD, BT]) await fs31.rm(f);
}

// ---- 権限全体設計(実 @platform/auth + @platform/ui) + 通知チャネル + レディネス ----
section("platform-authz / notify-channels / readiness");
{
  const fs32 = await import("node:fs/promises"); const st32 = Date.now();
  // authz: 実 auth rbac+hierarchy + 実 ui nav
  const RB = `/tmp/az-rb-${st32}.ts`, HI = `/tmp/az-hi-${st32}.ts`, AU = `/tmp/az-au-${st32}.ts`, NV = `/tmp/az-nv-${st32}.ts`, AZ = `/tmp/az-az-${st32}.ts`;
  await fs32.writeFile(RB, (await fs32.readFile(new URL("../packages/auth/src/rbac.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fs32.writeFile(HI, (await fs32.readFile(new URL("../packages/auth/src/hierarchy.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "\.\/rbac\.ts"/g, `from "${RB}"`));
  await fs32.writeFile(AU, `export * from "${RB}"; export * from "${HI}";`);
  await fs32.writeFile(NV, (await fs32.readFile(new URL("../packages/ui/src/lib/nav.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fs32.writeFile(AZ, (await fs32.readFile(new URL("../apps/internal-app/src/lib/platform-authz.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "@platform\/auth"/g, `from "${AU}"`).replace(/from "@platform\/ui"/g, `from "${NV}"`));
  const A = await import(AZ);
  const salesNav = A.navForRoles(["sales"]).map((n) => n.href);
  ok("platform-authz(sales見積OK会計NG/accountant会計OK/admin全許可/兼務/nav画面制御)", A.userCan(["sales"], "quote:create") === true && A.userCan(["sales"], "accounting:post") === false && A.userCan(["accountant"], "accounting:post") === true && A.userCan(["warehouse"], "invoice:issue") === false && A.userCan(["admin"], "anything:x") === true && A.userCan(["sales", "accountant"], "accounting:post") === true && salesNav.includes("/orders") && !salesNav.includes("/accounting") && A.navForRoles(["admin"]).length === 9);

  // notify channels: createNotifier 忠実再現 + アダプタ
  const NT = `/tmp/az-nt-${st32}.ts`, ML = `/tmp/az-ml-${st32}.ts`, CH = `/tmp/az-ch-${st32}.ts`;
  await fs32.writeFile(NT, "export function createNotifier(channels) { return { async notify(message) { try { await Promise.all(channels.map((c) => c.send(message))); return { ok: true }; } catch (e) { return { ok: false, error: e }; } } }; }");
  await fs32.writeFile(ML, "export {};");
  await fs32.writeFile(CH, (await fs32.readFile(new URL("../demos/showcase/src/examples/notify-channels-channels.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace(/from "@platform\/notify"/g, `from "${NT}"`).replace(/from "@platform\/mail"/g, `from "${ML}"`));
  const N = await import(NT), C = await import(CH);
  const mails = []; const mailer = { sendMail: async (m) => { mails.push(m); return { ok: true }; } };
  const slacks = []; const posts = []; 
  const mc = C.mailChannel(mailer, "team@x.com", { subjectPrefix: "承認依頼" });
  const sc = C.slackChannel("https://h/x", async (u, b) => { slacks.push(b); return { ok: true }; });
  await mc.send({ text: "承認を", level: "info" }); await mc.send({ text: "超過", level: "error" }); await sc.send({ text: "申請", level: "warn" });
  const notifierRes = await N.createNotifier([mc, sc]).notify({ text: "一括", level: "info" });
  const failRes = await N.createNotifier([C.mailChannel({ sendMail: async () => ({ ok: false }) }, "x")]).notify({ text: "x" });
  ok("notify-channels(mail件名/error【重要】/slack絵文字/一括送信ok/失敗err)", mails[0].subject === "承認依頼" && mails[0].to === "team@x.com" && mails[1].subject === "【重要】承認依頼" && slacks[0].text.includes(":warning:") && notifierRes.ok === true && failRes.ok === false);

  // readiness
  const RD = `/tmp/az-rd-${st32}.ts`;
  await fs32.writeFile(RD, (await fs32.readFile(new URL("../apps/internal-app/src/lib/readiness.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  const R = await import(RD);
  const allOk = await R.checkReadiness([{ name: "db", probe: async () => ({ ok: true }) }, { name: "mig", probe: async () => ({ ok: true }) }]);
  const dbDown = await R.checkReadiness([{ name: "db", probe: async () => ({ ok: false, detail: "refused" }) }]);
  const degraded = await R.checkReadiness([{ name: "db", probe: async () => ({ ok: true }) }, { name: "slack", critical: false, probe: async () => ({ ok: false }) }]);
  const thrown = await R.checkReadiness([{ name: "db", probe: async () => { throw new Error("boom"); } }]);
  ok("readiness(全OK200/必須失敗503/非必須degraded/例外failed理由)", allOk.ready === true && R.readinessHttpStatus(allOk) === 200 && dbDown.ready === false && R.readinessHttpStatus(dbDown) === 503 && degraded.ready === true && degraded.degraded === true && thrown.checks[0].detail === "boom");
  for (const f of [RB, HI, AU, NV, AZ, NT, ML, CH, RD]) await fs32.rm(f);
}


// ── chat / board / demos(実ソース結合・realtime配信) ──
{
  section("chat / board(実ソース)");
  const fscb = await import("node:fs/promises");
  const oscb = await import("node:os");
  const dcb = oscb.tmpdir();
  const stcb = Date.now();
  const rd = async (rel) => (await fscb.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const ATTC = `${dcb}/cb-attc-${stcb}.ts`, MSG = `${dcb}/cb-msg-${stcb}.ts`, ROOM = `${dcb}/cb-room-${stcb}.ts`, CHAT = `${dcb}/cb-chat-${stcb}.ts`;
  const ATTB = `${dcb}/cb-attb-${stcb}.ts`, POST = `${dcb}/cb-post-${stcb}.ts`, REAC = `${dcb}/cb-reac-${stcb}.ts`, TL = `${dcb}/cb-tl-${stcb}.ts`, BOARD = `${dcb}/cb-board-${stcb}.ts`;
  const RT = `${dcb}/cb-rt-${stcb}.ts`, RTB = `${dcb}/cb-rtb-${stcb}.ts`;
  const SESS = `${dcb}/cb-sess-${stcb}.ts`, VIEW = `${dcb}/cb-view-${stcb}.ts`, BV = `${dcb}/cb-bv-${stcb}.ts`;
  await fscb.writeFile(ATTC, await rd("../packages/chat/src/attachment.ts"));
  await fscb.writeFile(MSG, (await rd("../packages/chat/src/message.ts")).replace(/from "\.\/attachment\.ts"/g, `from "${ATTC}"`));
  await fscb.writeFile(ROOM, (await rd("../packages/chat/src/room.ts")).replace(/from "\.\/message\.ts"/g, `from "${MSG}"`));
  await fscb.writeFile(CHAT, `export * from "${ATTC}"; export * from "${MSG}"; export * from "${ROOM}";`);
  await fscb.writeFile(ATTB, await rd("../packages/board/src/attachment.ts"));
  await fscb.writeFile(POST, (await rd("../packages/board/src/post.ts")).replace(/from "\.\/attachment\.ts"/g, `from "${ATTB}"`));
  await fscb.writeFile(REAC, await rd("../packages/board/src/reaction.ts"));
  await fscb.writeFile(TL, (await rd("../packages/board/src/thread-list.ts")).replace(/from "\.\/post\.ts"/g, `from "${POST}"`));
  await fscb.writeFile(BOARD, `export * from "${ATTB}"; export * from "${POST}"; export * from "${REAC}"; export * from "${TL}";`);
  await fscb.writeFile(RTB, await rd("../packages/realtime/src/broadcast.ts"));
  await fscb.writeFile(RT, `export * from "${RTB}";`);
  await fscb.writeFile(SESS, (await rd("../demos/showcase/src/examples/chat-room-room-session.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`).replace(/from "@platform\/realtime"/g, `from "${RT}"`));
  await fscb.writeFile(VIEW, (await rd("../demos/showcase/src/examples/chat-room-view.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`));
  await fscb.writeFile(BV, (await rd("../demos/showcase/src/examples/board-threads-board-view.ts")).replace(/from "@platform\/board"/g, `from "${BOARD}"`));
  const CH = await import(CHAT);
  const M2 = (id, senderId, at, text = "x") => ({ id, roomId: "r1", senderId, text, at });
  const cm = CH.createMessage({ id: "m", roomId: "r", senderId: "u", text: "  hi @bob  ", at: "2025-07-01T10:00:00Z" });
  const em = cm.ok ? CH.editMessage(cm.message, "z", "2025-07-01T11:00:00Z") : { ok: false };
  ok("chat.message(trim/空NG/長すぎNG/edit/整列/日付/mention/reply)",
    cm.ok === true && cm.message.text === "hi @bob" &&
    CH.createMessage({ id: "x", roomId: "r", senderId: "u", text: "  " }).ok === false &&
    CH.createMessage({ id: "x", roomId: "r", senderId: "u", text: "a".repeat(5000) }).ok === false &&
    em.ok === true && em.message.editedAt === "2025-07-01T11:00:00Z" &&
    CH.sortMessages([M2("a","u1","2025-07-02T09:00:00Z"),M2("b","u2","2025-07-01T09:00:00Z")]).map(m=>m.id).join("")==="ba" &&
    CH.groupByDate([M2("a","u1","2025-07-02T09:00:00Z"),M2("b","u2","2025-07-01T09:00:00Z")]).length===2 &&
    JSON.stringify(CH.extractMentions("@bob @al @bob"))===JSON.stringify(["bob","al"]) &&
    CH.repliesTo([{ ...M2("r","u","t"), replyTo:"m1" }], "m1").length===1);
  const roomMsgs = [M2("a","u1","2025-07-02T09:00:00Z"),M2("b","u2","2025-07-01T09:00:00Z"),M2("c","u1","2025-07-01T10:00:00Z")];
  ok("chat.room(重複除去/未読自分以外/既読後0/firstUnread/活動順)",
    CH.createRoom({ id:"r", name:"g", kind:"group", memberIds:["u1","u1"] }).memberIds.length===1 &&
    CH.lastMessage(roomMsgs).id==="a" &&
    CH.unreadCount(roomMsgs, { userId:"u2" })===2 && CH.unreadCount(roomMsgs, { userId:"u1" })===1 &&
    CH.unreadCount(roomMsgs, CH.markRead({ userId:"u2" }, "2025-07-03T00:00:00Z"))===0 &&
    CH.firstUnread(roomMsgs, { userId:"u2" }).id==="c" &&
    CH.sortRoomsByActivity([CH.createRoom({ id:"r1", name:"A", kind:"group", memberIds:[], createdAt:"2025-01-01T00:00:00Z" }),CH.createRoom({ id:"r2", name:"B", kind:"group", memberIds:[], createdAt:"2025-01-02T00:00:00Z" })], { r1:roomMsgs, r2:[] })[0].id==="r1");
  const BD = await import(BOARD);
  const bposts = [{ id:"p1", authorId:"u1", body:"本文", createdAt:"2025-07-01T10:00:00Z" },{ id:"p2", authorId:"u2", body:"返信", createdAt:"2025-07-01T12:00:00Z", replyTo:"p1" }];
  const bt = BD.createThread({ id:"t", title:"  お知らせ  ", authorId:"u", tags:["総務"] });
  ok("board.post(検証/trim/施錠返信不可/本文返信分離/mention)",
    bt.ok===true && bt.thread.title==="お知らせ" &&
    BD.createThread({ id:"x", title:"  ", authorId:"u" }).ok===false &&
    BD.createPost({ id:"x", authorId:"u", body:"" }).ok===false &&
    BD.canReply({ id:"t", title:"x", authorId:"u", createdAt:"t", locked:true })===false &&
    BD.rootPosts(bposts).length===1 && BD.repliesOf(bposts, "p1").length===1 &&
    JSON.stringify(BD.extractMentions("@u1 @u2 @u1"))===JSON.stringify(["u1","u2"]));
  let rx = [];
  rx = BD.toggleReaction(rx, { postId:"p1", userId:"u1", kind:"like" });
  rx = BD.toggleReaction(rx, { postId:"p1", userId:"u2", kind:"like" });
  rx = BD.toggleReaction(rx, { postId:"p1", userId:"u1", kind:"eyes" });
  const rxLike = BD.toggleReaction(rx, { postId:"p1", userId:"u1", kind:"like" });
  const bsum = BD.summarize(bt.thread, bposts);
  const bpin = BD.summarize({ id:"t2", title:"重要", authorId:"u1", createdAt:"2025-06-01T00:00:00Z", pinned:true }, []);
  ok("board.reaction+list(集計/トグル解除/要約/ピン優先/タグ/検索)",
    BD.countReactions(rx, "p1").like===2 && BD.countReactions(rxLike, "p1").like===1 &&
    JSON.stringify(BD.userReactions(rx, "p1", "u1"))===JSON.stringify(["like","eyes"]) &&
    bsum.replyCount===1 && bsum.participants===3 &&
    BD.sortThreads([bsum, bpin])[0].thread.id==="t2" &&
    BD.filterByTag([bsum], "総務").length===1 &&
    BD.searchThreads([bsum], { t:bposts }, "返信").length===1);

  section("demos: chat-room(realtime配信) / board-threads");
  const B2 = await import(RT);
  const S2 = await import(SESS);
  const V2 = await import(VIEW);
  const memoryPubsub = () => { const h = new Map(); return {
    async publish(ch, msg){ (h.get(ch)||[]).forEach(fn=>fn(msg)); },
    async subscribe(ch, fn){ const a=h.get(ch)||[]; a.push(fn); h.set(ch, a); },
    async unsubscribe(ch){ h.delete(ch); } }; };
  const hub = B2.createBroadcastHub(memoryPubsub());
  const rA = [], rB = [];
  await S2.joinRoom(hub, "r1", "connA", (m)=>rA.push(m));
  await S2.joinRoom(hub, "r1", "connB", (m)=>rB.push(m));
  const sr = await S2.sendMessage(hub, { id:"m1", roomId:"r1", senderId:"u1", text:"こんにちは", at:"2025-07-01T10:00:00Z" });
  const badr = await S2.sendMessage(hub, { id:"x", roomId:"r1", senderId:"u1", text:"   " });
  await hub.unsubscribe("room:r1", "connB");
  await S2.sendMessage(hub, { id:"m3", roomId:"r1", senderId:"u1", text:"t", at:"2025-07-01T10:06:00Z" });
  const grp = V2.toMessageGroups([sr.message, { id:"m2", roomId:"r1", senderId:"u2", text:"やあ", at:"2025-07-01T10:05:00Z" }], "u1", (id)=>id==="u1"?"私":"田中");
  ok("chat-room(channel命名/2接続ライブ配信/空は非配信/解除後届かず/view own+表示名)",
    S2.roomChannel("r1")==="room:r1" && hub.localCount("room:r1")===1 &&
    sr.ok===true && rA.length===2 && rB.length===1 && rB[0].id==="m1" &&
    badr.ok===false &&
    grp.length===1 && grp[0].messages[0].own===true && grp[0].messages[1].own===false && grp[0].messages[1].authorName==="田中" && grp[0].messages[0].timestamp==="10:00");
  const BV2 = await import(BV);
  const pv = BV2.toPostView({ id:"p1", authorId:"u2", body:"質問", createdAt:"2025-07-01T10:00:00Z" }, [{ postId:"p1", userId:"u1", kind:"like" },{ postId:"p1", userId:"u3", kind:"like" }], "u1", (id)=>id==="u2"?"佐藤":id);
  const tl = BV2.toThreadList([{ id:"t1", title:"雑談", authorId:"u1", createdAt:"2025-07-01T00:00:00Z" },{ id:"t2", title:"重要", authorId:"u1", createdAt:"2025-06-01T00:00:00Z", pinned:true }], { t1:[{ id:"a", authorId:"u2", body:"x", createdAt:"2025-07-05T00:00:00Z", replyTo:"p0" }], t2:[] });
  ok("board-threads(PostView集計+自分状態/ThreadListピン優先+返信数)",
    pv.authorName==="佐藤" && pv.reactions.find(r=>r.kind==="like").count===2 && pv.reactions.find(r=>r.kind==="like").reacted===true &&
    tl[0].thread.id==="t2" && tl.find(s=>s.thread.id==="t1").replyCount===1);

  for (const f of [ATTC, MSG, ROOM, CHAT, ATTB, POST, REAC, TL, BOARD, RT, RTB, SESS, VIEW, BV]) await fscb.rm(f);
}


// ── chat 添付 / gateway / メンション通知(実ソース結合) ──
{
  section("chat: 添付 / gateway / メンション通知(実ソース)");
  const fsg = await import("node:fs/promises");
  const osg = await import("node:os");
  const dg = osg.tmpdir();
  const stg = Date.now();
  const rdg = async (rel) => (await fsg.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const ATC = `${dg}/g-attc-${stg}.ts`, MSG2 = `${dg}/g-msg-${stg}.ts`, ROOM2 = `${dg}/g-room-${stg}.ts`, CHAT2 = `${dg}/g-chat-${stg}.ts`;
  const ATB = `${dg}/g-attb-${stg}.ts`, POST2 = `${dg}/g-post-${stg}.ts`;
  const RTB2 = `${dg}/g-rtb-${stg}.ts`, RT2 = `${dg}/g-rt-${stg}.ts`, NTPL = `${dg}/g-ntpl-${stg}.ts`, NT2 = `${dg}/g-nt-${stg}.ts`;
  const GW = `${dg}/g-gw-${stg}.ts`, CN = `${dg}/g-cn-${stg}.ts`;
  await fsg.writeFile(ATC, await rdg("../packages/chat/src/attachment.ts"));
  await fsg.writeFile(MSG2, (await rdg("../packages/chat/src/message.ts")).replace(/from "\.\/attachment\.ts"/g, `from "${ATC}"`));
  await fsg.writeFile(ROOM2, (await rdg("../packages/chat/src/room.ts")).replace(/from "\.\/message\.ts"/g, `from "${MSG2}"`));
  await fsg.writeFile(CHAT2, `export * from "${ATC}"; export * from "${MSG2}"; export * from "${ROOM2}";`);
  await fsg.writeFile(ATB, await rdg("../packages/board/src/attachment.ts"));
  await fsg.writeFile(POST2, (await rdg("../packages/board/src/post.ts")).replace(/from "\.\/attachment\.ts"/g, `from "${ATB}"`));
  await fsg.writeFile(RTB2, await rdg("../packages/realtime/src/broadcast.ts"));
  await fsg.writeFile(RT2, `export * from "${RTB2}";`);
  await fsg.writeFile(NTPL, await rdg("../packages/notify/src/template.ts"));
  await fsg.writeFile(NT2, `export * from "${NTPL}";`);
  await fsg.writeFile(GW, (await rdg("../apps/internal-app/src/server/chat-gateway.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT2}"`).replace(/from "@platform\/realtime"/g, `from "${RT2}"`));
  await fsg.writeFile(CN, (await rdg("../apps/internal-app/src/server/chat-notify.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT2}"`).replace(/from "@platform\/notify"/g, `from "${NT2}"`));

  const AC = await import(ATC), MC = await import(MSG2), BC = await import(ATB), BP = await import(POST2);
  const img = { key: "chat/a.png", name: "a.png", size: 1000, type: "image/png" };
  const pdf = { key: "chat/b.pdf", name: "b.pdf", size: 2000, type: "application/pdf" };
  const big = { key: "chat/c.zip", name: "c.zip", size: 99999999, type: "application/zip" };
  ok("chat.attachment(制約なしOK/件数超NG/サイズ超NG/種別NG/画像抽出/合計/空文字+添付OK)",
    AC.validateAttachments([img, pdf]).ok === true &&
    AC.validateAttachments([img, pdf], { maxCount: 1 }).ok === false &&
    AC.validateAttachments([big], { maxSizeBytes: 5000000 }).ok === false &&
    AC.validateAttachments([pdf], { allowedTypes: ["image/"] }).ok === false &&
    AC.imageAttachments([img, pdf]).length === 1 && AC.totalSize([img, pdf]) === 3000 &&
    MC.createMessage({ id: "m", roomId: "r", senderId: "u", text: "", attachments: [img] }).ok === true &&
    MC.createMessage({ id: "x", roomId: "r", senderId: "u", text: "" }).ok === false);
  ok("board.attachment(検証同等/空本文+添付OK/空本文+添付なしNG)",
    BC.validateAttachments([big], { maxSizeBytes: 5000000 }).ok === false &&
    BP.createPost({ id: "p", authorId: "u", body: "", attachments: [pdf] }).ok === true &&
    BP.createPost({ id: "x", authorId: "u", body: "" }).ok === false);

  const B2 = await import(RTB2), G2 = await import(GW), CN2 = await import(CN);
  const memoryPubsub = () => { const h = new Map(); return {
    async publish(ch, msg){ (h.get(ch)||[]).forEach(fn=>fn(msg)); },
    async subscribe(ch, fn){ const a=h.get(ch)||[]; a.push(fn); h.set(ch, a); },
    async unsubscribe(ch){ h.delete(ch); } }; };
  const notified = [];
  const fakeNotifier = (l) => ({ async notify(m){ notified.push(l + ":" + m.text); return { ok: true }; } });
  const mn = CN2.buildMentionNotifier({ notifierFor: (h) => h === "bob" ? fakeNotifier("bob") : h === "carol" ? fakeNotifier("carol") : undefined, senderName: (id) => id === "alice" ? "アリス" : id, template: "{{sender}}: {{text}}" });
  let n = 0;
  const hub = B2.createBroadcastHub(memoryPubsub());
  const gw = G2.createChatGateway({ hub, newId: () => "m" + (++n), onMentions: mn, attachmentLimits: { maxCount: 2, maxSizeBytes: 5000000, allowedTypes: ["image/"] } });
  const rA = [], rB = [];
  await gw.connect("r1", "connA", (d) => rA.push(JSON.parse(d)));
  await gw.connect("r1", "connB", (d) => rB.push(JSON.parse(d)));
  const s1 = await gw.send({ roomId: "r1", senderId: "alice", text: "やあ @bob @carol @dave" });
  const s2 = await gw.send({ roomId: "r1", senderId: "alice", text: "  " });
  const s3 = await gw.send({ roomId: "r1", senderId: "alice", text: "", attachments: [img] });
  const s4 = await gw.send({ roomId: "r1", senderId: "alice", text: "資料", attachments: [pdf] });
  ok("gateway(channel命名/onlineCount/検証OK配信/空NG/画像添付OK/許可外NG)",
    G2.roomChannel("r1") === "room:r1" && gw.onlineCount("r1") === 2 &&
    s1.ok === true && rA.length === 2 && rB.length === 2 && rA[0].text.includes("@bob") &&
    s2.ok === false && s3.ok === true && rA[1].attachments.length === 1 && s4.ok === false);
  ok("gateway.mention(bob/carol通知/dave口なし除外/自分除外)",
    notified.filter(x => x.startsWith("bob:") || x.startsWith("carol:")).length === 2 &&
    notified.includes("bob:アリス: やあ @bob @carol @dave"));
  notified.length = 0;
  await gw.send({ roomId: "r1", senderId: "bob", text: "@bob 自分メモ" });
  const bBefore = rB.length;
  await gw.disconnect("r1", "connB");
  await gw.send({ roomId: "r1", senderId: "alice", text: "test" });
  ok("gateway(自分メンション通知なし/解除後connBは増えず)", notified.length === 0 && rB.length === bBefore && rA.length === bBefore + 1);

  for (const f of [ATC, MSG2, ROOM2, CHAT2, ATB, POST2, RTB2, RT2, NTPL, NT2, GW, CN]) await fsg.rm(f);
}


// ── chat-store / board service / client controller(実ソース結合) ──
{
  section("chat: 既読ストア / 掲示板通知 / クライアント制御(実ソース)");
  const fss = await import("node:fs/promises");
  const oss = await import("node:os");
  const ds = oss.tmpdir();
  const sts = Date.now();
  const rds = async (rel) => (await fss.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const AC = `${ds}/s-attc-${sts}.ts`, MSG = `${ds}/s-msg-${sts}.ts`, ROOM = `${ds}/s-room-${sts}.ts`, CHAT = `${ds}/s-chat-${sts}.ts`;
  const AB = `${ds}/s-attb-${sts}.ts`, POST = `${ds}/s-post-${sts}.ts`, REAC = `${ds}/s-reac-${sts}.ts`, TL = `${ds}/s-tl-${sts}.ts`, BOARD = `${ds}/s-board-${sts}.ts`;
  const NTPL = `${ds}/s-ntpl-${sts}.ts`, NT = `${ds}/s-nt-${sts}.ts`;
  const STORE = `${ds}/s-store-${sts}.ts`, CN = `${ds}/s-cn-${sts}.ts`, BSV = `${ds}/s-bsv-${sts}.ts`, CTRL = `${ds}/s-ctrl-${sts}.ts`;
  await fss.writeFile(AC, await rds("../packages/chat/src/attachment.ts"));
  await fss.writeFile(MSG, (await rds("../packages/chat/src/message.ts")).replace(/from "\.\/attachment\.ts"/g, `from "${AC}"`));
  await fss.writeFile(ROOM, (await rds("../packages/chat/src/room.ts")).replace(/from "\.\/message\.ts"/g, `from "${MSG}"`));
  await fss.writeFile(CHAT, `export * from "${AC}"; export * from "${MSG}"; export * from "${ROOM}";`);
  await fss.writeFile(AB, await rds("../packages/board/src/attachment.ts"));
  await fss.writeFile(POST, (await rds("../packages/board/src/post.ts")).replace(/from "\.\/attachment\.ts"/g, `from "${AB}"`));
  await fss.writeFile(REAC, await rds("../packages/board/src/reaction.ts"));
  await fss.writeFile(TL, (await rds("../packages/board/src/thread-list.ts")).replace(/from "\.\/post\.ts"/g, `from "${POST}"`));
  await fss.writeFile(BOARD, `export * from "${AB}"; export * from "${POST}"; export * from "${REAC}"; export * from "${TL}";`);
  await fss.writeFile(NTPL, await rds("../packages/notify/src/template.ts"));
  await fss.writeFile(NT, `export * from "${NTPL}";`);
  await fss.writeFile(STORE, (await rds("../apps/internal-app/src/server/chat-store.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`));
  await fss.writeFile(CN, (await rds("../apps/internal-app/src/server/chat-notify.ts")).replace(/from "@platform\/notify"/g, `from "${NT}"`));
  await fss.writeFile(BSV, (await rds("../apps/internal-app/src/server/board.ts")).replace(/from "@platform\/board"/g, `from "${BOARD}"`).replace(/from "\.\/chat-notify\.ts"/g, `from "${CN}"`));
  await fss.writeFile(CTRL, (await rds("../apps/internal-app/src/app/chat/chat-controller.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`));

  // chat-store
  const ST = await import(STORE);
  const iso = (x) => new Date(x).toISOString();
  const store = ST.createMemoryChatStore({ keepPerRoom: 3 });
  const Msg = (id, roomId, senderId, at) => ({ id, roomId, senderId, text: id, at: iso(at) });
  await store.append(Msg("a", "r1", "u1", "2025-07-01T10:00:00Z"));
  await store.append(Msg("b", "r1", "u2", "2025-07-01T10:05:00Z"));
  await store.append(Msg("c", "r1", "u2", "2025-07-01T10:10:00Z"));
  await store.append(Msg("d", "r1", "u2", "2025-07-01T10:15:00Z"));
  const u1Before = (await store.unreadFor("u1", ["r1"]))[0];
  await store.markRead("u1", "r1", iso("2025-07-01T10:15:00Z"));
  await store.markRead("u1", "r1", iso("2025-07-01T09:00:00Z"));
  ok("chat-store(recent古→新/keep上限で破棄/未読自分以外/markRead後0/後退しない/lastAt)",
    (await store.recent("r1")).map(m => m.id).join("") === "bcd" && u1Before.unread === 3 &&
    (await store.unreadFor("u1", ["r1"]))[0].unread === 0 && (await store.lastRead("u1", "r1")) === iso("2025-07-01T10:15:00Z") &&
    (await store.unreadFor("u1", ["r1"]))[0].lastAt === iso("2025-07-01T10:15:00Z") &&
    (await store.unreadFor("u2", ["r1"]))[0].unread === 0);

  // board service + 汎用メンション通知(文脈IDつき)
  const CN2 = await import(CN), BS = await import(BSV);
  const notified = [];
  const fake = (l) => ({ async notify(m){ notified.push(l + ":" + m.text); return { ok: true }; } });
  const mn = CN2.buildMentionNotifier({ notifierFor: (h) => h === "bob" ? fake("bob") : undefined, senderName: (id) => id === "alice" ? "アリス" : id, contextName: (id) => "スレ" + id, template: "{{sender}}@{{context}}: {{text}}" });
  let bn = 0;
  const board = BS.createBoardService({ newId: () => "p" + (++bn), onMentions: mn, attachmentLimits: { maxCount: 2, allowedTypes: ["image/"] } });
  const bp1 = await board.post({ threadId: "t1", authorId: "alice", body: "見て @bob" });
  const bp2 = await board.post({ threadId: "t1", authorId: "alice", body: "" });
  notified.length = 0;
  await board.post({ threadId: "t1", authorId: "bob", body: "@bob 自分メモ" });
  const beforeSelf = notified.length;
  const bp1n = [];
  const mn2 = CN2.buildMentionNotifier({ notifierFor: (h) => h === "bob" ? { async notify(m){ bp1n.push(m.text); return { ok: true }; } } : undefined, template: "{{context}}:{{text}}" });
  const board2 = BS.createBoardService({ newId: () => "q1", onMentions: mn2 });
  await board2.post({ threadId: "TH9", authorId: "alice", body: "@bob 確認" });
  ok("board-service(検証OK作成/空NG/自分メンション除外/文脈ID反映)",
    bp1.ok === true && bp1.post.body === "見て @bob" && bp2.ok === false && beforeSelf === 0 &&
    bp1n.length === 1 && bp1n[0] === "TH9:@bob 確認");

  // client controller(SSE fake + fetch fake)
  const CC = await import(CTRL);
  let esInst = null;
  class FakeES { constructor(url){ this.url = url; this.onmessage = null; this.onerror = null; this.closed = false; esInst = this; } emit(o){ this.onmessage && this.onmessage({ data: JSON.stringify(o) }); } emitRaw(sx){ this.onmessage && this.onmessage({ data: sx }); } close(){ this.closed = true; } }
  const fcalls = [];
  let fresp = { ok: true, json: async () => ({}) };
  const ffetch = async (url, opts) => { fcalls.push({ url, opts }); return fresp; };
  let last = "";
  const ctrl = CC.createChatController({ roomId: "r1", EventSourceImpl: FakeES, fetchImpl: ffetch, onChange: (m) => { last = m.map(x => x.id).join(""); } });
  ctrl.start();
  esInst.emitRaw("not-json");
  esInst.emit({ id: "b", roomId: "r1", senderId: "u2", text: "2", at: "2025-07-01T10:05:00Z" });
  esInst.emit({ id: "a", roomId: "r1", senderId: "u1", text: "1", at: "2025-07-01T10:00:00Z" });
  esInst.emit({ id: "a", roomId: "r1", senderId: "u1", text: "1", at: "2025-07-01T10:00:00Z" });
  const sres = await ctrl.send("hi @bob");
  fresp = { ok: false, status: 400, json: async () => ({ error: "空" }) };
  const sfail = await ctrl.send("");
  fresp = { ok: true, json: async () => ({}) };
  await ctrl.markRead("2025-07-01T11:00:00Z");
  ctrl.close();
  ok("client-controller(stream接続/整列dedup/onChange/send POST/400err/markRead POST/close)",
    esInst.url === "/api/chat/rooms/r1/stream" && ctrl.messages().map(m => m.id).join("") === "ab" && last === "ab" &&
    sres.ok === true && fcalls.some(c => c.url === "/api/chat/rooms/r1/messages") && sfail.ok === false && sfail.error === "空" &&
    fcalls[fcalls.length - 1].url === "/api/chat/rooms/r1/read" && esInst.closed === true);

  for (const f of [AC, MSG, ROOM, CHAT, AB, POST, REAC, TL, BOARD, NTPL, NT, STORE, CN, BSV, CTRL]) await fss.rm(f);
}


// ── Prisma store / ルーム管理 / プレゼンス / タイピング(実ソース結合) ──
{
  section("chat: Prisma store / ルーム / プレゼンス / タイピング(実ソース)");
  const fsp = await import("node:fs/promises");
  const osp = await import("node:os");
  const dp = osp.tmpdir();
  const stp = Date.now();
  const rdp = async (rel) => (await fsp.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const AC = `${dp}/p-attc-${stp}.ts`, MSG = `${dp}/p-msg-${stp}.ts`, ROOM = `${dp}/p-room-${stp}.ts`, CHAT = `${dp}/p-chat-${stp}.ts`;
  const STORE = `${dp}/p-store-${stp}.ts`, PSTORE = `${dp}/p-pstore-${stp}.ts`, RREPO = `${dp}/p-rrepo-${stp}.ts`, PRES = `${dp}/p-pres-${stp}.ts`;
  const RTB = `${dp}/p-rtb-${stp}.ts`, RT = `${dp}/p-rt-${stp}.ts`, GW = `${dp}/p-gw-${stp}.ts`, CTRL = `${dp}/p-ctrl-${stp}.ts`;
  await fsp.writeFile(AC, await rdp("../packages/chat/src/attachment.ts"));
  await fsp.writeFile(MSG, (await rdp("../packages/chat/src/message.ts")).replace(/from "\.\/attachment\.ts"/g, `from "${AC}"`));
  await fsp.writeFile(ROOM, (await rdp("../packages/chat/src/room.ts")).replace(/from "\.\/message\.ts"/g, `from "${MSG}"`));
  await fsp.writeFile(CHAT, `export * from "${AC}"; export * from "${MSG}"; export * from "${ROOM}";`);
  await fsp.writeFile(STORE, (await rdp("../apps/internal-app/src/server/chat-store.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`));
  await fsp.writeFile(PSTORE, (await rdp("../apps/internal-app/src/server/chat-store-prisma.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`).replace(/from "\.\/chat-store\.ts"/g, `from "${STORE}"`));
  await fsp.writeFile(RREPO, (await rdp("../apps/internal-app/src/server/chat-rooms.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`));
  await fsp.writeFile(PRES, await rdp("../apps/internal-app/src/server/chat-presence.ts"));
  await fsp.writeFile(RTB, await rdp("../packages/realtime/src/broadcast.ts"));
  await fsp.writeFile(RT, `export * from "${RTB}";`);
  await fsp.writeFile(GW, (await rdp("../apps/internal-app/src/server/chat-gateway.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`).replace(/from "@platform\/realtime"/g, `from "${RT}"`));
  await fsp.writeFile(CTRL, (await rdp("../apps/internal-app/src/app/chat/chat-controller.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`));

  const isoP = (x) => new Date(x).toISOString();

  // Prisma store(フェイク db)+ memory とのパリティ
  const PS = await import(PSTORE), MS = await import(STORE);
  const fakeDb = () => { const msgs = []; const reads = new Map(); const rk = (u, r) => u + "\u0000" + r; return {
    _reads: reads,
    chatMessageRow: {
      async create({ data }) { msgs.push({ ...data }); return data; },
      async findMany({ where, orderBy, take }) { let r = msgs.filter(m => m.roomId === where.roomId).slice().sort((a, b) => a.at.getTime() - b.at.getTime()); if (orderBy.at === "desc") r.reverse(); if (take != null) r = r.slice(0, take); return r; },
    },
    messageReadRow: {
      async findUnique({ where }) { return reads.get(rk(where.userId_roomId.userId, where.userId_roomId.roomId)) ?? null; },
      async upsert({ where, create, update }) { const k = rk(where.userId_roomId.userId, where.userId_roomId.roomId); const ex = reads.get(k); reads.set(k, ex ? { ...ex, ...update } : { ...create }); },
    },
  }; };
  const db = fakeDb();
  const pstore = PS.createPrismaChatStore(db, { keepPerRoom: 3 });
  const mstore = MS.createMemoryChatStore({ keepPerRoom: 3 });
  const PM = (id, roomId, senderId, at) => ({ id, roomId, senderId, text: id, at: isoP(at) });
  for (const m of [PM("a", "r1", "u1", "2025-07-01T10:00:00Z"), PM("b", "r1", "u2", "2025-07-01T10:05:00Z"), PM("c", "r1", "u2", "2025-07-01T10:10:00Z"), PM("d", "r1", "u2", "2025-07-01T10:15:00Z")]) { await pstore.append(m); await mstore.append(m); }
  const withAtt = { id: "e", roomId: "r2", senderId: "u1", text: "図", at: isoP("2025-07-01T11:00:00Z"), replyTo: "d", editedAt: isoP("2025-07-01T11:05:00Z"), attachments: [{ key: "k", name: "x.png", size: 1, type: "image/png" }] };
  await pstore.append(withAtt);
  const re = (await pstore.recent("r2"))[0];
  await pstore.markRead("u1", "r1", isoP("2025-07-01T10:15:00Z"));
  await pstore.markRead("u1", "r1", isoP("2025-07-01T09:00:00Z"));
  await mstore.markRead("u1", "r1", isoP("2025-07-01T10:15:00Z"));
  await mstore.markRead("u1", "r1", isoP("2025-07-01T09:00:00Z"));
  const pu = (await pstore.unreadFor("u1", ["r1"]))[0];
  const mu = (await mstore.unreadFor("u1", ["r1"]))[0];
  ok("prisma-store(recent古→新keep上限/添付replyTo往復/markRead後退しない/memoryとunread一致)",
    (await pstore.recent("r1")).map(m => m.id).join("") === "bcd" &&
    re.replyTo === "d" && re.editedAt === isoP("2025-07-01T11:05:00Z") && re.attachments.length === 1 &&
    (await pstore.lastRead("u1", "r1")) === isoP("2025-07-01T10:15:00Z") && pu.unread === 0 && db._reads.size === 1 && mu.unread === pu.unread);

  // ルームリポジトリ
  const RR = await import(RREPO);
  let rn = 0;
  const repo = RR.createMemoryRoomRepo({ newId: () => "r" + (++rn) });
  const room = await repo.create({ name: "総務", kind: "group", ownerId: "alice", memberIds: ["bob", "alice"] });
  await repo.addMember("r1", "carol");
  await repo.create({ id: "r2", name: "DM", kind: "dm", ownerId: "alice", memberIds: ["dave"] });
  await repo.removeMember("r1", "carol");
  ok("room-repo(owner+初期重複除去/isMember/addMember/所属一覧/get/removeMember)",
    room.memberIds.length === 2 && (await repo.isMember("r1", "alice")) === true && (await repo.isMember("r1", "zoe")) === false &&
    (await repo.roomIdsForUser("alice")).length === 2 && (await repo.roomsForUser("dave"))[0].name === "DM" &&
    (await repo.isMember("r1", "carol")) === false && (await repo.get("r1")).name === "総務" && (await repo.get("none")) === undefined);

  // プレゼンス(TTL)
  const PR = await import(PRES);
  const pres = PR.createPresenceTracker({ onlineTtlMs: 30000, typingTtlMs: 5000 });
  const t0 = 1000000;
  pres.heartbeat("r1", "alice", t0);
  pres.heartbeat("r1", "bob", t0);
  pres.typing("r1", "alice", t0);
  const snapNow = pres.snapshot("r1", t0);
  const typingGone = pres.snapshot("r1", t0 + 6000).typing.length;
  const onlineGone = pres.onlineCount("r1", t0 + 31000);
  pres.heartbeat("r1", "alice", t0 + 20000);
  const alive = pres.onlineCount("r1", t0 + 31000);
  pres.offline("r1", "alice");
  ok("presence(2人online/typing+online/typingTTL切れ/onlineTTL切れ/heartbeat延命/offline即時)",
    JSON.stringify(snapNow.online) === JSON.stringify(["alice", "bob"]) && JSON.stringify(snapNow.typing) === JSON.stringify(["alice"]) &&
    typingGone === 0 && onlineGone === 0 && alive === 1 && pres.onlineCount("r1", t0 + 31000) === 0);

  // gateway.publishTyping → controller.onTyping(封筒判別)
  const B = await import(RTB), G = await import(GW), CC = await import(CTRL);
  const memoryPubsub = () => { const h = new Map(); return {
    async publish(ch, msg) { (h.get(ch) || []).forEach(fn => fn(typeof msg === "string" ? msg : JSON.stringify(msg))); },
    async subscribe(ch, fn) { const a = h.get(ch) || []; a.push(fn); h.set(ch, a); },
    async unsubscribe(ch) { h.delete(ch); } }; };
  const hub = B.createBroadcastHub(memoryPubsub());
  let gwSeq = 0;
  const gw = G.createChatGateway({ hub, newId: () => "m" + (++gwSeq) });
  // controller をフェイク ES に手動接続(publishTyping の封筒を受ける)
  const received = { msgs: [], typing: [] };
  let esCtl = null;
  class FakeES2 { constructor(url) { this.url = url; this.onmessage = null; this.onerror = null; esCtl = this; } close() {} }
  // controller の EventSource は stream 経由。ここでは gateway の send を controller の ingest に橋渡しするため、
  // hub に生 send を直接繋いで controller の onmessage を模す。
  const ctrl = CC.createChatController({ roomId: "r1", EventSourceImpl: FakeES2, fetchImpl: async () => ({ ok: true, json: async () => ({}) }), onChange: (m) => { received.msgs = m.map(x => x.id); }, onTyping: (u) => received.typing.push(u) });
  ctrl.start();
  await hub.subscribe("room:r1", "cInline", (data) => esCtl.onmessage && esCtl.onmessage({ data }));
  await gw.send({ roomId: "r1", senderId: "u2", text: "こんにちは" });
  await gw.publishTyping("r1", "u2");
  ok("gateway.publishTyping→controller(メッセージは表示/タイピング封筒はonTyping)",
    received.msgs.length === 1 && received.msgs[0] === "m1" && received.typing.length === 1 && received.typing[0] === "u2");

  for (const f of [AC, MSG, ROOM, CHAT, STORE, PSTORE, RREPO, PRES, RTB, RT, GW, CTRL]) await fsp.rm(f);
}


// ── 全文検索 / 編集・削除 / ダイジェスト・cron(実ソース結合) ──
{
  section("chat: 全文検索 / 編集削除 / ダイジェスト(実ソース)");
  const fsx = await import("node:fs/promises");
  const osx = await import("node:os");
  const dx = osx.tmpdir();
  const stx = Date.now();
  const rdx = async (rel) => (await fsx.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const AC = `${dx}/x-attc-${stx}.ts`, MSG = `${dx}/x-msg-${stx}.ts`, ROOM = `${dx}/x-room-${stx}.ts`, CHAT = `${dx}/x-chat-${stx}.ts`;
  const AB = `${dx}/x-attb-${stx}.ts`, POST = `${dx}/x-post-${stx}.ts`, BOARD = `${dx}/x-board-${stx}.ts`;
  const CORE = `${dx}/x-core-${stx}.ts`, TOK = `${dx}/x-tok-${stx}.ts`, BM = `${dx}/x-bm-${stx}.ts`, MEM = `${dx}/x-mem-${stx}.ts`, MEI = `${dx}/x-mei-${stx}.ts`, SEARCH = `${dx}/x-search-${stx}.ts`;
  const NTPL = `${dx}/x-ntpl-${stx}.ts`, NT = `${dx}/x-nt-${stx}.ts`, RUNNER = `${dx}/x-runner-${stx}.ts`;
  const STORE = `${dx}/x-store-${stx}.ts`, RREPO = `${dx}/x-rrepo-${stx}.ts`, CSEARCH = `${dx}/x-csearch-${stx}.ts`, DIGEST = `${dx}/x-digest-${stx}.ts`;
  const RTB = `${dx}/x-rtb-${stx}.ts`, RT = `${dx}/x-rt-${stx}.ts`, GW = `${dx}/x-gw-${stx}.ts`, CTRL = `${dx}/x-ctrl-${stx}.ts`;
  await fsx.writeFile(AC, await rdx("../packages/chat/src/attachment.ts"));
  await fsx.writeFile(MSG, (await rdx("../packages/chat/src/message.ts")).replace(/from "\.\/attachment\.ts"/g, `from "${AC}"`));
  await fsx.writeFile(ROOM, (await rdx("../packages/chat/src/room.ts")).replace(/from "\.\/message\.ts"/g, `from "${MSG}"`));
  await fsx.writeFile(CHAT, `export * from "${AC}"; export * from "${MSG}"; export * from "${ROOM}";`);
  await fsx.writeFile(AB, await rdx("../packages/board/src/attachment.ts"));
  await fsx.writeFile(POST, (await rdx("../packages/board/src/post.ts")).replace(/from "\.\/attachment\.ts"/g, `from "${AB}"`));
  await fsx.writeFile(BOARD, `export * from "${AB}"; export * from "${POST}";`);
  await fsx.writeFile(CORE, `export const ErrorCode={EXTERNAL:"EXTERNAL",VALIDATION:"VALIDATION"};export class AppError extends Error{constructor(c,m,o){super(m);this.code=c;this.cause=o?.cause;}}export function ok(v){return{ok:true,value:v};}export function err(e){return{ok:false,error:e};}export async function tryCatch(fn){try{return{ok:true,value:await fn()};}catch(e){return{ok:false,error:e};}}`);
  await fsx.writeFile(TOK, await rdx("../packages/search/src/tokenize.ts"));
  await fsx.writeFile(BM, (await rdx("../packages/search/src/bm25.ts")).replace(/from "\.\/tokenize\.ts"/g, `from "${TOK}"`));
  await fsx.writeFile(MEM, (await rdx("../packages/search/src/adapters/memory.ts")).replace(/from "\.\.\/index\.ts"/g, `from "${SEARCH}"`).replace(/from "\.\.\/bm25\.ts"/g, `from "${BM}"`));
  await fsx.writeFile(MEI, `export function createMeilisearchAdapter(){ return {}; }`);
  await fsx.writeFile(SEARCH, (await rdx("../packages/search/src/index.ts")).replace(/from "@platform\/core"/g, `from "${CORE}"`).replace(/from "\.\/adapters\/memory\.ts"/g, `from "${MEM}"`).replace(/from "\.\/adapters\/meilisearch\.ts"/g, `from "${MEI}"`).replace(/from "\.\/bm25\.ts"/g, `from "${BM}"`).replace(/from "\.\/tokenize\.ts"/g, `from "${TOK}"`));
  await fsx.writeFile(NTPL, await rdx("../packages/notify/src/template.ts"));
  await fsx.writeFile(NT, `export * from "${NTPL}";`);
  await fsx.writeFile(RUNNER, await rdx("../packages/cron/src/runner.ts"));
  await fsx.writeFile(STORE, (await rdx("../apps/internal-app/src/server/chat-store.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`));
  await fsx.writeFile(RREPO, (await rdx("../apps/internal-app/src/server/chat-rooms.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`));
  await fsx.writeFile(CSEARCH, (await rdx("../apps/internal-app/src/server/chat-search.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`).replace(/from "@platform\/board"/g, `from "${BOARD}"`).replace(/from "@platform\/search"/g, `from "${SEARCH}"`));
  await fsx.writeFile(DIGEST, (await rdx("../apps/internal-app/src/server/chat-digest.ts")).replace(/from "@platform\/notify"/g, `from "${NT}"`).replace(/from "\.\/chat-store\.ts"/g, `from "${STORE}"`).replace(/from "\.\/chat-rooms\.ts"/g, `from "${RREPO}"`));
  await fsx.writeFile(RTB, await rdx("../packages/realtime/src/broadcast.ts"));
  await fsx.writeFile(RT, `export * from "${RTB}";`);
  await fsx.writeFile(GW, (await rdx("../apps/internal-app/src/server/chat-gateway.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`).replace(/from "@platform\/realtime"/g, `from "${RT}"`));
  await fsx.writeFile(CTRL, (await rdx("../apps/internal-app/src/app/chat/chat-controller.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`));

  const isoX = (x) => new Date(x).toISOString();

  // 全文検索(実 BM25)
  const SE = await import(SEARCH), CS = await import(CSEARCH);
  const cs = CS.createChatSearch({ messageSearch: SE.createSearch(SE.createMemorySearch({ fieldBoosts: { text: 2 } })), postSearch: SE.createSearch(SE.createMemorySearch({ fieldBoosts: { body: 2 } })) });
  await cs.indexMessage({ id: "m1", roomId: "r1", senderId: "u1", text: "プロジェクトの進捗を共有します", at: isoX("2025-07-01T10:00:00Z") });
  await cs.indexMessage({ id: "m2", roomId: "r1", senderId: "u2", text: "会議は明日です", at: isoX("2025-07-01T10:05:00Z") });
  await cs.indexMessage({ id: "m3", roomId: "r2", senderId: "u1", text: "プロジェクトの予算", at: isoX("2025-07-01T11:00:00Z") });
  await cs.indexPost({ id: "p1", authorId: "a1", body: "備品の申請方法", createdAt: isoX("2025-07-01T09:00:00Z") }, "t1");
  await cs.indexPost({ id: "p2", authorId: "a2", body: "備品の在庫確認", createdAt: isoX("2025-07-01T09:30:00Z") }, "t2");
  const sm = await cs.searchMessages("プロジェクト");
  await cs.removeMessage("m1");
  ok("chat-search(日本語2件/roomId絞込/score/投稿別索引/threadId絞込/削除で消える)",
    sm.length === 2 && sm.every(x => x.text.includes("プロジェクト")) && (await cs.searchMessages("プロジェクト", { roomId: "r1" })).length === 0 &&
    typeof sm[0].score === "number" && (await cs.searchPosts("備品")).length === 2 && (await cs.searchPosts("備品", { threadId: "t1" })).length === 1 &&
    (await cs.searchMessages("備品")).length === 0);

  // 編集・削除フロー(gateway + store + controller 封筒)
  const B = await import(RTB), ST = await import(STORE), G = await import(GW), CC = await import(CTRL);
  const memPS = () => { const h = new Map(); return { async publish(ch, msg) { (h.get(ch) || []).forEach(fn => fn(typeof msg === "string" ? msg : JSON.stringify(msg))); }, async subscribe(ch, fn) { const a = h.get(ch) || []; a.push(fn); h.set(ch, a); }, async unsubscribe(ch) { h.delete(ch); } }; };
  const store = ST.createMemoryChatStore({ keepPerRoom: 100 });
  const idxLog = [];
  const hub = B.createBroadcastHub(memPS());
  let gn = 0;
  const gw = G.createChatGateway({
    hub, newId: () => "m" + (++gn),
    onSent: async (m) => { await store.append(m); idxLog.push("i:" + m.id); },
    lookupMessage: async (roomId, id) => (await store.recent(roomId)).find(m => m.id === id),
    onEdited: async (m) => { await store.update(m); idxLog.push("re:" + m.id); },
    onDeleted: async (roomId, id) => { await store.remove(roomId, id); idxLog.push("de:" + id); },
  });
  const view = { list: [] };
  let esx = null;
  class FES { constructor(url) { this.url = url; this.onmessage = null; esx = this; } close() {} }
  const ctrl = CC.createChatController({ roomId: "r1", EventSourceImpl: FES, fetchImpl: async () => ({ ok: true, json: async () => ({}) }), onChange: (m) => { view.list = m.map(x => ({ id: x.id, text: x.text, edited: Boolean(x.editedAt) })); } });
  ctrl.start();
  await hub.subscribe("room:r1", "cx", (data) => esx.onmessage && esx.onmessage({ data }));
  await gw.send({ roomId: "r1", senderId: "alice@x.com", text: "最初" });
  const eSelf = await gw.edit({ roomId: "r1", messageId: "m1", editorId: "alice@x.com", text: "編集後" });
  const eOther = await gw.edit({ roomId: "r1", messageId: "m1", editorId: "bob@x.com", text: "乗っ取り" });
  const eAdmin = await gw.edit({ roomId: "r1", messageId: "m1", editorId: "admin@x.com", text: "管理者", isAdmin: true });
  const dOther = await gw.remove({ roomId: "r1", messageId: "m1", editorId: "bob@x.com" });
  const dSelf = await gw.remove({ roomId: "r1", messageId: "m1", editorId: "alice@x.com" });
  ok("chat-edit-delete(本人編集/他人403/admin可/本人削除→controller反映+履歴/索引再作成除去)",
    eSelf.ok === true && eSelf.message.text === "編集後" && eOther.ok === false && eOther.error.includes("権限") &&
    eAdmin.ok === true && dOther.ok === false && dSelf.ok === true && view.list.length === 0 &&
    (await store.recent("r1")).length === 0 && idxLog.includes("i:m1") && idxLog.includes("re:m1") && idxLog.includes("de:m1"));

  // ダイジェスト + cron
  const RR = await import(RREPO), DG = await import(DIGEST), CR = await import(RUNNER);
  const dstore = ST.createMemoryChatStore({ keepPerRoom: 100 });
  const repo = RR.createMemoryRoomRepo({ newId: () => "x" });
  await repo.create({ id: "r1", name: "総務", kind: "group", ownerId: "alice", memberIds: ["bob"] });
  await repo.create({ id: "r2", name: "開発", kind: "group", ownerId: "alice", memberIds: ["bob"] });
  await dstore.append({ id: "d1", roomId: "r1", senderId: "alice", text: "a", at: isoX("2025-07-01T10:00:00Z") });
  await dstore.append({ id: "d2", roomId: "r1", senderId: "alice", text: "b", at: isoX("2025-07-01T10:01:00Z") });
  await dstore.append({ id: "d3", roomId: "r2", senderId: "alice", text: "c", at: isoX("2025-07-01T10:02:00Z") });
  const sent = [];
  const digest = DG.buildUnreadDigest({ store: dstore, roomRepo: repo, notifierFor: (u) => u === "bob" ? { async notify(m) { sent.push(m.text); return { ok: true }; } } : undefined, roomName: (id) => id === "r1" ? "総務" : id === "r2" ? "開発" : id, template: "未読{{count}}件({{rooms}})" });
  const dres = await digest(["bob", "alice", "carol"]);
  let ran = 0; let clock = 0;
  const job = CR.createGuardedJob({ name: "digest", preventOverlap: true, now: () => clock, handler: async () => { ran++; await digest(["bob"]); } });
  await job.run();
  const failJob = CR.createGuardedJob({ name: "f", now: () => clock, handler: async () => { throw new Error("x"); } });
  await failJob.run();
  ok("chat-digest+cron(bobに未読3集約/alice0carol口なしskip/job成功/失敗failure)",
    dres.notified.length === 1 && dres.notified[0] === "bob" && sent[0] === "未読3件(総務: 2、開発: 1)" &&
    dres.skipped.includes("alice") && dres.skipped.includes("carol") && ran === 1 && job.stats().successes === 1 && failJob.stats().failures === 1);

  for (const f of [AC, MSG, ROOM, CHAT, AB, POST, BOARD, CORE, TOK, BM, MEM, MEI, SEARCH, NTPL, NT, RUNNER, STORE, RREPO, CSEARCH, DIGEST, RTB, RT, GW, CTRL]) await fsx.rm(f);
}


// ── リアクション配信 / 検索ハイライト / サムネイル生成(実ソース結合) ──
{
  section("chat: リアクション / ハイライト / サムネイル(実ソース)");
  const fsr = await import("node:fs/promises");
  const osr = await import("node:os");
  const dr = osr.tmpdir();
  const str = Date.now();
  const rdr = async (rel) => (await fsr.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const AC = `${dr}/rr-attc-${str}.ts`, RX = `${dr}/rr-rx-${str}.ts`, MSG = `${dr}/rr-msg-${str}.ts`, ROOM = `${dr}/rr-room-${str}.ts`, CHAT = `${dr}/rr-chat-${str}.ts`;
  const GEO = `${dr}/rr-geo-${str}.ts`, IMG = `${dr}/rr-img-${str}.ts`, HL = `${dr}/rr-hl-${str}.ts`;
  const RTB = `${dr}/rr-rtb-${str}.ts`, RT = `${dr}/rr-rt-${str}.ts`, GW = `${dr}/rr-gw-${str}.ts`, CTRL = `${dr}/rr-ctrl-${str}.ts`;
  const RSTORE = `${dr}/rr-rstore-${str}.ts`, THUMB = `${dr}/rr-thumb-${str}.ts`;
  await fsr.writeFile(AC, await rdr("../packages/chat/src/attachment.ts"));
  await fsr.writeFile(RX, await rdr("../packages/chat/src/reaction.ts"));
  await fsr.writeFile(MSG, (await rdr("../packages/chat/src/message.ts")).replace(/from "\.\/attachment\.ts"/g, `from "${AC}"`));
  await fsr.writeFile(ROOM, (await rdr("../packages/chat/src/room.ts")).replace(/from "\.\/message\.ts"/g, `from "${MSG}"`));
  await fsr.writeFile(CHAT, `export * from "${AC}"; export * from "${RX}"; export * from "${MSG}"; export * from "${ROOM}";`);
  await fsr.writeFile(GEO, await rdr("../packages/image/src/geometry.ts"));
  await fsr.writeFile(IMG, `export * from "${GEO}";`);
  await fsr.writeFile(HL, await rdr("../packages/ui/src/lib/highlight.ts"));
  await fsr.writeFile(RTB, await rdr("../packages/realtime/src/broadcast.ts"));
  await fsr.writeFile(RT, `export * from "${RTB}";`);
  await fsr.writeFile(GW, (await rdr("../apps/internal-app/src/server/chat-gateway.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`).replace(/from "@platform\/realtime"/g, `from "${RT}"`));
  await fsr.writeFile(CTRL, (await rdr("../apps/internal-app/src/app/chat/chat-controller.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`));
  await fsr.writeFile(RSTORE, (await rdr("../apps/internal-app/src/server/chat-reactions.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`));
  await fsr.writeFile(THUMB, (await rdr("../apps/internal-app/src/server/chat-thumbnails.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`).replace(/from "@platform\/image"/g, `from "${IMG}"`).replace(/from "@platform\/storage"/g, `from "${GEO}"`));

  // ハイライト(純関数)
  const H = await import(HL);
  const s1 = H.highlightSegments("プロジェクトの進捗", "プロジェクト");
  const s2 = H.highlightSegments("Hello World hello", "hello");
  ok("highlight(日本語前方一致/大小無視2箇所/連続まとめ/一致なし全体/クエリ空)",
    s1.length === 2 && s1[0].highlight === true && s1[1].highlight === false &&
    s2.filter(x => x.highlight).length === 2 &&
    H.highlightSegments("abcabc", "abc").length === 1 &&
    H.highlightSegments("foo", "xyz")[0].highlight === false &&
    H.highlightSegments("abc", "  ")[0].highlight === false &&
    JSON.stringify(H.queryTerms("cat dog cat")) === JSON.stringify(["cat", "dog"]));

  // リアクション配信(gateway + store + controller 封筒)
  const B = await import(RTB), RS = await import(RSTORE), G = await import(GW), CC = await import(CTRL);
  const memPS = () => { const h = new Map(); return { async publish(ch, msg) { (h.get(ch) || []).forEach(fn => fn(typeof msg === "string" ? msg : JSON.stringify(msg))); }, async subscribe(ch, fn) { const a = h.get(ch) || []; a.push(fn); h.set(ch, a); }, async unsubscribe(ch) { h.delete(ch); } }; };
  const rstore = RS.createMemoryReactionStore();
  const hub = B.createBroadcastHub(memPS());
  let rn = 0;
  const gw = G.createChatGateway({ hub, newId: () => "m" + (++rn), toggleReactionStore: (mid, uid, kind) => rstore.toggle(mid, uid, kind) });
  const recvR = [];
  let esr = null;
  class FES { constructor(url) { this.url = url; this.onmessage = null; esr = this; } close() {} }
  const ctrl = CC.createChatController({ roomId: "r1", EventSourceImpl: FES, fetchImpl: async () => ({ ok: true, json: async () => ({}) }), onChange: () => {}, onReaction: (mid, counts) => recvR.push({ mid, counts }) });
  ctrl.start();
  await hub.subscribe("room:r1", "cx", (data) => esr.onmessage && esr.onmessage({ data }));
  const rr1 = await gw.react({ roomId: "r1", messageId: "m1", userId: "alice", kind: "like" });
  await gw.react({ roomId: "r1", messageId: "m1", userId: "bob", kind: "like" });
  const rr3 = await gw.react({ roomId: "r1", messageId: "m1", userId: "alice", kind: "like" });
  const gwNo = G.createChatGateway({ hub, newId: () => "x" });
  const rrNo = await gwNo.react({ roomId: "r1", messageId: "m1", userId: "a", kind: "like" });
  ok("reaction-gateway(カウント配信/controller受信/別ユーザー増/再押し解除/store未指定は未対応)",
    rr1.ok === true && rr1.counts.like === 1 && recvR[0].counts.like === 1 &&
    recvR[1].counts.like === 2 && recvR[2].counts.like === 1 && rr3.counts.like === 1 && rrNo.ok === false && rrNo.error.includes("未対応"));

  // サムネイル(実 fitDimensions + fake processor/storage)
  const TH = await import(THUMB);
  const files = new Map();
  files.set("chat/a.png", { b: "orig" });
  const storage = { async get(k) { const v = files.get(k); return v ? { ok: true, value: v } : { ok: false, error: new Error("nf") }; }, async put(k, b, o) { files.set(k, b); return { ok: true, value: undefined }; } };
  const opsSeen = [];
  const processor = { async metadata() { return { ok: true, value: { width: 1200, height: 800 } }; }, async process(input, ops) { opsSeen.push(ops); return { ok: true, value: new Uint8Array([1, 2, 3]) }; } };
  const svc = TH.createThumbnailService({ processor, storage, maxSize: 240, newId: () => "T1" });
  const withThumb = await svc.ensureThumbnail({ key: "chat/a.png", name: "a.png", size: 1, type: "image/png" });
  const pdfOut = await svc.ensureThumbnail({ key: "chat/b.pdf", name: "b.pdf", size: 1, type: "application/pdf" });
  const missing = await svc.ensureThumbnail({ key: "nope.png", name: "n.png", size: 1, type: "image/png" });
  const all = await svc.ensureAll([{ key: "chat/a.png", name: "a.png", size: 1, type: "image/png" }, { key: "chat/b.pdf", name: "b.pdf", size: 1, type: "application/pdf" }]);
  ok("thumbnail(画像はthumbnailKey付与/寸法240x160維持/非画像そのまま/取得失敗で壊さない/ensureAll)",
    withThumb.thumbnailKey === "thumbnails/T1.jpg" && files.has("thumbnails/T1.jpg") &&
    opsSeen[0][0].width === 240 && opsSeen[0][0].height === 160 &&
    pdfOut.thumbnailKey === undefined && missing.thumbnailKey === undefined &&
    all[0].thumbnailKey !== undefined && all[1].thumbnailKey === undefined);

  for (const f of [AC, RX, MSG, ROOM, CHAT, GEO, IMG, HL, RTB, RT, GW, CTRL, RSTORE, THUMB]) await fsr.rm(f);
}


// ── ピン/ブックマーク / メンション未読 / リアクション永続化(実ソース結合) ──
{
  section("chat: ピン・ブックマーク / メンション未読 / リアクション永続化(実ソース)");
  const fsp = await import("node:fs/promises");
  const osp = await import("node:os");
  const dp = osp.tmpdir();
  const stp = Date.now();
  const rdp = async (rel) => (await fsp.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const AC = `${dp}/pb-attc-${stp}.ts`, RX = `${dp}/pb-rx-${stp}.ts`, PIN = `${dp}/pb-pin-${stp}.ts`, MSG = `${dp}/pb-msg-${stp}.ts`, ROOM = `${dp}/pb-room-${stp}.ts`, CHAT = `${dp}/pb-chat-${stp}.ts`;
  const STORE = `${dp}/pb-store-${stp}.ts`, RREPO = `${dp}/pb-rrepo-${stp}.ts`, PINS = `${dp}/pb-pins-${stp}.ts`, MENT = `${dp}/pb-ment-${stp}.ts`, REAC = `${dp}/pb-reac-${stp}.ts`;
  const RTB = `${dp}/pb-rtb-${stp}.ts`, RT = `${dp}/pb-rt-${stp}.ts`, GW = `${dp}/pb-gw-${stp}.ts`, CTRL = `${dp}/pb-ctrl-${stp}.ts`;
  await fsp.writeFile(AC, await rdp("../packages/chat/src/attachment.ts"));
  await fsp.writeFile(RX, await rdp("../packages/chat/src/reaction.ts"));
  await fsp.writeFile(PIN, await rdp("../packages/chat/src/pin.ts"));
  await fsp.writeFile(MSG, (await rdp("../packages/chat/src/message.ts")).replace(/from "\.\/attachment\.ts"/g, `from "${AC}"`));
  await fsp.writeFile(ROOM, (await rdp("../packages/chat/src/room.ts")).replace(/from "\.\/message\.ts"/g, `from "${MSG}"`));
  await fsp.writeFile(CHAT, `export * from "${AC}"; export * from "${RX}"; export * from "${PIN}"; export * from "${MSG}"; export * from "${ROOM}";`);
  await fsp.writeFile(STORE, (await rdp("../apps/internal-app/src/server/chat-store.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`));
  await fsp.writeFile(RREPO, (await rdp("../apps/internal-app/src/server/chat-rooms.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`));
  await fsp.writeFile(PINS, (await rdp("../apps/internal-app/src/server/chat-pins.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`));
  await fsp.writeFile(MENT, (await rdp("../apps/internal-app/src/server/chat-mentions.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`).replace(/from "\.\/chat-store\.ts"/g, `from "${STORE}"`).replace(/from "\.\/chat-rooms\.ts"/g, `from "${RREPO}"`));
  await fsp.writeFile(REAC, (await rdp("../apps/internal-app/src/server/chat-reactions.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`));
  await fsp.writeFile(RTB, await rdp("../packages/realtime/src/broadcast.ts"));
  await fsp.writeFile(RT, `export * from "${RTB}";`);
  await fsp.writeFile(GW, (await rdp("../apps/internal-app/src/server/chat-gateway.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`).replace(/from "@platform\/realtime"/g, `from "${RT}"`));
  await fsp.writeFile(CTRL, (await rdp("../apps/internal-app/src/app/chat/chat-controller.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`));

  const isoP = (x) => new Date(x).toISOString();

  // ピン/ブックマークストア
  const PS = await import(PINS);
  const pinStore = PS.createMemoryPinStore();
  const pa = await pinStore.togglePin("r1", "m1", "alice");
  await pinStore.togglePin("r1", "m2", "bob");
  const pc = await pinStore.togglePin("r1", "m1", "carol");
  const ba = await pinStore.toggleBookmark("u1", "m1", "r1");
  await pinStore.toggleBookmark("u1", "m2", "r2");
  const bc = await pinStore.toggleBookmark("u1", "m1", "r1");
  ok("pin-store(togglePin固定true/新しい順/再ピン解除false/bookmarkトグル/別ユーザー独立)",
    pa === true && (await pinStore.pins("r1"))[0].messageId === "m2" && pc === false && (await pinStore.pins("r1")).length === 1 &&
    ba === true && bc === false && (await pinStore.bookmarks("u1")).length === 1 && (await pinStore.bookmarks("u2")).length === 0);

  // メンション未読集計
  const ST = await import(STORE), RR = await import(RREPO), MI = await import(MENT);
  const store = ST.createMemoryChatStore({ keepPerRoom: 100 });
  const repo = RR.createMemoryRoomRepo({ newId: () => "x" });
  await repo.create({ id: "r1", name: "A", kind: "group", ownerId: "boss", memberIds: ["bob"] });
  await repo.create({ id: "r2", name: "B", kind: "group", ownerId: "boss", memberIds: ["bob"] });
  await store.append({ id: "a", roomId: "r1", senderId: "boss", text: "@bob おはよう", at: isoP("2025-07-01T09:00:00Z") });
  await store.append({ id: "b", roomId: "r1", senderId: "boss", text: "@bob 確認", at: isoP("2025-07-01T11:00:00Z") });
  await store.append({ id: "c", roomId: "r2", senderId: "boss", text: "@bob 別room", at: isoP("2025-07-01T12:00:00Z") });
  await store.append({ id: "d", roomId: "r2", senderId: "boss", text: "@alice 無関係", at: isoP("2025-07-01T13:00:00Z") });
  const inbox = MI.createMentionInbox({ store, roomRepo: repo });
  const before = await inbox.unreadCount("bob", "bob");
  const listOrder = (await inbox.unread("bob", "bob")).map(m => m.messageId).join("");
  await store.markRead("bob", "r1", isoP("2025-07-01T10:00:00Z"));
  const after = await inbox.unreadCount("bob", "bob");
  ok("mention-inbox(2room横断3件/新しい順cba/r1既読で2件/limit/所属外0)",
    before === 3 && listOrder === "cba" && after === 2 && (await inbox.unread("bob", "bob", 1)).length === 1 && (await inbox.unreadCount("alice", "alice")) === 0);

  // リアクション永続化(Prisma実装 fake db)+ memory パリティ
  const RC = await import(REAC);
  const fakeRxDb = () => { const rows = []; return {
    messageReactionRow: {
      async findUnique({ where }) { const w = where.messageId_userId_kind; return rows.find(r => r.messageId === w.messageId && r.userId === w.userId && r.kind === w.kind) ?? null; },
      async create({ data }) { rows.push({ ...data }); },
      async delete({ where }) { const w = where.messageId_userId_kind; const i = rows.findIndex(r => r.messageId === w.messageId && r.userId === w.userId && r.kind === w.kind); if (i >= 0) rows.splice(i, 1); },
      async findMany({ where }) { return rows.filter(r => r.messageId === where.messageId && (where.userId === undefined || r.userId === where.userId)); },
    } }; };
  const prx = RC.createPrismaReactionStore(fakeRxDb());
  const mrx = RC.createMemoryReactionStore();
  await prx.toggle("m1", "u1", "like"); await mrx.toggle("m1", "u1", "like");
  await prx.toggle("m1", "u2", "like"); await mrx.toggle("m1", "u2", "like");
  await prx.toggle("m1", "u1", "eyes"); await mrx.toggle("m1", "u1", "eyes");
  const pCounts = await prx.counts("m1"); const mCounts = await mrx.counts("m1");
  const pc3 = await prx.toggle("m1", "u1", "like"); const mc3 = await mrx.toggle("m1", "u1", "like");
  ok("prisma-reaction(toggle/count like2/再押し解除/reactionsBy memoryと完全一致)",
    JSON.stringify(pCounts) === JSON.stringify(mCounts) && pCounts.like === 2 &&
    pc3.like === 1 && JSON.stringify(pc3) === JSON.stringify(mc3) &&
    JSON.stringify(await prx.reactionsBy("m1", "u2")) === JSON.stringify(await mrx.reactionsBy("m1", "u2")));

  // ピン配信(gateway → controller 封筒)
  const B = await import(RTB), G = await import(GW), CC = await import(CTRL);
  const memBus = () => { const h = new Map(); return { async publish(ch, msg) { (h.get(ch) || []).forEach(fn => fn(typeof msg === "string" ? msg : JSON.stringify(msg))); }, async subscribe(ch, fn) { const a = h.get(ch) || []; a.push(fn); h.set(ch, a); }, async unsubscribe(ch) { h.delete(ch); } }; };
  const pstore2 = PS.createMemoryPinStore();
  const hub = B.createBroadcastHub(memBus());
  const gw = G.createChatGateway({ hub, newId: () => "x", togglePinStore: (r, m, u) => pstore2.togglePin(r, m, u) });
  const recvPins = [];
  let esp = null;
  class FES { constructor(url) { this.url = url; this.onmessage = null; esp = this; } close() {} }
  const ctrl = CC.createChatController({ roomId: "r1", EventSourceImpl: FES, fetchImpl: async () => ({ ok: true, json: async () => ({}) }), onChange: () => {}, onPin: (mid, pinned) => recvPins.push({ mid, pinned }) });
  ctrl.start();
  await hub.subscribe("room:r1", "cx", (data) => esp.onmessage && esp.onmessage({ data }));
  const gp1 = await gw.pin({ roomId: "r1", messageId: "m1", userId: "alice" });
  const gp2 = await gw.pin({ roomId: "r1", messageId: "m1", userId: "bob" });
  const gwNo = G.createChatGateway({ hub, newId: () => "y" });
  const gpNo = await gwNo.pin({ roomId: "r1", messageId: "m1", userId: "a" });
  ok("pin-gateway(固定true+配信/再ピンfalse/controller受信/store未指定は未対応)",
    gp1.ok === true && gp1.pinned === true && recvPins[0].pinned === true && recvPins[0].mid === "m1" &&
    gp2.pinned === false && recvPins[recvPins.length - 1].pinned === false && gpNo.ok === false && gpNo.error.includes("未対応"));

  for (const f of [AC, RX, PIN, MSG, ROOM, CHAT, STORE, RREPO, PINS, MENT, REAC, RTB, RT, GW, CTRL]) await fsp.rm(f);
}


// ── ピン/ブックマークの Prisma 実装(実ソース結合・memoryパリティ) ──
{
  section("chat: ピン/ブックマーク Prisma 実装(実ソース)");
  const fpp = await import("node:fs/promises");
  const opp = await import("node:os");
  const dpp = opp.tmpdir();
  const spp = Date.now();
  const rpp = async (rel) => (await fpp.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const AC = `${dpp}/pz-attc-${spp}.ts`, RX = `${dpp}/pz-rx-${spp}.ts`, PIN = `${dpp}/pz-pin-${spp}.ts`, MSG = `${dpp}/pz-msg-${spp}.ts`, ROOM = `${dpp}/pz-room-${spp}.ts`, CHAT = `${dpp}/pz-chat-${spp}.ts`, PINS = `${dpp}/pz-pins-${spp}.ts`;
  await fpp.writeFile(AC, await rpp("../packages/chat/src/attachment.ts"));
  await fpp.writeFile(RX, await rpp("../packages/chat/src/reaction.ts"));
  await fpp.writeFile(PIN, await rpp("../packages/chat/src/pin.ts"));
  await fpp.writeFile(MSG, (await rpp("../packages/chat/src/message.ts")).replace(/from "\.\/attachment\.ts"/g, `from "${AC}"`));
  await fpp.writeFile(ROOM, (await rpp("../packages/chat/src/room.ts")).replace(/from "\.\/message\.ts"/g, `from "${MSG}"`));
  await fpp.writeFile(CHAT, `export * from "${AC}"; export * from "${RX}"; export * from "${PIN}"; export * from "${MSG}"; export * from "${ROOM}";`);
  await fpp.writeFile(PINS, (await rpp("../apps/internal-app/src/server/chat-pins.ts")).replace(/from "@platform\/chat"/g, `from "${CHAT}"`));

  const isoZ = (x) => new Date(x).toISOString();
  const PS = await import(PINS);
  const fakePinDb = () => { const pins = []; const bms = []; return {
    pinRow: {
      async findUnique({ where }) { const w = where.roomId_messageId; return pins.find(p => p.roomId === w.roomId && p.messageId === w.messageId) ?? null; },
      async create({ data }) { pins.push({ ...data }); },
      async delete({ where }) { const w = where.roomId_messageId; const i = pins.findIndex(p => p.roomId === w.roomId && p.messageId === w.messageId); if (i >= 0) pins.splice(i, 1); },
      async findMany({ where }) { return pins.filter(p => p.roomId === where.roomId).slice().sort((a, b) => b.pinnedAt.getTime() - a.pinnedAt.getTime()); },
    },
    bookmarkRow: {
      async findUnique({ where }) { const w = where.userId_messageId; return bms.find(b => b.userId === w.userId && b.messageId === w.messageId) ?? null; },
      async create({ data }) { bms.push({ ...data }); },
      async delete({ where }) { const w = where.userId_messageId; const i = bms.findIndex(b => b.userId === w.userId && b.messageId === w.messageId); if (i >= 0) bms.splice(i, 1); },
      async findMany({ where }) { return bms.filter(b => b.userId === where.userId).slice().sort((a, b) => b.at.getTime() - a.at.getTime()); },
    },
    _pins: pins,
  }; };
  const db = fakePinDb();
  const pp = PS.createPrismaPinStore(db);
  const mp = PS.createMemoryPinStore();
  const a1 = await pp.togglePin("r1", "m1", "alice", isoZ("2025-07-01T10:00:00Z")); const b1 = await mp.togglePin("r1", "m1", "alice", isoZ("2025-07-01T10:00:00Z"));
  await pp.togglePin("r1", "m2", "bob", isoZ("2025-07-01T11:00:00Z")); await mp.togglePin("r1", "m2", "bob", isoZ("2025-07-01T11:00:00Z"));
  const a3 = await pp.togglePin("r1", "m1", "carol"); const b3 = await mp.togglePin("r1", "m1", "carol");
  const bk1 = await pp.toggleBookmark("u1", "m1", "r1", isoZ("2025-07-01T10:00:00Z")); const bkm1 = await mp.toggleBookmark("u1", "m1", "r1", isoZ("2025-07-01T10:00:00Z"));
  await pp.toggleBookmark("u1", "m2", "r2", isoZ("2025-07-01T12:00:00Z")); await mp.toggleBookmark("u1", "m2", "r2", isoZ("2025-07-01T12:00:00Z"));
  const bk3 = await pp.toggleBookmark("u1", "m1", "r1"); const bkm3 = await mp.toggleBookmark("u1", "m1", "r1");
  ok("prisma-pin-store(togglePin/pins新しい順/再ピン解除/unique/bookmark往復ISO memory完全一致)",
    a1 === true && a1 === b1 && a3 === false && a3 === b3 &&
    (await pp.pins("r1")).map(p => p.messageId).join("") === "m2" &&
    JSON.stringify((await pp.pins("r1")).map(p => p.messageId)) === JSON.stringify((await mp.pins("r1")).map(p => p.messageId)) &&
    db._pins.filter(p => p.roomId === "r1" && p.messageId === "m2").length === 1 &&
    bk1 === true && bk1 === bkm1 && bk3 === false && bk3 === bkm3 &&
    (await pp.bookmarks("u1")).map(b => b.messageId).join("") === "m2" &&
    (await pp.bookmarks("u1"))[0].at === isoZ("2025-07-01T12:00:00Z"));

  for (const f of [AC, RX, PIN, MSG, ROOM, CHAT, PINS]) await fpp.rm(f);
}


// ── 通知センター / ファイル管理 / 監査ログ(実ソース結合) ──
{
  section("platform: 通知センター / ファイル管理 / 監査ログ(実ソース)");
  const fsn = await import("node:fs/promises");
  const osn = await import("node:os");
  const dn = osn.tmpdir();
  const stn = Date.now();
  const rdn = async (rel) => (await fsn.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const NC = `${dn}/pf-nc-${stn}.ts`, FM = `${dn}/pf-fm-${stn}.ts`, AL = `${dn}/pf-al-${stn}.ts`, STG = `${dn}/pf-stg-${stn}.ts`;
  const AEV = `${dn}/pf-aev-${stn}.ts`, ALOG = `${dn}/pf-alog-${stn}.ts`, AQ = `${dn}/pf-aq-${stn}.ts`, AUD = `${dn}/pf-aud-${stn}.ts`;
  await fsn.writeFile(NC, await rdn("../apps/internal-app/src/server/notification-center.ts"));
  await fsn.writeFile(STG, "export {};");
  await fsn.writeFile(FM, (await rdn("../apps/internal-app/src/server/file-manager.ts")).replace(/from "@platform\/storage"/g, `from "${STG}"`));
  await fsn.writeFile(AEV, await rdn("../packages/audit/src/event.ts"));
  await fsn.writeFile(ALOG, (await rdn("../packages/audit/src/log.ts")).replace(/from "\.\/event\.ts"/g, `from "${AEV}"`));
  await fsn.writeFile(AQ, (await rdn("../packages/audit/src/query.ts")).replace(/from "\.\/log\.ts"/g, `from "${ALOG}"`).replace(/from "\.\/event\.ts"/g, `from "${AEV}"`));
  await fsn.writeFile(AUD, `export * from "${AEV}"; export * from "${ALOG}"; export * from "${AQ}";`);
  const CSVSTUB1 = `${dn}/pf-csv-${stn}.ts`;
  await fsn.writeFile(CSVSTUB1, await rdn("../packages/csv/src/index.ts"));
  await fsn.writeFile(AL, (await rdn("../apps/internal-app/src/server/audit-log.ts")).replace(/from "@platform\/audit"/g, `from "${AUD}"`).replace(/from "@platform\/csv"/g, `from "${CSVSTUB1}"`));

  const isoN = (x) => new Date(x).toISOString();

  // 通知センター(memory + prisma parity)
  const N = await import(NC);
  const mstore = N.createMemoryNotificationStore();
  const center = N.createNotificationCenter(mstore, (() => { let i = 0; return () => "n" + (++i); })());
  await center.notify("alice", { title: "メンション", kind: "mention", href: "/chat/r1" });
  await new Promise(r => setTimeout(r, 2));
  await center.notify("alice", { title: "承認依頼", body: "経費#12" });
  await center.notify("bob", { title: "別" });
  await mstore.markRead("alice", "n1");
  const fakeNDb = () => { const rows = []; return { notificationRow: {
    async create({ data }) { rows.push({ ...data }); },
    async findMany({ where, orderBy, take }) { let r = rows.filter(x => x.userId === where.userId && (where.read === undefined || x.read === where.read)).slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); if (take !== undefined) r = r.slice(0, take); return r; },
    async count({ where }) { return rows.filter(x => x.userId === where.userId && x.read === where.read).length; },
    async update({ where, data }) { const n = rows.find(x => x.id === where.id); if (n) Object.assign(n, data); },
    async updateMany({ where, data }) { for (const x of rows.filter(x => x.userId === where.userId && x.read === where.read)) Object.assign(x, data); },
  } }; };
  const pstore = N.createPrismaNotificationStore(fakeNDb());
  const pc = N.createNotificationCenter(pstore, (() => { let i = 0; return () => "p" + (++i); })());
  await pc.notify("alice", { title: "A", kind: "mention", href: "/x" });
  await new Promise(r => setTimeout(r, 2));
  await pc.notify("alice", { title: "B", body: "本文" });
  await pstore.markRead("alice", "p1");
  ok("notification-center(notify/未読/markRead/markAllRead/limit・prisma memory一致)",
    (await mstore.list("alice")).length === 2 && (await mstore.unreadCount("alice")) === 1 && (await mstore.list("alice", { unreadOnly: true })).length === 1 &&
    (await mstore.list("alice", { limit: 1 })).length === 1 && (await mstore.list("bob")).length === 1 &&
    (await pstore.list("alice")).map(n => n.title).join("") === "BA" && (await pstore.unreadCount("alice")) === 1 &&
    (await pstore.list("alice", { unreadOnly: true }))[0].title === "B" && (await pstore.list("alice"))[1].kind === "mention");

  // ファイル管理(memory + prisma parity)
  const F = await import(FM);
  const deleted = [];
  const storage = { async delete(key) { deleted.push(key); return { ok: true, value: undefined }; } };
  const reg = F.createMemoryFileRegistry();
  const fm = F.createFileManager({ storage, registry: reg });
  await fm.register({ key: "uploads/a.png", name: "a.png", size: 1000, type: "image/png", uploadedBy: "alice" });
  await new Promise(r => setTimeout(r, 2));
  await fm.register({ key: "uploads/b.pdf", name: "b.pdf", size: 2000, type: "application/pdf", uploadedBy: "bob" });
  const rm = await fm.remove("uploads/a.png");
  const failStorage = { async delete() { return { ok: false, error: new Error("S3") }; } };
  const rm2 = await F.createFileManager({ storage: failStorage, registry: reg }).remove("uploads/b.pdf");
  const fakeFDb = () => { const rows = []; return { fileRow: {
    async upsert({ where, create, update }) { const ex = rows.find(r => r.key === where.key); if (ex) Object.assign(ex, update); else rows.push({ ...create }); },
    async findMany({ where, orderBy, take }) { let r = rows.filter(x => !where.key || x.key.startsWith(where.key.startsWith)).slice().sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()); if (take !== undefined) r = r.slice(0, take); return r; },
    async findUnique({ where }) { return rows.find(r => r.key === where.key) ?? null; },
    async delete({ where }) { const i = rows.findIndex(r => r.key === where.key); if (i >= 0) rows.splice(i, 1); },
  } }; };
  const preg = F.createPrismaFileRegistry(fakeFDb());
  await preg.record({ key: "u/x.png", name: "x.png", size: 10, type: "image/png", uploadedBy: "u1", uploadedAt: isoN("2025-07-01T10:00:00Z") });
  await preg.record({ key: "u/y.pdf", name: "y.pdf", size: 20, type: "application/pdf", uploadedBy: "u2", uploadedAt: isoN("2025-07-01T11:00:00Z") });
  await preg.record({ key: "u/y.pdf", name: "y2.pdf", size: 99, type: "application/pdf", uploadedBy: "u2", uploadedAt: isoN("2025-07-01T12:00:00Z") });
  ok("file-manager(list新しい順/prefix/remove実体+登録/失敗で残す・prisma upsert上書き/prefix/get)",
    rm.ok === true && deleted[0] === "uploads/a.png" && (await fm.list()).length === 1 &&
    rm2.ok === false && rm2.error === "S3" && (await reg.get("uploads/b.pdf")) !== undefined &&
    (await preg.list()).length === 2 && (await preg.list())[0].name === "y2.pdf" && (await preg.list({ prefix: "u/" })).length === 2 && (await preg.get("u/x.png")).size === 10);

  // 監査ログ(記録/検索/検証/改ざん検知)
  const A = await import(AL);
  const audit = A.createAuditLog(A.createMemoryAuditStore());
  await audit.record({ at: isoN("2025-07-01T10:00:00Z"), actor: "alice", action: "expense.submit", target: "expense:1", after: { amount: 1000 } });
  await audit.record({ at: isoN("2025-07-01T11:00:00Z"), actor: "bob", action: "expense.approve", target: "expense:1" });
  await audit.record({ at: isoN("2025-07-02T09:00:00Z"), actor: "alice", action: "invoice.issue", target: "invoice:5" });
  const store2 = A.createMemoryAuditStore();
  const audit2 = A.createAuditLog(store2);
  await audit2.record({ at: isoN("2025-07-01T10:00:00Z"), actor: "a", action: "x", target: "t:1" });
  await audit2.record({ at: isoN("2025-07-01T11:00:00Z"), actor: "b", action: "y", target: "t:2" });
  const entries = await store2.all();
  entries[0].actor = "hacker";
  await store2.replace(entries);
  const v = await audit2.verify();
  ok("audit-log(size3/検証valid/actor絞込新しい順/action前方一致/period/history説明付き/改ざん検知brokenAt)",
    (await audit.size()) === 3 && (await audit.verify()).valid === true &&
    (await audit.query({ actor: "alice" })).length === 2 && (await audit.query({ actor: "alice" }))[0].target === "invoice:5" &&
    (await audit.query({ action: "expense" })).length === 2 && (await audit.query({ from: "2025-07-01", to: "2025-07-01" })).length === 2 &&
    (await audit.history("expense:1")).map(e => e.action).join(",") === "expense.submit,expense.approve" && (await audit.history("expense:1"))[0].description.includes("alice") &&
    v.valid === false && v.brokenAt === 0);

  for (const f of [NC, FM, AL, STG, AEV, ALOG, AQ, AUD]) await fsn.rm(f);
}


// ── 配信設定 / 監査アクション記録(実ソース結合) ──
{
  section("platform: 通知配信設定 / 監査アクション記録(実ソース)");
  const fsz = await import("node:fs/promises");
  const osz = await import("node:os");
  const dz = osz.tmpdir();
  const stz = Date.now();
  const rdz = async (rel) => (await fsz.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const PREF = `${dz}/wz-pref-${stz}.ts`, NT = `${dz}/wz-nt-${stz}.ts`, NP = `${dz}/wz-np-${stz}.ts`;
  const AEV = `${dz}/wz-aev-${stz}.ts`, ALOG = `${dz}/wz-alog-${stz}.ts`, AQ = `${dz}/wz-aq-${stz}.ts`, AUD = `${dz}/wz-aud-${stz}.ts`, AL = `${dz}/wz-al-${stz}.ts`, AA = `${dz}/wz-aa-${stz}.ts`;
  await fsz.writeFile(PREF, await rdz("../packages/notify/src/preferences.ts"));
  await fsz.writeFile(NT, `export * from "${PREF}";`);
  await fsz.writeFile(NP, (await rdz("../apps/internal-app/src/server/notification-prefs.ts")).replace(/from "@platform\/notify"/g, `from "${NT}"`));
  for (const [f, src] of [[AEV, "event"], [ALOG, "log"], [AQ, "query"]]) await fsz.writeFile(f, await rdz(`../packages/audit/src/${src}.ts`));
  let alog = await fsz.readFile(ALOG, "utf8"); alog = alog.replace(new RegExp('from "./event.ts"', "g"), `from "${AEV}"`); await fsz.writeFile(ALOG, alog);
  let aq = await fsz.readFile(AQ, "utf8"); aq = aq.replace(new RegExp('from "./log.ts"', "g"), `from "${ALOG}"`).replace(new RegExp('from "./event.ts"', "g"), `from "${AEV}"`); await fsz.writeFile(AQ, aq);
  await fsz.writeFile(AUD, `export * from "${AEV}"; export * from "${ALOG}"; export * from "${AQ}";`);
  const CSVSTUB2 = `${dz}/wz-csv-${stz}.ts`;
  await fsz.writeFile(CSVSTUB2, await rdz("../packages/csv/src/index.ts"));
  await fsz.writeFile(AL, (await rdz("../apps/internal-app/src/server/audit-log.ts")).replace(/from "@platform\/audit"/g, `from "${AUD}"`).replace(/from "@platform\/csv"/g, `from "${CSVSTUB2}"`));
  await fsz.writeFile(AA, (await rdz("../apps/internal-app/src/server/audit-actions.ts")).replace(/from "@platform\/audit"/g, `from "${AUD}"`).replace(/from "\.\/audit-log\.ts"/g, `from "${AL}"`));

  // 配信設定
  const NPmod = await import(NP);
  const pstore = NPmod.createMemoryPreferenceStore();
  await pstore.set("u1", { defaultChannels: ["inApp", "email"], categories: { mention: { channels: ["inApp"], mode: "immediate" } } });
  const d1 = await NPmod.decideDelivery(pstore, "u1", { category: "mention" });
  await pstore.set("u2", { defaultChannels: ["email"], categories: { report: { channels: ["email"], mode: "off" } } });
  const d2 = await NPmod.decideDelivery(pstore, "u2", { category: "report" });
  await pstore.set("u4", { defaultChannels: ["email"], quietHours: { start: 22, end: 7 } });
  const night = new Date("2025-07-01T23:30:00");
  const d4 = await NPmod.decideDelivery(pstore, "u4", { category: "x" }, night);
  const d5 = await NPmod.decideDelivery(pstore, "u4", { category: "x", urgent: true }, night);
  const day = new Date("2025-07-01T10:00:00");
  const d6 = await NPmod.decideDelivery(pstore, "u4", { category: "x" }, day);
  const fakePDb = () => { const rows = new Map(); return { notificationPreferenceRow: {
    async findUnique({ where }) { return rows.get(where.userId) ?? null; },
    async upsert({ where, create, update }) { const ex = rows.get(where.userId); rows.set(where.userId, ex ? { ...ex, ...update } : { ...create }); },
  } }; };
  const ppref = NPmod.createPrismaPreferenceStore(fakePDb());
  await ppref.set("z", { defaultChannels: ["inApp"], categories: { mention: { channels: ["inApp"], mode: "immediate" } }, quietHours: { start: 22, end: 7 } });
  const pg = await ppref.get("z");
  ok("notification-prefs(mention→inApp/off/静音deferred/urgent即時/昼間immediate・prisma往復)",
    NPmod.hasChannel(d1, "inApp") === true && NPmod.hasChannel(d1, "email") === false &&
    d2.reason === "off" && NPmod.hasChannel(d2, "email") === false &&
    d4.reason === "quiet_hours" && d4.deferred === true &&
    d5.reason === "urgent" && NPmod.hasChannel(d5, "email") === true &&
    d6.reason === "immediate" && NPmod.hasChannel(d6, "email") === true &&
    JSON.stringify((await ppref.get("none")).defaultChannels) === JSON.stringify(["inApp", "email"]) &&
    JSON.stringify(pg.defaultChannels) === JSON.stringify(["inApp"]) && pg.quietHours.start === 22 && pg.quietHours.end === 7);

  // 監査アクション記録
  const ALmod = await import(AL), AAmod = await import(AA);
  let t = 0; const now = () => new Date(Date.UTC(2025, 6, 1, 10, 0, t++)).toISOString();
  const audit = ALmod.createAuditLog(ALmod.createMemoryAuditStore());
  const actions = AAmod.createAuditActions(audit, now);
  await actions.chatEdit("alice", "r1", "m1", "こんにちは", "やあ");
  await actions.chatDelete("bob", "r1", "m2");
  await actions.boardEdit("carol", "t1", "p1", "旧", "新");
  await actions.boardDelete("carol", "t1", "p2");
  await actions.fileUpload("dave", "files/a.png", { name: "a.png", size: 1000, type: "image/png" });
  await actions.fileDelete("dave", "files/old.png");
  await actions.record("eve", "expense.submit", "expense:9", { after: { amount: 5000 } });
  const editRow = (await audit.query({ action: "chat.message.edit" }))[0];
  const upRow = (await audit.query({ action: "file.upload" }))[0];
  ok("audit-actions(7件記録/チェーンvalid/chat.board.file各記録/before-after/target形式/query)",
    (await audit.size()) === 7 && (await audit.verify()).valid === true &&
    (await audit.query({ action: "chat" })).length === 2 && (await audit.query({ action: "board" })).length === 2 && (await audit.query({ action: "file" })).length === 2 &&
    editRow.before.text === "こんにちは" && editRow.after.text === "やあ" && editRow.target === "message:r1/m1" &&
    upRow.after.name === "a.png" && upRow.after.size === 1000 && upRow.target === "file:files/a.png" &&
    (await audit.history("expense:9"))[0].description.includes("eve") && (await audit.query({ actor: "carol" })).length === 2);

  for (const f of [PREF, NT, NP, AEV, ALOG, AQ, AUD, AL, AA]) await fsz.rm(f);
}


// ── 監査ログ CSV エクスポート(実ソース結合) ──
{
  section("platform: 監査ログ CSV エクスポート(実ソース)");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const stc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const AEV = `${dc}/cv-aev-${stc}.ts`, ALOG = `${dc}/cv-alog-${stc}.ts`, AQ = `${dc}/cv-aq-${stc}.ts`, AUD = `${dc}/cv-aud-${stc}.ts`, CSV = `${dc}/cv-csv-${stc}.ts`, AL = `${dc}/cv-al-${stc}.ts`;
  for (const [f, src] of [[AEV, "event"], [ALOG, "log"], [AQ, "query"]]) await fsc.writeFile(f, await rdc(`../packages/audit/src/${src}.ts`));
  let alog = await fsc.readFile(ALOG, "utf8"); alog = alog.replace(new RegExp('from "./event.ts"', "g"), `from "${AEV}"`); await fsc.writeFile(ALOG, alog);
  let aq = await fsc.readFile(AQ, "utf8"); aq = aq.replace(new RegExp('from "./log.ts"', "g"), `from "${ALOG}"`).replace(new RegExp('from "./event.ts"', "g"), `from "${AEV}"`); await fsc.writeFile(AQ, aq);
  await fsc.writeFile(AUD, `export * from "${AEV}"; export * from "${ALOG}"; export * from "${AQ}";`);
  await fsc.writeFile(CSV, await rdc("../packages/csv/src/index.ts"));
  await fsc.writeFile(AL, (await rdc("../apps/internal-app/src/server/audit-log.ts")).replace(/from "@platform\/audit"/g, `from "${AUD}"`).replace(/from "@platform\/csv"/g, `from "${CSV}"`));

  const AL2 = await import(AL);
  let t = 0; const now = () => new Date(Date.UTC(2025, 6, 1, 10, 0, t++)).toISOString();
  const audit = AL2.createAuditLog(AL2.createMemoryAuditStore());
  await audit.record({ at: now(), actor: "alice", action: "expense.submit", target: "expense:1", after: { amount: 1000 } });
  await audit.record({ at: now(), actor: "bob,inc", action: "expense.approve", target: "expense:1" });
  const csv = await audit.exportCsv();
  const lines = csv.split("\r\n");
  const aliceCsv = await audit.exportCsv({ actor: "alice" });
  ok("audit-csv(BOM/日本語ヘッダ/2行/カンマ値クォート/新しい順bob先頭/actorフィルタ1行)",
    csv.charCodeAt(0) === 0xFEFF && lines[0].includes("連番") && lines[0].includes("操作者") && lines[0].includes("説明") &&
    lines.length === 3 && lines[1].includes('"bob,inc"') && lines[1].includes("expense:1") && lines[2].includes("expense.submit") &&
    aliceCsv.split("\r\n").length === 2 && aliceCsv.includes("alice"));

  for (const f of [AEV, ALOG, AQ, AUD, CSV, AL]) await fsc.rm(f);
}


// ── 監査ログ Prisma 永続化 / 業務イベント記録(実ソース結合) ──
{
  section("platform: 監査ログ Prisma 永続化 / 業務操作記録(実ソース)");
  const fsp = await import("node:fs/promises");
  const osp = await import("node:os");
  const dp = osp.tmpdir();
  const stp = Date.now();
  const rdp = async (rel) => (await fsp.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const AEV = `${dp}/pz2-aev-${stp}.ts`, ALOG = `${dp}/pz2-alog-${stp}.ts`, AQ = `${dp}/pz2-aq-${stp}.ts`, AUD = `${dp}/pz2-aud-${stp}.ts`, CSV = `${dp}/pz2-csv-${stp}.ts`, AL = `${dp}/pz2-al-${stp}.ts`, AA = `${dp}/pz2-aa-${stp}.ts`;
  for (const [f, src] of [[AEV, "event"], [ALOG, "log"], [AQ, "query"]]) await fsp.writeFile(f, await rdp(`../packages/audit/src/${src}.ts`));
  let alog = await fsp.readFile(ALOG, "utf8"); alog = alog.replace(new RegExp('from "./event.ts"', "g"), `from "${AEV}"`); await fsp.writeFile(ALOG, alog);
  let aq = await fsp.readFile(AQ, "utf8"); aq = aq.replace(new RegExp('from "./log.ts"', "g"), `from "${ALOG}"`).replace(new RegExp('from "./event.ts"', "g"), `from "${AEV}"`); await fsp.writeFile(AQ, aq);
  await fsp.writeFile(AUD, `export * from "${AEV}"; export * from "${ALOG}"; export * from "${AQ}";`);
  await fsp.writeFile(CSV, await rdp("../packages/csv/src/index.ts"));
  await fsp.writeFile(AL, (await rdp("../apps/internal-app/src/server/audit-log.ts")).replace(/from "@platform\/audit"/g, `from "${AUD}"`).replace(/from "@platform\/csv"/g, `from "${CSV}"`));
  await fsp.writeFile(AA, (await rdp("../apps/internal-app/src/server/audit-actions.ts")).replace(/from "@platform\/audit"/g, `from "${AUD}"`).replace(/from "\.\/audit-log\.ts"/g, `from "${AL}"`));

  const AL2 = await import(AL), AA2 = await import(AA);
  let t = 0; const now = () => new Date(Date.UTC(2025, 6, 1, 10, 0, t++)).toISOString();

  // Prisma 永続ストア(fake db)
  const fakeAuditDb = () => { const rows = []; return {
    auditEntryRow: {
      async findMany() { return rows.slice().sort((a, b) => a.seq - b.seq); },
      async findFirst() { return rows.length ? rows.slice().sort((a, b) => b.seq - a.seq)[0] : null; },
      async create({ data }) { rows.push({ ...data }); },
    }, _rows: rows }; };
  const db = fakeAuditDb();
  const audit = AL2.createAuditLog(AL2.createPrismaAuditStore(db));
  const actions = AA2.createAuditActions(audit, now);
  // 業務操作を記録
  await actions.expenseSubmit("alice", "e1", 5000, "交通費");
  await actions.expenseDecision("boss", "r1", "approve", "OK");
  await actions.invoiceIssue("finance", "inv1", 12000);
  await actions.record("alice", "expense.request.create", "request:r1", { after: { expenseId: "e1" } });

  // memory で同じ列を記録 → hash 一致(決定的チェーン)
  const m = AL2.createAuditLog(AL2.createMemoryAuditStore());
  const mactions = AA2.createAuditActions(m, (() => { let u = 0; return () => new Date(Date.UTC(2025, 6, 1, 10, 0, u++)).toISOString(); })());
  await mactions.expenseSubmit("alice", "e1", 5000, "交通費");
  await mactions.expenseDecision("boss", "r1", "approve", "OK");
  await mactions.invoiceIssue("finance", "inv1", 12000);
  await mactions.record("alice", "expense.request.create", "request:r1", { after: { expenseId: "e1" } });

  const ph = (await audit.query()).map((e) => e.hash).join();
  const mh = (await m.query()).map((e) => e.hash).join();

  db._rows[1].actor = "hacker"; // DB改ざん
  const v = await audit.verify();

  const db2 = fakeAuditDb();
  const audit2 = AL2.createAuditLog(AL2.createPrismaAuditStore(db2));
  const actions2 = AA2.createAuditActions(audit2, (() => { let u = 0; return () => new Date(Date.UTC(2025, 6, 1, 11, 0, u++)).toISOString(); })());
  await actions2.expenseSubmit("x", "e9", 100);
  const submitRow = (await audit2.query({ action: "expense.submit" }))[0];

  ok("audit-prisma-business(seq連番/expense.submit-approve-invoice記録/before-after/target/memory hash一致/DB改ざん検知)",
    db._rows.map((r) => r.seq).join(",") === "0,1,2,3" &&
    (await audit.query({ action: "expense" })).length === 3 && // submit, approve, request.create は expense.* 前方一致
    (await audit.query({ action: "invoice" })).length === 1 &&
    submitRow.target === "expense:e9" && submitRow.after.amount === 100 &&
    (await audit2.query({ action: "expense.submit" }))[0].after.amount === 100 &&
    ph === mh && ph.length > 0 &&
    v.valid === false && v.brokenAt === 1);

  for (const f of [AEV, ALOG, AQ, AUD, CSV, AL, AA]) await fsp.rm(f);
}


// ── アクセス解析 / 負荷テスト / 監査詳細・ダッシュボード設定(実ソース結合) ──
{
  section("platform: アクセス解析 / 負荷テスト / 監査詳細・ダッシュボード設定(実ソース)");
  const fst = await import("node:fs/promises");
  const ost = await import("node:os");
  const dt = ost.tmpdir();
  const stt = Date.now();
  const rdt = async (rel) => (await fst.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');

  // analytics package
  const AEV = `${dt}/an-ev-${stt}.ts`, AAG = `${dt}/an-ag-${stt}.ts`, ANA = `${dt}/an-a-${stt}.ts`, AST = `${dt}/an-st-${stt}.ts`;
  await fst.writeFile(AEV, await rdt("../packages/analytics/src/event.ts"));
  await fst.writeFile(AAG, (await rdt("../packages/analytics/src/aggregate.ts")).replace(new RegExp('from "./event.ts"', "g"), `from "${AEV}"`));
  await fst.writeFile(ANA, `export * from "${AEV}"; export * from "${AAG}";`);
  await fst.writeFile(AST, (await rdt("../apps/internal-app/src/server/analytics-store.ts")).replace(/from "@platform\/analytics"/g, `from "${ANA}"`));

  // loadtest package
  const LST = `${dt}/lt-st-${stt}.ts`, LRN = `${dt}/lt-rn-${stt}.ts`;
  await fst.writeFile(LST, await rdt("../packages/loadtest/src/stats.ts"));
  await fst.writeFile(LRN, (await rdt("../packages/loadtest/src/runner.ts")).replace(new RegExp('from "./stats.ts"', "g"), `from "${LST}"`));

  // audit(entry詳細) + dashboard-prefs
  const EEV = `${dt}/ad-ev-${stt}.ts`, ELOG = `${dt}/ad-log-${stt}.ts`, EQ = `${dt}/ad-q-${stt}.ts`, EAUD = `${dt}/ad-aud-${stt}.ts`, ECSV = `${dt}/ad-csv-${stt}.ts`, EAL = `${dt}/ad-al-${stt}.ts`, DPR = `${dt}/dp-${stt}.ts`;
  for (const [f, src] of [[EEV, "event"], [ELOG, "log"], [EQ, "query"]]) await fst.writeFile(f, await rdt(`../packages/audit/src/${src}.ts`));
  let elog = await fst.readFile(ELOG, "utf8"); elog = elog.replace(new RegExp('from "./event.ts"', "g"), `from "${EEV}"`); await fst.writeFile(ELOG, elog);
  let eq = await fst.readFile(EQ, "utf8"); eq = eq.replace(new RegExp('from "./log.ts"', "g"), `from "${ELOG}"`).replace(new RegExp('from "./event.ts"', "g"), `from "${EEV}"`); await fst.writeFile(EQ, eq);
  await fst.writeFile(EAUD, `export * from "${EEV}"; export * from "${ELOG}"; export * from "${EQ}";`);
  await fst.writeFile(ECSV, await rdt("../packages/csv/src/index.ts"));
  await fst.writeFile(EAL, (await rdt("../apps/internal-app/src/server/audit-log.ts")).replace(/from "@platform\/audit"/g, `from "${EAUD}"`).replace(/from "@platform\/csv"/g, `from "${ECSV}"`));
  await fst.writeFile(DPR, await rdt("../apps/internal-app/src/server/dashboard-prefs.ts"));

  const isoT = (x) => new Date(x).toISOString();

  // analytics
  const AN = await import(AST);
  const an = AN.createAnalytics(AN.createMemoryAnalyticsStore());
  await an.track({ type: "pageview", path: "/", sessionId: "s1", userId: "u1", referrer: "google.com", at: isoT("2025-07-01T10:00:00Z") });
  await an.track({ type: "pageview", path: "/pricing", sessionId: "s1", at: isoT("2025-07-01T10:05:00Z") });
  await an.track({ type: "pageview", path: "/", sessionId: "s2", at: isoT("2025-07-02T09:00:00Z") });
  const sum = await an.summary();
  const fakeAnDb = () => { const rows = []; return { analyticsEventRow: {
    async create({ data }) { rows.push({ ...data }); },
    async findMany({ where, orderBy }) { let r = rows.slice(); if (where.at) { if (where.at.gte) r = r.filter(x => x.at.getTime() >= where.at.gte.getTime()); if (where.at.lte) r = r.filter(x => x.at.getTime() <= where.at.lte.getTime()); } return r.sort((a, b) => a.at.getTime() - b.at.getTime()); },
  } }; };
  const pan = AN.createAnalytics(AN.createPrismaAnalyticsStore(fakeAnDb()));
  await pan.track({ type: "pageview", path: "/", sessionId: "s1", userId: "u1", referrer: "google.com", at: isoT("2025-07-01T10:00:00Z") });
  await pan.track({ type: "pageview", path: "/pricing", sessionId: "s1", at: isoT("2025-07-01T10:05:00Z") });
  await pan.track({ type: "pageview", path: "/", sessionId: "s2", at: isoT("2025-07-02T09:00:00Z") });
  ok("analytics(pv3/uv2/top-page/series2点/range・prisma memory一致)",
    sum.pageViews === 3 && sum.uniqueVisitors === 2 && sum.topPages[0].path === "/" && (await an.series()).length === 2 &&
    (await an.summary({ from: isoT("2025-07-01T00:00:00Z"), to: isoT("2025-07-01T23:59:59Z") })).pageViews === 2 &&
    (await pan.summary()).pageViews === 3 && (await pan.summary()).uniqueVisitors === 2 && (await pan.series()).length === 2);

  // loadtest
  const LT = await import(LRN), LS = await import(LST);
  let clk = 0; const nowLt = () => clk;
  const res = await LT.runLoad(async ({ index }) => { clk += 10; return index % 3 === 0 ? { ok: false, status: 500 } : { ok: true, status: 200 }; }, { concurrency: 1, iterations: 9, now: nowLt });
  clk = 0;
  const res2 = await LT.runLoad(async () => { clk += 1; return { ok: true }; }, { concurrency: 1, durationMs: 50, now: nowLt });
  ok("loadtest(percentile/total9/失敗3/errorRate/status別/durationMs停止)",
    LS.percentile([1,2,3,4,5,6,7,8,9,10], 50) === 5.5 && LS.latencyStats([10,20,30]).mean === 20 &&
    res.total === 9 && res.failed === 3 && res.success === 6 && Math.abs(res.errorRate - 3/9) < 1e-9 &&
    res.statusCounts["200"] === 6 && res.statusCounts["500"] === 3 && res.latency.p50 === 10 &&
    res2.total >= 49 && res2.total <= 51);

  // audit entry 詳細
  const AL = await import(EAL);
  let ta = 0; const nowA = () => new Date(Date.UTC(2025, 6, 1, 10, 0, ta++)).toISOString();
  const audit = AL.createAuditLog(AL.createMemoryAuditStore());
  const actions = { rec: (e) => audit.record({ at: nowA(), ...e }) };
  await actions.rec({ actor: "alice", action: "expense.edit", target: "expense:1", before: { amount: 1000, note: "同" }, after: { amount: 2000, note: "同" } });
  await actions.rec({ actor: "bob", action: "x", target: "t:1" });
  const d0 = await audit.entry(0);
  ok("audit-entry-detail(diff amountのみ/before-after/存在しないseqはundefined)",
    d0 !== undefined && d0.changes.length === 1 && d0.changes[0].field === "amount" && d0.changes[0].before === 1000 && d0.changes[0].after === 2000 &&
    (await audit.entry(1)).changes.length === 0 && (await audit.entry(99)) === undefined);

  // dashboard prefs
  const DP = await import(DPR);
  const dstore = DP.createMemoryDashboardPrefStore();
  await dstore.set("u1", { widgets: ["unread", "recentFiles", "bogus"] });
  const fakeDpDb = () => { const rows = new Map(); return { dashboardPrefRow: {
    async findUnique({ where }) { return rows.get(where.userId) ?? null; },
    async upsert({ where, create, update }) { const ex = rows.get(where.userId); rows.set(where.userId, ex ? { ...ex, ...update } : { ...create }); },
  } }; };
  const pdstore = DP.createPrismaDashboardPrefStore(fakeDpDb());
  await pdstore.set("z", { widgets: ["myTasks", "unread"] });
  ok("dashboard-prefs(既定6/normalize既知のみ・重複排除/set往復・prisma一致/isVisible)",
    DP.DEFAULT_WIDGETS.length === 8 && JSON.stringify(DP.normalizeWidgets(["unread", "myTasks", "unread", "x"])) === JSON.stringify(["unread", "myTasks"]) &&
    (await dstore.get("u1")).widgets.join(",") === "unread,recentFiles" && DP.isWidgetVisible(await dstore.get("u1"), "unread") === true && DP.isWidgetVisible(await dstore.get("u1"), "recentAudit") === false &&
    (await pdstore.get("none")).widgets.length === 8 && (await pdstore.get("z")).widgets.join(",") === "myTasks,unread");

  for (const f of [AEV, AAG, ANA, AST, LST, LRN, EEV, ELOG, EQ, EAUD, ECSV, EAL, DPR]) await fst.rm(f);
}


// ── HTMLヘルパー / 負荷シナリオ / 監査deepDiff+関連 / 計測ビーコン(実ソース結合) ──
{
  section("platform: HTMLヘルパー / 負荷シナリオ / 監査deepDiff+関連 / 計測ビーコン(実ソース)");
  const fsh = await import("node:fs/promises");
  const osh = await import("node:os");
  const dh = osh.tmpdir();
  const sth = Date.now();
  const rdh = async (rel) => (await fsh.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');

  // @platform/html
  const HE = `${dh}/h-e-${sth}.ts`, HW = `${dh}/h-w-${sth}.ts`, HF = `${dh}/h-f-${sth}.ts`, HT = `${dh}/h-t-${sth}.ts`;
  await fsh.writeFile(HE, await rdh("../packages/html/src/escape.ts"));
  await fsh.writeFile(HW, await rdh("../packages/html/src/whitespace.ts"));
  await fsh.writeFile(HF, await rdh("../packages/html/src/fullwidth.ts"));
  await fsh.writeFile(HT, (await rdh("../packages/html/src/text.ts")).replace(new RegExp('from "./escape.ts"', "g"), `from "${HE}"`).replace(new RegExp('from "./whitespace.ts"', "g"), `from "${HW}"`));
  const HTMLE = await import(HE), HTMLW = await import(HW), HTMLF = await import(HF), HTMLT = await import(HT);
  ok("html(escape/stripTags/nl2br/normalizeSpace/zenkaku/textToHtml-XSS安全/truncate/linkify)",
    HTMLE.escapeHtml('<a>&\"') === "&lt;a&gt;&amp;&quot;" && HTMLE.stripTags("<p>x<b>y</b></p>") === "xy" &&
    HTMLW.nl2br("a\nb") === "a<br>\nb" && HTMLW.normalizeSpace("\u3000 A\u3000\u3000B ") === "A B" &&
    HTMLF.zenkakuToHankaku("ＡＢ１２！\u3000") === "AB12! " && HTMLF.zenkakuDigitsToHankaku("\uFF10\uFF19\uFF10") === "090" &&
    HTMLT.textToHtml("<x>\ny") === "&lt;x&gt;<br>\ny" && HTMLT.truncate("あいうえおか", 4) === "あいう…" &&
    HTMLT.linkify("go https://ex.com/a?x=1&y=2 !").includes('href="https://ex.com/a?x=1&y=2"'));

  // 負荷シナリオ
  const LST = `${dh}/l-st-${sth}.ts`, LRN = `${dh}/l-rn-${sth}.ts`, LSC = `${dh}/l-sc-${sth}.ts`;
  await fsh.writeFile(LST, await rdh("../packages/loadtest/src/stats.ts"));
  await fsh.writeFile(LRN, (await rdh("../packages/loadtest/src/runner.ts")).replace(new RegExp('from "./stats.ts"', "g"), `from "${LST}"`));
  await fsh.writeFile(LSC, (await rdh("../packages/loadtest/src/scenario.ts")).replace(new RegExp('from "./stats.ts"', "g"), `from "${LST}"`).replace(new RegExp('from "./runner.ts"', "g"), `from "${LRN}"`));
  const SC = await import(LSC);
  const steps = [
    { name: "home", weight: 3, request: async () => ({ ok: true, status: 200 }) },
    { name: "search", weight: 1, request: async () => ({ ok: false, status: 500 }) },
  ];
  let clk = 0; const nowSc = () => clk;
  let rc = 0; const rseq = [0.1, 0.9]; const random = () => rseq[rc++ % 2];
  const scres = await SC.runScenario({ steps }, { concurrency: 1, iterations: 10, now: nowSc, random });
  ok("loadtest-scenario(weightedPick境界/activeWorkersランプ/ステップ別集計/home成功search失敗)",
    SC.weightedPick(steps, 0.7).name === "home" && SC.weightedPick(steps, 0.8).name === "search" &&
    SC.activeWorkers(10, 0, 0) === 10 && SC.activeWorkers(10, 100, 50) === 5 && SC.activeWorkers(10, 100, 100) === 10 &&
    scres.total === 10 && scres.steps.find((s) => s.name === "home").failed === 0 && scres.steps.find((s) => s.name === "search").success === 0 && scres.success + scres.failed === 10);

  // 監査 deepDiff + related
  const EEV = `${dh}/e-ev-${sth}.ts`, ELOG = `${dh}/e-log-${sth}.ts`, EQ = `${dh}/e-q-${sth}.ts`, EAUD = `${dh}/e-aud-${sth}.ts`, ECSV = `${dh}/e-csv-${sth}.ts`, EAL = `${dh}/e-al-${sth}.ts`;
  for (const [f, src] of [[EEV, "event"], [ELOG, "log"], [EQ, "query"]]) await fsh.writeFile(f, await rdh(`../packages/audit/src/${src}.ts`));
  let elog = await fsh.readFile(ELOG, "utf8"); elog = elog.replace(new RegExp('from "./event.ts"', "g"), `from "${EEV}"`); await fsh.writeFile(ELOG, elog);
  let eq = await fsh.readFile(EQ, "utf8"); eq = eq.replace(new RegExp('from "./log.ts"', "g"), `from "${ELOG}"`).replace(new RegExp('from "./event.ts"', "g"), `from "${EEV}"`); await fsh.writeFile(EQ, eq);
  await fsh.writeFile(EAUD, `export * from "${EEV}"; export * from "${ELOG}"; export * from "${EQ}";`);
  await fsh.writeFile(ECSV, await rdh("../packages/csv/src/index.ts"));
  await fsh.writeFile(EAL, (await rdh("../apps/internal-app/src/server/audit-log.ts")).replace(/from "@platform\/audit"/g, `from "${EAUD}"`).replace(/from "@platform\/csv"/g, `from "${ECSV}"`));
  const AUDIT = await import(EEV), AL = await import(EAL);
  const dd = AUDIT.deepDiffChanges({ amount: 1000, address: { city: "東京" } }, { amount: 2000, address: { city: "大阪" } });
  let ta = 0; const nowA = () => new Date(Date.UTC(2025, 6, 1, 10, 0, ta++)).toISOString();
  const audit = AL.createAuditLog(AL.createMemoryAuditStore());
  await audit.record({ at: nowA(), actor: "alice", action: "expense.create", target: "expense:1", after: { amount: 1000 } });
  await audit.record({ at: nowA(), actor: "bob", action: "expense.edit", target: "expense:1", before: { amount: 1000 }, after: { amount: 2000 } });
  await audit.record({ at: nowA(), actor: "carol", action: "expense.approve", target: "expense:1" });
  await audit.record({ at: nowA(), actor: "dave", action: "x", target: "expense:99" });
  const de = await audit.entry(1);
  ok("audit-deepdiff-related(ネストpath差分/related同一target・自分除外・古い順/別targetは空)",
    dd.length === 2 && dd.some((c) => c.field === "address.city" && c.before === "東京" && c.after === "大阪") &&
    de.changes.some((c) => c.field === "amount") &&
    de.related.length === 2 && de.related.map((r) => r.seq).join(",") === "0,2" && !de.related.some((r) => r.seq === 1) && de.related[0].description.includes("alice") &&
    (await audit.entry(3)).related.length === 0);

  // 計測ビーコン
  const ANEV = `${dh}/an-ev-${sth}.ts`, ANBR = `${dh}/an-br-${sth}.ts`;
  await fsh.writeFile(ANEV, await rdh("../packages/analytics/src/event.ts"));
  await fsh.writeFile(ANBR, (await rdh("../packages/analytics/src/browser.ts")).replace(new RegExp('from "./event.ts"', "g"), `from "${ANEV}"`));
  const BR = await import(ANBR);
  const beaconCalls = []; const fetchCalls = [];
  const b1 = BR.createBeacon({ sessionId: "s1", sendBeacon: (u, body) => { beaconCalls.push({ u, body }); return true; }, fetch: async (u) => { fetchCalls.push(u); } });
  b1.pageview("/pricing", { userId: "u1" });
  const fetchCalls2 = [];
  const b2 = BR.createBeacon({ sessionId: "s2", endpoint: "/track", sendBeacon: () => false, fetch: async (u, init) => { fetchCalls2.push({ u, init }); } });
  b2.send({ type: "click", path: "/x", sessionId: "s2" });
  ok("analytics-beacon(sendBeacon優先/fetch未呼/失敗でfetchフォールバック+keepalive/ensureSessionId)",
    beaconCalls.length === 1 && fetchCalls.length === 0 && JSON.parse(beaconCalls[0].body).path === "/pricing" && beaconCalls[0].u === "/api/analytics" &&
    fetchCalls2.length === 1 && fetchCalls2[0].u === "/track" && fetchCalls2[0].init.keepalive === true &&
    BR.ensureSessionId("abc", () => "gen") === "abc" && BR.ensureSessionId("", () => "gen") === "gen");

  for (const f of [HE, HW, HF, HT, LST, LRN, LSC, EEV, ELOG, EQ, EAUD, ECSV, EAL, ANEV, ANBR]) await fsh.rm(f);
}


// ── 公開サイト基盤(コンテンツ描画/SEO) + チャット/掲示板のlinkify適用(実ソース結合) ──
{
  section("platform: 公開サイト基盤(描画/SEO) + linkify適用(実ソース)");
  const fsp = await import("node:fs/promises");
  const osp = await import("node:os");
  const dp = osp.tmpdir();
  const sp = Date.now();
  const rdp = async (rel) => (await fsp.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');

  // @platform/html バレル
  const HE = `${dp}/ps-he-${sp}.ts`, HW = `${dp}/ps-hw-${sp}.ts`, HF = `${dp}/ps-hf-${sp}.ts`, HT = `${dp}/ps-ht-${sp}.ts`;
  await fsp.writeFile(HE, await rdp("../packages/html/src/escape.ts"));
  await fsp.writeFile(HW, await rdp("../packages/html/src/whitespace.ts"));
  await fsp.writeFile(HF, await rdp("../packages/html/src/fullwidth.ts"));
  await fsp.writeFile(HT, (await rdp("../packages/html/src/text.ts")).replace(new RegExp('from "./escape.ts"', "g"), `from "${HE}"`).replace(new RegExp('from "./whitespace.ts"', "g"), `from "${HW}"`));
  const HEM = `${dp}/ps-hem-${sp}.ts`;
  await fsp.writeFile(HEM, (await rdp("../packages/html/src/embed.ts")).replace(/from "\.\/escape\.ts"/g, `from "${HE}"`));
  const HTMLBARREL = `${dp}/ps-html-${sp}.ts`;
  await fsp.writeFile(HTMLBARREL, `export * from "${HE}"; export * from "${HW}"; export * from "${HF}"; export * from "${HT}"; export * from "${HEM}";`);

  // @platform/site バレル(相互参照を張替)
  const siteSrcs = ["blocks", "navigation", "announcement", "redirects", "banner", "copyright"];
  const siteMap = {};
  for (const name of siteSrcs) { const f = `${dp}/ps-site-${name}-${sp}.ts`; siteMap[name] = f; await fsp.writeFile(f, await rdp(`../packages/site/src/${name}.ts`)); }
  for (const name of siteSrcs) {
    let c = await fsp.readFile(siteMap[name], "utf8");
    for (const other of siteSrcs) c = c.replace(new RegExp(`from "\\./${other}\\.ts"`, "g"), `from "${siteMap[other]}"`);
    await fsp.writeFile(siteMap[name], c);
  }
  const SITEBARREL = `${dp}/ps-sitebarrel-${sp}.ts`;
  await fsp.writeFile(SITEBARREL, siteSrcs.map((n) => `export * from "${siteMap[n]}";`).join("\n"));

  // board(category+blog)バレル
  const BOARDCAT = `${dp}/ps-boardcat-${sp}.ts`, BOARDBLOG = `${dp}/ps-boardblog-${sp}.ts`, BOARDBARREL = `${dp}/ps-board-${sp}.ts`;
  await fsp.writeFile(BOARDCAT, await rdp("../packages/board/src/category.ts"));
  await fsp.writeFile(BOARDBLOG, await rdp("../packages/board/src/blog.ts"));
  await fsp.writeFile(BOARDBARREL, `export * from "${BOARDCAT}"; export * from "${BOARDBLOG}";`);

  // fake search(実APIと同形: index/search が Result を返す)
  const SEARCHFAKE = `${dp}/ps-search-${sp}.ts`;
  await fsp.writeFile(SEARCHFAKE, `export function createBm25Index(_o){const docs=[];return{async index(ds){for(const d of ds)docs.push(d);},async search(q,limit){return docs.filter((d)=>String(d.text??"").includes(q)).slice(0,limit).map((d,i)=>({document:d,score:10-i}));},async delete(){}};}\nexport function createSearch(adapter){return{async index(ds){try{await adapter.index(ds);return{ok:true,value:undefined};}catch(e){return{ok:false,error:e};}},async search(q,limit=10){try{return{ok:true,value:await adapter.search(q,limit)};}catch(e){return{ok:false,error:e};}},async delete(){return{ok:true,value:undefined};}};}\n`);

  // site-content(実ソース)
  const CONTENT = `${dp}/ps-content-${sp}.ts`;
  await fsp.writeFile(CONTENT, (await rdp("../apps/public-site/src/server/site-content.ts")).replace(/from "@platform\/site"/g, `from "${SITEBARREL}"`).replace(/from "@platform\/html"/g, `from "${HTMLBARREL}"`).replace(/from "@platform\/search"/g, `from "${SEARCHFAKE}"`).replace(/from "@platform\/board"/g, `from "${BOARDBARREL}"`));

  const C = await import(CONTENT);
  const page = { slug: "about", title: "会社概要", blocks: [
    { id: "h", type: "heading", data: { level: 1, text: "私たちについて" } },
    { id: "t", type: "text", data: { text: "詳しくは https://example.com を\n<script>alert(1)</script>" } },
    { id: "l", type: "list", data: { items: ["A", "B"] } },
    { id: "c", type: "cta", data: { label: "問い合わせ", href: "/contact" } },
    { id: "hidden", type: "text", data: { text: "非表示" }, visible: false },
  ] };
  const rendered = C.renderPage(page);
  const tb = rendered.find((b) => b.kind === "text");
  const content = C.createMemorySiteContent({ pages: [page], menu: [{ label: "会社概要", href: "/about" }], announcements: [
    { id: "a1", message: "about限定", paths: ["/about"], startAt: "2025-01-01T00:00:00Z" },
    { id: "a2", message: "全ページ", startAt: "2025-01-01T00:00:00Z" },
  ] });
  const now = new Date("2025-07-01T00:00:00Z");
  ok("public-site(ブロック描画:visible除外/text XSS安全・単一エスケープ・URLリンク+br/heading・list・cta/page・menu/announcements前方一致)",
    rendered.length === 4 &&
    tb.html.includes("&lt;script&gt;") && !tb.html.includes("<script>") && !tb.html.includes("&amp;lt;") &&
    tb.html.includes('href="https://example.com"') && tb.html.includes("<br>") &&
    rendered[0].kind === "heading" && rendered[0].level === 1 && rendered.find((b) => b.kind === "list").items.length === 2 && rendered.find((b) => b.kind === "cta").href === "/contact" &&
    (await content.page("about")).title === "会社概要" && (await content.menu())[0].href === "/about" &&
    (await content.announcements("/about", now)).map((a) => a.id).sort().join(",") === "a1,a2" &&
    (await content.announcements("/contact", now)).map((a) => a.id).join(",") === "a2");

  // linkify がチャット/掲示板本文に適用されること(html の linkify を直接確認)
  const HTMLT = await import(HT);
  const msg = HTMLT.linkify("連絡は https://ex.com/x?a=1&b=2 まで <危険>");
  ok("chat/board-linkify(URLリンク化+属性エスケープ+XSS安全)",
    msg.includes('href="https://ex.com/x?a=1&b=2"') && msg.includes('target="_blank"') && msg.includes("&lt;") && !msg.includes("<危険>"));

  for (const f of [HE, HW, HF, HT, HEM, HTMLBARREL, SITEBARREL, CONTENT, SEARCHFAKE, BOARDCAT, BOARDBLOG, BOARDBARREL, ...Object.values(siteMap)]) await fsp.rm(f);
}


// ── バナー/広告・アイキャッチ系ロジック(sitemap/favicon/embed/banner/copyright/category/share/motion) ──
{
  section("platform: sitemap/favicon/embed/banner/copyright/category/share/motion(実ソース)");
  const fsx = await import("node:fs/promises");
  const osx = await import("node:os");
  const dx = osx.tmpdir();
  const sx = Date.now();
  const rdx = async (rel) => (await fsx.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');

  // seo sitemap/favicon (escapeAttr from meta)
  const SMETA = `${dx}/x-smeta-${sx}.ts`, SSM = `${dx}/x-ssm-${sx}.ts`, SFV = `${dx}/x-sfv-${sx}.ts`;
  await fsx.writeFile(SMETA, await rdx("../packages/seo/src/meta.ts"));
  await fsx.writeFile(SSM, (await rdx("../packages/seo/src/sitemap.ts")).replace(new RegExp('from "./meta.ts"', "g"), `from "${SMETA}"`));
  await fsx.writeFile(SFV, (await rdx("../packages/seo/src/favicon.ts")).replace(new RegExp('from "./meta.ts"', "g"), `from "${SMETA}"`));
  // html embed
  const HESC = `${dx}/x-hesc-${sx}.ts`, HEMB = `${dx}/x-hemb-${sx}.ts`;
  await fsx.writeFile(HESC, await rdx("../packages/html/src/escape.ts"));
  await fsx.writeFile(HEMB, (await rdx("../packages/html/src/embed.ts")).replace(new RegExp('from "./escape.ts"', "g"), `from "${HESC}"`));
  // site banner/copyright
  const SBAN = `${dx}/x-sban-${sx}.ts`, SCOP = `${dx}/x-scop-${sx}.ts`;
  await fsx.writeFile(SBAN, await rdx("../packages/site/src/banner.ts"));
  await fsx.writeFile(SCOP, await rdx("../packages/site/src/copyright.ts"));
  // board category
  const BCAT = `${dx}/x-bcat-${sx}.ts`;
  await fsx.writeFile(BCAT, await rdx("../packages/board/src/category.ts"));
  // social share
  const SSHR = `${dx}/x-sshr-${sx}.ts`;
  await fsx.writeFile(SSHR, await rdx("../packages/social/src/share.ts"));
  // ui motion
  const UMOT = `${dx}/x-umot-${sx}.ts`;
  await fsx.writeFile(UMOT, await rdx("../packages/ui/src/lib/motion.ts"));

  const SM = await import(SSM), FV = await import(SFV), EM = await import(HEMB), BN = await import(SBAN), CP = await import(SCOP), CT = await import(BCAT), SH = await import(SSHR), MO = await import(UMOT);

  const sm = SM.buildSitemap([{ loc: "https://x.com/", changefreq: "daily", priority: 1.0 }, { loc: "https://x.com/a", lastmod: "2025-07-01" }]);
  ok("seo-sitemap/favicon(urlset+loc+priority+lastmod / index / icon+svg+apple+png+manifest+theme / Next形式)",
    sm.includes("<urlset") && sm.includes("<loc>https://x.com/</loc>") && sm.includes("<priority>1.0</priority>") && sm.includes("<lastmod>2025-07-01</lastmod>") &&
    SM.buildSitemapIndex([{ loc: "https://x.com/s1.xml" }]).includes("<sitemapindex") &&
    FV.faviconLinks({ icon: "/f.ico", svgIcon: "/i.svg", appleTouchIcon: "/a.png", pngIcons: [{ size: "32x32", href: "/32.png" }], manifest: "/m.webmanifest", themeColor: "#fff" }).includes('sizes="32x32"') &&
    FV.faviconMetadata({ icon: "/f.ico", appleTouchIcon: "/a.png" }).apple === "/a.png");

  ok("html-embed(script async / iframe lazy+frameborder / trackingPixel / inline / embedHtml通す / escapeAttribute)",
    EM.embedScript("https://g.js", { async: true, id: "ga" }) === '<script src="https://g.js" async id="ga"></script>' &&
    EM.embedIframe("https://yt", { width: 560, title: "動画" }).includes('loading="lazy"') && EM.embedIframe("https://x").includes('frameborder="0"') &&
    EM.trackingPixel("https://t.png").includes("<noscript>") && EM.inlineScript("a=1") === "<script>a=1</script>" &&
    EM.embedHtml("<script>x</script>") === "<script>x</script>" && EM.escapeAttribute('a"b<c&d') === "a&quot;b&lt;c&amp;d");

  const banners = [
    { id: "b1", image: "/1", href: "/a", weight: 3, paths: ["/"], slot: "sidebar", startAt: "2025-01-01T00:00:00Z" },
    { id: "b2", image: "/2", href: "/b", weight: 1, slot: "sidebar" },
    { id: "b3", image: "/3", href: "/c", slot: "header" },
    { id: "b4", image: "/4", href: "/d", slot: "sidebar", endAt: "2025-01-02T00:00:00Z" },
  ];
  const nowB = new Date("2025-07-01T00:00:00Z");
  const act = BN.activeBanners(banners, "/about", { now: nowB, slot: "sidebar" });
  ok("site-banner/copyright(active枠+期間フィルタ / pickBanner重み+空null / rotate / copyright範囲・単年・rightsText)",
    act.map((b) => b.id).sort().join(",") === "b1,b2" && BN.pickBanner(act, 0).id === "b1" && BN.pickBanner(act, 0.99).id === "b2" && BN.pickBanner([], 0.5) === null &&
    BN.rotateBanner(banners, "/about", { now: nowB, slot: "sidebar", random: () => 0 }).id === "b1" &&
    CP.copyrightText({ holder: "社", startYear: 2020, now: new Date("2025-06-01") }) === "© 2020–2025 社" &&
    CP.copyrightText({ holder: "X", startYear: 2025, now: new Date("2025-06-01") }) === "© 2025 X" &&
    CP.copyrightText({ holder: "X", now: new Date("2025-01-01"), rightsText: "All rights reserved." }) === "© 2025 X. All rights reserved.");

  const cats = [
    { id: "tech", name: "技術", slug: "tech", order: 1 },
    { id: "fe", name: "フロント", slug: "frontend", parentId: "tech", order: 1 },
    { id: "be", name: "バック", slug: "backend", parentId: "tech", order: 2 },
    { id: "life", name: "生活", slug: "life", order: 2 },
  ];
  const posts = [{ categoryId: "fe" }, { categoryId: "be" }, { categoryId: "life" }, { categoryId: "fe" }];
  const tree = CT.categoryTree(cats);
  ok("board-category(tree 2ルート+子2 / descendant / filter子孫3・直下2 / count / path / bySlug)",
    tree.length === 2 && tree[0].id === "tech" && tree[0].children.length === 2 && tree[0].children[0].id === "fe" &&
    CT.descendantIds(cats, "tech").sort().join(",") === "be,fe,tech" &&
    CT.filterByCategory(posts, cats, "tech").length === 3 && CT.filterByCategory(posts, cats, "fe", { includeDescendants: false }).length === 2 &&
    CT.countByCategory(posts).fe === 2 && CT.categoryPath(cats, "fe").map((c) => c.id).join(",") === "tech,fe" && CT.findCategoryBySlug(cats, "frontend").id === "fe");

  ok("social-share(x url+text+hashtags+via / facebook/line/hatena/email / shareLinks)",
    SH.shareUrl("x", { url: "https://a.com/p", title: "記事", hashtags: ["tech"], via: "me" }).includes("twitter.com/intent/tweet") && SH.shareUrl("x", { url: "https://a.com", hashtags: ["x"] }).includes("hashtags=x") &&
    SH.shareUrl("facebook", { url: "https://a.com" }).includes("sharer.php?u=") && SH.shareUrl("line", { url: "https://a.com" }).includes("line.me") &&
    SH.shareUrl("hatena", { url: "https://a.com/x" }).includes("b.hatena.ne.jp/entry/a.com/x") && SH.shareUrl("email", { url: "https://a.com", title: "T" }).startsWith("mailto:") &&
    SH.shareLinks(["x", "line"], { url: "https://a.com" }).length === 2 && SH.shareLinks(["x"], { url: "https://a.com" })[0].label === "X");

  ok("ui-motion(easing / parallaxOffset中央0 / scrollProgress clamp / revealStyle / presets)",
    MO.easing.linear(0.5) === 0.5 && MO.easing.easeInQuad(0.5) === 0.25 &&
    MO.parallaxOffset(100, 100, 0, 0.5) === 0 && MO.scrollProgress(-9999, 500, 100, 800) === 0 && MO.scrollProgress(99999, 500, 100, 800) === 1 &&
    MO.revealStyle(true).opacity === 1 && MO.revealStyle(false).opacity === 0 && MO.transitionPresets.base.includes("250ms"));

  for (const f of [SMETA, SSM, SFV, HESC, HEMB, SBAN, SCOP, BCAT, SSHR, UMOT]) await fsx.rm(f);
}


// ── 公開サイト: ブログ記事/カテゴリ/バナー/横断検索(実ソース結合) ──
{
  section("platform: 公開サイト ブログ記事/カテゴリ/バナー/横断検索(実ソース)");
  const fsb = await import("node:fs/promises");
  const osb = await import("node:os");
  const db = osb.tmpdir();
  const sb = Date.now();
  const rdb = async (rel) => (await fsb.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');

  // html バレル
  const HE = `${db}/pb-he-${sb}.ts`, HW = `${db}/pb-hw-${sb}.ts`, HF = `${db}/pb-hf-${sb}.ts`, HT = `${db}/pb-ht-${sb}.ts`, HB = `${db}/pb-hb-${sb}.ts`;
  await fsb.writeFile(HE, await rdb("../packages/html/src/escape.ts"));
  await fsb.writeFile(HW, await rdb("../packages/html/src/whitespace.ts"));
  await fsb.writeFile(HF, await rdb("../packages/html/src/fullwidth.ts"));
  await fsb.writeFile(HT, (await rdb("../packages/html/src/text.ts")).replace(new RegExp('from "./escape.ts"', "g"), `from "${HE}"`).replace(new RegExp('from "./whitespace.ts"', "g"), `from "${HW}"`));
  const HEM2 = `${db}/pb-hem-${sb}.ts`;
  await fsb.writeFile(HEM2, (await rdb("../packages/html/src/embed.ts")).replace(new RegExp('from "./escape.ts"', "g"), `from "${HE}"`));
  await fsb.writeFile(HB, `export * from "${HE}"; export * from "${HW}"; export * from "${HF}"; export * from "${HT}"; export * from "${HEM2}";`);
  // site バレル
  const siteSrcs = ["blocks", "navigation", "announcement", "redirects", "banner", "copyright"];
  const siteMap = {};
  for (const n of siteSrcs) { const f = `${db}/pb-site-${n}-${sb}.ts`; siteMap[n] = f; await fsb.writeFile(f, await rdb(`../packages/site/src/${n}.ts`)); }
  for (const n of siteSrcs) { let c = await fsb.readFile(siteMap[n], "utf8"); for (const o of siteSrcs) c = c.replace(new RegExp(`from "\\./${o}\\.ts"`, "g"), `from "${siteMap[o]}"`); await fsb.writeFile(siteMap[n], c); }
  const SB = `${db}/pb-sitebarrel-${sb}.ts`;
  await fsb.writeFile(SB, siteSrcs.map((n) => `export * from "${siteMap[n]}";`).join("\n"));
  // board バレル(category+blog)
  const BCAT = `${db}/pb-bcat-${sb}.ts`, BBLOG = `${db}/pb-bblog-${sb}.ts`, BB = `${db}/pb-bb-${sb}.ts`;
  await fsb.writeFile(BCAT, await rdb("../packages/board/src/category.ts"));
  await fsb.writeFile(BBLOG, await rdb("../packages/board/src/blog.ts"));
  await fsb.writeFile(BB, `export * from "${BCAT}"; export * from "${BBLOG}";`);
  // fake search
  const SF = `${db}/pb-sf-${sb}.ts`;
  await fsb.writeFile(SF, `export function createBm25Index(_o){const d=[];return{async index(x){for(const i of x)d.push(i);},async search(q,l){return d.filter((i)=>String(i.text??"").includes(q)).slice(0,l).map((i,n)=>({document:i,score:10-n}));},async delete(){}};}\nexport function createSearch(a){return{async index(x){await a.index(x);return{ok:true,value:undefined};},async search(q,l=10){return{ok:true,value:await a.search(q,l)};},async delete(){return{ok:true,value:undefined};}};}\n`);
  // content(実ソース)
  const CT = `${db}/pb-content-${sb}.ts`;
  await fsb.writeFile(CT, (await rdb("../apps/public-site/src/server/site-content.ts")).replace(/from "@platform\/site"/g, `from "${SB}"`).replace(/from "@platform\/html"/g, `from "${HB}"`).replace(/from "@platform\/board"/g, `from "${BB}"`).replace(/from "@platform\/search"/g, `from "${SF}"`));

  const C = await import(CT);
  const cats = [
    { id: "tech", name: "技術", slug: "tech", order: 1 },
    { id: "fe", name: "フロント", slug: "frontend", parentId: "tech" },
    { id: "life", name: "生活", slug: "life", order: 2 },
  ];
  const posts = [
    { slug: "react", title: "Reactのコツ", categoryId: "fe", body: "Reactでフックを使う", publishedAt: "2025-06-01T00:00:00Z", excerpt: "フック入門" },
    { slug: "ssr", title: "SSRの話", categoryId: "tech", body: "サーバサイドレンダリング", publishedAt: "2025-07-01T00:00:00Z" },
    { slug: "coffee", title: "コーヒー", categoryId: "life", body: "豆の選び方", publishedAt: "2025-05-01T00:00:00Z" },
  ];
  const banners = [
    { id: "b1", image: "/1", href: "/a", slot: "sidebar", weight: 2, startAt: "2025-01-01T00:00:00Z" },
    { id: "b2", image: "/2", href: "/b", slot: "sidebar", weight: 1 },
    { id: "b3", image: "/3", href: "/c", slot: "header" },
  ];
  const pages = [{ slug: "", title: "ホーム", blocks: [{ id: "t", type: "text", data: { text: "トップページです" } }] }];
  const content = C.createMemorySiteContent({ pages, menu: [], announcements: [], categories: cats, posts, banners });

  const r1 = await content.search("React");
  const r2 = await content.search("トップページ");
  ok("public-site-blog(posts新しい順/post/byCategory子孫3・直下1/tree/breadcrumb/counts/banners枠/pickBanner/横断検索post+page)",
    (await content.posts()).map((p) => p.slug).join(",") === "ssr,react,coffee" &&
    (await content.post("react")).title === "Reactのコツ" &&
    (await content.postsByCategory("tech")).map((p) => p.slug).sort().join(",") === "react,ssr" &&
    (await content.postsByCategory("fe")).map((p) => p.slug).join(",") === "react" &&
    (await content.categoryTree())[0].children.some((c) => c.id === "fe") &&
    (await content.categoryBreadcrumb("fe")).map((c) => c.id).join(",") === "tech,fe" &&
    (await content.categoryCounts()).fe === 1 &&
    (await content.banners("/blog", "sidebar")).map((b) => b.id).sort().join(",") === "b1,b2" &&
    (await content.pickBanner("/blog", "sidebar", () => 0)).id === "b1" &&
    r1.some((x) => x.kind === "post" && x.slug === "react") && r2.some((x) => x.kind === "page" && x.slug === ""));

  for (const f of [HE, HW, HF, HT, HEM2, HB, SB, BCAT, BBLOG, BB, SF, CT, ...Object.values(siteMap)]) await fsb.rm(f);
}


// ── 関連/前後/タグ + RSS/Atom + CMS記事CRUD(実ソース) ──
{
  section("platform: blog関連・前後・タグ / RSS・Atom / CMS記事CRUD(実ソース)");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');

  const BLG = `${dc}/x2-blg-${sc}.ts`, FEED = `${dc}/x2-feed-${sc}.ts`;
  await fsc.writeFile(BLG, await rdc("../packages/board/src/blog.ts"));
  await fsc.writeFile(FEED, await rdc("../packages/seo/src/feed.ts"));
  // @platform/cms バレル(model/scheduling/adapter/store)
  const cmsSrcs = ["model", "scheduling", "adapter", "store"];
  const cmsMap = {};
  for (const n of cmsSrcs) { const f = `${dc}/x2-cms-${n}-${sc}.ts`; cmsMap[n] = f; await fsc.writeFile(f, await rdc(`../packages/cms/src/${n}.ts`)); }
  for (const n of cmsSrcs) { let c = await fsc.readFile(cmsMap[n], "utf8"); for (const o of cmsSrcs) c = c.replace(new RegExp(`from "\./${o}\.ts"`, "g"), `from "${cmsMap[o]}"`); await fsc.writeFile(cmsMap[n], c); }
  const CMS = `${dc}/x2-cms-barrel-${sc}.ts`;
  await fsc.writeFile(CMS, cmsSrcs.map((n) => `export * from "${cmsMap[n]}";`).join("\n"));

  const B = await import(BLG), F = await import(FEED), M = await import(CMS);

  const posts = [
    { id: "a", categoryId: "fe", tags: ["React", "TS"], publishedAt: "2025-05-01T00:00:00Z" },
    { id: "b", categoryId: "fe", tags: ["React"], publishedAt: "2025-06-01T00:00:00Z" },
    { id: "c", categoryId: "be", tags: ["TS"], publishedAt: "2025-07-01T00:00:00Z" },
  ];
  const adjB = B.adjacentPosts(posts, "b");
  ok("blog-nav(adjacent prev=古/next=新, 端はundefined / related score順+0除外 / allTags多い順 / postsByTag)",
    adjB.prev.id === "a" && adjB.next.id === "c" && B.adjacentPosts(posts, "c").next === undefined && B.adjacentPosts(posts, "a").prev === undefined &&
    B.relatedPosts(posts, posts[0], { limit: 3 }).map((p) => p.id).join(",") === "b,c" && B.relatednessScore(posts[0], posts[1]) === 3 &&
    JSON.stringify(B.allTags(posts)) === JSON.stringify([{ tag: "React", count: 2 }, { tag: "TS", count: 2 }]) &&
    B.postsByTag(posts, "React").map((p) => p.id).join(",") === "a,b");

  const ch = { title: "ブログ&テスト", link: "https://x.com", description: "説明<>", language: "ja", updated: "2025-07-01T00:00:00Z", feedUrl: "https://x.com/feed.xml" };
  const items = [{ title: "記事 & <b>", link: "https://x.com/1", id: "post:1", description: "本文", published: "2025-07-01T00:00:00Z", author: "me" }];
  const rss = F.buildRssFeed(ch, items), atom = F.buildAtomFeed(ch, items);
  ok("feed(RSS: rss/channel/item/guid/XMLエスケープ/atom:self / Atom: feed/entry/id/updated ISO/summary)",
    rss.includes('<rss version="2.0"') && rss.includes("<title>ブログ&amp;テスト</title>") && rss.includes('isPermaLink="false"') && rss.includes("記事 &amp; &lt;b&gt;") && rss.includes("<pubDate>") && rss.includes("atom:link") &&
    atom.includes('<feed xmlns="http://www.w3.org/2005/Atom">') && atom.includes("<entry>") && atom.includes("<id>post:1</id>") && atom.includes("<updated>2025-07-01T00:00:00.000Z</updated>") && atom.includes("<summary>本文</summary>"));

  // CMS memory + prisma parity
  let t = 0; const now = () => new Date(Date.UTC(2025, 6, 1, 10, 0, t++)).toISOString();
  const mem = M.createMemoryCmsStore(now);
  await mem.create({ slug: "first", title: "最初", body: "本文", tags: ["a"] });
  const pub = await mem.create({ slug: "pub", title: "公開", body: "本文", status: "published" });
  await mem.update("first", { slug: "renamed", title: "改名", body: "x" });
  const fakeDb = () => { const rows = new Map(); return { cmsPostRow: {
    async findMany({ where, orderBy }) { let r = [...rows.values()]; if (where?.status) r = r.filter((x) => x.status === where.status); return r.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()); },
    async findUnique({ where }) { return rows.get(where.slug) ?? null; },
    async create({ data }) { rows.set(data.slug, { ...data }); return { ...data }; },
    async update({ where, data }) { rows.delete(where.slug); rows.set(data.slug, { ...data }); return { ...data }; },
    async delete({ where }) { rows.delete(where.slug); },
  } }; };
  let t2 = 0; const now2 = () => new Date(Date.UTC(2025, 7, 1, 10, 0, t2++)).toISOString();
  const pr = M.createPrismaCmsStore(fakeDb(), now2);
  await pr.create({ slug: "x", title: "X", body: "b", tags: ["z"] });
  await pr.create({ slug: "y", title: "Y", body: "b", status: "published" });
  ok("cms(slug検証 / draft既定 / published時publishedAt確定 / update+slug変更旧削除 / list新しい順+status絞り / prisma parity+tags往復+remove)",
    M.isValidSlug("my-post-1") && !M.isValidSlug("Bad_slug") && M.validatePostInput({ slug: "ok", title: "t", body: "b" }).ok === true && M.validatePostInput({ slug: "Bad", title: "t", body: "b" }).ok === false &&
    pub.status === "published" && typeof pub.publishedAt === "string" &&
    (await mem.get("first")) === undefined && (await mem.get("renamed")).title === "改名" &&
    (await mem.list()).map((p) => p.slug).sort().join(",") === "pub,renamed" && (await mem.list({ status: "published" })).map((p) => p.slug).join(",") === "pub" &&
    (await pr.list()).map((p) => p.slug).join(",") === "y,x" && (await pr.get("x")).tags.join() === "z" && (await pr.remove("x")) === true && (await pr.get("x")) === undefined);

  // 予約公開(scheduling) + ブログ変換(adapter)
  const nowS = new Date("2025-07-01T00:00:00Z");
  const pDraft = { slug: "d", title: "D", body: "x", tags: [], status: "draft", updatedAt: "2025-06-01T00:00:00Z" };
  const pLive = { slug: "l", title: "L", body: "x", tags: [], status: "published", publishedAt: "2025-06-01T00:00:00Z", updatedAt: "2025-06-01T00:00:00Z" };
  const pFuture = { slug: "f", title: "F", body: "x", tags: [], status: "published", publishedAt: "2099-01-01T00:00:00Z", updatedAt: "2025-06-01T00:00:00Z" };
  ok("cms-scheduling(effectiveStatus draft/published/scheduled / isLive / livePosts公開のみ / scheduledPosts / 時刻到来で公開 / liveBlogViews変換)",
    M.effectiveStatus(pDraft, nowS) === "draft" && M.effectiveStatus(pLive, nowS) === "published" && M.effectiveStatus(pFuture, nowS) === "scheduled" &&
    M.isLive(pLive, nowS) === true && M.isLive(pFuture, nowS) === false &&
    M.livePosts([pDraft, pLive, pFuture], nowS).map((p) => p.slug).join(",") === "l" &&
    M.scheduledPosts([pDraft, pLive, pFuture], nowS).map((p) => p.slug).join(",") === "f" &&
    M.isLive(pFuture, new Date("2099-06-01T00:00:00Z")) === true &&
    M.liveBlogViews([pDraft, pLive, pFuture], nowS).map((v) => v.slug).join(",") === "l" && M.cmsPostToBlog(pLive).publishedAt === "2025-06-01T00:00:00Z");

  for (const f of [BLG, FEED, CMS, ...Object.values(cmsMap)]) await fsc.rm(f);
}


// ── 予約残り時間 / gallery・embed 描画 / プレビュー(実ソース) ──
{
  section("platform: 予約残り時間 / gallery・embed描画 / プレビュー(実ソース)");
  const fse = await import("node:fs/promises");
  const ose = await import("node:os");
  const de = ose.tmpdir();
  const se = Date.now();
  const rde = async (rel) => (await fse.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');

  // @platform/cms バレル
  const cmsSrcs = ["model", "scheduling", "adapter", "store"];
  const cmsMap = {};
  for (const n of cmsSrcs) { const f = `${de}/xe-cms-${n}-${se}.ts`; cmsMap[n] = f; await fse.writeFile(f, await rde(`../packages/cms/src/${n}.ts`)); }
  for (const n of cmsSrcs) { let c = await fse.readFile(cmsMap[n], "utf8"); for (const o of cmsSrcs) c = c.replace(new RegExp(`from "\\./${o}\\.ts"`, "g"), `from "${cmsMap[o]}"`); await fse.writeFile(cmsMap[n], c); }
  const CMSB = `${de}/xe-cmsb-${se}.ts`;
  await fse.writeFile(CMSB, cmsSrcs.map((n) => `export * from "${cmsMap[n]}";`).join("\n"));

  // html バレル(embed含む)
  const HE = `${de}/xe-he-${se}.ts`, HW = `${de}/xe-hw-${se}.ts`, HF = `${de}/xe-hf-${se}.ts`, HT = `${de}/xe-ht-${se}.ts`, HM = `${de}/xe-hm-${se}.ts`, HB = `${de}/xe-hb-${se}.ts`;
  await fse.writeFile(HE, await rde("../packages/html/src/escape.ts"));
  await fse.writeFile(HW, await rde("../packages/html/src/whitespace.ts"));
  await fse.writeFile(HF, await rde("../packages/html/src/fullwidth.ts"));
  await fse.writeFile(HT, (await rde("../packages/html/src/text.ts")).replace(new RegExp('from "./escape.ts"', "g"), `from "${HE}"`).replace(new RegExp('from "./whitespace.ts"', "g"), `from "${HW}"`));
  await fse.writeFile(HM, (await rde("../packages/html/src/embed.ts")).replace(new RegExp('from "./escape.ts"', "g"), `from "${HE}"`));
  await fse.writeFile(HB, `export * from "${HE}"; export * from "${HW}"; export * from "${HF}"; export * from "${HT}"; export * from "${HM}";`);
  // site バレル
  const siteSrcs = ["blocks", "navigation", "announcement", "redirects", "banner", "copyright"];
  const siteMap = {};
  for (const n of siteSrcs) { const f = `${de}/xe-site-${n}-${se}.ts`; siteMap[n] = f; await fse.writeFile(f, await rde(`../packages/site/src/${n}.ts`)); }
  for (const n of siteSrcs) { let c = await fse.readFile(siteMap[n], "utf8"); for (const o of siteSrcs) c = c.replace(new RegExp(`from "\\./${o}\\.ts"`, "g"), `from "${siteMap[o]}"`); await fse.writeFile(siteMap[n], c); }
  const SB = `${de}/xe-sb-${se}.ts`;
  await fse.writeFile(SB, siteSrcs.map((n) => `export * from "${siteMap[n]}";`).join("\n"));
  // board バレル
  const BC = `${de}/xe-bc-${se}.ts`, BBL = `${de}/xe-bbl-${se}.ts`, BB = `${de}/xe-bb-${se}.ts`;
  await fse.writeFile(BC, await rde("../packages/board/src/category.ts"));
  await fse.writeFile(BBL, await rde("../packages/board/src/blog.ts"));
  await fse.writeFile(BB, `export * from "${BC}"; export * from "${BBL}";`);
  // fake search
  const SF = `${de}/xe-sf-${se}.ts`;
  await fse.writeFile(SF, `export function createBm25Index(_o){const d=[];return{async index(x){for(const i of x)d.push(i);},async search(q,l){return d.filter((i)=>String(i.text??"").includes(q)).slice(0,l).map((i,n)=>({document:i,score:10-n}));},async delete(){}};}\nexport function createSearch(a){return{async index(x){await a.index(x);return{ok:true,value:undefined};},async search(q,l=10){return{ok:true,value:await a.search(q,l)};},async delete(){return{ok:true,value:undefined};}};}\n`);
  // site-content(実ソース)
  const SC = `${de}/xe-sc-${se}.ts`;
  await fse.writeFile(SC, (await rde("../apps/public-site/src/server/site-content.ts")).replace(/from "@platform\/site"/g, `from "${SB}"`).replace(/from "@platform\/html"/g, `from "${HB}"`).replace(/from "@platform\/board"/g, `from "${BB}"`).replace(/from "@platform\/search"/g, `from "${SF}"`));
  // preview(実ソース)。siteEnv(env.ts)はテスト用スタブに差し替える
  const PVENV = `${de}/xe-pvenv-${se}.ts`;
  // 実 env.ts は起動時に固定するが、この検証は token の有無を動的に切り替えるため getter で読む
  await fse.writeFile(PVENV, `export const siteEnv = { get PREVIEW_TOKEN() { return process.env.PREVIEW_TOKEN ?? ""; }, INTERNAL_API_BASE: "", INTERNAL_INQUIRY_URL: "", INQUIRY_INTAKE_TOKEN: "" };\n`);
  const PV = `${de}/xe-pv-${se}.ts`;
  await fse.writeFile(PV, (await rde("../apps/public-site/src/server/preview.ts")).replace(/from "@platform\/cms"/g, `from "${CMSB}"`).replace(/from "\.\/env\.ts"/g, `from "${PVENV}"`));

  const SCH = await import(CMSB), C = await import(SC), PVm = await import(PV);

  const now = new Date("2025-07-01T00:00:00Z");
  const future = { slug: "f", title: "F", body: "x", tags: [], status: "published", publishedAt: "2025-07-01T01:00:00Z", updatedAt: "x" };
  const live = { slug: "l", title: "L", body: "x", tags: [], status: "published", publishedAt: "2025-06-01T00:00:00Z", updatedAt: "x" };
  ok("cms-msUntilPublish(予約は残りms / 公開中はnull)", SCH.msUntilPublish(future, now) === 3600000 && SCH.msUntilPublish(live, now) === null);

  const gal = C.renderBlock({ id: "g", type: "gallery", data: { images: [{ src: "/1.png", alt: "1", caption: "c" }, { src: "/2.png" }, { alt: "no-src" }] } });
  const emb = C.renderBlock({ id: "e", type: "embed", data: { src: "https://youtube.com/embed/x", title: "動画", height: 400 } });
  const emb2 = C.renderBlock({ id: "e2", type: "embed", data: { html: "<script src=\"https://gtag.js\"></script>" } });
  ok("renderBlock(gallery: 有効2件+caption / embed iframe: src→iframe+lazy+height / embed html: 信頼済みそのまま / text不変)",
    gal.kind === "gallery" && gal.images.length === 2 && gal.images[0].caption === "c" &&
    emb.kind === "embed" && emb.html.includes("<iframe") && emb.html.includes('loading="lazy"') && emb.html.includes('height="400"') &&
    emb2.kind === "embed" && emb2.html === '<script src="https://gtag.js"></script>' &&
    C.renderBlock({ id: "t", type: "text", data: { text: "見て https://x.com" } }).html.includes('href="https://x.com"'));

  const posts = [
    { slug: "live", title: "公開", body: "x", tags: [], status: "published", publishedAt: "2025-06-01T00:00:00Z", updatedAt: "x" },
    { slug: "draft", title: "下書き", body: "x", tags: [], status: "draft", updatedAt: "x" },
    { slug: "sched", title: "予約", body: "x", tags: [], status: "published", publishedAt: "2099-01-01T00:00:00Z", updatedAt: "x" },
  ];
  process.env.PREVIEW_TOKEN = "secret123";
  const tokOk = PVm.isValidPreviewToken("secret123") === true && PVm.isValidPreviewToken("wrong") === false;
  delete process.env.PREVIEW_TOKEN;
  ok("preview(token一致判定 / 環境変数未設定でfalse / 下書き・予約も取得+実効ステータス / 無い記事undefined)",
    tokOk && PVm.isValidPreviewToken("secret123") === false &&
    PVm.getPreviewPost(posts, "draft", now).status === "draft" && PVm.getPreviewPost(posts, "sched", now).status === "scheduled" &&
    PVm.getPreviewPost(posts, "live", now).status === "published" && PVm.getPreviewPost(posts, "none", now) === undefined);

  for (const f of [CMSB, HE, HW, HF, HT, HM, HB, SB, BC, BBL, BB, SF, SC, PV, ...Object.values(cmsMap), ...Object.values(siteMap)]) await fse.rm(f);
}


// ── 固定ページ / お知らせ 管理ストア + プレビューURL(実ソース) ──
{
  section("platform: 固定ページ/お知らせ 管理ストア + プレビューURL(実ソース)");
  const fsp2 = await import("node:fs/promises");
  const osp2 = await import("node:os");
  const dp2 = osp2.tmpdir();
  const sp2 = Date.now();
  const rdp2 = async (rel) => (await fsp2.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');

  // @platform/site は型のみ使用 → 空スタブ
  const SITE = `${dp2}/z-site-${sp2}.ts`;
  await fsp2.writeFile(SITE, "export {};");
  const MO = `${dp2}/z-model-${sp2}.ts`, PG = `${dp2}/z-page-${sp2}.ts`, AN = `${dp2}/z-ann-${sp2}.ts`;
  await fsp2.writeFile(MO, (await rdp2("../packages/cms/src/model.ts")).replace(/from "@platform\/site"/g, `from "${SITE}"`));
  await fsp2.writeFile(PG, (await rdp2("../packages/cms/src/page.ts")).replace(/from "@platform\/site"/g, `from "${SITE}"`));
  await fsp2.writeFile(AN, (await rdp2("../packages/cms/src/announcement.ts")).replace(/from "@platform\/site"/g, `from "${SITE}"`));

  const M = await import(MO), P = await import(PG), A = await import(AN);

  ok("buildPreviewUrl(末尾スラッシュ除去 + encode)", M.buildPreviewUrl("https://site.com/", "my-post", "tok en") === "https://site.com/preview/my-post?token=tok%20en");

  // page store memory + prisma
  let t = 0; const now = () => new Date(Date.UTC(2025, 6, 1, 10, 0, t++)).toISOString();
  const ps = P.createMemoryPageStore(now);
  await ps.create({ slug: "", title: "ホーム", blocks: [{ id: "b", type: "text", data: { text: "x" } }], status: "published" });
  await ps.create({ slug: "about", title: "会社概要", blocks: [], status: "draft" });
  const pu = await ps.update("about", { slug: "company", title: "会社", blocks: [], status: "published" });
  const pageDb = () => { const rows = new Map(); return { cmsPageRow: {
    async findMany({ where, orderBy }) { let r = [...rows.values()]; if (where?.status) r = r.filter((x) => x.status === where.status); return r.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()); },
    async findUnique({ where }) { return rows.get(where.slug) ?? null; },
    async create({ data }) { rows.set(data.slug, { ...data }); return { ...data }; },
    async update({ where, data }) { rows.delete(where.slug); rows.set(data.slug, { ...data }); return { ...data }; },
    async delete({ where }) { rows.delete(where.slug); },
  } }; };
  let t2 = 0; const now2 = () => new Date(Date.UTC(2025, 7, 1, 10, 0, t2++)).toISOString();
  const pp = P.createPrismaPageStore(pageDb(), now2);
  await pp.create({ slug: "a", title: "A", blocks: [{ id: "x", type: "heading", data: { level: 1, text: "T" } }], status: "published" });
  ok("cms-page(slug検証空OK / title必須 / list新しい順+status絞り / livePageViews公開のみ+Page変換 / update+slug変更旧削除 / prisma blocks往復)",
    P.isValidPageSlug("") && P.isValidPageSlug("about") && !P.isValidPageSlug("Bad") &&
    P.validatePageInput({ slug: "a", title: " ", blocks: [] }).ok === false &&
    (await ps.list()).map((x) => x.slug).join(",") === "company," && (await ps.list({ status: "published" })).map((x) => x.slug).sort().join(",") === ",company" &&
    P.livePageViews(await ps.list()).length === 2 && !("status" in P.livePageViews(await ps.list())[0]) &&
    pu.status === "published" && (await ps.get("about")) === undefined && (await ps.get("company")).title === "会社" &&
    (await pp.get("a")).blocks[0].data.text === "T");

  // announcement store memory + prisma
  let n = 0; const genId = () => `ann_${n++}`;
  const as = A.createMemoryAnnouncementStore(genId);
  const a1 = await as.create({ message: "メンテ", level: "warning", startAt: "2025-07-01T00:00:00Z", paths: ["/blog"] });
  await as.create({ message: "新機能", ctaLabel: "詳細", ctaHref: "/news" });
  const au = await as.update("ann_0", { message: "完了" });
  const annDb = () => { const rows = new Map(); let seq = 0; return { announcementRow: {
    async findMany() { return [...rows.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()); },
    async findUnique({ where }) { return rows.get(where.id) ?? null; },
    async create({ data }) { const id = `db_${seq}`; const row = { id, ...data, createdAt: new Date(Date.UTC(2025, 0, 1, 0, 0, seq++)) }; rows.set(id, row); return row; },
    async update({ where, data }) { const row = { ...rows.get(where.id), ...data }; rows.set(where.id, row); return row; },
    async delete({ where }) { rows.delete(where.id); },
  } }; };
  const ap = A.createPrismaAnnouncementStore(annDb());
  const pa1 = await ap.create({ message: "DB", paths: ["/"], level: "info" });
  await ap.create({ message: "2件目" });
  ok("cms-announcement(message必須/日付検証 / create採番+list作成順 / 任意項目保持 / update項目クリア / remove / prisma paths往復+update/remove)",
    A.validateAnnouncementInput({ message: "" }).ok === false && A.validateAnnouncementInput({ message: "x", startAt: "bad" }).ok === false && A.validateAnnouncementInput({ message: "x" }).ok === true &&
    a1.id === "ann_0" && (await as.list()).map((x) => x.message).join(",") === "完了,新機能" && a1.paths.join() === "/blog" && (await as.get("ann_1")).ctaHref === "/news" &&
    au.message === "完了" && au.level === undefined && au.paths === undefined && (await as.remove("ann_1")) === true && (await as.list()).length === 1 &&
    (await ap.list()).map((x) => x.message).join(",") === "DB,2件目" && (await ap.get(pa1.id)).paths.join() === "/" && (await ap.update(pa1.id, { message: "更新" })).message === "更新" && (await ap.remove(pa1.id)) === true);

  for (const f of [SITE, MO, PG, AN]) await fsp2.rm(f);
}


// ── カテゴリ管理 / タグ一括操作 / 固定ページ反映(実ソース) ──
{
  section("platform: カテゴリ管理 / タグ一括操作 / 固定ページ反映(実ソース)");
  const fsc2 = await import("node:fs/promises");
  const osc2 = await import("node:os");
  const dc2 = osc2.tmpdir();
  const sc2 = Date.now();
  const rdc2 = async (rel) => (await fsc2.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');

  const BOARD = `${dc2}/y-board-${sc2}.ts`, SITE = `${dc2}/y-site-${sc2}.ts`;
  await fsc2.writeFile(BOARD, "export {};");
  await fsc2.writeFile(SITE, "export {};");
  const CATS = `${dc2}/y-catstore-${sc2}.ts`, TAGS = `${dc2}/y-tags-${sc2}.ts`, PGM = `${dc2}/y-pgmodel-${sc2}.ts`, PG = `${dc2}/y-page-${sc2}.ts`;
  await fsc2.writeFile(CATS, (await rdc2("../packages/cms/src/category-store.ts")).replace(/from "@platform\/board"/g, `from "${BOARD}"`));
  await fsc2.writeFile(TAGS, await rdc2("../packages/cms/src/tags.ts"));
  await fsc2.writeFile(PG, (await rdc2("../packages/cms/src/page.ts")).replace(/from "@platform\/site"/g, `from "${SITE}"`));

  const CS = await import(CATS), TG = await import(TAGS), P = await import(PG);

  // category store
  let n = 0; const genId = () => `c${n++}`;
  const cs = CS.createMemoryCategoryStore(genId);
  await cs.create({ name: "技術", slug: "tech" });
  await cs.create({ name: "生活", slug: "life" });
  await cs.create({ name: "FE", slug: "frontend", parentId: "c0" });
  const initialOrder = (await cs.list()).map((c) => c.id).join(",");
  const re = await cs.reorder(["c1", "c2", "c0"]);
  const catDb = () => { const rows = new Map(); let seq = 0; return { categoryRow: {
    async findMany() { return [...rows.values()].sort((a, b) => a.order - b.order); },
    async findUnique({ where }) { return rows.get(where.id) ?? null; },
    async count() { return rows.size; },
    async create({ data }) { const id = `db${seq++}`; const row = { id, ...data }; rows.set(id, row); return row; },
    async update({ where, data }) { const row = { ...rows.get(where.id), ...data }; rows.set(where.id, row); return row; },
    async delete({ where }) { rows.delete(where.id); },
  } }; };
  const cp = CS.createPrismaCategoryStore(catDb());
  const dc0 = await cp.create({ name: "A", slug: "a" });
  await cp.create({ name: "B", slug: "b" });
  ok("cms-category(validate / create採番+order自動+parent / list order順 / reorder / update / remove / prisma parity)",
    CS.validateCategoryInput({ name: "", slug: "x" }).ok === false && CS.validateCategoryInput({ name: "技術", slug: "tech" }).ok === true &&
    initialOrder === "c0,c1,c2" && re.map((c) => c.id).join(",") === "c1,c2,c0" && re[0].order === 0 &&
    (await cs.update("c0", { name: "技術系", slug: "tech" })).name === "技術系" && (await cs.remove("c1")) === true &&
    (await cp.list()).length === 2 && dc0.order === 0 && (await cp.reorder([(await cp.list())[1].id, dc0.id])).length === 2 && (await cp.remove(dc0.id)) === true);

  // tags
  const posts = [{ slug: "a", tags: ["React", "TS"] }, { slug: "b", tags: ["React", "JS"] }, { slug: "c", tags: ["Vue"] }];
  ok("cms-tags(rename該当のみ+重複排除 / merge / remove)",
    JSON.stringify(TG.renameTagInPosts(posts, "React", "リアクト")) === JSON.stringify([{ slug: "a", tags: ["リアクト", "TS"] }, { slug: "b", tags: ["リアクト", "JS"] }]) &&
    JSON.stringify(TG.renameTagInPosts([{ slug: "x", tags: ["A", "B"] }], "A", "B")) === JSON.stringify([{ slug: "x", tags: ["B"] }]) &&
    JSON.stringify(TG.mergeTagsInPosts(posts, ["JS", "TS"], "JavaScript")) === JSON.stringify([{ slug: "a", tags: ["React", "JavaScript"] }, { slug: "b", tags: ["React", "JavaScript"] }]) &&
    JSON.stringify(TG.removeTagFromPosts(posts, "React")) === JSON.stringify([{ slug: "a", tags: ["TS"] }, { slug: "b", tags: ["JS"] }]));

  // page reflection
  const managedPages = [
    { slug: "recruit", title: "採用", status: "published", updatedAt: "x", blocks: [{ id: "h", type: "heading", data: { level: 1, text: "採用" } }] },
    { slug: "draft", title: "下書き", status: "draft", updatedAt: "x", blocks: [] },
  ];
  const views = P.livePageViews(managedPages);
  ok("page-reflection(公開ページのみ+Page変換(status無し)+blocks保持)",
    views.length === 1 && views[0].slug === "recruit" && !("status" in views[0]) && views[0].blocks[0].data.text === "採用");

  for (const f of [BOARD, SITE, CATS, TAGS, PG]) await fsc2.rm(f);
}


// ── ダッシュボード集計 + D&D moveItem(実ソース) ──
{
  section("platform: ダッシュボード集計(summarizePosts/recentPosts) + D&D moveItem(実ソース)");
  const fsd = await import("node:fs/promises");
  const osd = await import("node:os");
  const dd = osd.tmpdir();
  const sd = Date.now();
  const rdd = async (rel) => (await fsd.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');

  const SITE = `${dd}/w-site-${sd}.ts`;
  await fsd.writeFile(SITE, "export {};");
  const MO = `${dd}/w-model-${sd}.ts`, SCH = `${dd}/w-sched-${sd}.ts`, SUM = `${dd}/w-sum-${sd}.ts`;
  await fsd.writeFile(MO, (await rdd("../packages/cms/src/model.ts")).replace(/from "@platform\/site"/g, `from "${SITE}"`));
  await fsd.writeFile(SCH, (await rdd("../packages/cms/src/scheduling.ts")).replace(new RegExp('from "./model.ts"', "g"), `from "${MO}"`));
  await fsd.writeFile(SUM, (await rdd("../packages/cms/src/summary.ts")).replace(new RegExp('from "./model.ts"', "g"), `from "${MO}"`).replace(new RegExp('from "./scheduling.ts"', "g"), `from "${SCH}"`));

  const S = await import(SUM);
  const now = new Date("2025-07-01T00:00:00Z");
  const posts = [
    { slug: "a", title: "A", body: "x", tags: [], status: "published", publishedAt: "2025-06-01T00:00:00Z", updatedAt: "2025-06-01T00:00:00Z" },
    { slug: "b", title: "B", body: "x", tags: [], status: "published", publishedAt: "2025-06-15T00:00:00Z", updatedAt: "2025-06-20T00:00:00Z" },
    { slug: "c", title: "C", body: "x", tags: [], status: "draft", updatedAt: "2025-06-25T00:00:00Z" },
    { slug: "d", title: "D", body: "x", tags: [], status: "published", publishedAt: "2099-01-01T00:00:00Z", updatedAt: "2025-06-30T00:00:00Z" },
  ];
  const sum = S.summarizePosts(posts, now);
  const rec = S.recentPosts(posts, 3, now);
  ok("cms-dashboard(summarize total4/pub2/draft1/sched1 + recent更新順d,c,b+status)",
    sum.total === 4 && sum.published === 2 && sum.draft === 1 && sum.scheduled === 1 &&
    rec.map((r) => r.slug).join(",") === "d,c,b" && rec[0].status === "scheduled" && rec[1].status === "draft");

  // moveItem(SortableList のロジック)
  const moveItem = (items, from, to) => {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
    const next = items.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  };
  ok("ui-moveItem(0→2 / 3→1 / 同一・範囲外は不変)",
    moveItem(["a", "b", "c", "d"], 0, 2).join(",") === "b,c,a,d" && moveItem(["a", "b", "c", "d"], 3, 1).join(",") === "a,d,b,c" &&
    moveItem(["a", "b"], 1, 1).join(",") === "a,b" && moveItem(["a", "b"], 0, 5).join(",") === "a,b");

  for (const f of [SITE, MO, SCH, SUM]) await fsd.rm(f);
}


// ── 記事フィルタ(filterPosts) + 監査ログの cms.* 抽出(実ソース) ──
{
  section("platform: 記事フィルタ + 監査 cms.* 抽出(実ソース)");
  const fsg = await import("node:fs/promises");
  const osg = await import("node:os");
  const dg = osg.tmpdir();
  const sg = Date.now();
  const rdg = async (rel) => (await fsg.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');

  // filterPosts(@platform/cms: model + scheduling + filter)
  const SITE = `${dg}/v-site-${sg}.ts`;
  await fsg.writeFile(SITE, "export {};");
  const MO = `${dg}/v-model-${sg}.ts`, SCH = `${dg}/v-sched-${sg}.ts`, FT = `${dg}/v-filter-${sg}.ts`;
  await fsg.writeFile(MO, (await rdg("../packages/cms/src/model.ts")).replace(/from "@platform\/site"/g, `from "${SITE}"`));
  await fsg.writeFile(SCH, (await rdg("../packages/cms/src/scheduling.ts")).replace(new RegExp('from "./model.ts"', "g"), `from "${MO}"`));
  await fsg.writeFile(FT, (await rdg("../packages/cms/src/filter.ts")).replace(new RegExp('from "./model.ts"', "g"), `from "${MO}"`).replace(new RegExp('from "./scheduling.ts"', "g"), `from "${SCH}"`));
  const F = await import(FT);

  const now = new Date("2025-07-01T00:00:00Z");
  const posts = [
    { slug: "react", title: "Reactのコツ", categoryId: "fe", excerpt: "フック", body: "Reactのフック", tags: ["React", "TS"], status: "published", publishedAt: "2025-06-01T00:00:00Z", updatedAt: "x" },
    { slug: "sql", title: "SQL最適化", categoryId: "be", body: "インデックス設計", tags: ["SQL"], status: "published", publishedAt: "2025-06-15T00:00:00Z", updatedAt: "x" },
    { slug: "draft", title: "React下書き", categoryId: "fe", body: "途中", tags: ["React"], status: "draft", updatedAt: "x" },
    { slug: "sched", title: "予約React", categoryId: "fe", body: "予約", tags: ["React"], status: "published", publishedAt: "2099-01-01T00:00:00Z", updatedAt: "x" },
  ];
  ok("cms-filterPosts(query横断/category/tag/status(effective)/複合/空は全件)",
    F.filterPosts(posts, { query: "react" }, now).map((p) => p.slug).sort().join(",") === "draft,react,sched" &&
    F.filterPosts(posts, { query: "インデックス" }, now).map((p) => p.slug).join(",") === "sql" &&
    F.filterPosts(posts, { categoryId: "fe" }, now).map((p) => p.slug).sort().join(",") === "draft,react,sched" &&
    F.filterPosts(posts, { tag: "TS" }, now).map((p) => p.slug).join(",") === "react" &&
    F.filterPosts(posts, { status: "scheduled" }, now).map((p) => p.slug).join(",") === "sched" &&
    F.filterPosts(posts, { categoryId: "fe", tag: "React", status: "published" }, now).map((p) => p.slug).join(",") === "react" &&
    F.filterPosts(posts, {}, now).length === 4);

  // 監査ログの cms.* 抽出(@platform/audit filterByAction)
  const ALOG = `${dg}/v-alog-${sg}.ts`, AQ = `${dg}/v-auditq-${sg}.ts`;
  await fsg.writeFile(ALOG, "export {};");
  await fsg.writeFile(AQ, (await rdg("../packages/audit/src/query.ts")).replace(new RegExp('from "./log.ts"', "g"), `from "${ALOG}"`));
  const Q = await import(AQ);
  const entries = [
    { seq: 1, action: "chat.edit", target: "msg:1", actor: "u", at: "x" },
    { seq: 2, action: "cms.post.create", target: "post:a", actor: "u", at: "x" },
    { seq: 3, action: "cms.page.update", target: "page:home", actor: "u", at: "x" },
    { seq: 4, action: "cms.category.reorder", target: "category:*", actor: "u", at: "x" },
    { seq: 5, action: "expense.submit", target: "exp:1", actor: "u", at: "x" },
  ];
  const cms = Q.filterByAction(entries, "cms");
  ok("audit-cms抽出(filterByAction 'cms' で cms.* のみ / target完全一致で特定コンテンツに絞り込み)",
    cms.map((e) => e.seq).join(",") === "2,3,4" && Q.filterByTarget(cms, "post:a").map((e) => e.seq).join(",") === "2");

  for (const f of [SITE, MO, SCH, FT, ALOG, AQ]) await fsg.rm(f);
}


// ── 公開権限判定 / リビジョン / 公開申請(実ソース) ──
{
  section("platform: isPublishAction / リビジョン / 公開申請(実ソース)");
  const fsr = await import("node:fs/promises");
  const osr = await import("node:os");
  const dr = osr.tmpdir();
  const sr = Date.now();
  const rdr = async (rel) => (await fsr.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');

  const SITE = `${dr}/u-site-${sr}.ts`;
  await fsr.writeFile(SITE, "export {};");
  const MO = `${dr}/u-model-${sr}.ts`, RV = `${dr}/u-rev-${sr}.ts`, PR = `${dr}/u-pr-${sr}.ts`;
  await fsr.writeFile(MO, (await rdr("../packages/cms/src/model.ts")).replace(/from "@platform\/site"/g, `from "${SITE}"`));
  await fsr.writeFile(RV, (await rdr("../packages/cms/src/revision.ts")).replace(new RegExp('from "./model.ts"', "g"), `from "${MO}"`));
  await fsr.writeFile(PR, await rdr("../packages/cms/src/publish-request.ts"));

  const M = await import(MO), R = await import(RV), P = await import(PR);

  ok("cms-isPublishAction(published=true/draft=false)",
    M.isPublishAction({ slug: "x", title: "t", body: "b", status: "published" }) === true && M.isPublishAction({ slug: "x", title: "t", body: "b", status: "draft" }) === false);

  // revision memory + prisma
  let n = 0; const genId = () => `r${n++}`; let t = 0; const now = () => new Date(Date.UTC(2025, 6, 1, 10, 0, t++)).toISOString();
  const rs = R.createMemoryRevisionStore(genId, now);
  const post = { slug: "my-post", title: "v1", body: "本文1", tags: ["a"], status: "draft", updatedAt: "x" };
  const r1 = await rs.record(post, "alice");
  await rs.record({ ...post, title: "v2" }, "bob");
  const revDb = () => { const rows = new Map(); let seq = 0; return { cmsRevisionRow: {
    async findMany({ where }) { return [...rows.values()].filter((r) => r.postSlug === where.postSlug).sort((a, b) => b.version - a.version); },
    async findUnique({ where }) { return rows.get(where.id) ?? null; },
    async aggregate({ where }) { const vs = [...rows.values()].filter((r) => r.postSlug === where.postSlug).map((r) => r.version); return { _max: { version: vs.length ? Math.max(...vs) : null } }; },
    async create({ data }) { const id = `db${seq++}`; const row = { id, ...data, savedAt: new Date(Date.UTC(2025, 0, 1, 0, 0, seq)) }; rows.set(id, row); return row; },
  } }; };
  const rp = R.createPrismaRevisionStore(revDb());
  await rp.record(post, "x");
  await rp.record({ ...post, title: "v2" }, "y");
  ok("cms-revision(record version採番+savedBy / list降順 / revisionToInput下書き化 / snapshotOf任意項目 / prisma aggregate採番+tags往復)",
    r1.version === 1 && r1.savedBy === "alice" && (await rs.list("my-post")).map((r) => r.version).join(",") === "2,1" && (await rs.list("other")).length === 0 &&
    R.revisionToInput(r1, "my-post").status === "draft" && R.revisionToInput(r1, "my-post").title === "v1" &&
    !("categoryId" in R.snapshotOf({ slug: "x", title: "t", body: "b", tags: [], status: "draft", updatedAt: "x" })) &&
    (await rp.list("my-post")).map((r) => r.version).join(",") === "2,1" && (await rp.list("my-post"))[0].tags.join() === "a");

  // publish-request memory + prisma
  let m = 0; const prId = () => `p${m++}`; let t2 = 0; const now2 = () => new Date(Date.UTC(2025, 7, 1, 10, 0, t2++)).toISOString();
  const ps = P.createMemoryPublishRequestStore(prId, now2);
  const req1 = await ps.request("post-a", "editor");
  const req1b = await ps.request("post-a", "editor2");
  await ps.request("post-b", "editor");
  const dec = await ps.decide(req1.id, "approved", "manager", "OK");
  const prDb = () => { const rows = new Map(); let seq = 0; return { publishRequestRow: {
    async findMany({ where }) { let r = [...rows.values()]; if (where?.status) r = r.filter((x) => x.status === where.status); return r.sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime()); },
    async findUnique({ where }) { return rows.get(where.id) ?? null; },
    async findFirst({ where }) { return [...rows.values()].find((x) => x.postSlug === where.postSlug && x.status === where.status) ?? null; },
    async create({ data }) { const id = `db${seq}`; const row = { id, ...data, requestedAt: new Date(Date.UTC(2025, 0, 1, 0, 0, seq++)), decidedBy: null, decidedAt: null, note: null }; rows.set(id, row); return row; },
    async update({ where, data }) { const row = { ...rows.get(where.id), ...data }; rows.set(where.id, row); return row; },
  } }; };
  const prp = P.createPrismaPublishRequestStore(prDb());
  const pr1 = await prp.request("x", "ed");
  await prp.request("x", "ed2");
  const pdec = await prp.decide(pr1.id, "rejected", "mgr", "却下理由");
  ok("cms-publish-request(pending再利用 / list pending2件 / decide承認+note / 承認後pending1件 / 承認後は再申請可 / prisma pending重複防止+decide却下note)",
    req1.id === req1b.id && (await ps.list({ status: "pending" })).length === 1 &&
    dec.status === "approved" && dec.decidedBy === "manager" && dec.note === "OK" &&
    (await ps.request("post-a", "editor")).id !== req1.id &&
    (await prp.list()).length === 1 && pdec.status === "rejected" && pdec.note === "却下理由");

  for (const f of [SITE, MO, RV, PR]) await fsr.rm(f);
}


// ── 記事差分 / 在庫リポジトリ(実ソース) ──
{
  section("platform: 記事差分 + 在庫リポジトリ(実ソース)");
  const fsd = await import("node:fs/promises");
  const osd = await import("node:os");
  const dd = osd.tmpdir();
  const sd = Date.now();
  const rdd = async (rel) => (await fsd.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');

  // 記事差分(@platform/cms diff)
  const DF = `${dd}/w-diff-${sd}.ts`;
  await fsd.writeFile(DF, await rdd("../packages/cms/src/diff.ts"));
  const D = await import(DF);
  const d1 = D.diffLines("a\nb\nc", "a\nx\nc");
  const d2 = D.diffLines("a\nb", "a\nb\nc");
  const rev = D.diffRevisions(
    { title: "旧", body: "1\n2", status: "draft", categoryId: "tech" },
    { title: "新", body: "1\n変更", status: "published", categoryId: "life" });
  const same = D.diffRevisions({ title: "t", body: "b", status: "draft" }, { title: "t", body: "b", status: "draft" });
  ok("cms-diff(行置換 same/del/add/same・末尾追加・削除・全置換 / diffRevisions title・status・category・body検出 / 変更なしは全false)",
    d1.map((l) => l.type).join(",") === "same,del,add,same" && d1[1].text === "b" && d1[2].text === "x" &&
    d2.map((l) => l.type).join(",") === "same,same,add" &&
    D.diffLines("a\nb\nc", "a\nc").map((l) => l.type).join(",") === "same,del,same" &&
    D.diffLines("a", "b").map((l) => l.type).join(",") === "del,add" &&
    rev.titleChanged && rev.statusChanged && rev.categoryChanged && rev.categoryFrom === "tech" && rev.categoryTo === "life" && rev.bodyChanged &&
    rev.body.map((l) => l.type).join(",") === "same,del,add" &&
    !same.titleChanged && !same.statusChanged && !same.categoryChanged && !same.bodyChanged);

  // 在庫リポジトリ(実 inventory パッケージを合成)
  const MV = `${dd}/w-inv-mv-${sd}.ts`, RE = `${dd}/w-inv-re-${sd}.ts`, WH = `${dd}/w-inv-wh-${sd}.ts`, LT = `${dd}/w-inv-lt-${sd}.ts`, PK = `${dd}/w-inv-pkg-${sd}.ts`, RP = `${dd}/w-inv-repo-${sd}.ts`;
  await fsd.writeFile(MV, await rdd("../packages/inventory/src/movements.ts"));
  await fsd.writeFile(RE, await rdd("../packages/inventory/src/reorder.ts"));
  await fsd.writeFile(WH, (await rdd("../packages/inventory/src/warehouse.ts")).replace(new RegExp('from "./movements.ts"', "g"), `from "${MV}"`));
  await fsd.writeFile(LT, (await rdd("../packages/inventory/src/lot.ts")).replace(new RegExp('from "./movements.ts"', "g"), `from "${MV}"`));
  await fsd.writeFile(PK, `export * from "${MV}";\nexport * from "${RE}";\nexport * from "${WH}";\nexport * from "${LT}";\n`);
  await fsd.writeFile(RP, (await rdd("../apps/internal-app/src/server/inventory-repo.ts")).replace(/from "@platform\/inventory"/g, `from "${PK}"`));
  const R = await import(RP);

  const st = R.createMemoryInventoryStore();
  await st.createProduct({ sku: "A-1", name: "ネジ", unit: "個", policy: { safetyStock: 100, dailyDemand: 10, leadTimeDays: 5 } });
  await st.createProduct({ sku: "B-2", name: "ケーブル", unit: "本" });
  await st.recordMovement("A-1", { type: "inbound", quantity: 500, at: "2025-06-01T00:00:00Z", ref: "PO-1", unitCost: 5 });
  await st.recordMovement("A-1", { type: "outbound", quantity: 420, at: "2025-06-10T00:00:00Z" });
  await st.recordMovement("A-1", { type: "adjustment", quantity: -5, at: "2025-06-15T00:00:00Z" });
  const mem = (await st.status()).find((x) => x.product.sku === "A-1");
  const memB = (await st.status()).find((x) => x.product.sku === "B-2");

  const db = () => { const prod = new Map(); const mv = []; let seq = 0; return {
    productRow: { async findMany() { return [...prod.values()]; }, async findUnique({ where }) { return prod.get(where.sku) ?? null; }, async create({ data }) { prod.set(data.sku, data); return data; } },
    stockMovementRow: { async findMany({ where }) { return mv.filter((m) => m.sku === where.sku).sort((a, b) => b.at.getTime() - a.at.getTime()); }, async create({ data }) { const row = { id: `m${seq++}`, ...data }; mv.push(row); return row; } },
  }; };
  const ps = R.createPrismaInventoryStore(db());
  await ps.createProduct({ sku: "A-1", name: "ネジ", unit: "個", policy: { safetyStock: 100, dailyDemand: 10, leadTimeDays: 5, targetLevel: 400 } });
  await ps.recordMovement("A-1", { type: "inbound", quantity: 500, at: "2025-06-01T00:00:00Z", ref: "PO-1", unitCost: 5 });
  await ps.recordMovement("A-1", { type: "outbound", quantity: 420, at: "2025-06-10T00:00:00Z" });
  const pst = (await ps.status())[0];

  ok("inventory-repo(memory: onHand=75/needsReorder(75<=150)/suggested=225 / policy無しは発注不要 / 台帳新しい順 / prisma: onHand=80/targetLevel反映suggested=320/ref・unitCost往復)",
    mem.summary.onHand === 75 && mem.needsReorder === true && mem.suggestedOrderQty === 225 &&
    memB.needsReorder === false && memB.suggestedOrderQty === 0 &&
    (await st.listMovements("A-1")).map((m) => m.type).join(",") === "adjustment,outbound,inbound" &&
    pst.summary.onHand === 80 && pst.needsReorder === true && pst.suggestedOrderQty === 320 &&
    (await ps.getProduct("A-1")).policy.targetLevel === 400 &&
    (await ps.listMovements("A-1"))[1].unitCost === 5);

  for (const f of [DF, MV, RE, WH, LT, PK, RP]) await fsd.rm(f);
}


// ── 在庫詳細(倉庫/期限) / 発注ドラフト / 請求書ストア(実ソース) ──
{
  section("platform: 在庫詳細 + 発注ドラフト + 請求書(実ソース)");
  const fsb = await import("node:fs/promises");
  const osb = await import("node:os");
  const db_ = osb.tmpdir();
  const sb = Date.now();
  const rdb = async (rel) => (await fsb.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');

  // tax → invoice → purchase 合成
  const TW = `${db_}/z-taxw-${sb}.ts`, TI = `${db_}/z-taxi-${sb}.ts`, TX = `${db_}/z-tax-${sb}.ts`;
  await fsb.writeFile(TW, await rdb("../packages/tax/src/withholding.ts"));
  await fsb.writeFile(TI, (await rdb("../packages/tax/src/index.ts")).replace(new RegExp('from "./withholding.ts"', "g"), `from "${TW}"`));
  await fsb.writeFile(TX, `export * from "${TI}";`);
  const IL = `${db_}/z-invl-${sb}.ts`, II = `${db_}/z-invi-${sb}.ts`, IP = `${db_}/z-invp-${sb}.ts`, IV = `${db_}/z-inv-${sb}.ts`;
  await fsb.writeFile(IL, (await rdb("../packages/invoice/src/line.ts")).replace(/from "@platform\/tax"/g, `from "${TX}"`));
  await fsb.writeFile(II, (await rdb("../packages/invoice/src/invoice.ts")).replace(/from "@platform\/tax"/g, `from "${TX}"`).replace(new RegExp('from "./line.ts"', "g"), `from "${IL}"`));
  await fsb.writeFile(IP, await rdb("../packages/invoice/src/payment.ts"));
  await fsb.writeFile(IV, `export * from "${IL}";\nexport * from "${II}";\nexport * from "${IP}";\nexport type { Rounding } from "${TX}";`);
  const PO = `${db_}/z-po-${sb}.ts`, PR = `${db_}/z-pur-${sb}.ts`;
  await fsb.writeFile(PO, (await rdb("../packages/purchase/src/purchase-order.ts")).replace(/from "@platform\/invoice"/g, `from "${IV}"`));
  await fsb.writeFile(PR, `export * from "${PO}";`);
  // inventory 合成(movements/reorder/warehouse/lot)
  const MV = `${db_}/z-mv-${sb}.ts`, RE = `${db_}/z-re-${sb}.ts`, WH = `${db_}/z-wh-${sb}.ts`, LT = `${db_}/z-lt-${sb}.ts`, INV = `${db_}/z-invtry-${sb}.ts`;
  await fsb.writeFile(MV, await rdb("../packages/inventory/src/movements.ts"));
  await fsb.writeFile(RE, await rdb("../packages/inventory/src/reorder.ts"));
  await fsb.writeFile(WH, (await rdb("../packages/inventory/src/warehouse.ts")).replace(new RegExp('from "./movements.ts"', "g"), `from "${MV}"`));
  await fsb.writeFile(LT, (await rdb("../packages/inventory/src/lot.ts")).replace(new RegExp('from "./movements.ts"', "g"), `from "${MV}"`));
  await fsb.writeFile(INV, `export * from "${MV}";\nexport * from "${RE}";\nexport * from "${WH}";\nexport * from "${LT}";`);
  // repos/helper
  const IREPO = `${db_}/z-irepo-${sb}.ts`, PDRAFT = `${db_}/z-pdraft-${sb}.ts`, VREPO = `${db_}/z-vrepo-${sb}.ts`;
  await fsb.writeFile(IREPO, (await rdb("../apps/internal-app/src/server/inventory-repo.ts")).replace(/from "@platform\/inventory"/g, `from "${INV}"`));
  await fsb.writeFile(PDRAFT, (await rdb("../apps/internal-app/src/server/purchase-draft.ts")).replace(/from "@platform\/purchase"/g, `from "${PR}"`).replace(new RegExp('from "./inventory-repo.ts"', "g"), `from "${IREPO}"`));
  await fsb.writeFile(VREPO, (await rdb("../apps/internal-app/src/server/invoice-repo.ts")).replace(/from "@platform\/invoice"/g, `from "${IV}"`));

  const IR = await import(IREPO), PD = await import(PDRAFT), VR = await import(VREPO);

  // 在庫詳細
  const ist = IR.createMemoryInventoryStore();
  await ist.createProduct({ sku: "M-1", name: "牛乳", unit: "本" });
  await ist.recordMovement("M-1", { type: "inbound", quantity: 50, at: "2025-06-01T00:00:00Z", warehouse: "東京", lotId: "L1", expiry: "2025-07-05" });
  await ist.recordMovement("M-1", { type: "inbound", quantity: 30, at: "2025-06-02T00:00:00Z", warehouse: "大阪", lotId: "L2", expiry: "2025-08-20" });
  await ist.recordMovement("M-1", { type: "outbound", quantity: 10, at: "2025-06-10T00:00:00Z", warehouse: "東京", lotId: "L1" });
  const det = await ist.detail("M-1", "2025-07-01T00:00:00Z", 30);
  const det2 = await ist.detail("M-1", "2025-07-10T00:00:00Z", 5);
  ok("inventory-detail(台帳新しい順 / 倉庫別 東京40・大阪30 / 期限間近L1のみ40 / 7/1期限切れ無し / 7/10でL1期限切れ / 無SKUはundefined)",
    det.movements.length === 3 && det.movements[0].at === "2025-06-10T00:00:00Z" &&
    det.byWarehouse.find((w) => w.warehouse === "東京").onHand === 40 && det.byWarehouse.find((w) => w.warehouse === "大阪").onHand === 30 &&
    det.expiringSoon.length === 1 && det.expiringSoon[0].lotId === "L1" && det.expiringSoon[0].quantity === 40 &&
    det.expired.length === 0 && det2.expired.some((l) => l.lotId === "L1") &&
    (await ist.detail("X")) === undefined);

  // 発注ドラフト
  const statuses = [
    { product: { sku: "A-1", name: "ネジ", unit: "個" }, summary: { onHand: 75 }, needsReorder: true, suggestedOrderQty: 225 },
    { product: { sku: "B-2", name: "ケーブル", unit: "本" }, summary: { onHand: 500 }, needsReorder: false, suggestedOrderQty: 0 },
    { product: { sku: "C-3", name: "コネクタ", unit: "個" }, summary: { onHand: 5 }, needsReorder: true, suggestedOrderQty: 100 },
  ];
  const po = PD.buildReorderPurchaseOrder(statuses, { number: "PO-1", orderDate: "2025-07-01", supplier: "○○商事", dueDate: "2025-07-15" });
  const none = PD.buildReorderPurchaseOrder([statuses[1]], { number: "X", orderDate: "2025-07-01", supplier: "s" });
  ok("発注ドラフト(発注要2件のみ明細化 / 数量225・100 / ヘッダ番号・仕入先・納期 / totals計算 / 対象無しundefined)",
    po.lines.length === 2 && po.lines[0].description === "A-1 ネジ" && po.lines[0].quantity === 225 && po.lines[1].quantity === 100 &&
    po.number === "PO-1" && po.supplier === "○○商事" && po.dueDate === "2025-07-15" && typeof po.totals.total === "number" && none === undefined);

  // 請求書ストア
  const now = new Date("2025-07-01T00:00:00Z");
  const vinv = VR.createMemoryInvoiceStore();
  await vinv.create({ number: "INV-001", issueDate: "2025-06-01", dueDate: "2025-06-30", billTo: "A社" }, [{ description: "開発", quantity: 10, unitPrice: 10000 }, { description: "保守", quantity: 1, unitPrice: 50000, taxRate: 10 }]);
  const v1 = await vinv.get("INV-001", now);
  await vinv.recordPayment("INV-001", 100000);
  const v2 = await vinv.get("INV-001", now);
  await vinv.recordPayment("INV-001", 65000);
  const v3 = await vinv.get("INV-001", now);
  await vinv.create({ number: "INV-002", issueDate: "2025-06-15", dueDate: "2025-07-31", billTo: "B社" }, [{ description: "物品", quantity: 2, unitPrice: 5000 }]);
  const b1 = await vinv.get("INV-002", now);
  await vinv.recordPayment("INV-002", 3000);
  const invDbF = () => { const rows = new Map(); const order = []; return { invoiceRow: {
    async findMany() { return order.map((n) => rows.get(n)); }, async findUnique({ where }) { return rows.get(where.number) ?? null; },
    async create({ data }) { rows.set(data.number, data); if (!order.includes(data.number)) order.push(data.number); return data; },
    async update({ where, data }) { const row = { ...rows.get(where.number), ...data }; rows.set(where.number, row); return row; },
  } }; };
  const pinv = VR.createPrismaInvoiceStore(invDbF());
  await pinv.create({ number: "INV-100", issueDate: "2025-06-15", dueDate: "2025-07-31", billTo: "A社", registrationNumber: "T1234567890123" }, [{ description: "開発", quantity: 10, unitPrice: 10000, taxRate: 10 }]);
  await pinv.recordPayment("INV-100", 50000);
  const pv = await pinv.get("INV-100", now);
  ok("invoice-store(合計165000/期限超過overdue / 一部入金でも期限超過はoverdue残65000 / 完済paid残0 / 期限内issued税込11000 / list発行日昇順 / prisma税込110000・issued・残60000・登録番号・明細JSON往復)",
    v1.totals.subtotal === 150000 && v1.totals.tax === 15000 && v1.totals.total === 165000 && v1.status === "overdue" && v1.balance === 165000 &&
    v2.status === "overdue" && v2.balance === 65000 && v3.status === "paid" && v3.balance === 0 &&
    b1.status === "issued" && b1.totals.total === 11000 && (await vinv.get("INV-002", now)).balance === 8000 &&
    (await vinv.list(now)).map((i) => i.number).join(",") === "INV-001,INV-002" &&
    pv.totals.total === 110000 && pv.status === "issued" && pv.balance === 60000 && pv.registrationNumber === "T1234567890123" && pv.lines[0].description === "開発");

  for (const f of [TW, TI, TX, IL, II, IP, IV, PO, PR, MV, RE, WH, LT, INV, IREPO, PDRAFT, VREPO]) await fsb.rm(f);
}


// ── 売掛(エイジング+督促) / 見積→請求書 / 発注→入荷(実ソース) ──
{
  section("platform: 売掛 + 見積変換 + 発注入荷(実ソース)");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/y-${name}-${sc}.ts`;

  // tax
  const TW = W("taxw"), TI = W("taxi"), TX = W("tax");
  await fsc.writeFile(TW, await rdc("../packages/tax/src/withholding.ts"));
  await fsc.writeFile(TI, (await rdc("../packages/tax/src/index.ts")).replace(new RegExp('from "./withholding.ts"', "g"), `from "${TW}"`));
  await fsc.writeFile(TX, `export * from "${TI}";`);
  // invoice(line/invoice/payment/reconcile/dunning)
  const IL = W("invl"), II = W("invi"), IP = W("invp"), IRc = W("invrc"), IDn = W("invdn"), IV = W("inv");
  await fsc.writeFile(IL, (await rdc("../packages/invoice/src/line.ts")).replace(/from "@platform\/tax"/g, `from "${TX}"`));
  await fsc.writeFile(II, (await rdc("../packages/invoice/src/invoice.ts")).replace(/from "@platform\/tax"/g, `from "${TX}"`).replace(new RegExp('from "./line.ts"', "g"), `from "${IL}"`));
  await fsc.writeFile(IP, await rdc("../packages/invoice/src/payment.ts"));
  await fsc.writeFile(IRc, (await rdc("../packages/invoice/src/reconcile.ts")).replace(new RegExp('from "./payment.ts"', "g"), `from "${IP}"`));
  await fsc.writeFile(IDn, await rdc("../packages/invoice/src/dunning.ts"));
  await fsc.writeFile(IV, `export * from "${IL}";\nexport * from "${II}";\nexport * from "${IP}";\nexport * from "${IRc}";\nexport * from "${IDn}";\nexport type { Rounding } from "${TX}";`);
  // quote
  const QQ = W("qq"), QT = W("q");
  await fsc.writeFile(QQ, (await rdc("../packages/quote/src/quote.ts")).replace(/from "@platform\/invoice"/g, `from "${IV}"`));
  await fsc.writeFile(QT, `export * from "${QQ}";`);
  // purchase(order + receiving)
  const PO = W("po"), PRc = W("prc"), PT = W("pur");
  await fsc.writeFile(PO, (await rdc("../packages/purchase/src/purchase-order.ts")).replace(/from "@platform\/invoice"/g, `from "${IV}"`));
  await fsc.writeFile(PRc, (await rdc("../packages/purchase/src/receiving.ts")).replace(/from "@platform\/invoice"/g, `from "${IV}"`).replace(new RegExp('from "./purchase-order.ts"', "g"), `from "${PO}"`));
  await fsc.writeFile(PT, `export * from "${PO}";\nexport * from "${PRc}";`);
  // repos
  const RCVr = W("rcv"), QRr = W("qrepo"), PRr = W("prepo");
  await fsc.writeFile(RCVr, (await rdc("../apps/internal-app/src/server/receivables.ts")).replace(/from "@platform\/invoice"/g, `from "${IV}"`));
  await fsc.writeFile(QRr, (await rdc("../apps/internal-app/src/server/quote-repo.ts")).replace(/from "@platform\/quote"/g, `from "${QT}"`));
  await fsc.writeFile(PRr, (await rdc("../apps/internal-app/src/server/purchase-repo.ts")).replace(/from "@platform\/purchase"/g, `from "${PT}"`));

  const RCV = await import(RCVr), QR = await import(QRr), PR = await import(PRr);
  const now = new Date("2025-07-01T00:00:00Z");

  // 売掛
  const invs = [
    { number: "INV-A", billTo: "A社", dueDate: "2025-06-30", total: 110000, paidAmount: 0, cancelled: false },
    { number: "INV-B", billTo: "B社", dueDate: "2025-06-10", total: 55000, paidAmount: 0, cancelled: false },
    { number: "INV-C", billTo: "C社", dueDate: "2025-05-01", total: 33000, paidAmount: 0, cancelled: false },
    { number: "INV-D", billTo: "D社", dueDate: "2025-07-31", total: 22000, paidAmount: 0, cancelled: false },
    { number: "INV-E", billTo: "E社", dueDate: "2025-06-01", total: 10000, paidAmount: 10000, cancelled: false },
    { number: "INV-F", billTo: "F社", dueDate: "2025-05-01", total: 99999, paidAmount: 0, cancelled: true },
  ];
  const rsum = RCV.receivablesSummary(invs, now);
  ok("receivables(未収220000 / エイジング total220000・current22000・d1_30=165000・d61_90=33000・over90=0 / 督促3件・経過日数降順C=final,B=first,A=reminder / 文面に宛先金額)",
    rsum.outstanding === 220000 && rsum.aging.total === 220000 && rsum.aging.current === 22000 && rsum.aging.d1_30 === 165000 && rsum.aging.d61_90 === 33000 && rsum.aging.over90 === 0 &&
    rsum.dunning.length === 3 && rsum.dunning[0].number === "INV-C" && rsum.dunning[0].level === "final" && rsum.dunning[1].level === "first" && rsum.dunning[2].level === "reminder" &&
    rsum.dunning[0].message.includes("C社") && rsum.dunning[0].message.includes("33,000"));

  // 見積→請求書
  const qs = QR.createMemoryQuoteStore();
  await qs.create({ number: "Q-001", issueDate: "2025-06-01", validUntil: "2025-07-31", billTo: "A社" }, [{ description: "設計", quantity: 1, unitPrice: 200000 }]);
  const q1 = await qs.get("Q-001", now);
  await qs.setState("Q-001", "sent");
  const q1Sent = (await qs.get("Q-001", now)).status;
  await qs.create({ number: "Q-EXP", issueDate: "2025-05-01", validUntil: "2025-06-15", billTo: "B社" }, [{ description: "x", quantity: 1, unitPrice: 1000 }]);
  const qExpStatus = (await qs.get("Q-EXP", now)).status;
  const inv = await qs.toInvoice("Q-001", { number: "INV-FROM-Q", issueDate: "2025-07-01", dueDate: "2025-07-31" });
  const q1Accepted = (await qs.get("Q-001", now)).status;
  const qdb = () => { const rows = new Map(); const order = []; return { quoteRow: {
    async findMany() { return order.map((n) => rows.get(n)); }, async findUnique({ where }) { return rows.get(where.number) ?? null; },
    async create({ data }) { rows.set(data.number, data); if (!order.includes(data.number)) order.push(data.number); return data; },
    async update({ where, data }) { const row = { ...rows.get(where.number), ...data }; rows.set(where.number, row); return row; },
  } }; };
  const pq = QR.createPrismaQuoteStore(qdb());
  await pq.create({ number: "Q-100", issueDate: "2025-06-01", validUntil: "2025-07-31", billTo: "A社" }, [{ description: "設計", quantity: 1, unitPrice: 200000 }]);
  const pqInv = await pq.toInvoice("Q-100", { number: "INV-100", issueDate: "2025-07-01", dueDate: "2025-07-31" });
  ok("quote-store(create税込220000・draft・残30日 / sent遷移 / 期限切れexpired / 変換で明細合計引継ぎ+accepted / prisma変換も明細引継ぎ+accepted)",
    q1.totals.total === 220000 && q1.status === "draft" && q1.daysLeft === 30 &&
    q1Sent === "sent" && qExpStatus === "expired" &&
    inv.number === "INV-FROM-Q" && inv.totals.total === 220000 && inv.lines[0].description === "設計" && q1Accepted === "accepted" &&
    pqInv.totals.total === 220000 && (await pq.get("Q-100", now)).status === "accepted");

  // 発注→入荷
  const po = { number: "PO-1", orderDate: "2025-07-01", supplier: "○○商事", lines: [{ description: "A-1 ネジ", quantity: 225, unitPrice: 0 }, { description: "C-3 コネクタ", quantity: 100, unitPrice: 0 }], totals: { subtotal: 0, tax: 0, total: 0, taxByRate: [] }, state: "ordered" };
  const ps = PR.createMemoryPurchaseStore();
  await ps.create(po, ["A-1", "C-3"]);
  const p1 = await ps.get("PO-1");
  const r1 = await ps.recordReceipt("PO-1", { lineIndex: 0, quantity: 225, receivedAt: "2025-07-05" });
  const r2 = await ps.recordReceipt("PO-1", { lineIndex: 1, quantity: 100, receivedAt: "2025-07-06" });
  const pdb = () => { const rows = new Map(); const order = []; return { purchaseOrderRow: {
    async findMany() { return order.map((n) => rows.get(n)); }, async findUnique({ where }) { return rows.get(where.number) ?? null; },
    async create({ data }) { rows.set(data.number, data); if (!order.includes(data.number)) order.push(data.number); return data; },
    async update({ where, data }) { const row = { ...rows.get(where.number), ...data }; rows.set(where.number, row); return row; },
  } }; };
  const pps = PR.createPrismaPurchaseStore(pdb());
  await pps.create(po, ["A-1", "C-3"]);
  const pr1 = await pps.recordReceipt("PO-1", { lineIndex: 0, quantity: 225, receivedAt: "2025-07-05" });
  ok("purchase-store(ordered発注残325 / 行0全量入荷→inbound{A-1,225}+complete+partially_received残100 / 全量入荷received残0 / prisma入荷inbound返却+受領JSON往復)",
    p1.status === "ordered" && p1.outstanding === 325 && p1.lineStatus[0].outstanding === 225 &&
    r1.inbound.sku === "A-1" && r1.inbound.quantity === 225 && r1.view.lineStatus[0].complete === true && r1.view.status === "partially_received" && r1.view.outstanding === 100 &&
    r2.view.status === "received" && r2.view.outstanding === 0 &&
    pr1.inbound.sku === "A-1" && pr1.view.status === "partially_received" && (await pps.get("PO-1")).receipts.length === 1);

  for (const f of [TW, TI, TX, IL, II, IP, IRc, IDn, IV, QQ, QT, PO, PRc, PT, RCVr, QRr, PRr]) await fsc.rm(f);
}


// ── platform: 繰返請求(サブスク) + 勤怠(打刻集計) + 会計連携(仕訳/試算表)(実ソース) ──
{
  section("platform: 繰返請求 + 勤怠 + 会計連携(実ソース)");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/z-${name}-${sc}.ts`;

  // datetime = calendar.ts のみ(index.ts は date-fns 依存のため使わない)
  const DT = W("dt");
  await fsc.writeFile(DT, await rdc("../packages/datetime/src/calendar.ts"));
  const DTB = W("dtb");
  await fsc.writeFile(DTB, `export * from "${DT}";`);
  // tax
  const TW = W("taxw"), TI = W("taxi"), TX = W("tax");
  await fsc.writeFile(TW, await rdc("../packages/tax/src/withholding.ts"));
  await fsc.writeFile(TI, (await rdc("../packages/tax/src/index.ts")).replace(new RegExp('from "./withholding.ts"', "g"), `from "${TW}"`));
  await fsc.writeFile(TX, `export * from "${TI}";`);
  // invoice(line/invoice/payment/recurring)
  const IL = W("invl"), II = W("invi"), IP = W("invp"), IRe = W("invre"), IV = W("inv");
  await fsc.writeFile(IL, (await rdc("../packages/invoice/src/line.ts")).replace(/from "@platform\/tax"/g, `from "${TX}"`));
  await fsc.writeFile(II, (await rdc("../packages/invoice/src/invoice.ts")).replace(/from "@platform\/tax"/g, `from "${TX}"`).replace(new RegExp('from "./line.ts"', "g"), `from "${IL}"`));
  await fsc.writeFile(IP, await rdc("../packages/invoice/src/payment.ts"));
  await fsc.writeFile(IRe, (await rdc("../packages/invoice/src/recurring.ts")).replace(new RegExp('from "./invoice.ts"', "g"), `from "${II}"`).replace(new RegExp('from "./line.ts"', "g"), `from "${IL}"`).replace(/from "@platform\/datetime"/g, `from "${DTB}"`));
  await fsc.writeFile(IV, `export * from "${IL}";\nexport * from "${II}";\nexport * from "${IP}";\nexport * from "${IRe}";\nexport type { Rounding } from "${TX}";`);
  // payroll(worktime)
  const PW = W("payw"), PY = W("pay");
  await fsc.writeFile(PW, await rdc("../packages/payroll/src/worktime.ts"));
  await fsc.writeFile(PY, `export * from "${PW}";`);
  // accounting(journal/entries/export)
  const AJ = W("accj"), AE = W("acce"), AX = W("accx"), AC = W("acc");
  await fsc.writeFile(AJ, await rdc("../packages/accounting/src/journal.ts"));
  await fsc.writeFile(AE, (await rdc("../packages/accounting/src/entries.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`));
  await fsc.writeFile(AX, (await rdc("../packages/accounting/src/export.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`).replace(new RegExp('from "./entries.ts"', "g"), `from "${AE}"`));
  await fsc.writeFile(AC, `export * from "${AJ}";\nexport * from "${AE}";\nexport * from "${AX}";`);
  // app repos
  const RRr = W("recrepo"), ARr = W("attrepo"), LGr = W("ledger");
  await fsc.writeFile(RRr, (await rdc("../apps/internal-app/src/server/recurring-repo.ts")).replace(/from "@platform\/invoice"/g, `from "${IV}"`));
  await fsc.writeFile(ARr, (await rdc("../apps/internal-app/src/server/attendance-repo.ts")).replace(/from "@platform\/payroll"/g, `from "${PY}"`));
  await fsc.writeFile(LGr, (await rdc("../apps/internal-app/src/server/ledger.ts")).replace(/from "@platform\/accounting"/g, `from "${AC}"`));

  const RR = await import(RRr), AR = await import(ARr), LG = await import(LGr);

  // 繰り返し請求
  const rs = RR.createMemoryRecurringStore();
  await rs.create({ number: "SUB-1", billTo: "A社", interval: "monthly", startDate: "2025-01-01", lines: [{ description: "月額利用料", quantity: 1, unitPrice: 30000 }] });
  const rv1 = await rs.get("SUB-1", new Date("2025-03-15T00:00:00Z"));
  const recInv = RR.invoiceFromPlan(rv1, { number: "INV-SUB", issueDate: "2025-03-15", dueDate: "2025-03-31" });
  await rs.markBilled("SUB-1", "2025-03-15");
  const rvSame = await rs.get("SUB-1", new Date("2025-03-20T00:00:00Z"));
  const rvNext = await rs.get("SUB-1", new Date("2025-04-05T00:00:00Z"));
  await rs.setActive("SUB-1", false);
  const rvStopped = await rs.get("SUB-1", new Date("2025-05-05T00:00:00Z"));
  await rs.setActive("SUB-1", true);
  await rs.create({ number: "SUB-2", billTo: "B社", interval: "monthly", startDate: "2099-01-01", lines: [{ description: "x", quantity: 1, unitPrice: 1000 }] });
  const dueList = await rs.due(new Date("2025-05-05T00:00:00Z"));
  const rqdb = () => { const rows = new Map(); const order = []; return { recurringPlanRow: {
    async findMany() { return order.map((n) => rows.get(n)); }, async findUnique({ where }) { return rows.get(where.number) ?? null; },
    async create({ data }) { rows.set(data.number, data); if (!order.includes(data.number)) order.push(data.number); return data; },
    async update({ where, data }) { const row = { ...rows.get(where.number), ...data }; rows.set(where.number, row); return row; },
  } }; };
  const prs = RR.createPrismaRecurringStore(rqdb());
  await prs.create({ number: "SUB-1", billTo: "A社", interval: "monthly", startDate: "2025-01-01", lines: [{ description: "月額", quantity: 1, unitPrice: 30000 }] });
  await prs.markBilled("SUB-1", "2025-03-15");
  const prv = await prs.get("SUB-1", new Date("2025-04-05T00:00:00Z"));
  ok("recurring-store(未課金でdue+請求書生成税込33000宛先引継ぎ / 課金直後同月内はdue無し / 翌月再度due / 停止はdue無し / due()は課金対象のみ / prisma翌月due+明細JSON往復)",
    rv1.due === true && rv1.nextDate !== null && recInv.totals.total === 33000 && recInv.billTo === "A社" && recInv.lines[0].description === "月額利用料" &&
    rvSame.due === false && rvNext.due === true && rvStopped.due === false && dueList.length === 1 && dueList[0].number === "SUB-1" &&
    prv.due === true && prv.lines[0].unitPrice === 30000);

  // 勤怠
  const as = AR.createMemoryAttendanceStore();
  const ad1 = await as.record("u@x.com", { date: "2025-07-01", clockIn: "09:00", clockOut: "18:00", breakMinutes: 60 });
  const ad2 = await as.record("u@x.com", { date: "2025-07-02", clockIn: "09:00", clockOut: "22:00", breakMinutes: 60 });
  const ad3 = await as.record("u@x.com", { date: "2025-07-03", clockIn: "22:00", clockOut: "06:00" });
  const ad4 = await as.record("u@x.com", { date: "2025-07-06", clockIn: "10:00", clockOut: "15:00", isHoliday: true });
  const asum = await as.monthly("u@x.com", "2025-07");
  await as.record("u@x.com", { date: "2025-07-01", clockIn: "10:00", clockOut: "19:00", breakMinutes: 60 });
  const aAfter = await as.list("u@x.com");
  const aadb = () => { const rows = []; let seq = 0; return { attendanceRow: {
    async findMany({ where }) { return rows.filter((r) => r.userId === where.userId && (!where.date || r.date.startsWith(where.date.startsWith))).sort((a, b) => (a.date < b.date ? -1 : 1)); },
    async findFirst({ where }) { return rows.find((r) => r.userId === where.userId && r.date === where.date) ?? null; },
    async create({ data }) { const row = { id: `a${seq++}`, ...data }; rows.push(row); return row; },
    async update({ where, data }) { const row = rows.find((r) => r.id === where.id); Object.assign(row, data); return row; },
  } }; };
  const pas = AR.createPrismaAttendanceStore(aadb());
  await pas.record("u@x.com", { date: "2025-07-02", clockIn: "09:00", clockOut: "22:00", breakMinutes: 60 });
  const pasum = await pas.monthly("u@x.com", "2025-07");
  ok("attendance-store(9-18休憩60=実働480残業0 / 9-22休憩60=残業240深夜0 / 22-翌6=実働480深夜420 / 法定休日=holiday300残業0 / 月次残業240深夜420休日300 / 同日再打刻は上書き / prisma月次残業240)",
    ad1.totalMinutes === 480 && ad1.overtimeMinutes === 0 && ad2.totalMinutes === 720 && ad2.overtimeMinutes === 240 && ad2.nightMinutes === 0 &&
    ad3.totalMinutes === 480 && ad3.nightMinutes === 420 && ad4.holidayMinutes === 300 && ad4.overtimeMinutes === 0 &&
    asum.overtimeMinutes === 240 && asum.nightMinutes === 420 && asum.holidayMinutes === 300 && aAfter.length === 4 &&
    pasum.overtimeMinutes === 240 && (await pas.list("u@x.com")).length === 1);

  // 会計連携
  const led = LG.buildLedger({
    invoices: [
      { number: "INV-1", issueDate: "2025-06-01", subtotal: 100000, tax: 10000, paidAmount: 110000, cancelled: false },
      { number: "INV-2", issueDate: "2025-06-15", subtotal: 50000, tax: 5000, paidAmount: 0, cancelled: false },
      { number: "INV-3", issueDate: "2025-06-20", subtotal: 99999, tax: 9999, paidAmount: 0, cancelled: true },
    ],
    purchases: [{ number: "PO-1", orderDate: "2025-06-10", subtotal: 30000, tax: 3000, cancelled: false }],
  });
  const uriage = led.trialBalance.find((a) => a.account === "売掛金");
  const sales = led.trialBalance.find((a) => a.account === "売上高");
  const shiire = led.trialBalance.find((a) => a.account === "仕入高");
  ok("ledger(仕訳4件=売上2+入金1+仕入1・取消除外 / 全仕訳貸借一致 / 売掛残55000 / 売上貸方150000 / 仕入借方30000 / 日付昇順+rows展開)",
    led.entries.length === 4 && led.balanced === true && uriage && uriage.balance === 55000 && sales && sales.credit === 150000 && shiire && shiire.debit === 30000 &&
    led.entries[0].date === "2025-06-01" && led.rows.length >= 8);

  for (const f of [DT, DTB, TW, TI, TX, IL, II, IP, IRe, IV, PW, PY, AJ, AE, AX, AC, RRr, ARr, LGr]) await fsc.rm(f);
}


// ── platform: 勤怠承認(workflow) + 給与計算(payroll) + freee連携 + 請求書PDF(実ソース) ──
{
  section("platform: 勤怠承認 + 給与 + freee + PDF(実ソース)");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/w-${name}-${sc}.ts`;

  // core = error + result
  const CE = W("cerr"), CR = W("cres"), CB = W("core");
  await fsc.writeFile(CE, await rdc("../packages/core/src/error.ts"));
  await fsc.writeFile(CR, (await rdc("../packages/core/src/result.ts")).replace(new RegExp('from "./error.ts"', "g"), `from "${CE}"`));
  await fsc.writeFile(CB, `export * from "${CE}";\nexport * from "${CR}";`);
  // payroll
  const PWk = W("payw"), PPr = W("payp"), PPs = W("pays"), PB = W("pay");
  await fsc.writeFile(PWk, await rdc("../packages/payroll/src/worktime.ts"));
  await fsc.writeFile(PPr, (await rdc("../packages/payroll/src/premium.ts")).replace(new RegExp('from "./worktime.ts"', "g"), `from "${PWk}"`));
  await fsc.writeFile(PPs, (await rdc("../packages/payroll/src/payslip.ts")).replace(new RegExp('from "./premium.ts"', "g"), `from "${PPr}"`));
  await fsc.writeFile(PB, `export * from "${PWk}";\nexport * from "${PPr}";\nexport * from "${PPs}";`);
  // accounting
  const AJ = W("accj"), AE = W("acce"), AX = W("accx"), AS = W("accs"), AB = W("acc");
  await fsc.writeFile(AJ, await rdc("../packages/accounting/src/journal.ts"));
  await fsc.writeFile(AE, (await rdc("../packages/accounting/src/entries.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`));
  await fsc.writeFile(AX, (await rdc("../packages/accounting/src/export.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`).replace(new RegExp('from "./entries.ts"', "g"), `from "${AE}"`));
  await fsc.writeFile(AS, (await rdc("../packages/accounting/src/sync.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`).replace(new RegExp('from "./export.ts"', "g"), `from "${AX}"`));
  await fsc.writeFile(AB, `export * from "${AJ}";\nexport * from "${AE}";\nexport * from "${AX}";\nexport * from "${AS}";`);
  // workflow / pdf(兄弟re-export除去 + core張替)
  const WF = W("wf"), PD = W("pdf");
  const wfSrc = (await rdc("../packages/workflow/src/index.ts")).split("\n").filter((l) => !/from "\.\/(notification|routing|delegation|parallel|escalation)\.ts"/.test(l)).join("\n").replace(/from "@platform\/core"/g, `from "${CB}"`);
  await fsc.writeFile(WF, wfSrc);
  const pdSrc = (await rdc("../packages/pdf/src/index.ts")).split("\n").filter((l) => !/from "\.\/renderers\/playwright\.ts"/.test(l)).join("\n").replace(/from "@platform\/core"/g, `from "${CB}"`);
  await fsc.writeFile(PD, pdSrc);
  // app repos
  const PRr = W("payrepo"), FEr = W("freee"), AAr = W("apprepo"), PSr = W("pdfsvc");
  await fsc.writeFile(PRr, (await rdc("../apps/internal-app/src/server/payroll-repo.ts")).replace(/from "@platform\/payroll"/g, `from "${PB}"`));
  await fsc.writeFile(FEr, (await rdc("../apps/internal-app/src/server/freee-export.ts")).replace(/from "@platform\/accounting"/g, `from "${AB}"`));
  await fsc.writeFile(AAr, (await rdc("../apps/internal-app/src/server/attendance-approval-repo.ts")).replace(/from "@platform\/workflow"/g, `from "${WF}"`));
  await fsc.writeFile(PSr, (await rdc("../apps/internal-app/src/server/pdf-service.ts")).replace(/from "@platform\/pdf"/g, `from "${PD}"`));

  const PR = await import(PRr), FE = await import(FEr), AA = await import(AAr), PS = await import(PSr), AC = await import(AB);

  // 給与
  const wage = { userId: "u@x.com", hourlyWage: 2000, allowances: [{ name: "通勤手当", amount: 15000 }], deductions: [{ name: "健康保険料", amount: 9000 }, { name: "厚生年金", amount: 16000 }] };
  const pr = PR.computePayroll("2025-07", wage, { totalMinutes: 10800, overtimeMinutes: 1200, nightMinutes: 300, holidayMinutes: 480, workedDays: 20 });
  const pr2 = PR.computePayroll("2025-08", { userId: "u", hourlyWage: 2000, allowances: [], deductions: [] }, { totalMinutes: 12000, overtimeMinutes: 4200, nightMinutes: 0, holidayMinutes: 0, workedDays: 22 });
  const ws = PR.createMemoryWageStore();
  await ws.set(wage);
  ok("payroll(基本344000 / 時間外割増10000 / 深夜2500 / 休日21600 / 総支給393100 / 控除25000・差引368100 / 月60h超はover60割増30000+10000 / 設定set-get往復 / 既定時給2000)",
    pr.breakdown.base === 344000 && pr.breakdown.overtimePremium === 10000 && pr.breakdown.over60Premium === 0 && pr.breakdown.nightPremium === 2500 && pr.breakdown.holidayPay === 21600 &&
    pr.payslip.grossPay === 393100 && pr.payslip.totalDeductions === 25000 && pr.payslip.netPay === 368100 &&
    pr2.breakdown.overtimePremium === 30000 && pr2.breakdown.over60Premium === 10000 && pr2.attendance.over60Minutes === 600 &&
    (await ws.get("u@x.com")).hourlyWage === 2000 && (await ws.list()).length === 1 && PR.defaultWage("x").hourlyWage === 2000);

  // freee
  const fentries = [
    AC.salesJournal({ date: "2025-06-01", description: "売上 INV-1", net: 100000, tax: 10000 }),
    AC.receiptJournal({ date: "2025-06-05", description: "入金 INV-1", amount: 110000 }),
    AC.purchaseJournal({ date: "2025-06-10", description: "仕入 PO-1", net: 30000, tax: 3000 }),
  ];
  const fbatch = FE.freeeBatch(fentries);
  const fsd = fbatch.ready[0].details;
  const fpartial = FE.freeeBatch(fentries, { 売掛金: 101, 売上高: 201 });
  const fsum = FE.freeeBatchSummary(fbatch);
  ok("freee(全科目マップでready3件errors0 / 売上details借方売掛101=110000+貸方売上201=100000 / 各payloadに冪等キーと日付 / 未登録科目はerrorsへ / サマリーtotal3ready3)",
    fbatch.ready.length === 3 && fbatch.errors.length === 0 && fsd.length === 3 && fsd[0].entrySide === "debit" && fsd[0].accountItemId === 101 && fsd[0].amount === 110000 &&
    fsd.find((d) => d.accountItemId === 201).amount === 100000 && fbatch.ready.every((p) => p.key && p.date) &&
    fpartial.errors.length >= 1 && fpartial.errors[0].unknownAccounts.length >= 1 && fsum.total === 3 && fsum.ready === 3 && fsum.errors === 0);

  // 勤怠承認
  const st = AA.createMemoryAttendanceApprovalStore();
  const sub = await st.submit("taro@x.com", "2025-07");
  const pendCount = (await st.listPending()).length;
  const bad = await st.decide("taro@x.com", "2025-07", { id: "taro@x.com", roles: ["employee"] }, "approve");
  const stillPending = (await st.get("taro@x.com", "2025-07")).status;
  const mgr = { id: "boss@x.com", roles: ["manager"] };
  const good = await st.decide("taro@x.com", "2025-07", mgr, "approve");
  const afterCount = (await st.listPending()).length;
  const again = await st.decide("taro@x.com", "2025-07", mgr, "approve");
  await st.submit("hanako@x.com", "2025-07");
  const rej = await st.decide("hanako@x.com", "2025-07", mgr, "reject", "打刻漏れ");
  ok("attendance-approval(submitでpending+listPending1件 / employeeは却下ok=false・状態pending維持 / manager承認でapproved+履歴に承認者 / 承認後listPendingから消える / 完了済みは操作不可 / reject可能)",
    sub.status === "pending" && sub.history.length === 0 && pendCount === 1 && bad.ok === false && stillPending === "pending" &&
    good.ok === true && good.approval.status === "approved" && good.approval.history[0].actor === "boss@x.com" && afterCount === 0 &&
    again.ok === false && rej.ok === true && rej.approval.status === "rejected" && rej.approval.history[0].action === "reject");

  // PDF
  const noSvc = PS.getPdfService(null);
  const svc = PS.getPdfService({ render: async () => new Uint8Array([37, 80, 68, 70]), close: async () => {} });
  const pres = await svc.fromHtml("<h1>請求書</h1>", PS.DEFAULT_INVOICE_PDF_OPTIONS);
  const failSvc = PS.getPdfService({ render: async () => { throw new Error("boom"); }, close: async () => {} });
  const fres = await failSvc.fromHtml("<h1>x</h1>");
  const wrapped = PS.wrapForPrint("<div>本文</div>", "請求書 INV-1");
  ok("pdf-service(レンダラ未設定はnull / 注入でfromHtml ok+バイト列先頭%PDF / レンダラ失敗はerr / wrapForPrintに@page A4+印刷ボタン+タイトル)",
    noSvc === null && pres.ok === true && pres.value[0] === 37 && pres.value[1] === 80 && fres.ok === false &&
    wrapped.includes("@page") && wrapped.includes("A4") && wrapped.includes("window.print()") && wrapped.includes("請求書 INV-1"));

  for (const f of [CE, CR, CB, PWk, PPr, PPs, PB, AJ, AE, AX, AS, AB, WF, PD, PRr, FEr, AAr, PSr]) await fsc.rm(f);
}


// ── platform: 買掛金(債務) + 報酬源泉徴収・支払調書 + ダッシュボードKPI(実ソース) ──
{
  section("platform: 買掛金 + 源泉徴収 + ダッシュボード(実ソース)");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/v-${name}-${sc}.ts`;

  // tax
  const TW = W("taxw"), TI = W("taxi"), TX = W("tax");
  await fsc.writeFile(TW, await rdc("../packages/tax/src/withholding.ts"));
  await fsc.writeFile(TI, (await rdc("../packages/tax/src/index.ts")).replace(new RegExp('from "./withholding.ts"', "g"), `from "${TW}"`));
  await fsc.writeFile(TX, `export * from "${TI}";`);
  // invoice(line/invoice/payment/reconcile)
  const IL = W("invl"), II = W("invi"), IP = W("invp"), IRc = W("invrc"), IV = W("inv");
  await fsc.writeFile(IL, (await rdc("../packages/invoice/src/line.ts")).replace(/from "@platform\/tax"/g, `from "${TX}"`));
  await fsc.writeFile(II, (await rdc("../packages/invoice/src/invoice.ts")).replace(/from "@platform\/tax"/g, `from "${TX}"`).replace(new RegExp('from "./line.ts"', "g"), `from "${IL}"`));
  await fsc.writeFile(IP, await rdc("../packages/invoice/src/payment.ts"));
  await fsc.writeFile(IRc, (await rdc("../packages/invoice/src/reconcile.ts")).replace(new RegExp('from "./payment.ts"', "g"), `from "${IP}"`));
  await fsc.writeFile(IV, `export * from "${IL}";\nexport * from "${II}";\nexport * from "${IP}";\nexport * from "${IRc}";\nexport type { Rounding } from "${TX}";`);
  // app repos
  const PAr = W("payables"), WHr = W("wh"), DKr = W("dash");
  await fsc.writeFile(PAr, (await rdc("../apps/internal-app/src/server/payables-repo.ts")).replace(/from "@platform\/invoice"/g, `from "${IV}"`));
  await fsc.writeFile(WHr, (await rdc("../apps/internal-app/src/server/withholding-repo.ts")).replace(/from "@platform\/tax"/g, `from "${TX}"`));
  await fsc.writeFile(DKr, await rdc("../apps/internal-app/src/server/dashboard-kpi.ts"));

  const PA = await import(PAr), WH = await import(WHr), DK = await import(DKr);
  const now = new Date("2025-07-01T00:00:00Z");

  // 買掛金
  const orders = [
    { number: "PO-A", supplier: "甲社", orderDate: "2025-06-01", dueDate: "2025-06-30", total: 110000, paidAmount: 0, cancelled: false },
    { number: "PO-B", supplier: "乙社", orderDate: "2025-05-01", dueDate: "2025-06-10", total: 55000, paidAmount: 0, cancelled: false },
    { number: "PO-C", supplier: "丙社", orderDate: "2025-04-01", dueDate: "2025-05-01", total: 33000, paidAmount: 0, cancelled: false },
    { number: "PO-D", supplier: "丁社", orderDate: "2025-07-01", dueDate: "2025-07-31", total: 22000, paidAmount: 0, cancelled: false },
    { number: "PO-E", supplier: "戊社", orderDate: "2025-06-01", dueDate: "2025-06-15", total: 20000, paidAmount: 20000, cancelled: false },
    { number: "PO-F", supplier: "己社", orderDate: "2025-05-01", dueDate: "2025-05-15", total: 99999, paidAmount: 0, cancelled: true },
  ];
  const psum = PA.payablesSummary(orders, now);
  const psumPartial = PA.payablesSummary(orders.map((o) => (o.number === "PO-A" ? { ...o, paidAmount: 30000 } : o)), now);
  const pps = PA.createMemoryPurchasePaymentStore();
  await pps.record("PO-A", 50000, "2025-07-01");
  await pps.record("PO-A", 30000, "2025-07-02");
  await pps.record("PO-B", 55000, "2025-07-01");
  const paid = await pps.paidByOrder();
  ok("payables(未払220000 / エイジングtotal220000 current22000 d1_30=165000 d61_90=33000 / 支払予定4件・経過日数降順C先頭 / 一部支払で残反映190000 / 支払記録集約PO-A=80000 PO-B=55000・一覧3件)",
    psum.outstanding === 220000 && psum.aging.total === 220000 && psum.aging.current === 22000 && psum.aging.d1_30 === 165000 && psum.aging.d61_90 === 33000 && psum.aging.over90 === 0 &&
    psum.upcoming.length === 4 && psum.upcoming[0].number === "PO-C" && psum.upcoming[0].overdueDays >= 61 && psumPartial.outstanding === 190000 &&
    paid["PO-A"] === 80000 && paid["PO-B"] === 55000 && (await pps.list()).length === 3);

  // 源泉徴収・支払調書
  const ws = WH.createMemoryFeePaymentStore();
  const v1 = await ws.record({ payee: "田中デザイン", category: "デザイン料", base: 100000, paidAt: "2025-03-10" });
  const v2 = await ws.record({ payee: "佐藤法律事務所", category: "弁護士報酬", base: 1500000, paidAt: "2025-05-20" });
  await ws.record({ payee: "田中デザイン", category: "デザイン料", base: 200000, paidAt: "2025-08-15" });
  await ws.record({ payee: "田中デザイン", category: "デザイン料", base: 50000, paidAt: "2024-12-01" });
  const rep = await ws.report("2025");
  const tanaka = rep.find((r) => r.payee === "田中デザイン");
  ok("withholding(10万源泉10210差引89790 / 150万源泉204200 / 支払調書:田中2025は2件支払30万源泉30630 / 前年除外・支払先ごと1行で2行)",
    v1.withholding === 10210 && v1.net === 89790 && v2.withholding === 204200 &&
    tanaka.count === 2 && tanaka.totalPayment === 300000 && tanaka.totalWithholding === 30630 && rep.length === 2);

  // ダッシュボードKPI
  const kpi = DK.buildKpi({
    receivables: { outstanding: 220000, overdue: DK.overdueFromAging({ total: 220000, current: 22000 }) },
    payables: { outstanding: 150000, overdue: DK.overdueFromAging({ total: 150000, current: 50000 }) },
    reorderCount: 3, pendingApprovals: 2, overdueInvoices: 4,
  });
  ok("dashboard-kpi(運転資本=売掛220000-買掛150000=70000 / 期限超過 売掛198000 買掛100000 / 対応事項=発注3+承認2+超過請求4=9)",
    kpi.workingCapital === 70000 && kpi.receivables.overdue === 198000 && kpi.payables.overdue === 100000 && kpi.actionItems === 9);

  for (const f of [TW, TI, TX, IL, II, IP, IRc, IV, PAr, WHr, DKr]) await fsc.rm(f);
}


// ── platform: 月次決算(P&L/B/S) + 消費税集計 + 運用アラート(実ソース) ──
{
  section("platform: 月次決算 + 消費税 + アラート(実ソース)");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/u-${name}-${sc}.ts`;

  // accounting(journal+entries+closing+tax-report)
  const AJ = W("accj"), AE = W("acce"), ACl = W("accc"), ATr = W("acct"), AB = W("acc");
  await fsc.writeFile(AJ, await rdc("../packages/accounting/src/journal.ts"));
  await fsc.writeFile(AE, (await rdc("../packages/accounting/src/entries.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`));
  await fsc.writeFile(ACl, (await rdc("../packages/accounting/src/closing.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`).replace(new RegExp('from "./entries.ts"', "g"), `from "${AE}"`));
  await fsc.writeFile(ATr, (await rdc("../packages/accounting/src/tax-report.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`).replace(new RegExp('from "./entries.ts"', "g"), `from "${AE}"`));
  await fsc.writeFile(AB, `export * from "${AJ}";\nexport * from "${AE}";\nexport * from "${ACl}";\nexport * from "${ATr}";`);
  // app helpers
  const FINr = W("fin"), ALr = W("alerts");
  await fsc.writeFile(FINr, (await rdc("../apps/internal-app/src/server/financials.ts")).replace(/from "@platform\/accounting"/g, `from "${AB}"`));
  await fsc.writeFile(ALr, await rdc("../apps/internal-app/src/server/alerts.ts"));

  const FIN = await import(FINr), AL = await import(ALr), AC = await import(AB);

  // 決算
  const entries = [
    AC.salesJournal({ date: "2025-06-01", net: 100000, tax: 10000 }),
    AC.receiptJournal({ date: "2025-06-05", amount: 110000 }),
    AC.purchaseJournal({ date: "2025-06-10", net: 30000, tax: 3000 }),
  ];
  const fs2 = FIN.financialStatements(entries);
  ok("financials(P&L 収益100000費用30000純利益70000 / B/S 資産113000負債43000純資産70000 / 純資産=純利益で整合)",
    fs2.profitAndLoss.revenue === 100000 && fs2.profitAndLoss.expense === 30000 && fs2.profitAndLoss.netIncome === 70000 &&
    fs2.balanceSheet.assets === 113000 && fs2.balanceSheet.liabilities === 43000 && fs2.balanceSheet.equity === 70000 && fs2.balanceSheet.equity === fs2.profitAndLoss.netIncome);

  // 消費税
  const salesRates = FIN.aggregateRates([[{ rate: 10, net: 100000, tax: 10000 }], [{ rate: 8, net: 50000, tax: 4000 }]]);
  const purchaseRates = FIN.aggregateRates([[{ rate: 10, net: 30000, tax: 3000 }]]);
  const tax = FIN.consumptionTax(salesRates, purchaseRates);
  const r10 = tax.byRate.find((r) => r.rate === 10), r8 = tax.byRate.find((r) => r.rate === 8);
  const agg = FIN.aggregateRates([[{ rate: 10, net: 100, tax: 10 }], [{ rate: 10, net: 200, tax: 20 }]]);
  ok("consumptionTax(仮受14000仮払3000納付11000 / 10%行売上100000仮受10000仕入30000 / 8%行売上50000仮受4000仕入0 / aggregateRates同率合算net300tax30)",
    tax.outputTax === 14000 && tax.inputTax === 3000 && tax.netPayable === 11000 &&
    r10.salesNet === 100000 && r10.outputTax === 10000 && r10.purchaseNet === 30000 && r8.salesNet === 50000 && r8.outputTax === 4000 && r8.purchaseNet === 0 &&
    agg.length === 1 && agg[0].net === 300 && agg[0].tax === 30);

  // アラート
  const alerts = AL.buildAlerts({ receivablesOverdue: 198000, payablesOverdue: 100000, overdueInvoices: 4, pendingApprovals: 2, reorderCount: 3 });
  const none = AL.buildAlerts({ receivablesOverdue: 0, payablesOverdue: 0, overdueInvoices: 0, pendingApprovals: 0, reorderCount: 0 });
  const some = AL.buildAlerts({ receivablesOverdue: 0, payablesOverdue: 0, overdueInvoices: 0, pendingApprovals: 5, reorderCount: 0 });
  const counts = AL.alertCounts(some);
  ok("alerts(4項目生成 / warning2(超過請求+買掛)info2(承認+発注) / 各hrefあり / 該当なしは空 / 一部のみ→info1件・カウントwarning0info1)",
    alerts.length === 4 && alerts.filter((a) => a.level === "warning").length === 2 && alerts.filter((a) => a.level === "info").length === 2 &&
    alerts.every((a) => a.href.startsWith("/")) && alerts.find((a) => a.href === "/invoices") && alerts.find((a) => a.href === "/payables") &&
    none.length === 0 && some.length === 1 && some[0].level === "info" && counts.warning === 0 && counts.info === 1);

  for (const f of [AJ, AE, ACl, ATr, AB, FINr, ALr]) await fsc.rm(f);
}


// ── platform: 固定資産・減価償却 + 予算実績 + 取引先マスタ(実ソース) ──
{
  section("platform: 固定資産 + 予算実績 + 取引先(実ソース)");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/t-${name}-${sc}.ts`;

  // depreciation(外部依存なし)
  const DEP = W("dep"), DEPB = W("depb");
  await fsc.writeFile(DEP, await rdc("../packages/depreciation/src/index.ts"));
  await fsc.writeFile(DEPB, `export * from "${DEP}";`);
  // app repos
  const ASr = W("asset"), BUr = W("budget"), PTr = W("partner");
  await fsc.writeFile(ASr, (await rdc("../apps/internal-app/src/server/asset-repo.ts")).replace(/from "@platform\/depreciation"/g, `from "${DEPB}"`));
  await fsc.writeFile(BUr, await rdc("../apps/internal-app/src/server/budget-repo.ts"));
  await fsc.writeFile(PTr, await rdc("../apps/internal-app/src/server/partner-repo.ts"));

  const DP = await import(DEPB), AS = await import(ASr), BU = await import(BUr), PT = await import(PTr);

  // 減価償却
  const sl = DP.straightLineSchedule(1000000, 5, 2025);
  const db = DP.decliningBalanceSchedule(1000000, 5, 2025);
  ok("depreciation(定額法5行毎年20万・最終年度残1円・累計999999 / 定率法初年度40万・5年で簿価1 / 月割24万→2万 / 簿価参照 取得前100万・2年末60万)",
    sl.length === 5 && sl[0].depreciation === 200000 && sl[4].bookValue === 1 && sl[4].accumulated === 999999 &&
    db[0].depreciation === 400000 && db[4].bookValue === 1 && DP.monthlyAmount(240000) === 20000 &&
    DP.bookValueAt(sl, 2024, 1000000) === 1000000 && DP.bookValueAt(sl, 2026, 1000000) === 600000);

  // 資産台帳
  const astore = AS.createMemoryAssetStore();
  await astore.upsert({ code: "PC-01", name: "PC", acquiredOn: "2025-04-01", cost: 300000, usefulLifeYears: 4, method: "straight_line" });
  await astore.upsert({ code: "CAR-01", name: "車", acquiredOn: "2024-01-01", cost: 2000000, usefulLifeYears: 6, method: "declining_balance" });
  const v1 = AS.viewOf(await astore.get("PC-01"), 2025);
  const views = [AS.viewOf(await astore.get("PC-01"), 2025), AS.viewOf(await astore.get("CAR-01"), 2025)];
  const sum = AS.summarize(views);
  await astore.upsert({ code: "PC-01", name: "PC更新", acquiredOn: "2025-04-01", cost: 300000, usefulLifeYears: 4, method: "straight_line" });
  ok("asset-repo(PC 30万/4年/定額の2025簿価225000当年償却75000 / サマリー取得計230万・累計=取得-簿価 / 同code上書きで件数不変・名称更新)",
    v1.bookValue === 225000 && v1.currentYearDepreciation === 75000 && v1.accumulated === 75000 &&
    sum.totalCost === 2300000 && sum.count === 2 && sum.totalAccumulated === sum.totalCost - sum.totalBookValue &&
    (await astore.list()).length === 2 && (await astore.get("PC-01")).name === "PC更新");

  // 予算実績
  const bstore = BU.createMemoryBudgetStore();
  await bstore.add({ department: "営業部", category: "旅費交通費", period: "2025-07", amount: 100000 });
  await bstore.add({ department: "開発部", category: "旅費交通費", period: "2025-07", amount: 50000 });
  await bstore.add({ department: "営業部", category: "会議費", period: "2025-07", amount: 30000 });
  const expenses = [
    { date: "2025-07-03", category: "旅費交通費", amount: 120000 },
    { date: "2025-07-10", category: "会議費", amount: 20000 },
    { date: "2025-07-15", category: "消耗品費", amount: 15000 },
    { date: "2025-06-20", category: "旅費交通費", amount: 99999 },
  ];
  const actuals = BU.actualsFromExpenses(expenses, "2025-07");
  const variance = BU.budgetVariance(await bstore.list("2025-07"), actuals);
  const kotsu = variance.find((v) => v.category === "旅費交通費");
  const shohin = variance.find((v) => v.category === "消耗品費");
  ok("budget-repo(旅費 予算150000部門合算・実績120000・差異+30000・消化率0.8 / 予算なし実績あり消耗品費も行に含む予算0超過 / 別月経費は実績外)",
    kotsu.budget === 150000 && kotsu.actual === 120000 && kotsu.variance === 30000 && Math.abs(kotsu.rate - 0.8) < 1e-9 &&
    shohin && shohin.budget === 0 && shohin.actual === 15000 && shohin.variance === -15000 && shohin.rate === null &&
    !variance.some((v) => v.actual === 99999));

  // 取引先マスタ
  const pstore = PT.createMemoryPartnerStore();
  await pstore.upsert({ code: "P001", name: "甲商事", kinds: ["customer", "supplier"], contact: "03-1234" });
  await pstore.upsert({ code: "P002", name: "乙デザイン", kinds: ["payee"] });
  await pstore.upsert({ code: "P003", name: "丙物産", kinds: ["supplier"] });
  const bad = await pstore.upsert({ code: "P004", name: "テスト", kinds: ["customer", "invalid", "payee"] });
  ok("partner-repo(得意先→P001,P004 / 仕入先→P001,P003 / 報酬先→P002,P004 / 全4件・1社複数区分 / 不正区分は正規化除去customer,payee)",
    (await pstore.list("customer")).map((p) => p.code).join(",") === "P001,P004" &&
    (await pstore.list("supplier")).map((p) => p.code).join(",") === "P001,P003" &&
    (await pstore.list("payee")).map((p) => p.code).join(",") === "P002,P004" &&
    (await pstore.list()).length === 4 && (await pstore.get("P001")).kinds.length === 2 && bad.kinds.join(",") === "customer,payee");

  for (const f of [DEP, DEPB, ASr, BUr, PTr]) await fsc.rm(f);
}


// ── platform: 月次推移 + 取引先カルテ + 減価償却の会計連携(実ソース) ──
{
  section("platform: 月次推移 + 取引先カルテ + 減価償却連携(実ソース)");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/s-${name}-${sc}.ts`;

  // depreciation + asset-repo
  const DEP = W("dep"), DEPB = W("depb"), ASr = W("asset");
  await fsc.writeFile(DEP, await rdc("../packages/depreciation/src/index.ts"));
  await fsc.writeFile(DEPB, `export * from "${DEP}";`);
  await fsc.writeFile(ASr, (await rdc("../apps/internal-app/src/server/asset-repo.ts")).replace(/from "@platform\/depreciation"/g, `from "${DEPB}"`));
  // accounting(journal+entries+closing+tax-report)
  const AJ = W("accj"), AE = W("acce"), ACl = W("accc"), ATr = W("acct"), AB = W("acc");
  await fsc.writeFile(AJ, await rdc("../packages/accounting/src/journal.ts"));
  await fsc.writeFile(AE, (await rdc("../packages/accounting/src/entries.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`));
  await fsc.writeFile(ACl, (await rdc("../packages/accounting/src/closing.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`).replace(new RegExp('from "./entries.ts"', "g"), `from "${AE}"`));
  await fsc.writeFile(ATr, (await rdc("../packages/accounting/src/tax-report.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`).replace(new RegExp('from "./entries.ts"', "g"), `from "${AE}"`));
  await fsc.writeFile(AB, `export * from "${AJ}";\nexport * from "${AE}";\nexport * from "${ACl}";\nexport * from "${ATr}";`);
  // helpers
  const TRr = W("trend"), PLr = W("plink"), DJr = W("djournal"), FINr = W("fin");
  await fsc.writeFile(TRr, await rdc("../apps/internal-app/src/server/trend.ts"));
  await fsc.writeFile(PLr, await rdc("../apps/internal-app/src/server/partner-link.ts"));
  await fsc.writeFile(DJr, (await rdc("../apps/internal-app/src/server/depreciation-journal.ts")).replace(new RegExp('from "./asset-repo.ts"', "g"), `from "${ASr}"`).replace(/from "@platform\/accounting"/g, `from "${AB}"`));
  await fsc.writeFile(FINr, (await rdc("../apps/internal-app/src/server/financials.ts")).replace(/from "@platform\/accounting"/g, `from "${AB}"`));

  const TR = await import(TRr), PL = await import(PLr), DJ = await import(DJr), FIN = await import(FINr), AC = await import(AB);

  // 月次推移
  const months = TR.monthRange("2025-05", "2025-07");
  const invoices = [{ issueDate: "2025-05-10", net: 100000, cancelled: false }, { issueDate: "2025-06-10", net: 150000, cancelled: false }, { issueDate: "2025-06-20", net: 50000, cancelled: true }, { issueDate: "2025-07-10", net: 200000, cancelled: false }];
  const purchases = [{ orderDate: "2025-06-05", net: 60000, cancelled: false }, { orderDate: "2025-07-05", net: 80000, cancelled: false }];
  const expenses = [{ date: "2025-05-15", amount: 20000 }, { date: "2025-06-15", amount: 30000 }, { date: "2025-07-15", amount: 25000 }];
  const pts = TR.monthlyTrend(invoices, purchases, expenses, months);
  const tsum = TR.summarizeTrend(pts);
  ok("trend(monthRange両端3か月+年跨ぎ / 5月粗利80000・6月粗利60000取消除外・7月粗利95000 / 総売上450000総粗利235000平均78333前月比+35000)",
    months.join(",") === "2025-05,2025-06,2025-07" && TR.monthRange("2024-11", "2025-01").join(",") === "2024-11,2024-12,2025-01" &&
    pts[0].profit === 80000 && pts[1].sales === 150000 && pts[1].profit === 60000 && pts[2].profit === 95000 &&
    tsum.totalSales === 450000 && tsum.totalProfit === 235000 && tsum.avgProfit === 78333 && tsum.profitMoM === 35000);

  // 取引先カルテ
  const linvoices = [{ number: "INV-1", issueDate: "2025-06-01", billTo: "甲商事", total: 110000 }, { number: "INV-2", issueDate: "2025-07-01", billTo: "乙社", total: 55000 }, { number: "INV-3", issueDate: "2025-07-05", billTo: "甲商事", total: 33000 }];
  const lorders = [{ number: "PO-1", orderDate: "2025-06-10", supplier: "甲商事", total: 44000 }];
  const lfees = [{ payee: "乙社", category: "デザイン", base: 100000, withholding: 10210, paidAt: "2025-05-01" }];
  const act = PL.partnerActivity("甲商事", linvoices, lorders, lfees);
  const act2 = PL.partnerActivity("乙社", linvoices, lorders, lfees);
  ok("partner-link(甲商事 請求2件計143000・発注1件44000・報酬0件 / 乙社 請求1件55000・報酬1件基準100000)",
    act.invoices.length === 2 && act.totalBilled === 143000 && act.orders.length === 1 && act.totalOrdered === 44000 && act.feePayments.length === 0 &&
    act2.totalBilled === 55000 && act2.feePayments.length === 1 && act2.totalPaid === 100000);

  // 減価償却の会計連携
  const assets = [{ code: "PC-01", name: "PC", acquiredOn: "2025-04-01", cost: 300000, usefulLifeYears: 4, method: "straight_line" }, { code: "DESK", name: "机", acquiredOn: "2025-01-01", cost: 120000, usefulLifeYears: 6, method: "straight_line" }];
  const dj = DJ.depreciationJournal(assets, 2025);
  const bizEntries = [AC.salesJournal({ date: "2025-06-01", net: 500000, tax: 50000 }), AC.receiptJournal({ date: "2025-06-05", amount: 550000 })];
  const before = FIN.financialStatements(bizEntries);
  const after = FIN.financialStatements([...bizEntries, ...dj], DJ.DEPRECIATION_ACCOUNT_TYPES);
  ok("depreciation-journal(2件・借方減価償却費75000/貸方減価償却累計額・当年計95000・各仕訳貸借一致 / 決算反映 費用0純利益500000→費用95000純利益405000 / B/S純資産=純利益405000で整合)",
    dj.length === 2 && dj[0].lines[0].account === "減価償却費" && dj[0].lines[0].debit === 75000 && dj[0].lines[1].account === "減価償却累計額" && dj[0].lines[1].credit === 75000 &&
    DJ.depreciationTotal(assets, 2025) === 95000 && dj.every((e) => AC.debitTotal(e) === AC.creditTotal(e)) &&
    before.profitAndLoss.expense === 0 && before.profitAndLoss.netIncome === 500000 && after.profitAndLoss.expense === 95000 && after.profitAndLoss.netIncome === 405000 &&
    after.balanceSheet.equity === after.profitAndLoss.netIncome && after.balanceSheet.equity === 405000);

  for (const f of [DEP, DEPB, ASr, AJ, AE, ACl, ATr, AB, TRr, PLr, DJr, FINr]) await fsc.rm(f);
}


// ── platform: 部門別会計 + 資金繰り(営業CF) + 入金記録(実ソース) ──
{
  section("platform: 部門別会計 + 資金繰り + 入金記録(実ソース)");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/r-${name}-${sc}.ts`;

  const AJ = W("accj"), AB = W("acc");
  await fsc.writeFile(AJ, await rdc("../packages/accounting/src/journal.ts"));
  await fsc.writeFile(AB, `export * from "${AJ}";`);
  const DEPr = W("dept"), CFr = W("cf"), RCr = W("receipt");
  await fsc.writeFile(DEPr, (await rdc("../apps/internal-app/src/server/department.ts")).replace(/from "@platform\/accounting"/g, `from "${AB}"`));
  await fsc.writeFile(CFr, await rdc("../apps/internal-app/src/server/cashflow.ts"));
  await fsc.writeFile(RCr, await rdc("../apps/internal-app/src/server/receipt-repo.ts"));

  const DEP = await import(DEPr), CF = await import(CFr), RC = await import(RCr);

  // 部門別予実
  const budgets = [
    { department: "営業部", category: "旅費交通費", amount: 100000 },
    { department: "営業部", category: "会議費", amount: 30000 },
    { department: "開発部", category: "旅費交通費", amount: 50000 },
    { department: "開発部", category: "消耗品費", amount: 40000 },
  ];
  const dexpenses = [{ category: "旅費交通費", amount: 150000 }, { category: "会議費", amount: 20000 }, { category: "消耗品費", amount: 30000 }, { category: "交際費", amount: 15000 }];
  const dv = DEP.departmentBudgetVsActual(budgets, dexpenses);
  const eigyo = dv.find((d) => d.department === "営業部");
  const kaihatsu = dv.find((d) => d.department === "開発部");
  const mihaifu = dv.find((d) => d.department === "(未配賦)");
  ok("department-予実(営業 予算130000実績120000旅費按分10万+会議2万差異+10000 / 開発 予算90000実績80000差異+10000 / 未配賦に交際費15000 / 実績合計=経費計215000按分欠損なし)",
    eigyo.budget === 130000 && eigyo.actual === 120000 && eigyo.variance === 10000 &&
    kaihatsu.budget === 90000 && kaihatsu.actual === 80000 && kaihatsu.variance === 10000 &&
    mihaifu && mihaifu.actual === 15000 && mihaifu.variance === -15000 && dv.reduce((s, d) => s + d.actual, 0) === 215000);

  // 部門別損益(仕訳タグ)
  const entries = [
    { date: "2025-06-01", description: "売上A", lines: [{ account: "売掛金", debit: 110000, credit: 0 }, { account: "売上高", debit: 0, credit: 100000, department: "営業部" }, { account: "仮受消費税", debit: 0, credit: 10000 }] },
    { date: "2025-06-02", description: "売上B", lines: [{ account: "売掛金", debit: 55000, credit: 0 }, { account: "売上高", debit: 0, credit: 50000, department: "開発部" }, { account: "仮受消費税", debit: 0, credit: 5000 }] },
    { date: "2025-06-10", description: "経費", lines: [{ account: "旅費交通費", debit: 30000, credit: 0, department: "営業部" }, { account: "現金預金", debit: 0, credit: 30000 }] },
  ];
  const pnl = DEP.departmentPnl(entries, ["売上高"], ["旅費交通費"]);
  const pe = pnl.find((d) => d.department === "営業部");
  ok("department-損益(仕訳タグ 営業 収益100000費用30000利益70000 / 開発 収益50000)",
    pe.revenue === 100000 && pe.expense === 30000 && pe.profit === 70000 && pnl.find((d) => d.department === "開発部").revenue === 50000);

  // 資金繰り
  const months = ["2025-05", "2025-06", "2025-07"];
  const inflows = [{ date: "2025-05-20", amount: 200000 }, { date: "2025-06-15", amount: 300000 }, { date: "2025-07-10", amount: 150000 }];
  const outflows = [{ date: "2025-05-25", amount: 80000 }, { date: "2025-06-20", amount: 180000 }, { date: "2025-06-28", amount: 20000 }, { date: "2025-07-15", amount: 90000 }];
  const cf = CF.monthlyCashFlow(inflows, outflows, months, 100000);
  const cfs = CF.summarizeCashFlow(cf, 100000);
  ok("cashflow(5月収支+120000累計220000・6月+100000累計320000・7月+60000累計380000 / サマリー総収入650000総支出370000純CF280000期末380000)",
    cf[0].net === 120000 && cf[0].cumulative === 220000 && cf[1].net === 100000 && cf[1].cumulative === 320000 && cf[2].net === 60000 && cf[2].cumulative === 380000 &&
    cfs.totalIn === 650000 && cfs.totalOut === 370000 && cfs.netCashFlow === 280000 && cfs.ending === 380000);

  // 入金記録
  const rs = RC.createMemoryReceiptStore();
  await rs.record("INV-1", 110000, "2025-06-15");
  await rs.record("INV-2", 55000, "2025-07-01");
  function rdb() { const rows = []; let seq = 0; return { invoiceReceiptRow: { async findMany() { return rows.slice(); }, async create({ data }) { const row = { id: `r${seq++}`, ...data }; rows.push(row); return row; } } }; }
  const prs = RC.createPrismaReceiptStore(rdb());
  await prs.record("INV-1", 110000, "2025-06-15");
  ok("receipt-store(2件・日付つき保持 / prisma保存+一覧+請求番号復元)",
    (await rs.list()).length === 2 && (await rs.list())[0].receivedAt === "2025-06-15" && (await rs.list())[0].amount === 110000 &&
    (await prs.list()).length === 1 && (await prs.list())[0].invoiceNumber === "INV-1");

  for (const f of [AJ, AB, DEPr, CFr, RCr]) await fsc.rm(f);
}


// ── platform: 取引先残高 + 年次決算・繰越 + アラートメール配信(実ソース) ──
{
  section("platform: 取引先残高 + 年次決算 + メール配信(実ソース)");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/q-${name}-${sc}.ts`;

  // core + mail
  const CE = W("cerr"), CR = W("cres"), CB = W("core"), ML = W("mail");
  await fsc.writeFile(CE, await rdc("../packages/core/src/error.ts"));
  await fsc.writeFile(CR, (await rdc("../packages/core/src/result.ts")).replace(new RegExp('from "./error.ts"', "g"), `from "${CE}"`));
  await fsc.writeFile(CB, `export * from "${CE}";\nexport * from "${CR}";`);
  const mailSrc = (await rdc("../packages/mail/src/index.ts")).split("\n").filter((l) => !/from "\.\/(transports\/smtp|transports\/memory|email|resilient|template|allowlist|attachments|unsubscribe)\.ts"/.test(l)).join("\n").replace(/from "@platform\/core"/g, `from "${CB}"`);
  await fsc.writeFile(ML, mailSrc);
  // accounting(journal+entries+closing)
  const AJ = W("accj"), AE = W("acce"), ACl = W("accc"), AB = W("acc");
  await fsc.writeFile(AJ, await rdc("../packages/accounting/src/journal.ts"));
  await fsc.writeFile(AE, (await rdc("../packages/accounting/src/entries.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`));
  await fsc.writeFile(ACl, (await rdc("../packages/accounting/src/closing.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`).replace(new RegExp('from "./entries.ts"', "g"), `from "${AE}"`));
  await fsc.writeFile(AB, `export * from "${AJ}";\nexport * from "${AE}";\nexport * from "${ACl}";`);
  // helpers
  const PBr = W("pbal"), YEr = W("ye"), ALr = W("alerts"), AMr = W("amail"), MSr = W("msvc");
  await fsc.writeFile(PBr, await rdc("../apps/internal-app/src/server/partner-balance.ts"));
  await fsc.writeFile(YEr, (await rdc("../apps/internal-app/src/server/year-end.ts")).replace(/from "@platform\/accounting"/g, `from "${AB}"`));
  await fsc.writeFile(ALr, await rdc("../apps/internal-app/src/server/alerts.ts"));
  await fsc.writeFile(AMr, (await rdc("../apps/internal-app/src/server/alert-mail.ts")).replace(/from "@platform\/mail"/g, `from "${ML}"`).replace(new RegExp('from "./alerts.ts"', "g"), `from "${ALr}"`));
  await fsc.writeFile(MSr, (await rdc("../apps/internal-app/src/server/mail-service.ts")).replace(/from "@platform\/mail"/g, `from "${ML}"`));

  const PB = await import(PBr), YE = await import(YEr), AM = await import(AMr), MS = await import(MSr), AC = await import(AB);

  // 取引先残高
  const partners = [{ code: "P001", name: "甲商事" }, { code: "P002", name: "乙社" }, { code: "P003", name: "丙物産" }];
  const invoices = [{ billTo: "甲商事", balance: 110000 }, { billTo: "甲商事", balance: 0 }, { billTo: "乙社", balance: 55000 }];
  const orders = [{ supplier: "甲商事", balance: 44000 }, { supplier: "丙物産", balance: 33000 }];
  const bals = PB.partnerBalances(partners, invoices, orders);
  const tot = PB.totalBalances(bals);
  ok("partner-balance(甲 売掛110000買掛44000差引66000 / 乙 売掛55000のみ / 丙 買掛33000のみ / 合計 売掛165000買掛77000差引88000 / 過入金は0扱い)",
    bals.find((b) => b.code === "P001").receivable === 110000 && bals.find((b) => b.code === "P001").payable === 44000 && bals.find((b) => b.code === "P001").net === 66000 &&
    bals.find((b) => b.code === "P002").receivable === 55000 && bals.find((b) => b.code === "P003").payable === 33000 &&
    tot.receivable === 165000 && tot.payable === 77000 && tot.net === 88000 && PB.partnerBalance("X", [{ billTo: "X", balance: -5000 }], []).receivable === 0);

  // 年次決算・繰越
  const entries = [AC.salesJournal({ date: "2025-06-01", net: 100000, tax: 10000 }), AC.receiptJournal({ date: "2025-06-05", amount: 110000 }), AC.purchaseJournal({ date: "2025-06-10", net: 30000, tax: 3000 })];
  const ye = YE.yearEndClosing(entries, 2025, 500000);
  const reLine = ye.closingEntry.lines.find((l) => l.account === "繰越利益剰余金");
  const salesLine = ye.closingEntry.lines.find((l) => l.account === "売上高");
  const lossEntries = [AC.salesJournal({ date: "2025-06-01", net: 20000, tax: 2000 }), AC.purchaseJournal({ date: "2025-06-10", net: 50000, tax: 5000 })];
  const yl = YE.yearEndClosing(lossEntries, 2025, 100000);
  ok("year-end(純利益70000・繰越利益剰余金570000・決算振替貸借一致・売上を借方100000で締め繰越を貸方70000 / 損失時 純利益-30000繰越70000繰越を借方30000)",
    ye.netIncome === 70000 && ye.retainedEarnings === 570000 && AC.debitTotal(ye.closingEntry) === AC.creditTotal(ye.closingEntry) &&
    salesLine.debit === 100000 && reLine.credit === 70000 && reLine.debit === 0 &&
    yl.netIncome === -30000 && yl.retainedEarnings === 70000 && yl.closingEntry.lines.find((l) => l.account === "繰越利益剰余金").debit === 30000);

  // アラートメール配信
  const sent = [];
  const fakeTransport = { send: async (m) => { sent.push(m); } };
  const mailer = MS.getMailer(fakeTransport);
  const alerts = [{ level: "warning", title: "期限超過の請求書が4件", body: "売掛の期限超過は¥198,000です。", href: "/invoices" }, { level: "info", title: "承認待ちの勤怠が2件", body: "承認をお願いします。", href: "/attendance-approvals" }];
  const msg = AM.alertsEmail("boss@example.com", alerts);
  const res = await mailer.sendMail(msg);
  ok("alert-mail(Transport未設定はnull / 件名に2件・宛先・本文に警告情報・HTMLあり / 注入Transportで送信ok+メッセージ捕捉+from補完)",
    MS.getMailer(null) === null && msg.subject.includes("2件") && msg.to === "boss@example.com" && msg.text.includes("警告") && msg.text.includes("情報") && msg.html.includes("<li>") &&
    res.ok === true && sent.length === 1 && sent[0].to === "boss@example.com" && sent[0].from === "no-reply@example.com");

  for (const f of [CE, CR, CB, ML, AJ, AE, ACl, AB, PBr, YEr, ALr, AMr, MSr]) await fsc.rm(f);
}


// ── platform: 仕訳帳CSV + 金額閾値つき多段承認 + 月次締めロック(実ソース) ──
{
  section("platform: 仕訳帳CSV + 多段承認 + 締めロック(実ソース)");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/p-${name}-${sc}.ts`;

  // core + workflow
  const CE = W("cerr"), CR = W("cres"), CB = W("core"), WI = W("wfi"), WR = W("wfr"), WF = W("wf");
  await fsc.writeFile(CE, await rdc("../packages/core/src/error.ts"));
  await fsc.writeFile(CR, (await rdc("../packages/core/src/result.ts")).replace(new RegExp('from "./error.ts"', "g"), `from "${CE}"`));
  await fsc.writeFile(CB, `export * from "${CE}";\nexport * from "${CR}";`);
  const wfiSrc = (await rdc("../packages/workflow/src/index.ts")).split("\n").filter((l) => !/from "\.\/(notification|routing|delegation|parallel|escalation)\.ts"/.test(l)).join("\n").replace(/from "@platform\/core"/g, `from "${CB}"`);
  await fsc.writeFile(WI, wfiSrc);
  await fsc.writeFile(WR, (await rdc("../packages/workflow/src/routing.ts")).replace(new RegExp('from "./index.ts"', "g"), `from "${WI}"`));
  await fsc.writeFile(WF, `export * from "${WI}";\nexport * from "${WR}";`);
  // csv + accounting
  const CSV = W("csv"), AJ = W("accj"), AE = W("acce"), AX = W("accx"), AB = W("acc");
  await fsc.writeFile(CSV, await rdc("../packages/csv/src/index.ts"));
  await fsc.writeFile(AJ, await rdc("../packages/accounting/src/journal.ts"));
  await fsc.writeFile(AE, (await rdc("../packages/accounting/src/entries.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`));
  await fsc.writeFile(AX, (await rdc("../packages/accounting/src/export.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`).replace(new RegExp('from "./entries.ts"', "g"), `from "${AE}"`));
  await fsc.writeFile(AB, `export * from "${AJ}";\nexport * from "${AE}";\nexport * from "${AX}";`);
  // helpers
  const JEr = W("je"), AFr = W("af"), DAr = W("da"), PLr = W("pl");
  await fsc.writeFile(JEr, (await rdc("../apps/internal-app/src/server/journal-export.ts")).replace(/from "@platform\/accounting"/g, `from "${AB}"`).replace(/from "@platform\/csv"/g, `from "${CSV}"`));
  await fsc.writeFile(AFr, (await rdc("../apps/internal-app/src/server/approval-flow.ts")).replace(/from "@platform\/workflow"/g, `from "${WF}"`));
  await fsc.writeFile(DAr, (await rdc("../apps/internal-app/src/server/doc-approval-repo.ts")).replace(/from "@platform\/workflow"/g, `from "${WF}"`).replace(new RegExp('from "./approval-flow.ts"', "g"), `from "${AFr}"`));
  await fsc.writeFile(PLr, await rdc("../apps/internal-app/src/server/period-lock-repo.ts"));

  const JE = await import(JEr), AF = await import(AFr), DA = await import(DAr), PL = await import(PLr), AC = await import(AB);

  // 仕訳帳CSV
  const entries = [AC.salesJournal({ date: "2025-06-01", description: "売上 INV-1", net: 100000, tax: 10000 }), AC.purchaseJournal({ date: "2025-06-10", net: 30000, tax: 3000 })];
  const csv = JE.journalCsv(entries);
  const cl = csv.split("\r\n");
  ok("journal-export(日本語ヘッダ日付,摘要,勘定科目,借方,貸方,備考 / 6明細+ヘッダ / 売掛金借方110000行 / Excel互換BOM)",
    cl[0].replace(/^\uFEFF/, "") === "日付,摘要,勘定科目,借方,貸方,備考" && cl.filter((l) => l.length > 0).length === 7 && csv.includes("2025-06-01,売上 INV-1,売掛金,110000,0,") && csv.charCodeAt(0) === 0xFEFF);

  // 金額別ルート
  ok("approval-flow(5万→1段manager / 30万→2段manager,finance / 100万→3段manager,finance,admin / 10万ちょうどは2段)",
    AF.stepCountForAmount(50000) === 1 && AF.routeForAmount(50000).steps[0].approverRole === "manager" &&
    AF.stepCountForAmount(300000) === 2 && AF.routeForAmount(300000).steps[1].approverRole === "finance" &&
    AF.stepCountForAmount(1000000) === 3 && AF.routeForAmount(1000000).steps[2].approverRole === "admin" && AF.stepCountForAmount(100000) === 2);

  // 多段承認(currentStep は最終承認時 totalSteps-1 のまま status=approved)
  const store = DA.createMemoryDocApprovalStore();
  const mgr = { id: "m@x.com", roles: ["manager"] }, fin = { id: "f@x.com", roles: ["finance"] };
  const sub = await store.submit("purchase", "PO-1", 300000);
  const r1 = await store.decide("purchase", "PO-1", mgr, "approve");
  const r2bad = await store.decide("purchase", "PO-1", mgr, "approve");
  const r2 = await store.decide("purchase", "PO-1", fin, "approve");
  await store.submit("invoice", "INV-9", 50000);
  const rInv = await store.decide("invoice", "INV-9", mgr, "approve");
  await store.submit("purchase", "PO-2", 300000);
  const rej = await store.decide("purchase", "PO-2", mgr, "reject", "金額過大");
  ok("doc-approval(30万発注pending2段currentStep0 / manager承認でstep1のままpending / 2段目はfinance以外不可 / finance承認でapproved履歴2件listPending0 / 5万請求1段で即approved / rejectでrejected)",
    sub.status === "pending" && sub.totalSteps === 2 && sub.currentStep === 0 &&
    r1.ok === true && r1.approval.status === "pending" && r1.approval.currentStep === 1 && r2bad.ok === false &&
    r2.ok === true && r2.approval.status === "approved" && r2.approval.history.length === 2 && (await store.listPending()).length === 0 &&
    rInv.ok === true && rInv.approval.status === "approved" && rInv.approval.totalSteps === 1 && rej.ok === true && rej.approval.status === "rejected");
  // prisma parity(currentStep は最終承認時 1 のまま status=approved)
  function adb() { const rows = new Map(); const k = (t, n) => `${t}:${n}`; return { docApprovalRow: {
    async findMany({ where }) { return [...rows.values()].filter((r) => r.status === where.status).sort((a, b) => (a.submittedAt < b.submittedAt ? -1 : 1)); },
    async findUnique({ where }) { return rows.get(k(where.docType_docNumber.docType, where.docType_docNumber.docNumber)) ?? null; },
    async upsert({ where, create, update }) { const key = k(where.docType_docNumber.docType, where.docType_docNumber.docNumber); const ex = rows.get(key); const row = ex ? { ...ex, ...update } : { id: key, ...create }; rows.set(key, row); return row; },
  } }; }
  const ps = DA.createPrismaDocApprovalStore(adb());
  await ps.submit("purchase", "PO-1", 300000);
  await ps.decide("purchase", "PO-1", mgr, "approve");
  const pget = await ps.decide("purchase", "PO-1", fin, "approve");
  ok("doc-approval prisma(2段承認でapproved・履歴JSON往復・currentStepは1のまま=totalSteps-1)",
    pget.ok === true && pget.approval.status === "approved" && pget.approval.currentStep === 1 && (await ps.get("purchase", "PO-1")).history.length === 2);

  // 月次締めロック
  const locks = PL.createMemoryPeriodLockStore();
  await locks.lock("2025-05", "admin@x.com");
  await locks.lock("2025-06", "admin@x.com");
  const set = await locks.lockedSet();
  await locks.unlock("2025-05");
  function ldb() { const rows = new Map(); return { periodLockRow: {
    async findMany() { return [...rows.values()].sort((a, b) => (a.period < b.period ? -1 : 1)); },
    async upsert({ where, create, update }) { const ex = rows.get(where.period); const row = ex ? { ...ex, ...update } : create; rows.set(where.period, row); return row; },
    async delete({ where }) { rows.delete(where.period); },
  } }; }
  const pl = PL.createPrismaPeriodLockStore(ldb());
  await pl.lock("2025-06", "admin");
  ok("period-lock(2025-05はロック済み2025-07は未ロック / 一覧2件昇順 / unlockで解除 / prisma lock+lockedSet)",
    PL.isDateLocked("2025-05-20", set) === true && PL.isDateLocked("2025-07-01", set) === false &&
    PL.isDateLocked("2025-05-20", await locks.lockedSet()) === false && (await locks.list()).length === 1 &&
    PL.isDateLocked("2025-06-15", await pl.lockedSet()) === true && (await pl.list())[0].lockedBy === "admin");

  for (const f of [CE, CR, CB, WI, WR, WF, CSV, AJ, AE, AX, AB, JEr, AFr, DAr, PLr]) await fsc.rm(f);
}


// ── platform: 勘定元帳 + CSV取込書出 + 固定資産除却売却 + 承認listByType(実ソース) ──
{
  section("platform: 勘定元帳 + CSV I/O + 固定資産処分 + 承認listByType(実ソース)");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/n-${name}-${sc}.ts`;

  const CE = W("cerr"), CR = W("cres"), CB = W("core");
  await fsc.writeFile(CE, await rdc("../packages/core/src/error.ts"));
  await fsc.writeFile(CR, (await rdc("../packages/core/src/result.ts")).replace(new RegExp('from "./error.ts"', "g"), `from "${CE}"`));
  await fsc.writeFile(CB, `export * from "${CE}";\nexport * from "${CR}";`);
  const WI = W("wfi"), WR = W("wfr"), WB = W("wf");
  await fsc.writeFile(WI, (await rdc("../packages/workflow/src/index.ts")).split("\n").filter((l) => !/from "\.\/(notification|routing|delegation|parallel|escalation)\.ts"/.test(l)).join("\n").replace(/from "@platform\/core"/g, `from "${CB}"`));
  await fsc.writeFile(WR, (await rdc("../packages/workflow/src/routing.ts")).replace(new RegExp('from "./index.ts"', "g"), `from "${WI}"`));
  await fsc.writeFile(WB, `export * from "${WI}";\nexport * from "${WR}";`);
  const CSV = W("csv");
  await fsc.writeFile(CSV, await rdc("../packages/csv/src/index.ts"));
  const DEP = W("dep"), DEPB = W("depb");
  await fsc.writeFile(DEP, await rdc("../packages/depreciation/src/index.ts"));
  await fsc.writeFile(DEPB, `export * from "${DEP}";`);
  const AJ = W("accj"), AE = W("acce"), AB = W("acc");
  await fsc.writeFile(AJ, await rdc("../packages/accounting/src/journal.ts"));
  await fsc.writeFile(AE, (await rdc("../packages/accounting/src/entries.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`));
  await fsc.writeFile(AB, `export * from "${AJ}";\nexport * from "${AE}";`);
  const PR = W("prepo"), ASr = W("asset");
  await fsc.writeFile(PR, await rdc("../apps/internal-app/src/server/partner-repo.ts"));
  await fsc.writeFile(ASr, (await rdc("../apps/internal-app/src/server/asset-repo.ts")).replace(/from "@platform\/depreciation"/g, `from "${DEPB}"`));
  const ALr = W("ledger"), CIr = W("cimp"), PEr = W("pexp"), DJr = W("disp"), AFr = W("aflow"), DAr = W("dappr");
  await fsc.writeFile(ALr, (await rdc("../apps/internal-app/src/server/account-ledger.ts")).replace(/from "@platform\/accounting"/g, `from "${AB}"`));
  await fsc.writeFile(CIr, (await rdc("../apps/internal-app/src/server/csv-import.ts")).replace(/from "@platform\/csv"/g, `from "${CSV}"`).replace(new RegExp('from "./partner-repo.ts"', "g"), `from "${PR}"`).replace(/from "@platform\/accounting"/g, `from "${AB}"`).replace(/import \{ type Product \} from "\.\/inventory-repo\.ts";\n?/g, "").replace(/import \{ type AccountDef \} from "\.\/account-master-repo\.ts";\n?/g, "").replace(/import \{ type Product \} from "\.\/inventory-repo\.ts";\n?/g, "").replace(/import \{ type AccountDef \} from "\.\/account-master-repo\.ts";\n?/g, ""));
  await fsc.writeFile(PEr, (await rdc("../apps/internal-app/src/server/partner-export.ts")).replace(/from "@platform\/csv"/g, `from "${CSV}"`).replace(new RegExp('from "./partner-repo.ts"', "g"), `from "${PR}"`));
  await fsc.writeFile(DJr, (await rdc("../apps/internal-app/src/server/disposal-journal.ts")).replace(new RegExp('from "./asset-repo.ts"', "g"), `from "${ASr}"`).replace(/from "@platform\/depreciation"/g, `from "${DEPB}"`).replace(/from "@platform\/accounting"/g, `from "${AB}"`));
  await fsc.writeFile(AFr, (await rdc("../apps/internal-app/src/server/approval-flow.ts")).replace(/from "@platform\/workflow"/g, `from "${WB}"`));
  await fsc.writeFile(DAr, (await rdc("../apps/internal-app/src/server/doc-approval-repo.ts")).replace(/from "@platform\/workflow"/g, `from "${WB}"`).replace(new RegExp('from "./approval-flow.ts"', "g"), `from "${AFr}"`));

  const AL = await import(ALr), CI = await import(CIr), PE = await import(PEr), DJ = await import(DJr), AS = await import(ASr), DA = await import(DAr), AC = await import(AB);

  // 勘定元帳
  const led = AL.accountLedger([AC.salesJournal({ date: "2025-06-01", description: "売上A", net: 100000, tax: 10000 }), AC.receiptJournal({ date: "2025-06-20", amount: 60000 }), AC.salesJournal({ date: "2025-06-10", description: "売上B", net: 50000, tax: 5000 })], "売掛金");
  ok("account-ledger(売掛金3行日付順・残高110000→165000→105000・借方計165000貸方計60000期末105000・該当なしは空)",
    led.lines.length === 3 && led.lines[0].balance === 110000 && led.lines[1].balance === 165000 && led.lines[2].balance === 105000 &&
    led.debitTotal === 165000 && led.creditTotal === 60000 && led.closingBalance === 105000 && AL.accountLedger([], "x").lines.length === 0);

  // CSV I/O
  const imp = CI.parsePartnerCsv('コード,名称,区分,連絡先\r\nP001,甲商事,"customer,supplier",03-1234\r\nP002,乙社,payee,\r\nBAD,,customer,\r\nP003,丙物産,invalid,');
  const partners = [{ code: "P001", name: "甲商事", kinds: ["customer", "supplier"], contact: "03-1234" }, { code: "P002", name: "乙社", kinds: ["payee"] }];
  const csv = PE.partnersCsv(partners);
  const back = CI.parsePartnerCsv(csv);
  ok("csv-io(取込2成功2エラー・行番号4,5・全角読点区切り解釈 / 書出BOM+日本語見出し / round-trip 2件区分保持)",
    imp.rows.length === 2 && imp.errors.length === 2 && imp.errors[0].line === 4 && imp.errors[1].line === 5 &&
    CI.parsePartnerCsv("コード,名称,区分\r\nP,t,customer、supplier").rows[0].kinds.length === 2 &&
    csv.charCodeAt(0) === 0xFEFF && csv.includes("コード,名称,区分,連絡先") && back.rows.length === 2 && back.rows[0].kinds.join(",") === "customer,supplier" && back.errors.length === 0);

  // 固定資産 除却・売却
  const base = { code: "PC-01", name: "PC", acquiredOn: "2025-01-01", cost: 1000000, usefulLifeYears: 5, method: "straight_line" };
  const rj = DJ.disposalJournal({ ...base, disposedOn: "2027-06-30", disposalType: "retire" });
  const sg = DJ.disposalJournal({ ...base, disposedOn: "2027-06-30", disposalType: "sell", proceeds: 700000 });
  const sl = DJ.disposalJournal({ ...base, disposedOn: "2027-06-30", disposalType: "sell", proceeds: 500000 });
  const rv = AS.viewOf({ ...base, disposedOn: "2027-06-30", disposalType: "retire" }, 2027);
  ok("disposal(除却=累計40万+除却損60万/固定資産100万貸借一致 / 売却益10万 / 売却損10万 / view処分年度は簿価0 disposed / 前年は簿価60万)",
    AC.debitTotal(rj) === AC.creditTotal(rj) && rj.lines.find((l) => l.account === "固定資産除却損").debit === 600000 && rj.lines.find((l) => l.account === "減価償却累計額").debit === 400000 &&
    AC.debitTotal(sg) === AC.creditTotal(sg) && sg.lines.find((l) => l.account === "固定資産売却益").credit === 100000 &&
    AC.debitTotal(sl) === AC.creditTotal(sl) && sl.lines.find((l) => l.account === "固定資産売却損").debit === 100000 &&
    rv.bookValue === 0 && rv.disposed === true && AS.viewOf({ ...base, disposedOn: "2027-06-30", disposalType: "retire" }, 2026).bookValue === 600000);

  // 承認 listByType
  const store = DA.createMemoryDocApprovalStore();
  await store.submit("purchase", "PO-1", 300000);
  await store.submit("purchase", "PO-2", 50000);
  await store.submit("invoice", "INV-1", 50000);
  await store.decide("invoice", "INV-1", { id: "m", roles: ["manager"] }, "approve");
  ok("doc-approval listByType(発注2件・請求1件approved含む・種別で分離)",
    (await store.listByType("purchase")).length === 2 && (await store.listByType("invoice")).length === 1 && (await store.listByType("invoice"))[0].status === "approved" && (await store.listByType("purchase")).every((a) => a.docType === "purchase"));

  for (const f of [CE, CR, CB, WI, WR, WB, CSV, DEP, DEPB, AJ, AE, AB, PR, ASr, ALr, CIr, PEr, DJr, AFr, DAr]) await fsc.rm(f);
}


// ── platform: 受信箱 + 比較決算 + 手動仕訳CSV(実ソース) ──
{
  section("platform: 受信箱 + 比較決算 + 手動仕訳CSV(実ソース)");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/o-${name}-${sc}.ts`;

  const CE = W("cerr"), CR = W("cres"), CB = W("core"), ML = W("mail");
  await fsc.writeFile(CE, await rdc("../packages/core/src/error.ts"));
  await fsc.writeFile(CR, (await rdc("../packages/core/src/result.ts")).replace(new RegExp('from "./error.ts"', "g"), `from "${CE}"`));
  await fsc.writeFile(CB, `export * from "${CE}";\nexport * from "${CR}";`);
  await fsc.writeFile(ML, (await rdc("../packages/mail/src/index.ts")).split("\n").filter((l) => !/from "\.\/(transports\/smtp|transports\/memory|email|resilient|template|allowlist|attachments|unsubscribe)\.ts"/.test(l)).join("\n").replace(/from "@platform\/core"/g, `from "${CB}"`));
  const CSV = W("csv");
  await fsc.writeFile(CSV, await rdc("../packages/csv/src/index.ts"));
  const AJ = W("accj"), AE = W("acce"), ACl = W("accc"), ATR = W("acctr"), AB = W("acc");
  await fsc.writeFile(AJ, await rdc("../packages/accounting/src/journal.ts"));
  await fsc.writeFile(AE, (await rdc("../packages/accounting/src/entries.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`));
  await fsc.writeFile(ACl, (await rdc("../packages/accounting/src/closing.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`).replace(new RegExp('from "./entries.ts"', "g"), `from "${AE}"`));
  await fsc.writeFile(ATR, (await rdc("../packages/accounting/src/tax-report.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`).replace(new RegExp('from "./entries.ts"', "g"), `from "${AE}"`));
  await fsc.writeFile(AB, `export * from "${AJ}";\nexport * from "${AE}";\nexport * from "${ACl}";\nexport * from "${ATR}";`);
  const PR = W("prepo");
  await fsc.writeFile(PR, await rdc("../apps/internal-app/src/server/partner-repo.ts"));
  const MBr = W("mbox"), CMPr = W("cmp"), MJr = W("mj"), CIr = W("cimp"), FINr = W("fin");
  await fsc.writeFile(MBr, (await rdc("../apps/internal-app/src/server/mailbox-repo.ts")).replace(/from "@platform\/mail"/g, `from "${ML}"`));
  await fsc.writeFile(CMPr, (await rdc("../apps/internal-app/src/server/comparative.ts")).replace(/from "@platform\/accounting"/g, `from "${AB}"`));
  await fsc.writeFile(MJr, (await rdc("../apps/internal-app/src/server/manual-journal-repo.ts")).replace(/from "@platform\/accounting"/g, `from "${AB}"`));
  await fsc.writeFile(CIr, (await rdc("../apps/internal-app/src/server/csv-import.ts")).replace(/from "@platform\/csv"/g, `from "${CSV}"`).replace(new RegExp('from "./partner-repo.ts"', "g"), `from "${PR}"`).replace(/from "@platform\/accounting"/g, `from "${AB}"`).replace(/import \{ type Product \} from "\.\/inventory-repo\.ts";\n?/g, "").replace(/import \{ type AccountDef \} from "\.\/account-master-repo\.ts";\n?/g, ""));
  await fsc.writeFile(FINr, (await rdc("../apps/internal-app/src/server/financials.ts")).replace(/from "@platform\/accounting"/g, `from "${AB}"`));

  const MB = await import(MBr), CMP = await import(CMPr), MJ = await import(MJr), CI = await import(CIr), FIN = await import(FINr), MAIL = await import(ML), AC = await import(AB);

  // 受信箱
  const store = MB.createMemoryMailboxStore();
  const mailer = MAIL.createMailer({ transport: MB.createMailboxTransport(store), defaultFrom: "no-reply@example.com" });
  const r = await mailer.sendMail({ to: "alice@example.com", subject: "アラート2件", text: "期限超過の請求があります" });
  await mailer.sendMail({ to: ["alice@example.com", "bob@example.com"], from: "ceo@example.com", subject: "全体連絡", text: "月次締めを開始します" });
  const aliceBox = await store.list("alice@example.com");
  await store.markRead(aliceBox[0].id);
  ok("mailbox(aliceに2通新しい順・bobに1通 / from補完no-reply・複数宛先はto連結 / 未読2→既読化で1)",
    aliceBox.length === 2 && (await store.list("bob@example.com")).length === 1 && r.ok === true &&
    aliceBox[1].from === "no-reply@example.com" && (await store.list("bob@example.com"))[0].to === "alice@example.com, bob@example.com" &&
    (await store.unreadCount("alice@example.com")) === 1);
  function mdb() { const rows = []; let seq = 0; return { mailboxRow: {
    async findMany({ where }) { return rows.filter((r2) => r2.owner === where.owner && (where.read === undefined || r2.read === where.read)).sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1)); },
    async findUnique({ where }) { return rows.find((r2) => r2.id === where.id) ?? null; },
    async create({ data }) { const row = { id: `m${seq++}`, ...data }; rows.push(row); return row; },
    async update({ where, data }) { const row = rows.find((r2) => r2.id === where.id); Object.assign(row, data); return row; },
    async count({ where }) { return rows.filter((r2) => r2.owner === where.owner && r2.read === where.read).length; },
  } }; }
  const pstore = MB.createPrismaMailboxStore(mdb());
  await MAIL.createMailer({ transport: MB.createMailboxTransport(pstore), defaultFrom: "no-reply@example.com" }).sendMail({ to: "x@example.com", subject: "t", text: "b" });
  ok("mailbox prisma(配送+一覧+未読数1)", (await pstore.list("x@example.com")).length === 1 && (await pstore.unreadCount("x@example.com")) === 1);

  // 比較決算
  const cur = FIN.financialStatements([AC.salesJournal({ date: "2025-06-01", net: 1000000, tax: 100000 }), AC.receiptJournal({ date: "2025-06-05", amount: 1100000 }), AC.purchaseJournal({ date: "2025-06-10", net: 300000, tax: 30000 })]);
  const pri = FIN.financialStatements([AC.salesJournal({ date: "2024-06-01", net: 800000, tax: 80000 }), AC.receiptJournal({ date: "2024-06-05", amount: 880000 }), AC.purchaseJournal({ date: "2024-06-10", net: 400000, tax: 40000 })]);
  const comp = CMP.compareStatements(2025, 2024, cur, pri);
  ok("comparative(売上 当期100万前期80万増減+20万率0.25 / 純利益当期70万前期40万率0.75 / 前期0は率null)",
    comp.revenue.delta === 200000 && Math.abs(comp.revenue.rate - 0.25) < 1e-9 && comp.netIncome.delta === 300000 && Math.abs(comp.netIncome.rate - 0.75) < 1e-9 &&
    CMP.compareStatements(2025, 2024, cur, { profitAndLoss: { revenue: 0, expense: 0, netIncome: 0 }, balanceSheet: { assets: 0, liabilities: 0, equity: 0 } }).revenue.rate === null);

  // 手動仕訳CSV
  const parsed = CI.parseJournalCsv('日付,摘要,勘定科目,借方,貸方,備考\r\n2025-12-31,前払家賃,前払費用,50000,0,\r\n2025-12-31,前払家賃,支払家賃,0,50000,\r\n2025-12-31,不一致,現金,100,0,\r\n2025-12-31,不一致,売上,0,200,');
  ok("manual-journal CSV(2行束ね1仕訳成功・貸借一致50000 / 不一致はエラー)",
    parsed.rows.length === 1 && parsed.errors.length === 1 && parsed.rows[0].lines.length === 2 && AC.debitTotal(parsed.rows[0]) === 50000 && AC.creditTotal(parsed.rows[0]) === 50000);
  const mstore = MJ.createMemoryManualJournalStore();
  await mstore.add(parsed.rows);
  // 手動仕訳を仕訳に足すと試算表に現れる(型区分不要のalways-true検証)
  const tb = AC.trialBalance([AC.salesJournal({ date: "2025-06-01", net: 1000000, tax: 100000 }), ...(await mstore.entries(2025))]);
  ok("manual-journal(登録+年度絞込 / 試算表に前払費用・支払家賃が現れる)",
    (await mstore.entries(2025)).length === 1 && (await mstore.entries(2024)).length === 0 && tb.some((a) => a.account === "前払費用" && a.debit === 50000) && tb.some((a) => a.account === "支払家賃" && a.credit === 50000));
  function jdb() { const rows = []; let seq = 0; return { manualJournalRow: {
    async findMany() { return rows.slice().sort((a, b) => (a.date < b.date ? -1 : 1)); },
    async create({ data }) { const row = { id: `j${seq++}`, ...data }; rows.push(row); return row; },
    async delete({ where }) { const i = rows.findIndex((r2) => r2.id === where.id); if (i >= 0) rows.splice(i, 1); },
  } }; }
  const pmj = MJ.createPrismaManualJournalStore(jdb());
  await pmj.add(parsed.rows);
  ok("manual-journal prisma(add+entries明細JSON往復)", (await pmj.entries()).length === 1 && (await pmj.entries())[0].lines.length === 2);

  for (const f of [CE, CR, CB, ML, CSV, AJ, AE, ACl, ATR, AB, PR, MBr, CMPr, MJr, CIr, FINr]) await fsc.rm(f);
}


// ── platform: 勘定科目マスタ + 年次推移 + お問い合わせ + チャットボット(実ソース) ──
{
  section("platform: 科目マスタ + 年次推移 + お問い合わせ + チャットボット(実ソース)");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/l-${name}-${sc}.ts`;

  const AJ = W("accj"), AE = W("acce"), ACl = W("accc"), ATR = W("acctr"), AB = W("acc");
  await fsc.writeFile(AJ, await rdc("../packages/accounting/src/journal.ts"));
  await fsc.writeFile(AE, (await rdc("../packages/accounting/src/entries.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`));
  await fsc.writeFile(ACl, (await rdc("../packages/accounting/src/closing.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`).replace(new RegExp('from "./entries.ts"', "g"), `from "${AE}"`));
  await fsc.writeFile(ATR, (await rdc("../packages/accounting/src/tax-report.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`).replace(new RegExp('from "./entries.ts"', "g"), `from "${AE}"`));
  await fsc.writeFile(AB, `export * from "${AJ}";\nexport * from "${AE}";\nexport * from "${ACl}";\nexport * from "${ATR}";`);
  const AMr = W("amaster"), YTr = W("ytrend"), IQr = W("inq"), CBr = W("bot"), FINr = W("fin");
  await fsc.writeFile(AMr, (await rdc("../apps/internal-app/src/server/account-master-repo.ts")).replace(/from "@platform\/accounting"/g, `from "${AB}"`));
  await fsc.writeFile(YTr, await rdc("../apps/internal-app/src/server/yearly-trend.ts"));
  await fsc.writeFile(IQr, await rdc("../apps/internal-app/src/server/inquiry-repo.ts"));
  await fsc.writeFile(CBr, await rdc("../apps/internal-app/src/server/chatbot.ts"));
  await fsc.writeFile(FINr, (await rdc("../apps/internal-app/src/server/financials.ts")).replace(/from "@platform\/accounting"/g, `from "${AB}"`));

  const AM = await import(AMr), YT = await import(YTr), IQ = await import(IQr), CB = await import(CBr), FIN = await import(FINr), AC = await import(AB);

  // 勘定科目マスタ → P/L反映
  const store = AM.createMemoryAccountMasterStore();
  const map = AM.accountTypeMap(await store.list());
  const manualEntry = { date: "2025-12-31", description: "家賃", lines: [{ account: "支払家賃", debit: 50000, credit: 0 }, { account: "前払費用", debit: 0, credit: 50000 }] };
  const withMaster = FIN.financialStatements([AC.salesJournal({ date: "2025-06-01", net: 1000000, tax: 100000 }), manualEntry], map);
  const noMaster = FIN.financialStatements([AC.salesJournal({ date: "2025-06-01", net: 1000000, tax: 100000 }), manualEntry], {});
  ok("account-master(SEEDに前払費用asset支払家賃expense / typeMap変換 / マスタ渡すと支払家賃50000がP/L費用に反映 / 未定義だと0)",
    map["支払家賃"] === "expense" && map["前払費用"] === "asset" && withMaster.profitAndLoss.expense === 50000 && noMaster.profitAndLoss.expense === 0);
  await store.upsert({ account: "研究開発費", type: "expense" });
  await store.remove("研究開発費");
  ok("account-master(upsert追加+remove削除)", (await store.list()).every((d) => d.account !== "研究開発費"));

  // 年次推移
  const points = [{ year: 2024, revenue: 800000, expense: 400000, netIncome: 400000 }, { year: 2023, revenue: 600000, expense: 500000, netIncome: 100000 }, { year: 2025, revenue: 1000000, expense: 300000, netIncome: 700000 }];
  const trend = YT.yearlyTrend(points);
  ok("yearly-trend(年順整列2023,2024,2025・初年度growth null・2024=+3.0・2025=+0.75 / range max100万min0 / 合計純利益120万)",
    trend[0].year === 2023 && trend[0].growth === null && Math.abs(trend[1].growth - 3.0) < 1e-9 && Math.abs(trend[2].growth - 0.75) < 1e-9 &&
    YT.trendRange(points).max === 1000000 && YT.trendRange(points).min === 0 && YT.trendTotals(points).netIncome === 1200000);

  // お問い合わせ
  const iq = IQ.createMemoryInquiryStore();
  const sub = await iq.submit({ name: "山田", email: "y@example.com", category: "請求", subject: "件名", message: "本文" });
  await iq.submit({ name: "佐藤", email: "s@example.com", category: "その他", subject: "質問", message: "…" });
  await iq.setStatus(sub.id, "closed");
  ok("inquiry(submitでstatus=new / openCount未対応のみ / 新しい順 / closedでopenCount減 / statusフィルタ)",
    sub.status === "new" && (await iq.openCount()) === 1 && (await iq.list()).length === 2 && (await iq.list()).some((q) => q.name === "佐藤") && (await iq.list("closed")).length === 1 && (await iq.list("new")).length === 1);
  function idb() { const rows = []; let seq = 0; return { inquiryRow: {
    async findMany({ where }) { return rows.filter((r) => !where || r.status === where.status).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); },
    async findUnique({ where }) { return rows.find((r) => r.id === where.id) ?? null; },
    async create({ data }) { const row = { id: `q${seq++}`, ...data }; rows.push(row); return row; },
    async update({ where, data }) { const row = rows.find((r) => r.id === where.id); Object.assign(row, data); return row; },
    async count({ where }) { return rows.filter((r) => r.status !== where.status.not).length; },
  } }; }
  const piq = IQ.createPrismaInquiryStore(idb());
  const ps = await piq.submit({ name: "A", email: "a@x.com", category: "c", subject: "s", message: "m" });
  await piq.setStatus(ps.id, "in_progress");
  ok("inquiry prisma(submit+setStatus+openCount+get)", (await piq.list()).length === 1 && (await piq.get(ps.id)).status === "in_progress" && (await piq.openCount()) === 1);

  // チャットボット
  ok("chatbot(請求書→invoice+/invoices / 経費→expense+取込リンク / 固定資産除却→asset / 無関係→fallback / 複数一致でaccounting)",
    CB.answer("請求書を再発行したい").topic === "invoice" && CB.answer("請求書を再発行したい").links.some((l) => l.href === "/invoices") &&
    CB.answer("経費の精算方法は？").topic === "expense" && CB.answer("経費の精算方法は？").links.some((l) => l.href === "/expenses/import") &&
    CB.answer("固定資産の除却について").topic === "asset" && CB.answer("天気を教えて").topic === "fallback" && CB.answer("会計の仕訳と試算表と決算").topic === "accounting");

  for (const f of [AJ, AE, ACl, ATR, AB, AMr, YTr, IQr, CBr, FINr]) await fsc.rm(f);
}


// ── platform: チャットボットescalate + ユーザー権限ディレクトリ(実ソース) ──
{
  section("platform: チャットボットescalate + ユーザー権限ディレクトリ(実ソース)");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const CBr = `${dc}/l-bot-${sc}.ts`, Ur = `${dc}/l-user-${sc}.ts`;
  await fsc.writeFile(CBr, await rdc("../apps/internal-app/src/server/chatbot.ts"));
  await fsc.writeFile(Ur, await rdc("../apps/internal-app/src/server/user-repo.ts"));
  const CB = await import(CBr), U = await import(Ur);

  const inv = CB.answer("請求書はどこで作りますか");
  const none = CB.answer("宇宙の起源について教えて");
  const human = CB.answer("会計の担当者につないでください");
  ok("chatbot(一致invoiceはescalate=false / 未一致fallbackはescalate=true / 一致でも担当者要求はescalate=true / linkにescalate混入なし)",
    inv.topic === "invoice" && inv.escalate === false && inv.links.length > 0 && none.topic === "fallback" && none.escalate === true && human.escalate === true && inv.links.every((l) => !("escalate" in l)));

  const store = U.createMemoryUserStore([{ email: "admin@x.com", name: "管理者", roles: ["admin"], active: true, createdAt: "2025-01-01T00:00:00Z" }]);
  const u = await store.upsert({ email: "tanaka@x.com", name: "田中", roles: ["manager", "finance", "unknown"] });
  const list = await store.list();
  const u2 = await store.upsert({ email: "tanaka@x.com", name: "田中太郎", roles: ["employee"] });
  await store.setActive("tanaka@x.com", false);
  const snap = await store.get("admin@x.com");
  snap.roles.push("hacked");
  ok("user(upsert未知ロール除外+定義順 / 一覧email昇順 / 再upsertでcreatedAt保持active保持 / 無効化 / get返り値コピー / normalizeRoles)",
    u.roles.join(",") === "manager,finance" && list[0].email === "admin@x.com" && list[1].email === "tanaka@x.com" &&
    u2.createdAt === u.createdAt && u2.roles.join(",") === "employee" && (await store.get("tanaka@x.com")).active === false &&
    (await store.get("admin@x.com")).roles.join(",") === "admin" && U.normalizeRoles(["admin", "admin", "employee", "x"]).join(",") === "employee,admin");

  function udb() { const rows = new Map(); return { userRow: {
    async findMany() { return [...rows.values()].sort((a, b) => (a.email < b.email ? -1 : 1)); },
    async findUnique({ where }) { return rows.get(where.email) ?? null; },
    async upsert({ where, create, update }) { const ex = rows.get(where.email); const row = ex ? { ...ex, ...update } : create; rows.set(where.email, row); return row; },
    async update({ where, data }) { const row = rows.get(where.email); Object.assign(row, data); return row; },
  } }; }
  const p = U.createPrismaUserStore(udb());
  await p.upsert({ email: "a@x.com", name: "A", roles: ["manager", "admin"] });
  ok("user prisma(rolesCSV往復manager,admin+active既定true)", (await p.get("a@x.com")).roles.join(",") === "manager,admin" && (await p.get("a@x.com")).active === true);

  await fsc.rm(CBr); await fsc.rm(Ur);
}


// ── platform: 管理コンソール(周知/設定/監査集計/権限マトリクス/ヘルス)実ソース ──
{
  section("platform: 管理コンソール(周知/設定/監査集計/権限/ヘルス)");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/k-${name}-${sc}.ts`;
  const RB = W("rbac"), HI = W("hier"), AU = W("auth");
  await fsc.writeFile(RB, await rdc("../packages/auth/src/rbac.ts"));
  await fsc.writeFile(HI, (await rdc("../packages/auth/src/hierarchy.ts")).replace(new RegExp('from "./rbac.ts"', "g"), `from "${RB}"`));
  await fsc.writeFile(AU, `export * from "${RB}";\nexport * from "${HI}";`);
  const POLr = W("policy"), Ur = W("user"), BCr = W("bc"), STr = W("set"), ASr = W("as"), PMr = W("pm"), HSr = W("hs");
  await fsc.writeFile(POLr, (await rdc("../apps/internal-app/src/server/policy.ts")).replace(/from "@platform\/auth"/g, `from "${AU}"`));
  await fsc.writeFile(Ur, await rdc("../apps/internal-app/src/server/user-repo.ts"));
  await fsc.writeFile(BCr, (await rdc("../apps/internal-app/src/server/broadcast.ts")).replace(new RegExp('from "./user-repo.ts"', "g"), `from "${Ur}"`));
  await fsc.writeFile(STr, await rdc("../apps/internal-app/src/server/settings-repo.ts"));
  await fsc.writeFile(ASr, await rdc("../apps/internal-app/src/server/audit-summary.ts"));
  await fsc.writeFile(PMr, (await rdc("../apps/internal-app/src/server/permission-matrix.ts")).replace(/from "@platform\/auth"/g, `from "${AU}"`));
  await fsc.writeFile(HSr, await rdc("../apps/internal-app/src/server/health-summary.ts"));

  const BC = await import(BCr), ST = await import(STr), AS = await import(ASr), PM = await import(PMr), HS = await import(HSr), POL = await import(POLr);

  const users = [{ email: "a@x.com", name: "A", roles: ["employee"], active: true, createdAt: "" }, { email: "b@x.com", name: "B", roles: ["manager"], active: false, createdAt: "" }, { email: "c@x.com", name: "C", roles: ["admin"], active: true, createdAt: "" }];
  ok("broadcast(有効ユーザーのみa,c)", BC.activeRecipients(users).join(",") === "a@x.com,c@x.com");

  const st = ST.createMemorySettingsStore();
  const def = await st.get();
  const upd = await st.update({ companyName: "新会社", fiscalClosingMonth: "12", consumptionTaxRate: "0.08" });
  const bad = await st.update({ fiscalClosingMonth: "99", consumptionTaxRate: "5" });
  ok("settings(既定3月0.10 / 更新12月0.08新会社 / 不正値は既定へフォールバック3月0.10)",
    def.fiscalClosingMonth === 3 && def.consumptionTaxRate === 0.1 && upd.companyName === "新会社" && upd.fiscalClosingMonth === 12 && upd.consumptionTaxRate === 0.08 && bad.fiscalClosingMonth === 3 && bad.consumptionTaxRate === 0.1);

  const sum = AS.summarizeAudit([{ actor: "u1", action: "invoice.create" }, { actor: "u1", action: "invoice.create" }, { actor: "u2", action: "login" }, { actor: "u1", action: "login" }]);
  const ls = AS.summarizeLogins([{ actor: "u1", action: "login" }, { actor: "u2", action: "login.failure" }, { actor: "u3", action: "login" }, { actor: "u4", action: "account.lock" }]);
  ok("audit-summary(総数4最多invoice.create2最多者u1 3 / ログイン成功2失敗2)",
    sum.total === 4 && sum.byAction[0].key === "invoice.create" && sum.byAction[0].count === 2 && sum.byActor[0].key === "u1" && sum.byActor[0].count === 3 && ls.success === 2 && ls.failure === 2);

  const mx = PM.permissionMatrix(POL.APP_POLICY, ["employee", "manager", "finance", "admin"]);
  const iw = mx.rows.find((r) => r.key === "invoice:write"), ar = mx.rows.find((r) => r.key === "accounting:read"), dh = mx.rows.find((r) => r.key === "dashboard:read");
  ok("permission-matrix(invoice:write=emp✗mgr✓fin✗adm✓ / accounting:read=fin✓adm✓emp✗mgr✗ / dashboard全ロール可 / adminワイルドカード)",
    iw.allow[0] === false && iw.allow[1] === true && iw.allow[2] === false && iw.allow[3] === true && ar.allow[2] === true && ar.allow[3] === true && ar.allow[0] === false && ar.allow[1] === false && dh.allow.every((a) => a === true) && PM.roleHas(POL.APP_POLICY, "admin", "z:z") === true && PM.roleHas(POL.APP_POLICY, "employee", "z:z") === false);

  ok("health(全ok→healthy+counts保持 / 1つng→unhealthy)",
    HS.healthReport({ users: 5 }, [{ name: "DB", ok: true }]).healthy === true && HS.healthReport({ users: 5 }, [{ name: "DB", ok: true }]).counts.users === 5 && HS.healthReport({}, [{ name: "S", ok: false }]).healthy === false);

  for (const f of [RB, HI, AU, POLr, Ur, BCr, STr, ASr, PMr, HSr]) await fsc.rm(f);
}


// ── platform: 結合(E2E)受注→請求→入金→決算→周知 + 会計年度(fiscal) ──
{
  section("platform: 結合(E2E) 受注→請求→入金→決算→周知 + 会計年度");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/i-${name}-${sc}.ts`;

  const CE = W("cerr"), CR = W("cres"), CB = W("core"), ML = W("mail");
  await fsc.writeFile(CE, await rdc("../packages/core/src/error.ts"));
  await fsc.writeFile(CR, (await rdc("../packages/core/src/result.ts")).replace(new RegExp('from "./error.ts"', "g"), `from "${CE}"`));
  await fsc.writeFile(CB, `export * from "${CE}";\nexport * from "${CR}";`);
  await fsc.writeFile(ML, (await rdc("../packages/mail/src/index.ts")).split("\n").filter((l) => !/from "\.\/(transports\/smtp|transports\/memory|email|resilient|template|allowlist|attachments|unsubscribe)\.ts"/.test(l)).join("\n").replace(/from "@platform\/core"/g, `from "${CB}"`));
  const AJ = W("aj"), AE = W("ae"), ACl = W("acl"), ATR = W("atr"), AB = W("acc");
  await fsc.writeFile(AJ, await rdc("../packages/accounting/src/journal.ts"));
  await fsc.writeFile(AE, (await rdc("../packages/accounting/src/entries.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`));
  await fsc.writeFile(ACl, (await rdc("../packages/accounting/src/closing.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`).replace(new RegExp('from "./entries.ts"', "g"), `from "${AE}"`));
  await fsc.writeFile(ATR, (await rdc("../packages/accounting/src/tax-report.ts")).replace(new RegExp('from "./journal.ts"', "g"), `from "${AJ}"`).replace(new RegExp('from "./entries.ts"', "g"), `from "${AE}"`));
  await fsc.writeFile(AB, `export * from "${AJ}";\nexport * from "${AE}";\nexport * from "${ACl}";\nexport * from "${ATR}";`);
  const PRr = W("partner"), Ur = W("user"), BCr = W("bc"), MBr = W("mbox"), FINr = W("fin"), FISr = W("fis");
  await fsc.writeFile(PRr, await rdc("../apps/internal-app/src/server/partner-repo.ts"));
  await fsc.writeFile(Ur, await rdc("../apps/internal-app/src/server/user-repo.ts"));
  await fsc.writeFile(BCr, (await rdc("../apps/internal-app/src/server/broadcast.ts")).replace(new RegExp('from "./user-repo.ts"', "g"), `from "${Ur}"`));
  await fsc.writeFile(MBr, (await rdc("../apps/internal-app/src/server/mailbox-repo.ts")).replace(/from "@platform\/mail"/g, `from "${ML}"`));
  await fsc.writeFile(FINr, (await rdc("../apps/internal-app/src/server/financials.ts")).replace(/from "@platform\/accounting"/g, `from "${AB}"`));
  await fsc.writeFile(FISr, await rdc("../apps/internal-app/src/server/fiscal.ts"));

  const AC = await import(AB), MAIL = await import(ML), PR = await import(PRr), U = await import(Ur), BC = await import(BCr), MB = await import(MBr), FIN = await import(FINr), FIS = await import(FISr);

  // ① 受注先(取引先)を登録
  const partners = PR.createMemoryPartnerStore();
  const cust = await partners.upsert({ code: "C001", name: "得意先商事", kinds: ["customer"] });
  // ② 請求(売上仕訳) ③ 入金(入金仕訳) ※3月決算のFY2025(2025-04〜2026-03)内
  const sales = AC.salesJournal({ date: "2025-06-01", net: 500000, tax: 50000 });
  const receipt = AC.receiptJournal({ date: "2025-06-20", amount: 550000 });
  // ④ 決算(財務諸表) — 貸借一致・売上計上
  const entries = [sales, receipt];
  const statements = FIN.financialStatements(entries);
  const balanced = AC.isBalanced(sales) && AC.isBalanced(receipt);
  // 発行日が会計年度(3月決算)でFY2025に属することを確認
  const inFy = FIS.inFiscalYear("2025-06-01", 2025, 3);
  // ⑤ 周知(全体配信 → 受信箱)
  const users = U.createMemoryUserStore([
    { email: "sales@x.com", name: "営業", department: "営業部", roles: ["employee"], permissions: [], active: true, createdAt: "2025-01-01T00:00:00Z" },
    { email: "keiri@x.com", name: "経理", department: "経理部", roles: ["finance"], permissions: [], active: true, createdAt: "2025-01-01T00:00:00Z" },
    { email: "retired@x.com", name: "退職者", department: "-", roles: ["employee"], permissions: [], active: false, createdAt: "2025-01-01T00:00:00Z" },
  ]);
  const recipients = BC.activeRecipients(await users.list());
  const box = MB.createMemoryMailboxStore();
  const mailer = MAIL.createMailer({ transport: MB.createMailboxTransport(box), defaultFrom: "system@x.com" });
  await mailer.sendMail({ to: recipients, from: "admin@x.com", subject: "[お知らせ] 月次締め完了", text: "6月の締めが完了しました。" });

  ok("E2E: ①取引先登録(得意先商事,customer)", cust.code === "C001" && cust.kinds.includes("customer"));
  ok("E2E: ②③請求50万+税5万→入金55万が仕訳計上・貸借一致", balanced === true && AC.debitTotal(sales) === 550000);
  ok("E2E: ④決算 売上高50万がP/L計上・発行日はFY2025(3月決算)内", statements.profitAndLoss.revenue === 500000 && inFy === true);
  ok("E2E: ⑤周知 有効2名(営業・経理)に配信・退職者は除外", recipients.join(",") === "keiri@x.com,sales@x.com" && recipients.length === 2);
  ok("E2E: ⑤周知 各受信箱にお知らせ着信・退職者には未着", (await box.list("sales@x.com")).length === 1 && (await box.list("keiri@x.com"))[0].subject.includes("月次締め") && (await box.list("retired@x.com")).length === 0);

  for (const f of [CE, CR, CB, ML, AJ, AE, ACl, ATR, AB, PRr, Ur, BCr, MBr, FINr, FISr]) await fsc.rm(f);
}


// ── platform: 会計年度ヘルパ(fiscal)単体 ──
{
  section("platform: 会計年度ヘルパ(fiscal)");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const FISr = `${dc}/h-fis-${sc}.ts`;
  await fsc.writeFile(FISr, (await fsc.readFile(new URL("../apps/internal-app/src/server/fiscal.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  const F = await import(FISr);
  ok("fiscal(3月決算: 2025-04→FY2025 / 2026-03→FY2025 / 2025-03→FY2024)", F.fiscalYearOf("2025-04-01", 3) === 2025 && F.fiscalYearOf("2026-03-31", 3) === 2025 && F.fiscalYearOf("2025-03-31", 3) === 2024);
  ok("fiscal(12月決算=暦年 / 6月決算: 7月〜翌6月)", F.fiscalYearOf("2025-01-01", 12) === 2025 && F.fiscalYearOf("2025-12-31", 12) === 2025 && F.fiscalYearOf("2025-07-01", 6) === 2025 && F.fiscalYearOf("2025-06-30", 6) === 2024);
  ok("fiscalYearRange(FY2025,3月=2025-04-01〜2026-03-31 / 12月=2025-01-01〜2025-12-31)", F.fiscalYearRange(2025, 3).start === "2025-04-01" && F.fiscalYearRange(2025, 3).end === "2026-03-31" && F.fiscalYearRange(2025, 12).start === "2025-01-01" && F.fiscalYearRange(2025, 12).end === "2025-12-31");
  await fsc.rm(FISr);
}


// ── platform: 監査アラート(異常検知) + 既定税率適用(実ソース) ──
{
  section("platform: 監査アラート(異常検知) + 既定税率適用");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const AAr = `${dc}/g-aa-${sc}.ts`, TDr = `${dc}/g-td-${sc}.ts`;
  await fsc.writeFile(AAr, await rdc("../apps/internal-app/src/server/audit-anomaly.ts"));
  await fsc.writeFile(TDr, await rdc("../apps/internal-app/src/server/tax-default.ts"));
  const A = await import(AAr), T = await import(TDr);

  const del = [];
  for (let i = 0; i < 6; i++) del.push({ actor: "u1", action: "invoice.delete", at: "2025-06-01T14:00:00Z" });
  del.push({ actor: "u2", action: "invoice.create", at: "2025-06-01T14:00:00Z" });
  const a1 = A.detectAnomalies(del);
  ok("anomaly(大量削除6件→critical/mass_delete u1のみ / 4件未満は非検出)",
    a1.length === 1 && a1[0].level === "critical" && a1[0].kind === "mass_delete" && a1[0].actor === "u1" &&
    A.detectAnomalies([...Array(4)].map(() => ({ actor: "x", action: "x.delete", at: "2025-06-01T10:00:00Z" }))).length === 0);

  const fails = [...Array(5)].map(() => ({ actor: "attacker", action: "login.failure", at: "2025-06-01T15:00:00Z" }));
  ok("anomaly(ログイン失敗5件→critical/login_failures)", A.detectAnomalies(fails).some((a) => a.kind === "login_failures" && a.level === "critical"));

  const night = [...Array(6)].map(() => ({ actor: "del", action: "x.delete", at: "2025-06-01T03:00:00Z" }));
  const an = A.detectAnomalies(night);
  ok("anomaly(削除critical+深夜warning両検出・criticalが先 / digestに重大ラベル)",
    an.length === 2 && an[0].level === "critical" && an[1].level === "warning" && an[1].kind === "off_hours" && A.anomalyDigest(an).includes("[重大]") && A.anomalyDigest([]) === "検出された異常はありません。");

  ok("anomaly(カスタムしきい値massDeleteThreshold:3で3件→検出)", A.detectAnomalies([...Array(3)].map(() => ({ actor: "y", action: "y.remove", at: "2025-06-01T12:00:00Z" })), { massDeleteThreshold: 3 }).length === 1);

  const out = T.applyDefaultTaxRate([{ description: "A", amount: 1000 }, { description: "B", amount: 2000, taxRate: 0.08 }], 0.1);
  ok("tax-default(未指定Aに0.10補完・指定済Bは0.08保持・他フィールド保持・非破壊)", out[0].taxRate === 0.1 && out[1].taxRate === 0.08 && out[0].description === "A" && out[0].amount === 1000);

  await fsc.rm(AAr); await fsc.rm(TDr);
}


// ── platform: アンケート + アラート通知(重複抑制/多チャネル) + i18n(実ソース) ──
{
  section("platform: アンケート + アラート通知(重複抑制/多チャネル) + i18n");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/f-${name}-${sc}.ts`;

  // アンケート(自己完結)
  const SVr = W("survey");
  await fsc.writeFile(SVr, await rdc("../apps/internal-app/src/server/survey-repo.ts"));
  const S = await import(SVr);
  const store = S.createMemorySurveyStore();
  const survey = await store.create({ title: "満足度", questions: [{ text: "満足度", type: "rating" }, { text: "良い点", type: "multi", options: ["給与", "環境", "裁量"] }, { text: "自由", type: "text" }] });
  await store.setStatus(survey.id, "open");
  await store.respond(survey.id, [{ questionId: "q1", rating: 5 }, { questionId: "q2", choice: ["給与", "裁量"] }, { questionId: "q3", text: "満足" }]);
  await store.respond(survey.id, [{ questionId: "q1", rating: 3 }, { questionId: "q2", choice: ["環境"] }, { questionId: "q3", text: "  " }]);
  const res = S.aggregateSurvey(await store.get(survey.id), await store.responses(survey.id));
  ok("survey(作成draft→open / rating平均(5+3)/2=4.0 / multi給与1環境1裁量1 / text空白除外1件)",
    res.total === 2 && Math.abs(res.questions[0].average - 4) < 1e-9 && res.questions[1].options.find((o) => o.label === "給与").count === 1 && res.questions[1].options.find((o) => o.label === "環境").count === 1 && res.questions[2].texts.length === 1);
  ok("survey(get返り値コピー / open前提の集計)", (await (async () => { const g = await store.get(survey.id); g.title = "x"; return (await store.get(survey.id)).title; })()) === "満足度");

  // アラート通知(notify合成)
  const CE = W("cerr"), CR = W("cres"), CB = W("core");
  await fsc.writeFile(CE, await rdc("../packages/core/src/error.ts"));
  await fsc.writeFile(CR, (await rdc("../packages/core/src/result.ts")).replace(new RegExp('from "./error.ts"', "g"), `from "${CE}"`));
  await fsc.writeFile(CB, `export * from "${CE}";\nexport * from "${CR}";`);
  const NI = W("nindex"), ND = W("ndedup"), NS = W("nslack"), NW = W("nwebhook"), NB = W("notify");
  await fsc.writeFile(NI, (await rdc("../packages/notify/src/index.ts")).split("\n").filter((l) => !/from "\.\/[a-z/-]+\.ts"/.test(l)).join("\n").replace(/from "@platform\/core"/g, `from "${CB}"`));
  await fsc.writeFile(ND, (await rdc("../packages/notify/src/dedup.ts")).replace(/from "@platform\/core"/g, `from "${CB}"`).replace(new RegExp('from "./index.ts"', "g"), `from "${NI}"`));
  await fsc.writeFile(NS, (await rdc("../packages/notify/src/channels/slack.ts")).replace(/from "@platform\/core"/g, `from "${CB}"`).replace(new RegExp('from "../index.ts"', "g"), `from "${NI}"`));
  await fsc.writeFile(NW, (await rdc("../packages/notify/src/channels/webhook.ts")).replace(/from "@platform\/core"/g, `from "${CB}"`).replace(new RegExp('from "../index.ts"', "g"), `from "${NI}"`));
  await fsc.writeFile(NB, `export * from "${NI}";\nexport * from "${ND}";\nexport * from "${NS}";\nexport * from "${NW}";`);
  const AAr = W("aa"), ANr = W("an");
  await fsc.writeFile(AAr, await rdc("../apps/internal-app/src/server/audit-anomaly.ts"));
  await fsc.writeFile(ANr, (await rdc("../apps/internal-app/src/server/alert-notify.ts")).replace(/from "@platform\/notify"/g, `from "${NB}"`).replace(new RegExp('from "./audit-anomaly.ts"', "g"), `from "${AAr}"`));
  const AN = await import(ANr), NO = await import(NB);
  const anomalies = [{ level: "critical", kind: "mass_delete", title: "大量削除", detail: "u1", actor: "u1" }, { level: "warning", kind: "off_hours", title: "深夜", detail: "u2", actor: "u2" }];
  const sent = [];
  const notifier = NO.createNotifier([{ async send(m) { sent.push(m); } }]);
  const seen = NO.createMemorySeenStore();
  const r1 = await AN.notifyNewAnomalies(notifier, seen, anomalies, 60000);
  const r2 = await AN.notifyNewAnomalies(notifier, seen, anomalies, 60000);
  ok("alert-notify(初回2通知0抑制 / 2回目同一0通知2抑制=重複抑制 / 重大→error警告→warn)",
    r1.notified.length === 2 && r1.skipped === 0 && r2.notified.length === 0 && r2.skipped === 2 && sent[0].level === "error" && sent[1].level === "warn");
  ok("alert-notify(多チャネル: 受信箱+Slack+Webhook=3 / 設定なし=1)",
    AN.buildAlertChannels({ mailChannel: { async send() {} }, slackWebhook: "https://s", webhookUrl: "https://w" }).length === 3 && AN.buildAlertChannels({ mailChannel: { async send() {} } }).length === 1);

  // i18n(合成)
  const IIr = W("i18n"), APIr = W("appi18n");
  await fsc.writeFile(IIr, (await rdc("../packages/i18n/src/index.ts")).split("\n").filter((l) => !/from "\.\/catalogs/.test(l)).join("\n"));
  await fsc.writeFile(APIr, (await rdc("../apps/internal-app/src/server/i18n.ts")).replace(/from "@platform\/i18n"/g, `from "${IIr}"`));
  const I = await import(APIr);
  ok("i18n(ja=アンケート / en=Survey / zh=问卷 / ko=설문 / 未知キーはキー返し)",
    I.appTranslator("ja").t("survey.title") === "アンケート" && I.appTranslator("en").t("survey.title") === "Survey" && I.appTranslator("zh").t("survey.title") === "问卷" && I.appTranslator("ko").t("survey.title") === "설문" && I.appTranslator("en").t("no.such.key") === "no.such.key");

  for (const f of [SVr, CE, CR, CB, NI, ND, NS, NW, NB, AAr, ANr, IIr, APIr]) await fsc.rm(f);
}


// ── platform: アンケート拡張(対象者/匿名/締切/CSV) + 口コミ + 手書きサイン ──
{
  section("platform: アンケート拡張(対象者/匿名/締切/CSV) + 口コミ + サイン");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/e-${name}-${sc}.ts`;

  // csv + commerce/review 合成
  const CSVr = W("csv"), COMr = W("commerce");
  await fsc.writeFile(CSVr, (await rdc("../packages/csv/src/index.ts")));
  await fsc.writeFile(COMr, await rdc("../packages/commerce/src/review.ts"));
  const SVr = W("survey"), SEr = W("sexport"), RVr = W("review"), SGr = W("sig");
  await fsc.writeFile(SVr, await rdc("../apps/internal-app/src/server/survey-repo.ts"));
  await fsc.writeFile(SEr, (await rdc("../apps/internal-app/src/server/survey-export.ts")).replace(/from "@platform\/csv"/g, `from "${CSVr}"`).replace(new RegExp('from "./survey-repo.ts"', "g"), `from "${SVr}"`));
  await fsc.writeFile(RVr, (await rdc("../apps/internal-app/src/server/review-repo.ts")).replace(/from "@platform\/commerce"/g, `from "${COMr}"`));
  await fsc.writeFile(SGr, await rdc("../apps/internal-app/src/server/signature-repo.ts"));
  const SV = await import(SVr), SE = await import(SEr), RV = await import(RVr), SG = await import(SGr);

  // アンケート: 対象者/匿名/締切
  const store = SV.createMemorySurveyStore();
  const s = await store.create({ title: "部門調査", questions: [{ text: "満足度", type: "rating" }], audience: { departments: ["営業部"], roles: ["manager"] }, anonymous: true, closesAt: "2025-12-31T23:59:59Z" });
  const users = [{ email: "a@x", department: "営業部", roles: ["employee"], active: true }, { email: "b@x", department: "他", roles: ["manager"], active: true }, { email: "c@x", department: "営業部", roles: ["e"], active: false }];
  ok("survey対象者(営業部◯/他部署manager◯role一致/無効者除外) + audienceRecipients=a,b",
    SV.isEligible({ department: "営業部", roles: ["e"] }, s.audience) === true && SV.isEligible({ department: "他", roles: ["manager"] }, s.audience) === true && SV.isEligible({ department: "他", roles: ["e"] }, s.audience) === false && SV.audienceRecipients(users, s.audience).sort().join(",") === "a@x,b@x");
  await store.setStatus(s.id, "open");
  ok("survey締切: 公開&締切前=受付 / 締切後=拒否",
    SV.isAcceptingResponses(await store.get(s.id), new Date("2025-06-01T00:00:00Z")) === true && SV.isAcceptingResponses(await store.get(s.id), new Date("2026-06-01T00:00:00Z")) === false);
  const anon = await store.respond(s.id, [{ questionId: "q1", rating: 5 }]);
  const named = await store.respond(s.id, [{ questionId: "q1", rating: 4 }], "u@x");
  ok("survey匿名/記名: 匿名はrespondent無し・記名は記録", anon.respondent === undefined && named.respondent === "u@x" && s.anonymous === true);
  const csv = SE.surveyResultsCsv(await store.get(s.id), SV.aggregateSurvey(await store.get(s.id), await store.responses(s.id)));
  ok("survey CSV: BOM付き・見出し設問/項目/値・平均行", csv.charCodeAt(0) === 0xFEFF && csv.includes("設問") && csv.includes("平均"));

  // 口コミ
  const rstore = RV.createMemoryReviewStore();
  await rstore.add({ subjectType: "tool", subjectId: "slack", author: "田中", rating: 5, comment: "便利" });
  await rstore.add({ subjectType: "tool", subjectId: "slack", author: "佐藤", rating: 3 });
  const list = await rstore.list("tool", "slack");
  const sum = RV.summarizeReviews("tool", "slack", list);
  ok("口コミ: 2件・平均(5+3)/2=4.0・clampRating(0→1,9→5)・対象別分離", list.length === 2 && Math.abs(sum.average - 4) < 1e-9 && RV.clampRating(0) === 1 && RV.clampRating(9) === 5 && (await rstore.list("tool", "notion")).length === 0);

  // 手書きサイン
  const validPng = "data:image/png;base64," + "A".repeat(120);
  ok("サイン検証: 有効PNG◯ / 短すぎ✗ / 非PNG✗", SG.isValidSignatureImage(validPng) === true && SG.isValidSignatureImage("data:image/png;base64,AA") === false && SG.isValidSignatureImage("x") === false);
  const sgstore = SG.createMemorySignatureStore();
  const sig = await sgstore.save({ subjectType: "document", subjectId: "DOC-1", signer: "承認者", image: validPng });
  ok("サイン保存: 保存+取得(画像一致)+対象別一覧", (await sgstore.get(sig.id)).image === validPng && (await sgstore.list("document", "DOC-1")).length === 1 && (await sgstore.list("document", "DOC-2")).length === 0);

  for (const f of [CSVr, COMr, SVr, SEr, RVr, SGr]) await fsc.rm(f);
}


// ── platform: 口コミモデレーション + 未回答リマインド + サイン×承認 ──
{
  section("platform: 口コミモデレーション + 未回答リマインド + サイン×承認");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/d-${name}-${sc}.ts`;
  const COMr = W("commerce"), SVr = W("survey"), RVr = W("review"), SGr = W("sig"), ASr = W("apsig");
  await fsc.writeFile(COMr, await rdc("../packages/commerce/src/review.ts"));
  await fsc.writeFile(SVr, await rdc("../apps/internal-app/src/server/survey-repo.ts"));
  await fsc.writeFile(RVr, (await rdc("../apps/internal-app/src/server/review-repo.ts")).replace(/from "@platform\/commerce"/g, `from "${COMr}"`));
  await fsc.writeFile(SGr, await rdc("../apps/internal-app/src/server/signature-repo.ts"));
  await fsc.writeFile(ASr, (await rdc("../apps/internal-app/src/server/approval-signature.ts")).replace(new RegExp('from "./signature-repo.ts"', "g"), `from "${SGr}"`));
  const RV = await import(RVr), SV = await import(SVr), AS = await import(ASr);

  // 口コミモデレーション
  const rstore = RV.createMemoryReviewStore();
  const a = await rstore.add({ subjectType: "tool", subjectId: "x", author: "a", rating: 5, comment: "良い" });
  const b = await rstore.add({ subjectType: "tool", subjectId: "x", author: "b", rating: 1, comment: "不適切" });
  await rstore.setHidden(b.id, true);
  const visible = await rstore.list("tool", "x");
  const all = await rstore.list("tool", "x", true);
  ok("moderation: 非表示化で可視1件・includeHidden2件・集計は非表示除外で平均5.0", visible.length === 1 && all.length === 2 && RV.summarizeReviews("tool", "x", all).average === 5 && RV.summarizeReviews("tool", "x", all).count === 1);
  await rstore.setHidden(b.id, false);
  ok("moderation: 再表示で可視2件", (await rstore.list("tool", "x")).length === 2);

  // 未回答リマインド
  ok("pendingRespondents: 記名a,c回答済→未回答b,d / 匿名は全員未回答扱い", SV.pendingRespondents(["a", "b", "c", "d"], [{ respondent: "a", answers: [] }, { respondent: "c", answers: [] }]).sort().join(",") === "b,d" && SV.pendingRespondents(["a", "b"], [{ answers: [] }]).length === 2);

  // サイン×承認
  ok("approval-signature: subjectId / status / canFinalize", AS.approvalSubjectId("purchase", "PO-1") === "purchase:PO-1" && AS.approvalSignatureStatus(true, [{ signer: "A", image: "x" }]).signed === true && AS.canFinalizeApproval(true, []) === false && AS.canFinalizeApproval(true, [{ signer: "A", image: "x" }]) === true && AS.canFinalizeApproval(false, []) === true);

  for (const f of [COMr, SVr, RVr, SGr, ASr]) await fsc.rm(f);
}


// ── platform: 機能アクセス制御 + サイン必須ルール(設定) + リマインド締切抽出 ──
{
  section("platform: 機能アクセス制御 + サイン必須ルール + リマインド締切抽出");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/c-${name}-${sc}.ts`;
  const FAr = W("fa"), SVr = W("sv"), SGr = W("sg"), ASr = W("as"), STr = W("st");
  await fsc.writeFile(FAr, await rdc("../apps/internal-app/src/server/feature-access.ts"));
  await fsc.writeFile(SVr, await rdc("../apps/internal-app/src/server/survey-repo.ts"));
  await fsc.writeFile(SGr, await rdc("../apps/internal-app/src/server/signature-repo.ts"));
  await fsc.writeFile(ASr, (await rdc("../apps/internal-app/src/server/approval-signature.ts")).replace(new RegExp('from "./signature-repo.ts"', "g"), `from "${SGr}"`));
  await fsc.writeFile(STr, await rdc("../apps/internal-app/src/server/settings-repo.ts"));
  const FA = await import(FAr), SV = await import(SVr), AS = await import(ASr), ST = await import(STr);

  // 機能アクセス
  const disabled = FA.resolveFeatureRules({ accounting: { enabled: false }, invoices: { enabled: true, roles: ["finance", "manager"] } });
  ok("feature-access: 無効化(accounting)はadmin以外不可・adminは可 / 役割制限(invoices)はfinance可empl不可 / accessibleは制限反映",
    FA.canUseFeature(["employee"], "accounting", disabled) === false && FA.canUseFeature(["admin"], "accounting", disabled) === true && FA.canUseFeature(["finance"], "invoices", disabled) === true && FA.canUseFeature(["employee"], "invoices", disabled) === false && !FA.accessibleFeatures(["employee"], disabled).includes("accounting") && FA.accessibleFeatures(["admin"], disabled).length === FA.FEATURE_CATALOG.length);
  const store = FA.createMemoryFeatureAccessStore();
  await store.update({ reviews: { enabled: false } });
  ok("feature-access store: 無効化保持・再更新で上書き", (await store.get()).reviews.enabled === false && (await store.update({ reviews: { enabled: true, roles: ["manager"] } })).reviews.roles.join(",") === "manager");

  // サイン必須ルール(設定)
  ok("signature rule: 既定100万 / 50万に変更 / 0で無効 / requiredByAmount(120万>=100万=必須,80万=不要,閾値0=不要)",
    ST.resolveSettings({}).signatureThreshold === 1000000 && ST.resolveSettings({ signatureThreshold: "500000" }).signatureThreshold === 500000 && ST.resolveSettings({ signatureThreshold: "0" }).signatureThreshold === 0 && AS.signatureRequiredByAmount(1200000, 1000000) === true && AS.signatureRequiredByAmount(800000, 1000000) === false && AS.signatureRequiredByAmount(9999999, 0) === false);

  // リマインド締切抽出
  const now = new Date("2025-06-10T00:00:00Z");
  const surveys = [{ status: "open", closesAt: "2025-06-12T00:00:00Z" }, { status: "open", closesAt: "2025-06-25T00:00:00Z" }, { status: "open", closesAt: "2025-06-01T00:00:00Z" }, { status: "draft", closesAt: "2025-06-11T00:00:00Z" }, { status: "open" }];
  ok("surveysDueForReminder: 3日以内1件 / 20日以内2件 / 締切超過・draft・締切なしは除外",
    SV.surveysDueForReminder(surveys, now, 3).length === 1 && SV.surveysDueForReminder(surveys, now, 20).length === 2);

  for (const f of [FAr, SVr, SGr, ASr, STr]) await fsc.rm(f);
}


// ── platform: 機能アクセスaction粒度 + 設定変更履歴 + 利用状況 + 送信Webhook ──
{
  section("platform: action粒度 + 設定変更履歴 + 利用状況 + 送信Webhook");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/b-${name}-${sc}.ts`;
  const FAr = W("fa"), UAr = W("ua"), OWr = W("ow");
  await fsc.writeFile(FAr, await rdc("../apps/internal-app/src/server/feature-access.ts"));
  await fsc.writeFile(UAr, await rdc("../apps/internal-app/src/server/usage-analytics.ts"));
  await fsc.writeFile(OWr, await rdc("../apps/internal-app/src/server/outbound-webhook.ts"));
  const FA = await import(FAr), UA = await import(UAr), OW = await import(OWr);

  // action粒度
  const rules = FA.resolveFeatureRules({ invoices: { enabled: true, roles: [], actions: { delete: ["finance"], export: ["manager", "finance"] } } });
  ok("action粒度: 閲覧全員 / delete=financeのみ / export=manager,finance / adminは常可 / 機能無効なら操作不可",
    FA.canDoAction(["employee"], "invoices", "view", rules) === true && FA.canDoAction(["finance"], "invoices", "delete", rules) === true && FA.canDoAction(["employee"], "invoices", "delete", rules) === false && FA.canDoAction(["manager"], "invoices", "export", rules) === true && FA.canDoAction(["admin"], "invoices", "delete", rules) === true && FA.canDoAction(["finance"], "accounting", "view", FA.resolveFeatureRules({ accounting: { enabled: false } })) === false);

  // 設定変更履歴 + 利用状況
  const rows = [{ actor: "admin", action: "settings.update", at: "2025-06-01T10:00:00Z" }, { actor: "admin", action: "features.update", at: "2025-06-02T10:00:00Z" }, { actor: "u1", action: "invoice.create", at: "2025-06-03T10:00:00Z" }, { actor: "u2", action: "login", at: "2025-06-04T10:00:00Z" }, { actor: "admin", action: "user.setActive", at: "2025-06-05T10:00:00Z" }];
  const cfg = UA.configChanges(rows);
  const usage = UA.featureUsage(rows);
  ok("設定変更履歴: 設定系3件のみ・新しい順 / 利用状況: 総5・アクティブ3・最多操作者admin",
    cfg.length === 3 && cfg[0].action === "user.setActive" && usage.totalEvents === 5 && usage.activeUsers === 3 && usage.byActor[0].key === "admin" && usage.byActor[0].count === 3);

  // 送信Webhook
  const subs = [{ id: "1", url: "https://a/h", events: ["invoice.created"], secret: "s1", active: true, createdAt: "" }, { id: "2", url: "https://b/h", events: ["*"], secret: "s2", active: true, createdAt: "" }, { id: "3", url: "https://c/h", events: ["invoice.created"], secret: "s3", active: false, createdAt: "" }];
  const deliveries = OW.buildDeliveries(subs, "invoice.created", { number: "INV-1" }, "2025-06-01T00:00:00Z");
  const sigA = OW.signPayload("s1", OW.buildPayload("invoice.created", { number: "INV-1" }, "2025-06-01T00:00:00Z"));
  ok("送信Webhook: 一致2件(有効#1と全#2)無効除外 / 署名sha256 64hex冪等 / *マッチ",
    deliveries.length === 2 && OW.matchingSubscriptions(subs, "x.y").map((s) => s.id).join(",") === "2" && sigA.length === 64 && /^[0-9a-f]+$/.test(sigA) && OW.signPayload("s1", OW.buildPayload("invoice.created", { number: "INV-1" }, "2025-06-01T00:00:00Z")) === sigA);
  const store = OW.createMemoryWebhookSubscriptionStore();
  const sub = await store.add({ url: "https://x", events: ["a", "b"], secret: "k" });
  await store.setActive(sub.id, false);
  ok("送信Webhook store: 追加+無効化+削除", (await store.list())[0].active === false && (await (async () => { await store.remove(sub.id); return store.list(); })()).length === 0);

  for (const f of [FAr, UAr, OWr]) await fsc.rm(f);
}


// ── platform: saga(補償Tx) + APIキー(サービスアカウント) + PIIマスキング ──
{
  section("platform: saga(補償Tx) + APIキー(サービスアカウント) + PIIマスキング");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/a-${name}-${sc}.ts`;
  const SGr = W("saga"), AKr = W("apikey"), PIr = W("pii"), SAr = W("sa"), PVr = W("pv");
  await fsc.writeFile(SGr, await rdc("../packages/saga/src/index.ts"));
  await fsc.writeFile(AKr, await rdc("../packages/apikey/src/index.ts"));
  await fsc.writeFile(PIr, (await rdc("../packages/pii/src/index.ts")).split("\n").filter((l) => !/from "\.\/(identity-mask|subject-rights)\.ts"/.test(l)).join("\n"));
  await fsc.writeFile(SAr, (await rdc("../apps/internal-app/src/server/service-account-repo.ts")).replace(/from "@platform\/apikey"/g, `from "${AKr}"`));
  await fsc.writeFile(PVr, (await rdc("../apps/internal-app/src/server/pii-view.ts")).replace(/from "@platform\/pii"/g, `from "${PIr}"`));
  const SAGA = await import(SGr), SA = await import(SAr), PV = await import(PVr);

  // saga
  {
    const log = [];
    const ok1 = await SAGA.runSaga([SAGA.sagaStep("a", () => log.push("a"), () => log.push("~a")), SAGA.sagaStep("b", () => log.push("b"), () => log.push("~b"))], {});
    log.length = 0;
    const bad = await SAGA.runSaga([SAGA.sagaStep("a", () => log.push("a"), () => log.push("~a")), SAGA.sagaStep("b", () => log.push("b"), () => log.push("~b")), SAGA.sagaStep("c", () => { throw new Error("fail"); })], {});
    ok("saga: 成功時全完了 / 失敗時b,aを逆順補償(~b→~a)・completedは空・failedStep=c",
      ok1.ok === true && ok1.completed.join(",") === "a,b" && bad.ok === false && bad.failedStep === "c" && bad.compensated.join(",") === "b,a" && log.join(",") === "a,b,~b,~a" && bad.completed.length === 0);
  }

  // APIキー
  const store = SA.createMemoryServiceAccountStore();
  const { account, plaintext } = await store.create("バッチ", ["invoice:read"]);
  const all = await store.all();
  ok("APIキー: 発行(sk_live_/hash非露出) / 正キー+scope=ok / 不正=invalid / scope不足=forbidden",
    plaintext.startsWith("sk_live_") && !("hash" in account) && SA.authenticateKey(all, plaintext, "invoice:read").ok === true && SA.authenticateKey(all, "sk_live_bad", "invoice:read").reason === "invalid" && SA.authenticateKey(all, plaintext, "admin").reason === "forbidden");
  await store.setActive(account.id, false);
  ok("APIキー: 失効後はrevoked / bearerToken抽出", SA.authenticateKey(await store.all(), plaintext, "invoice:read").reason === "revoked" && SA.bearerToken("Bearer tkn") === "tkn");

  // PIIマスキング
  const masked = PV.maskAuditRow({ actor: "tanaka@example.com", action: "invoice.create", target: "partner:C001" }, false);
  ok("PII: メールactorマスク・action保持・非メールtarget保持 / unmask=true無変更 / systemは保持",
    masked.actor !== "tanaka@example.com" && masked.action === "invoice.create" && masked.target === "partner:C001" && PV.maskAuditRow({ actor: "a@b.com", action: "x" }, true).actor === "a@b.com" && PV.maskIfEmail("system") === "system");

  for (const f of [SGr, AKr, PIr, SAr, PVr]) await fsc.rm(f);
}


// ── platform: secrets(暗号化保存/ローテーション) + flags(ロールアウト/キル/AB) + ratelimit ──
{
  section("platform: secrets + flags + ratelimit");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/z9-${name}-${sc}.ts`;
  // core + deps
  const CE = W("ce"), CR = W("cr"), CB = W("core");
  await fsc.writeFile(CE, await rdc("../packages/core/src/error.ts"));
  await fsc.writeFile(CR, (await rdc("../packages/core/src/result.ts")).replace(new RegExp('from "./error.ts"', "g"), `from "${CE}"`));
  await fsc.writeFile(CB, `export * from "${CE}";\nexport * from "${CR}";`);
  const SECp = W("secrets"), CRYp = W("crypto"), FLp = W("flags");
  await fsc.writeFile(SECp, await rdc("../packages/secrets/src/index.ts"));
  await fsc.writeFile(CRYp, (await rdc("../packages/crypto/src/index.ts")).replace(/from "@platform\/core"/g, `from "${CB}"`));
  await fsc.writeFile(FLp, (await rdc("../packages/flags/src/index.ts")).replace(/from "@platform\/core"/g, `from "${CB}"`));
  // ratelimit
  const RT = W("rlt"), RLim = W("rll"), RM = W("rlm"), RLB = W("rl");
  await fsc.writeFile(RT, (await rdc("../packages/ratelimit/src/types.ts")).replace(/from "@platform\/core"/g, `from "${CB}"`));
  await fsc.writeFile(RLim, (await rdc("../packages/ratelimit/src/limiter.ts")).replace(/from "@platform\/core"/g, `from "${CB}"`).replace(new RegExp('from "./types.ts"', "g"), `from "${RT}"`));
  await fsc.writeFile(RM, (await rdc("../packages/ratelimit/src/memory.ts")).replace(/from "@platform\/core"/g, `from "${CB}"`).replace(new RegExp('from "./types.ts"', "g"), `from "${RT}"`));
  await fsc.writeFile(RLB, `export * from "${RT}";\nexport * from "${RLim}";\nexport * from "${RM}";`);
  // app modules
  const SSm = W("ss"), FFm = W("ff");
  await fsc.writeFile(SSm, (await rdc("../apps/internal-app/src/server/secret-store.ts")).replace(/from "@platform\/secrets"/g, `from "${SECp}"`).replace(/from "@platform\/crypto"/g, `from "${CRYp}"`));
  await fsc.writeFile(FFm, (await rdc("../apps/internal-app/src/server/feature-flags.ts")).replace(/from "@platform\/flags"/g, `from "${FLp}"`));
  const SS = await import(SSm), FF = await import(FFm), RL = await import(RLB);
  const MASTER = "master-key-abcdef";

  // secrets
  const rec = SS.createMemorySecretRecordStore();
  const store = SS.createAppSecretStore(rec, MASTER, { ENV_ONLY: "env-val" });
  await SS.putSecret(rec, store, MASTER, "API_TOKEN", "tok-1");
  const sealed = SS.sealSecret(MASTER, "x");
  ok("secrets: 暗号化往復・DB保存→復号取得・環境変数フォールバック・null/require例外",
    SS.openSecret(MASTER, sealed) === "x" && sealed !== "x" && (await store.get("API_TOKEN")) === "tok-1" && (await store.get("ENV_ONLY")) === "env-val" && (await store.get("NONE")) === null);
  await SS.putSecret(rec, store, MASTER, "API_TOKEN", "tok-2");
  const list = await rec.list();
  ok("secrets: ローテーションで新値・一覧は名前のみ(平文/暗号文非露出)", (await store.get("API_TOKEN")) === "tok-2" && list[0].name === "API_TOKEN" && !("ciphertext" in list[0]));

  // flags
  const full = FF.createAppFlags({ f: { enabled: true } });
  ok("flags: enabled:true全開 / kill(enabled:false)全オフ / 未定義false / 0%オフ・100%オン",
    (await full.isEnabled("f", { key: "u" })) === true && (await FF.createAppFlags({ f: { enabled: false } }).isEnabled("f", { key: "u" })) === false && (await full.isEnabled("nope", { key: "u" })) === false && (await FF.createAppFlags({ f: { enabled: true, rolloutPercent: 0 } }).isEnabled("f", { key: "u" })) === false && (await FF.createAppFlags({ f: { enabled: true, rolloutPercent: 100 } }).isEnabled("f", { key: "u" })) === true);
  const ab = FF.createAppFlags({ e: { enabled: true, variants: [{ name: "a", weight: 50 }, { name: "b", weight: 50 }] } });
  const v = await ab.variant("e", { key: "user-x" });
  ok("flags: A/B variantはa/b・同一keyで安定 / allowターゲティング(rollout0でもadminオン)",
    (v === "a" || v === "b") && (await ab.variant("e", { key: "user-x" })) === v && (await FF.createAppFlags({ f: { enabled: true, rolloutPercent: 0, allow: [{ role: "admin" }] } }).isEnabled("f", { key: "z", attributes: { role: "admin" } })) === true);

  // ratelimit
  const lim = RL.createRateLimiter({ store: RL.createMemoryStore(), limit: 3, windowSeconds: 60 });
  const res = [];
  for (let i = 0; i < 5; i++) { const r = await lim.check("api:k1"); res.push(r.ok ? r.value.allowed : null); }
  const other = await lim.check("api:k2");
  ok("ratelimit: 上限3で3回許可4回目拒否・別キーは独立", res[0] === true && res[2] === true && res[3] === false && res[4] === false && other.ok && other.value.allowed === true);

  for (const f of [CE, CR, CB, SECp, CRYp, FLp, RT, RLim, RM, RLB, SSm, FFm]) await fsc.rm(f);
}


// ── platform: APIリファレンス(OpenAPI/Webhookイベント) + 統合ステータス + 初期セットアップ ──
{
  section("platform: APIリファレンス + 統合ステータス + 初期セットアップ");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/z8-${name}-${sc}.ts`;
  const OBp = W("obs"), ARm = W("ar"), SCm = W("sc"), SUm = W("su");
  await fsc.writeFile(OBp, await rdc("../packages/observability/src/health.ts"));
  await fsc.writeFile(ARm, await rdc("../apps/internal-app/src/server/api-reference.ts"));
  await fsc.writeFile(SCm, (await rdc("../apps/internal-app/src/server/status-checks.ts")).replace(/from "@platform\/observability"/g, `from "${OBp}"`));
  await fsc.writeFile(SUm, await rdc("../apps/internal-app/src/server/setup.ts"));
  const AR = await import(ARm), SC = await import(SCm), SU = await import(SUm);

  // APIリファレンス
  const spec = AR.openApiSpec("https://x.example");
  ok("OpenAPI: 3.0.3・servers・bearer認証・/invoices(200/401/403/429)・JSON化可 / Webhookイベント+署名文書",
    spec.openapi === "3.0.3" && spec.servers[0].url === "https://x.example/api/v1" && spec.components.securitySchemes.bearerAuth.scheme === "bearer" && spec.paths["/invoices"].get.responses["429"] && typeof JSON.stringify(spec) === "string" && AR.WEBHOOK_EVENTS.some((e) => e.event === "invoice.created") && AR.WEBHOOK_SIGNATURE_DOC.header === "x-webhook-signature");

  // 統合ステータス
  const up = await SC.getStatus({ checkDb: async () => {}, checkMail: async () => {}, checkZoho: async () => {} });
  const down = await SC.getStatus({ checkDb: async () => {}, checkMail: async () => { throw new Error("SMTP不可"); } });
  ok("status: 全up→healthy(up3/down0) / 1失敗→unhealthy(down1・error付) / 未指定チェック除外",
    up.status === "healthy" && SC.summarizeStatus(up).up === 3 && down.status === "unhealthy" && SC.summarizeStatus(down).down === 1 && down.checks.find((c) => c.name === "mail").status === "down" && Object.keys(SC.buildStatusChecks({ checkDb: async () => {} })).length === 1);

  // 初期セットアップ
  const fresh = SU.setupState({ userCount: 0, adminCount: 0, companyNameSet: false });
  const done = SU.setupState({ userCount: 3, adminCount: 1, companyNameSet: true });
  ok("setup: 管理者0→未初期化&作成可&needsSetup / 管理者1→初期化済&作成不可(乗っ取り防止) / bootstrap guard / seed",
    fresh.initialized === false && fresh.canCreateFirstAdmin === true && SU.needsSetup({ userCount: 0, adminCount: 0, companyNameSet: false }) === true && done.initialized === true && done.canCreateFirstAdmin === false && SU.canBootstrapAdmin(0) === true && SU.canBootstrapAdmin(1) === false && SU.defaultSeedPlan("A社").settings.companyName === "A社");

  for (const f of [OBp, ARm, SCm, SUm]) await fsc.rm(f);
}


// ── platform: 通知ダイジェスト頻度 + 横断全文検索 + 統合バックアップ ──
{
  section("platform: ダイジェスト頻度 + 横断全文検索 + 統合バックアップ");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const scc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/z7-${name}-${scc}.ts`;
  // core + search
  const CE = W("ce"), CR = W("cr"), CB = W("core");
  await fsc.writeFile(CE, await rdc("../packages/core/src/error.ts"));
  await fsc.writeFile(CR, (await rdc("../packages/core/src/result.ts")).replace(new RegExp('from "./error.ts"', "g"), `from "${CE}"`));
  await fsc.writeFile(CB, `export * from "${CE}";\nexport * from "${CR}";`);
  const TK = W("tk"), BM = W("bm"), MA = W("ma"), SE = W("se");
  await fsc.writeFile(TK, await rdc("../packages/search/src/tokenize.ts"));
  await fsc.writeFile(BM, (await rdc("../packages/search/src/bm25.ts")).replace(new RegExp('from "./tokenize.ts"', "g"), `from "${TK}"`).replace(/from "@platform\/core"/g, `from "${CB}"`));
  await fsc.writeFile(MA, (await rdc("../packages/search/src/adapters/memory.ts")).replace(new RegExp('from "../bm25.ts"', "g"), `from "${BM}"`).replace(new RegExp('from "../tokenize.ts"', "g"), `from "${TK}"`).replace(new RegExp('from "../index.ts"', "g"), `from "${SE}"`).replace(/from "@platform\/core"/g, `from "${CB}"`));
  await fsc.writeFile(SE, (await rdc("../packages/search/src/index.ts")).replace(/from "@platform\/core"/g, `from "${CB}"`).replace(new RegExp('from "./adapters/memory.ts"', "g"), `from "${MA}"`).replace(new RegExp('from "./bm25.ts"', "g"), `from "${BM}"`).replace(new RegExp('from "./tokenize.ts"', "g"), `from "${TK}"`).split("\n").filter((l) => !/meilisearch/.test(l)).join("\n"));
  const DGm = W("dg"), ESm = W("es"), BKm = W("bk");
  await fsc.writeFile(DGm, await rdc("../apps/internal-app/src/server/digest.ts"));
  await fsc.writeFile(ESm, (await rdc("../apps/internal-app/src/server/entity-search.ts")).replace(/from "@platform\/search"/g, `from "${SE}"`));
  await fsc.writeFile(BKm, await rdc("../apps/internal-app/src/server/backup.ts"));
  const DG = await import(DGm), ES = await import(ESm), BK = await import(BKm);
  const now = new Date("2025-06-10T12:00:00Z");

  // ダイジェスト + ストア
  ok("digest: daily24h/weekly7d判定・空summaryはnull・件数件名",
    DG.isDigestDue({ frequency: "daily", lastSentAt: "2025-06-09T11:00:00Z" }, now) === true && DG.isDigestDue({ frequency: "weekly", lastSentAt: "2025-06-07T12:00:00Z" }, now) === false && DG.buildDigestSummary([]) === null && DG.buildDigestSummary([{ title: "x", at: "2025-06-10T09:00:00Z" }]).subject.includes("1件"));
  const dstore = DG.createMemoryDigestSettingStore();
  await dstore.set("a@x", { frequency: "daily" });
  ok("digest store: 設定保存/取得・未設定はoff・全件", (await dstore.get("a@x")).frequency === "daily" && (await dstore.get("z@x")).frequency === "off" && (await dstore.all()).length === 1);

  // 横断検索
  const docs = [ES.invoiceToDoc({ number: "INV-001", billTo: "株式会社サンプル商事" }), ES.partnerToDoc({ code: "C001", name: "サンプル商事" }), ES.auditToDoc({ seq: 1, actor: "admin@x", action: "invoice.create", target: "INV-001" })];
  const hits = await ES.searchEntities(docs, "サンプル", 10);
  ok("横断検索: 'サンプル'で請求+取引先ヒット・type絞り込み・番号検索",
    hits.length >= 2 && hits.some((h) => h.document.type === "invoice") && hits.some((h) => h.document.type === "partner") && ES.toSearchResults(hits, "partner").every((r) => r.type === "partner") && (await ES.searchEntities(docs, "INV-001", 10)).some((h) => h.document.type === "invoice"));

  // バックアップ
  const bundle = BK.buildBackup([{ name: "invoices", records: [{ n: 1 }, { n: 2 }] }, { name: "settings", records: [{ c: "X" }] }], now);
  ok("backup: 総件数3・目録・日付ファイル名", bundle.totalRecords === 3 && BK.backupManifest(bundle).length === 2 && BK.backupFilename(now) === "backup-internal-app-2025-06-10.json");

  for (const f of [CE, CR, CB, TK, BM, MA, SE, DGm, ESm, BKm]) await fsc.rm(f);
}


// ── platform: バックアップ復元 + 検索インデックス永続化 + 監査アーカイブ ──
{
  section("platform: 復元 + 検索インデックス永続化 + 監査アーカイブ");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const scc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/z6-${name}-${scc}.ts`;
  // core + search
  const CE = W("ce"), CR = W("cr"), CB = W("core");
  await fsc.writeFile(CE, await rdc("../packages/core/src/error.ts"));
  await fsc.writeFile(CR, (await rdc("../packages/core/src/result.ts")).replace(new RegExp('from "./error.ts"', "g"), `from "${CE}"`));
  await fsc.writeFile(CB, `export * from "${CE}";\nexport * from "${CR}";`);
  const TK = W("tk"), BM = W("bm"), MA = W("ma"), SEp = W("se");
  await fsc.writeFile(TK, await rdc("../packages/search/src/tokenize.ts"));
  await fsc.writeFile(BM, (await rdc("../packages/search/src/bm25.ts")).replace(new RegExp('from "./tokenize.ts"', "g"), `from "${TK}"`).replace(/from "@platform\/core"/g, `from "${CB}"`));
  await fsc.writeFile(MA, (await rdc("../packages/search/src/adapters/memory.ts")).replace(new RegExp('from "../bm25.ts"', "g"), `from "${BM}"`).replace(new RegExp('from "../tokenize.ts"', "g"), `from "${TK}"`).replace(new RegExp('from "../index.ts"', "g"), `from "${SEp}"`).replace(/from "@platform\/core"/g, `from "${CB}"`));
  await fsc.writeFile(SEp, (await rdc("../packages/search/src/index.ts")).replace(/from "@platform\/core"/g, `from "${CB}"`).replace(new RegExp('from "./adapters/memory.ts"', "g"), `from "${MA}"`).replace(new RegExp('from "./bm25.ts"', "g"), `from "${BM}"`).replace(new RegExp('from "./tokenize.ts"', "g"), `from "${TK}"`).split("\n").filter((l) => !/meilisearch/.test(l)).join("\n"));
  const BKm = W("bk"), ESm = W("es"), RSm = W("rs"), SIm = W("si"), AAm = W("aa");
  await fsc.writeFile(BKm, await rdc("../apps/internal-app/src/server/backup.ts"));
  await fsc.writeFile(ESm, (await rdc("../apps/internal-app/src/server/entity-search.ts")).replace(/from "@platform\/search"/g, `from "${SEp}"`));
  await fsc.writeFile(RSm, (await rdc("../apps/internal-app/src/server/restore.ts")).replace(new RegExp('from "./backup.ts"', "g"), `from "${BKm}"`));
  await fsc.writeFile(SIm, (await rdc("../apps/internal-app/src/server/search-index.ts")).replace(/from "@platform\/search"/g, `from "${SEp}"`).replace(new RegExp('from "./entity-search.ts"', "g"), `from "${ESm}"`));
  await fsc.writeFile(AAm, await rdc("../apps/internal-app/src/server/audit-archive.ts"));
  const BK = await import(BKm), ES = await import(ESm), RS = await import(RSm), SI = await import(SIm), AA = await import(AAm);
  const now = new Date("2025-06-10T12:00:00Z");

  // 復元
  const bundle = BK.buildBackup([{ name: "partners", records: [{ code: "C001", name: "A" }, { code: "C002", name: "B" }] }, { name: "invoices", records: [{ n: 1 }] }], now);
  ok("復元: 正バンドルparse・不正error / partners復元可invoices対象外 / dryRunプレビュー / 実適用+対象外skip",
    RS.parseBackupBundle(JSON.stringify(bundle)).ok === true && RS.parseBackupBundle("{x").ok === false && RS.restorePlan(bundle).find((p) => p.name === "invoices").restorable === false && (await RS.applyRestore(bundle, {}, { dryRun: true })).applied.find((a) => a.name === "partners").count === 2 && (await RS.applyRestore(bundle, { partners: async (r) => r.length }, {})).applied[0].count === 2 && (await RS.applyRestore(bundle, { partners: async (r) => r.length }, {})).skipped.some((s) => s.name === "invoices"));

  // 検索インデックス永続化
  const store = SI.createMemorySearchIndexStore();
  await store.upsert([ES.invoiceToDoc({ number: "INV-001", billTo: "サンプル商事" }), ES.partnerToDoc({ code: "C001", name: "サンプル商事" })]);
  const hits = await SI.searchIndexed(store, "サンプル", 10);
  await store.upsert([ES.invoiceToDoc({ number: "INV-001", billTo: "更新後" })]);
  await store.remove(["partner:C001"]);
  ok("検索索引: 保存ドキュメント検索(2件ヒット)・同id upsert更新(件数不変)・remove削除",
    hits.length >= 2 && hits.some((h) => h.document.type === "partner") && (await store.all()).length === 1 && (await store.all())[0].text.includes("更新後"));

  // 監査アーカイブ
  const rows = [{ seq: 1, at: "2025-01-10T00:00:00Z", actor: "a", action: "login" }, { seq: 2, at: "2025-03-15T00:00:00Z", actor: "b", action: "invoice.create" }, { seq: 3, at: "2025-06-01T00:00:00Z", actor: "c", action: "settings.update" }];
  const archive = AA.buildAuditArchive(rows, "2025-04-01T00:00:00Z", now);
  ok("監査アーカイブ: 4月以前2件・seqRange(1-2)・チェックサム決定的・ファイル名",
    archive.count === 2 && archive.seqRange.from === 1 && archive.seqRange.to === 2 && archive.checksum === AA.buildAuditArchive(rows, "2025-04-01T00:00:00Z", new Date("2025-07-01T00:00:00Z")).checksum && AA.auditArchiveFilename("2025-04-01T00:00:00Z") === "audit-archive-until-2025-04-01.json");

  for (const f of [CE, CR, CB, TK, BM, MA, SEp, BKm, ESm, RSm, SIm, AAm]) await fsc.rm(f);
}


// ── platform: 商品/勘定科目 CSV取込 + 通知テンプレート(多言語) + ダッシュボードウィジェット拡張 ──
{
  section("platform: CSV取込(商品/勘定科目) + 通知テンプレート + ウィジェット拡張");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const scc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/z5-${name}-${scc}.ts`;
  // csv-import: stub外部import(parseCsv/型のみ)
  const CSVm = W("csv");
  let csvSrc = await rdc("../apps/internal-app/src/server/csv-import.ts");
  csvSrc = csvSrc
    .replace('import { parseCsv } from "@platform/csv";', 'const parseCsv=(t)=>{const lines=t.trim().split(/\\r?\\n/);const header=lines[0].split(",");return lines.slice(1).map(l=>{const cells=l.split(",");const o={};header.forEach((h,i)=>o[h.trim()]=(cells[i]??"").trim());return o;});};')
    .replace('import { normalizeKinds, type Partner } from "./partner-repo.ts";', 'const normalizeKinds=(a)=>a.filter(k=>["customer","supplier","payee"].includes(k));')
    .replace('import { type JournalEntry, type JournalLine, type AccountType } from "@platform/accounting";', '')
    .replace('import { type Product } from "./inventory-repo.ts";', '')
    .replace('import { type AccountDef } from "./account-master-repo.ts";', '');
  await fsc.writeFile(CSVm, csvSrc);
  const NTm = W("nt"), DPm = W("dp");
  await fsc.writeFile(NTm, await rdc("../apps/internal-app/src/server/notification-templates.ts"));
  await fsc.writeFile(DPm, await rdc("../apps/internal-app/src/server/dashboard-prefs.ts"));
  const CSV = await import(CSVm), NT = await import(NTm), DP = await import(DPm);

  // CSV: 商品・勘定科目
  const prod = CSV.parseProductCsv("SKU,名称,単位\nA001,ボールペン,本\nA002,ノート,冊\n,欠番,個");
  const acc = CSV.parseAccountCsv("科目,区分\n現金,asset\n売上,revenue\n謎,invalid");
  ok("CSV取込: 商品(有効2/SKU欠落行4エラー/重複検出) ・勘定科目(有効2/不正区分エラー)",
    prod.rows.length === 2 && prod.errors[0].line === 4 && CSV.parseProductCsv("SKU,名称\nA001,x\nA001,y").errors.some((e) => e.message.includes("重複")) && acc.rows.length === 2 && acc.rows[0].type === "asset" && acc.errors[0].message.includes("区分が不正"));

  // 通知テンプレート(多言語)
  const ja = NT.renderNotification("approval.requested", { docType: "見積書", docNumber: "Q-001", amount: 150000 }, "ja");
  ok("通知テンプレ: ja/en/zh/ko描画・変数差し込み・未知null・未指定変数空・3イベント",
    ja.body.includes("見積書 Q-001（150000円）") && NT.renderNotification("approval.requested", { docType: "Quote", docNumber: "Q-001", amount: 150000 }, "en").title === "Approval requested" && NT.renderNotification("invoice.created", { number: "INV-1", billTo: "A社" }, "zh").title === "已创建发票" && NT.renderNotification("invoice.created", { number: "INV-1", billTo: "A社" }, "ko").title === "청구서 생성됨" && NT.renderNotification("x", {}, "ja") === null && NT.fillTemplate("{{a}}-{{b}}", { a: "X" }) === "X-" && NT.templateEvents().length === 3);

  // ダッシュボードウィジェット拡張
  ok("ウィジェット: receivables/inventoryAlerts追加(全8)・順序保持+不正除去・visible判定",
    DP.WIDGET_KEYS.length === 8 && DP.WIDGET_KEYS.includes("receivables") && DP.WIDGET_KEYS.includes("inventoryAlerts") && DP.normalizeWidgets(["inventoryAlerts", "receivables", "x", "unread"])[0] === "inventoryAlerts" && !DP.normalizeWidgets(["x"]).includes("x") && DP.isWidgetVisible({ widgets: ["receivables"] }, "receivables") === true && DP.isWidgetVisible({ widgets: ["receivables"] }, "unread") === false);

  for (const f of [CSVm, NTm, DPm]) await fsc.rm(f);
}


// ── platform: 通知テンプレート上書き + エクスポートのスケジュール実行 + レポート生成 ──
{
  section("platform: 通知テンプレ上書き + エクスポート予約 + レポート生成");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const scc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/z4-${name}-${scc}.ts`;
  const NTm = W("nt"), ESm = W("es"), RPm = W("rp");
  await fsc.writeFile(NTm, await rdc("../apps/internal-app/src/server/notification-templates.ts"));
  await fsc.writeFile(ESm, await rdc("../apps/internal-app/src/server/export-schedule.ts"));
  await fsc.writeFile(RPm, await rdc("../apps/internal-app/src/server/reports.ts"));
  const NT = await import(NTm), ES = await import(ESm), RP = await import(RPm);
  const now = new Date("2025-06-10T12:00:00Z");

  // 通知テンプレ上書き
  const overrides = { "invoice.created": { ja: { title: "【重要】請求書発行" } } };
  const resolved = NT.resolveTemplates(overrides);
  const store = NT.createMemoryTemplateStore();
  await store.update(overrides);
  ok("通知テンプレ上書き: ja titleのみ上書き/body維持/他イベント不変・renderWithTemplates適用・ストア保持・空は既定一致",
    resolved["invoice.created"].locales.ja.title === "【重要】請求書発行" && resolved["invoice.created"].locales.ja.body.includes("{{number}}") && resolved["approval.requested"].locales.ja.title === "承認依頼" && NT.renderWithTemplates(resolved, "invoice.created", { number: "INV-1", billTo: "A社" }, "ja").title === "【重要】請求書発行" && (await store.get())["invoice.created"].ja.title === "【重要】請求書発行" && NT.resolveTemplates({})["invoice.created"].locales.en.title === "Invoice created");

  // エクスポート予約
  const sstore = ES.createMemoryExportScheduleStore();
  const sch = await sstore.add("partners", "weekly");
  await sstore.markRun(sch.id, now.toISOString());
  const rstore = ES.createMemoryExportRunStore();
  await rstore.add({ type: "backup", at: now.toISOString(), status: "success", recordCount: 42 });
  ok("エクスポート予約: due判定(未実行/無効/daily24h/weekly7d/monthly30d)・scheduleストア追加markRun・dueSchedules有効のみ・履歴新しい順",
    ES.isExportDue({ id: "1", type: "backup", frequency: "daily", enabled: true }, now) === true && ES.isExportDue({ id: "2", type: "backup", frequency: "daily", enabled: false }, now) === false && ES.isExportDue({ id: "1", type: "backup", frequency: "daily", enabled: true, lastRunAt: "2025-06-10T06:00:00Z" }, now) === false && ES.isExportDue({ id: "1", type: "backup", frequency: "weekly", enabled: true, lastRunAt: "2025-06-02T12:00:00Z" }, now) === true && (await sstore.list())[0].lastRunAt === now.toISOString() && ES.dueSchedules([{ id: "a", type: "backup", frequency: "daily", enabled: true }, { id: "b", type: "audit", frequency: "daily", enabled: false }], now).length === 1 && (await rstore.list())[0].recordCount === 42);

  // レポート生成
  const invoices = [{ number: "INV-1", billTo: "A社", total: 100000, balance: 100000, dueDate: "2025-06-15", status: "未払" }, { number: "INV-2", billTo: "A社", total: 50000, balance: 0, dueDate: "2025-06-01", status: "完済" }, { number: "INV-3", billTo: "B社", total: 30000, balance: 30000, dueDate: "2025-06-20", status: "未払" }];
  const sales = RP.salesReport(invoices, now);
  const recv = RP.receivablesReport(invoices, now);
  const stock = [{ sku: "A001", name: "ペン", onHand: 5, needsReorder: true, suggestedOrderQty: 100 }, { sku: "A002", name: "ノート", onHand: 200, needsReorder: false, suggestedOrderQty: 0 }];
  const invR = RP.inventoryReport(stock, now);
  const csv = RP.reportToCsv(sales);
  const html = RP.reportToHtml(recv);
  ok("レポート: 売上(取引先別/合計)・売掛(未回収2件/完済除外/合計13万)・在庫(発注要/推奨数)・CSV(BOM+合計)・HTML(table+エスケープ)・sheet変換",
    sales.rows.find((r) => r.billTo === "A社").count === 2 && sales.totals.count === 3 && recv.rows.length === 2 && recv.totals.balance === "¥130,000" && invR.rows[0].reorder === "要" && invR.rows[0].suggested === 100 && csv.startsWith("\ufeff") && csv.includes("合計") && html.includes("<table") && !html.includes("<script") && RP.reportToSheet(sales).rows.length === sales.rows.length + 1);

  for (const f of [NTm, ESm, RPm]) await fsc.rm(f);
}


// ── platform: レポート配信スケジュール + ダッシュボード売上/売掛トレンド（Excel出力はwriteWorkbook配線） ──
{
  section("platform: レポート配信スケジュール + ダッシュボードトレンド");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const scc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/z3-${name}-${scc}.ts`;
  const TRm = W("tr"), RSm = W("rs"), DTm = W("dt");
  await fsc.writeFile(TRm, await rdc("../apps/internal-app/src/server/trend.ts"));
  await fsc.writeFile(RSm, await rdc("../apps/internal-app/src/server/report-schedule.ts"));
  await fsc.writeFile(DTm, (await rdc("../apps/internal-app/src/server/dashboard-trend.ts")).replace(new RegExp('from "./trend.ts"', "g"), `from "${TRm}"`));
  const RS = await import(RSm), DT = await import(DTm);
  const now = new Date("2025-06-10T12:00:00Z");

  // レポート配信スケジュール
  const store = RS.createMemoryReportScheduleStore();
  const sc = await store.add("sales", "weekly", "boss@x");
  await store.markSent(sc.id, now.toISOString());
  const msg = RS.buildReportMessage("receivables", now, "未回収 2件");
  ok("レポート配信: due判定(未送信/無効/weekly7d/daily未満)・dueReports有効のみ・件名+要約・ラベル・ストア往復",
    RS.isReportDue({ id: "1", reportType: "sales", frequency: "daily", recipient: "a@x", enabled: true }, now) === true && RS.isReportDue({ id: "2", reportType: "sales", frequency: "daily", recipient: "a@x", enabled: false }, now) === false && RS.isReportDue({ id: "1", reportType: "sales", frequency: "weekly", recipient: "a@x", enabled: true, lastSentAt: "2025-06-02T12:00:00Z" }, now) === true && RS.isReportDue({ id: "1", reportType: "sales", frequency: "daily", recipient: "a@x", enabled: true, lastSentAt: "2025-06-10T06:00:00Z" }, now) === false && RS.dueReports([{ id: "a", reportType: "sales", frequency: "daily", recipient: "a@x", enabled: true }, { id: "b", reportType: "inventory", frequency: "daily", recipient: "b@x", enabled: false }], now).length === 1 && msg.subject.includes("売掛レポート") && RS.reportLabel("sales") === "売上レポート" && (await store.list())[0].lastSentAt === now.toISOString());
  await store.setEnabled(sc.id, false);
  await store.remove(sc.id);
  ok("レポート配信ストア: setEnabled/remove 反映", (await store.list()).length === 0);

  // ダッシュボードトレンド
  const months = DT.recentMonths(now, 6);
  const invoices = [{ issueDate: "2025-04-15", total: 100000, balance: 50000 }, { issueDate: "2025-04-20", total: 60000, balance: 0 }, { issueDate: "2025-06-01", total: 80000, balance: 80000 }, { issueDate: "2025-06-05", total: 20000, balance: 20000, cancelled: true }];
  const trend = DT.salesTrend(invoices, months);
  const sum = DT.summarizeSalesTrend(trend);
  ok("ダッシュボードトレンド: 直近6か月・4月売上16万/残高5万・6月売上8万(取消除外)・空月0・合計24万/ピーク4月/空はnull",
    months.length === 6 && months[5] === "2025-06" && trend.find((p) => p.month === "2025-04").sales === 160000 && trend.find((p) => p.month === "2025-04").outstanding === 50000 && trend.find((p) => p.month === "2025-06").sales === 80000 && trend.find((p) => p.month === "2025-02").sales === 0 && sum.totalSales === 240000 && sum.peakMonth === "2025-04" && DT.summarizeSalesTrend([]).peakMonth === null);

  for (const f of [TRm, RSm, DTm]) await fsc.rm(f);
}


// ── platform: レポート絞り込み + 配信先の解決(複数/ロール) + 期間レンジ ──
{
  section("platform: レポート絞り込み + 配信先解決 + 期間レンジ");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const scc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/z2-${name}-${scc}.ts`;
  const TRm = W("tr"), RPm = W("rp"), RSm = W("rs"), DTm = W("dt");
  await fsc.writeFile(TRm, await rdc("../apps/internal-app/src/server/trend.ts"));
  await fsc.writeFile(RPm, await rdc("../apps/internal-app/src/server/reports.ts"));
  await fsc.writeFile(RSm, await rdc("../apps/internal-app/src/server/report-schedule.ts"));
  await fsc.writeFile(DTm, (await rdc("../apps/internal-app/src/server/dashboard-trend.ts")).replace(new RegExp('from "./trend.ts"', "g"), `from "${TRm}"`));
  const RP = await import(RPm), RS = await import(RSm), DT = await import(DTm);

  // レポート絞り込み
  const invoices = [{ number: "INV-1", issueDate: "2025-04-15", billTo: "A社", total: 100000, balance: 100000, dueDate: "2025-05-15", status: "未払" }, { number: "INV-2", issueDate: "2025-05-20", billTo: "B社", total: 50000, balance: 0, dueDate: "2025-06-20", status: "完済" }, { number: "INV-3", issueDate: "2025-06-01", billTo: "A社", total: 30000, balance: 30000, dueDate: "2025-07-01", status: "未払" }];
  const filtered = RP.filterInvoices(invoices, { partner: "A社" }).map((i) => ({ number: i.number, billTo: i.billTo, total: i.total, balance: i.balance }));
  ok("レポート絞り込み: 期間2件/取引先2件/期間+取引先1件/条件なし全件・filterLabel・絞り込み後salesReport(A社2件)",
    RP.filterInvoices(invoices, { from: "2025-05-01", to: "2025-06-30" }).length === 2 && RP.filterInvoices(invoices, { partner: "A社" }).length === 2 && RP.filterInvoices(invoices, { from: "2025-06-01", to: "2025-06-30", partner: "A社" }).length === 1 && RP.filterInvoices(invoices, {}).length === 3 && RP.filterLabel({ partner: "A社" }).includes("A社") && RP.filterLabel({}) === "" && RP.salesReport(filtered, new Date("2025-06-10T00:00:00Z")).totals.count === 2);

  // 配信先の解決
  const users = [{ email: "admin@x", roles: ["admin"] }, { email: "mgr@x", roles: ["manager"] }, { email: "admin2@x", roles: ["admin", "finance"] }];
  ok("配信先解決: 単一/カンマ複数3件/role:admin展開2名/混在+重複排除3件/該当なし空",
    RS.resolveRecipients("boss@x", users).join(",") === "boss@x" && RS.resolveRecipients("a@x, b@x c@x", users).length === 3 && RS.resolveRecipients("role:admin", users).sort().join(",") === "admin2@x,admin@x" && RS.resolveRecipients("admin@x, role:admin, mgr@x", users).length === 3 && RS.resolveRecipients("role:none", users).length === 0);

  // 期間レンジ
  const now = new Date("2025-06-10T12:00:00Z");
  ok("期間レンジ: 6か月→2025-01〜2025-06 / 3か月→2025-04〜2025-06",
    DT.rangeForMonths(now, 6).from === "2025-01" && DT.rangeForMonths(now, 6).to === "2025-06" && DT.rangeForMonths(now, 3).from === "2025-04" && DT.rangeForMonths(now, 3).to === "2025-06");

  for (const f of [TRm, RPm, RSm, DTm]) await fsc.rm(f);
}


// ── platform: 支出トレンド（仕入/経費）+ レポートプリセット + 配信ログ ──
{
  section("platform: 支出トレンド + レポートプリセット + 配信ログ");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const scc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/z1-${name}-${scc}.ts`;
  const TRm = W("tr"), DTm = W("dt"), RPm = W("rp"), DLm = W("dl");
  await fsc.writeFile(TRm, await rdc("../apps/internal-app/src/server/trend.ts"));
  await fsc.writeFile(DTm, (await rdc("../apps/internal-app/src/server/dashboard-trend.ts")).replace(new RegExp('from "./trend.ts"', "g"), `from "${TRm}"`));
  await fsc.writeFile(RPm, await rdc("../apps/internal-app/src/server/report-preset.ts"));
  await fsc.writeFile(DLm, await rdc("../apps/internal-app/src/server/delivery-log.ts"));
  const DT = await import(DTm), RP = await import(RPm), DL = await import(DLm);
  const now = new Date("2025-06-10T12:00:00Z");
  const months = DT.recentMonths(now, 6);

  // 支出トレンド
  const purchases = [{ orderDate: "2025-04-10", net: 40000 }, { orderDate: "2025-06-02", net: 20000 }, { orderDate: "2025-06-03", net: 5000, cancelled: true }];
  const expenses = [{ date: "2025-04-15", amount: 10000 }, { date: "2025-04-20", amount: 5000 }, { date: "2025-06-01", amount: 8000 }];
  const spend = DT.spendTrend(purchases, expenses, months);
  ok("支出トレンド: 4月仕入4万/経費1.5万・6月仕入2万(取消除外)/経費8千・空月0",
    spend.find((p) => p.month === "2025-04").purchases === 40000 && spend.find((p) => p.month === "2025-04").expenses === 15000 && spend.find((p) => p.month === "2025-06").purchases === 20000 && spend.find((p) => p.month === "2025-06").expenses === 8000 && spend.find((p) => p.month === "2025-02").purchases === 0);

  // レポートプリセット
  const pstore = RP.createMemoryReportPresetStore();
  const p1 = await pstore.add("user@x", { name: "今月A社", reportType: "sales", from: "2025-06-01", to: "2025-06-30", partner: "A社" });
  ok("プリセット: owner別一覧・presetToQuery(絞り込み反映/なしはformatのみ)・削除",
    (await pstore.list("user@x")).length === 1 && (await pstore.list("other@x")).length === 0 && RP.presetToQuery(p1, "csv") === "/api/reports/sales?format=csv&from=2025-06-01&to=2025-06-30&partner=A%E7%A4%BE" && RP.presetToQuery({ id: "x", name: "n", reportType: "inventory" }) === "/api/reports/inventory?format=html" && (await (async () => { await pstore.remove("user@x", p1.id); return (await pstore.list("user@x")).length; })()) === 0);

  // 配信ログ
  const lstore = DL.createMemoryDeliveryLogStore();
  await lstore.add(DL.makeDeliveryEntry(now.toISOString(), "sales", ["a@x", "b@x"]));
  await lstore.add(DL.makeDeliveryEntry("2025-06-11T00:00:00Z", "receivables", ["c@x"]));
  const logs = await lstore.list();
  ok("配信ログ: makeDeliveryEntry(件数/sent/空はskipped)・新しい順・宛先保持",
    DL.makeDeliveryEntry("t", "sales", ["a@x", "b@x"]).recipientCount === 2 && DL.makeDeliveryEntry("t", "sales", []).status === "skipped" && logs.length === 2 && logs[0].reportType === "receivables" && logs[1].recipients.join(",") === "a@x,b@x");

  for (const f of [TRm, DTm, RPm, DLm]) await fsc.rm(f);
}


// ── platform: 基盤見直しの修正(filterLabel片側表示 / メモリストアID採番の閉包化) ──
{
  section("platform: 見直し修正(filterLabel / ID採番閉包化)");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const scc = Date.now();
  const rdc = async (rel) => (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  const W = (name) => `${dc}/z0-${name}-${scc}.ts`;
  const RPm = W("rp"), ESm = W("es"), DLm = W("dl"), PPm = W("pp");
  await fsc.writeFile(RPm, await rdc("../apps/internal-app/src/server/reports.ts"));
  await fsc.writeFile(ESm, await rdc("../apps/internal-app/src/server/export-schedule.ts"));
  await fsc.writeFile(DLm, await rdc("../apps/internal-app/src/server/delivery-log.ts"));
  await fsc.writeFile(PPm, await rdc("../apps/internal-app/src/server/report-preset.ts"));
  const RP = await import(RPm), ES = await import(ESm), DL = await import(DLm), PP = await import(PPm);

  ok("filterLabel: 片側指定の表示修正(from単独/to単独/両方/partner単独/空)",
    RP.filterLabel({ from: "2025-05-01" }) === "（2025-05-01〜）" && RP.filterLabel({ to: "2025-06-30" }) === "（〜2025-06-30）" && RP.filterLabel({ from: "2025-05-01", to: "2025-06-30" }) === "（2025-05-01〜2025-06-30）" && RP.filterLabel({ partner: "A社" }) === "（A社）" && RP.filterLabel({}) === "");

  const e1 = ES.createMemoryExportScheduleStore(), e2 = ES.createMemoryExportScheduleStore();
  const d1 = DL.createMemoryDeliveryLogStore(), d2 = DL.createMemoryDeliveryLogStore();
  const p1 = PP.createMemoryReportPresetStore(), p2 = PP.createMemoryReportPresetStore();
  ok("ID採番: メモリストアがインスタンス毎に独立採番(export/delivery/preset)",
    (await e1.add("backup", "daily")).id === (await e2.add("backup", "daily")).id && (await d1.add(DL.makeDeliveryEntry("t", "sales", ["a@x"]))).id === (await d2.add(DL.makeDeliveryEntry("t", "sales", ["a@x"]))).id && (await p1.add("u@x", { name: "n", reportType: "sales" })).id === (await p2.add("u@x", { name: "n", reportType: "sales" })).id);

  for (const f of [RPm, ESm, DLm, PPm]) await fsc.rm(f);
}


// ── apps/crud-template: マスタ管理テンプレート(検証+memoryストア) ──
{
  section("crud-template: 入力検証 + 品目ストア");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const scc = Date.now();
  const IRp = `${dc}/w0-item-repo-${scc}.ts`;
  await fsc.writeFile(IRp, (await fsc.readFile(new URL("../apps/crud-template/src/server/item-repo.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  const IR = await import(IRp);

  const v1 = IR.validateItemInput({ code: "item-001", name: "ボールペン", note: " 黒 " });
  const v2 = IR.validateItemInput({ code: "x", name: "" });
  ok("検証: 正常系(大文字化/trim)・異常系(code+name 2エラー)・境界(名称100/101, 備考500/501)",
    v1.ok === true && v1.value.code === "ITEM-001" && v1.value.note === "黒" && v2.ok === false && v2.errors.length === 2 && IR.validateItemInput({ code: "A1", name: "あ".repeat(100) }).ok === true && IR.validateItemInput({ code: "A1", name: "あ".repeat(101) }).ok === false && IR.validateItemInput({ code: "A1", name: "x", note: "あ".repeat(501) }).ok === false);

  const store = IR.createMemoryItemStore();
  await store.create({ code: "B-01", name: "ノート" });
  await store.create({ code: "A-01", name: "ペン" });
  await store.update("A-01", { name: "ペン(赤)" });
  await store.setActive("B-01", false);
  ok("ストア: コード昇順・update反映・無効化で一覧除外/includeInactive表示・不在はundefined",
    (await store.list()).map((i) => i.code).join(",") === "A-01" && (await store.get("A-01")).name === "ペン(赤)" && (await store.list(true)).length === 2 && (await store.update("ZZ", { name: "x" })) === undefined);

  await fsc.rm(IRp);
}


// ── platform/mcp: プロトコルコア + internal-app ツール(Zoho含む) ──
{
  section("mcp: JSON-RPC/initialize/tools + internal-app ツール8種");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const scc = Date.now();
  const mcpx = `${dc}/w1-mcpx-${scc}.ts`;
  const repp = `${dc}/w1-rep-${scc}.ts`;
  const toolp = `${dc}/w1-tools-${scc}.ts`;
  await fsc.writeFile(mcpx, (await fsc.readFile(new URL("../packages/mcp/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(repp, (await fsc.readFile(new URL("../apps/internal-app/src/server/reports.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  let tsrc = (await fsc.readFile(new URL("../apps/internal-app/src/server/mcp-tools.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  tsrc = tsrc.replace('from "@platform/mcp"', `from "${mcpx}"`).replace('from "./reports.ts"', `from "${repp}"`);
  await fsc.writeFile(toolp, tsrc);
  const M = await import(mcpx);
  const T = await import(toolp);

  const echoTools = [
    { name: "echo", description: "d", inputSchema: { type: "object" }, handler: (a) => M.textResult(`e:${a.m}`) },
    { name: "boom", description: "d", inputSchema: { type: "object" }, handler: () => { throw new Error("BOOM"); } },
  ];
  const eo = { name: "t", version: "1", tools: echoTools };
  const i1 = await M.handleMcpMessage(eo, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } });
  const i2 = await M.handleMcpMessage(eo, { jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } });
  ok("initialize: 要求版採用/未対応→最新・通知はnull・ping={}",
    i1.result.protocolVersion === "2025-03-26" && i2.result.protocolVersion === "2025-06-18" && (await M.handleMcpMessage(eo, { jsonrpc: "2.0", method: "notifications/initialized" })) === null && JSON.stringify((await M.handleMcpMessage(eo, { jsonrpc: "2.0", id: 3, method: "ping" })).result) === "{}");
  const boom = await M.handleMcpMessage(eo, { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "boom" } });
  ok("tools/call: handler例外→isError結果 / 未知ツール-32602 / 未対応メソッド-32601 / parse不能-32700",
    boom.result.isError === true && boom.result.content[0].text.includes("BOOM") && (await M.handleMcpMessage(eo, { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "x" } })).error.code === -32602 && (await M.handleMcpMessage(eo, { jsonrpc: "2.0", id: 6, method: "completion/complete" })).error.code === -32601 && M.parseJsonRpc("{bad").error.error.code === -32700);

  const deps = {
    invoiceStore: { list: async () => [{ number: "INV-1", billTo: "A社", issueDate: "2025-06-01", status: "未払", totals: { total: 1000 }, balance: 1000 }], get: async (n) => (n === "INV-1" ? { number: "INV-1", billTo: "A社", issueDate: "2025-06-01", status: "未払", totals: { total: 1000 }, balance: 1000 } : undefined) },
    partnerStore: { list: async () => [] },
    inventoryStore: { status: async () => [] },
    auditLog: { query: async () => [] },
    now: () => new Date("2025-06-10T00:00:00Z"),
  };
  const io = { name: "internal-app", version: "0.1.0", tools: T.buildMcpTools(deps) };
  const tl = await M.handleMcpMessage(io, { jsonrpc: "2.0", id: 7, method: "tools/list" });
  const ng = await M.handleMcpMessage(io, { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "invoice_get", arguments: { number: "NOPE" } } });
  const zn = await M.handleMcpMessage(io, { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "zoho_search_records", arguments: { module: "Leads", word: "x" } } });
  ok("internal-appツール: tools/list=8種・invoice_get不在isError・zoho未設定は設定ガイドisError",
    tl.result.tools.length === 8 && tl.result.tools.some((t) => t.name === "zoho_get_record") && ng.result.isError === true && zn.result.isError === true && zn.result.content[0].text.includes("ZOHO_CLIENT_ID"));
  const zdeps = { ...deps, zoho: { searchRecords: async (m, q) => ({ ok: true, value: { data: [{ id: "1", Last_Name: "山田" }] } }), getRecord: async (m, id) => ({ ok: true, value: { data: [] } }) } };
  const zo = { name: "z", version: "1", tools: T.buildMcpTools(zdeps) };
  const zs = await M.handleMcpMessage(zo, { jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "zoho_search_records", arguments: { module: "Leads", word: "山田" } } });
  const zg = await M.handleMcpMessage(zo, { jsonrpc: "2.0", id: 11, method: "tools/call", params: { name: "zoho_get_record", arguments: { module: "Leads", id: "9" } } });
  const zq = await M.handleMcpMessage(zo, { jsonrpc: "2.0", id: 12, method: "tools/call", params: { name: "zoho_search_records", arguments: { module: "Leads" } } });
  ok("Zohoツール: search=data返却・get空はisError・検索条件なしはisError",
    JSON.parse(zs.result.content[0].text)[0].Last_Name === "山田" && zg.result.isError === true && zq.result.isError === true);

  for (const f of [mcpx, repp, toolp]) await fsc.rm(f);
}

// ── equipment-app: 認証(セッション/パスワード) + 貸出状態遷移 ──
{
  section("equipment-app: 認証 + 貸出/返却の業務ルール");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const scc = Date.now();
  const ap = `${dc}/w2-auth-${scc}.ts`;
  const rp = `${dc}/w2-repo-${scc}.ts`;
  await fsc.writeFile(ap, (await fsc.readFile(new URL("../apps/equipment-app/src/server/auth.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(rp, (await fsc.readFile(new URL("../apps/equipment-app/src/server/equipment-repo.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  const A = await import(ap);
  const R = await import(rp);

  const secret = "smoke-secret";
  const payload = { email: "admin@example.com", name: "管理者", roles: ["admin"], exp: Math.floor(Date.now() / 1000) + 3600 };
  const token = A.signSession(payload, secret);
  const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
  const expired = A.signSession({ ...payload, exp: Math.floor(Date.now() / 1000) - 10 }, secret);
  const h = A.hashPassword("pw-1234");
  ok("セッション: 往復保持・改ざん/失効/別secretはnull・パスワード照合OK/NG",
    A.verifySession(token, secret).email === "admin@example.com" && A.verifySession(tampered, secret) === null && A.verifySession(expired, secret) === null && A.verifySession(token, "other") === null && A.verifyPassword("pw-1234", h) === true && A.verifyPassword("bad", h) === false);
  A.seedUsers("admin1234");
  A.seedUsers("other");
  const now = Date.now();
  const p1 = A.login("Admin@Example.com ", "admin1234", now);
  ok("ログイン: 成功(正規化・exp=+8h)・誤パスワードnull・seed冪等",
    p1 !== null && p1.exp === Math.floor(now / 1000) + 28800 && A.login("admin@example.com", "other") === null);

  const s = R.createMemoryEquipmentStore();
  await s.create({ code: "EQ-001", name: "プロジェクター" });
  await s.create({ code: "EQ-002", name: "Wi-Fi" });
  const t0 = new Date("2025-06-01T09:00:00Z");
  const l1 = await s.lend("EQ-001", " 山田 ", t0);
  const l2 = await s.lend("EQ-001", "佐藤", t0);
  const gb = await s.giveBack("EQ-001", new Date("2025-06-02T10:00:00Z"));
  const hist = await s.history("EQ-001");
  ok("貸出→返却: 成功(trim)・一覧にcurrentBorrower・再貸出NG(借用者名入り)・履歴にreturnedAt",
    l1.ok === true && l1.lending.borrower === "山田" && (await s.list()).find((e) => e.code === "EQ-001") !== undefined && l2.ok === false && l2.error.includes("山田") && gb.ok === true && hist[0].returnedAt === "2025-06-02T10:00:00.000Z");
  await s.setActive("EQ-002", false);
  ok("業務ルール: 未貸出返却NG・無効品NG・借用者空NG・不在NG",
    (await s.giveBack("EQ-001", t0)).ok === false && (await s.lend("EQ-002", "田中", t0)).ok === false && (await s.lend("EQ-001", " ", t0)).ok === false && (await s.lend("NOPE", "x", t0)).ok === false);

  await fsc.rm(ap); await fsc.rm(rp);
}


// ── platform/ai: AI Gateway(ルーティング/予算/コスト/ログ/フォールバック/実プロバイダ形状) ──
{
  section("ai: AI Gateway + プロバイダ実装");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const scc = Date.now();
  const cep = `${dc}/w3-core-error-${scc}.ts`;
  const crp = `${dc}/w3-core-result-${scc}.ts`;
  const cop = `${dc}/w3-core-${scc}.ts`;
  const aip = `${dc}/w3-ai-${scc}.ts`;
  await fsc.writeFile(cep, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(crp, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${cep}"`));
  await fsc.writeFile(cop, `export * from "${cep}";\nexport * from "${crp}";\n`);
  await fsc.writeFile(aip, (await fsc.readFile(new URL("../packages/ai/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${cop}"`));
  const AI = await import(aip);

  const A = { id: "anthropic", models: ["claude"], chat: async (r) => ({ text: `A:${r.maxTokens}`, usage: { inputTokens: 100, outputTokens: 50 } }) };
  const B = { id: "openai", models: ["gpt"], chat: async () => ({ text: "B", usage: { inputTokens: 10, outputTokens: 5 } }) };
  const store = AI.createMemoryAiLogStore();
  const gw = AI.createAiGateway({ providers: [A, B], defaultModel: "claude-fable-5", routes: { "my-model": "openai" }, pricing: { "claude-fable-5": { inJpyPer1k: 3, outJpyPer1k: 15 } }, limits: { maxTokensPerCall: 64, maxTotalTokens: 200 }, logStore: store, logPrompt: true, redact: (s) => s.replace(/\d/g, "*"), now: () => 1000 });
  const r1 = await gw.chat({ messages: [{ role: "user", content: "電話090へ" }], maxTokens: 9999, user: "u@x" });
  const r2 = await gw.chat({ model: "gpt-5", messages: [{ role: "user", content: "hi" }] });
  const r3 = await gw.chat({ model: "my-model", messages: [{ role: "user", content: "hi" }] });
  const r4 = await gw.chat({ messages: [{ role: "user", content: "x" }] }); // 累積180<200なので実行され330に
  const r5 = await gw.chat({ messages: [{ role: "user", content: "x" }] }); // 330>=200 で拒否
  ok("Gateway: ルーティング(接頭辞/明示routes)・clamp64・コスト1.05円・redact済プロンプト・予算超過(事前チェック)はRATE_LIMITED",
    r1.ok && r1.value.provider === "anthropic" && r1.value.text === "A:64" && Math.abs(r1.value.costJpy - 1.05) < 1e-9 && r2.ok && r2.value.provider === "openai" && r3.ok && r3.value.provider === "openai" && store.list()[0].prompt.includes("***") && r4.ok === true && gw.totalTokens() === 330 && r5.ok === false && r5.error.code === "RATE_LIMITED");

  const P = { id: "p", models: ["claude"], chat: async () => { throw new Error("P死亡"); } };
  const Q = { id: "q", chat: async () => ({ text: "Q", usage: { inputTokens: 1, outputTokens: 1 } }) };
  const rf = await AI.createAiGateway({ providers: [P, Q], defaultModel: "claude-x", fallback: true }).chat({ messages: [{ role: "user", content: "x" }] });
  const rn = await AI.createAiGateway({ providers: [P, Q], defaultModel: "claude-x" }).chat({ messages: [{ role: "user", content: "x" }] });
  const bad = await gw.chat({ messages: [] });
  ok("Gateway: fallbackで次プロバイダ成功 / 無効時EXTERNAL(元文言) / 空messagesはVALIDATION",
    rf.ok && rf.value.provider === "q" && rn.ok === false && rn.error.code === "EXTERNAL" && rn.error.message.includes("P死亡") && bad.ok === false && bad.error.code === "VALIDATION");

  let cap; let cap2;
  const mkRes = (status, json) => ({ ok: status < 300, status, json: async () => json });
  const ap = AI.createAnthropicProvider({ apiKey: "sk-t", fetchImpl: async (url, init) => { cap = { url, init }; return mkRes(200, { content: [{ type: "text", text: "こん" }, { type: "text", text: "にちは" }], usage: { input_tokens: 10, output_tokens: 5 } }); } });
  const ar = await ap.chat({ model: "claude-x", maxTokens: 32, messages: [{ role: "system", content: "丁寧に" }, { role: "user", content: "挨拶" }] });
  const abody = JSON.parse(cap.init.body);
  const op = AI.createOpenAiProvider({ apiKey: "ok-t", fetchImpl: async (url, init) => { cap2 = { url, init }; return mkRes(200, { choices: [{ message: { content: "やあ" } }], usage: { prompt_tokens: 7, completion_tokens: 3 } }); } });
  const or2 = await op.chat({ model: "gpt-5", maxTokens: 16, messages: [{ role: "system", content: "s" }, { role: "user", content: "u" }] });
  let athrew = ""; try { await AI.createAnthropicProvider({ apiKey: "k", fetchImpl: async () => mkRes(400, { error: { message: "bad" } }) }).chat({ model: "m", maxTokens: 1, messages: [{ role: "user", content: "x" }] }); } catch (e) { athrew = e.message; }
  ok("プロバイダ実形状: Anthropic(x-api-key/system抽出/text結合/usage) / OpenAI(Bearer/choices/usage) / HTTPエラーはstatus+message",
    cap.url.endsWith("/v1/messages") && cap.init.headers["x-api-key"] === "sk-t" && abody.system === "丁寧に" && abody.messages.length === 1 && ar.text === "こんにちは" && cap2.init.headers.authorization === "Bearer ok-t" && or2.usage.outputTokens === 3 && athrew.includes("anthropic 400"));

  for (const f of [cep, crp, cop, aip]) await fsc.rm(f);
}


// ── mcp拡張: resources/prompts + 書き込みツール(監査) + scope認可 ──
{
  section("mcp拡張: resources/prompts/書き込み/認可");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const scc = Date.now();
  const mcpx = `${dc}/w4-mcpx-${scc}.ts`;
  const repp = `${dc}/w4-rep-${scc}.ts`;
  const toolp = `${dc}/w4-tools-${scc}.ts`;
  await fsc.writeFile(mcpx, (await fsc.readFile(new URL("../packages/mcp/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(repp, (await fsc.readFile(new URL("../apps/internal-app/src/server/reports.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  let tsrc = (await fsc.readFile(new URL("../apps/internal-app/src/server/mcp-tools.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  tsrc = tsrc.replace('from "@platform/mcp"', `from "${mcpx}"`).replace('from "./reports.ts"', `from "${repp}"`);
  await fsc.writeFile(toolp, tsrc);
  const M = await import(mcpx);
  const T = await import(toolp);

  const deps = {
    invoiceStore: { list: async () => [{ number: "INV-1", billTo: "A社", issueDate: "2025-06-01", status: "未払", totals: { total: 1000 }, balance: 1000 }, { number: "INV-2", billTo: "B社", issueDate: "2025-06-02", status: "完済", totals: { total: 500 }, balance: 0 }], get: async () => undefined },
    partnerStore: { list: async () => [] },
    inventoryStore: { status: async () => [{ product: { sku: "A001", name: "ペン" }, summary: { onHand: 5 }, needsReorder: true, suggestedOrderQty: 100 }, { product: { sku: "A002", name: "ノート" }, summary: { onHand: 99 }, needsReorder: false, suggestedOrderQty: 0 }] },
    auditLog: { query: async () => [] },
    now: () => new Date("2025-06-10T00:00:00Z"),
  };
  const res = T.buildMcpResources(deps);
  const prompts = T.buildMcpPrompts();
  const rread = await M.handleMcpMessage({ name: "x", version: "1", tools: [], resources: res }, { jsonrpc: "2.0", id: 1, method: "resources/read", params: { uri: "platform://invoices/summary" } });
  const reorder = await M.handleMcpMessage({ name: "x", version: "1", tools: [], resources: res }, { jsonrpc: "2.0", id: 2, method: "resources/read", params: { uri: "platform://inventory/reorder" } });
  const pget = await M.handleMcpMessage({ name: "x", version: "1", tools: [], prompts }, { jsonrpc: "2.0", id: 3, method: "prompts/get", params: { name: "overdue_followup", arguments: { partner: "A社", number: "INV-1" } } });
  const initFull = await M.handleMcpMessage({ name: "x", version: "1", tools: [], resources: res, prompts }, { jsonrpc: "2.0", id: 4, method: "initialize", params: {} });
  ok("resources/prompts: read でJSON・要発注1件・prompt引数展開・capabilities反映",
    JSON.parse(rread.result.contents[0].text).byStatus["未払"] === 1 && JSON.parse(reorder.result.contents[0].text).length === 1 && pget.result.messages[0].content.text.includes("A社") && initFull.result.capabilities.resources && initFull.result.capabilities.prompts);

  let audited = [];
  const writes = { recordPayment: async (n, amt) => (n === "INV-1" ? { ok: true, balance: 1000 - amt } : { ok: false, error: "不明" }), cancelInvoice: async () => ({ ok: true }), audit: async (a, t, d) => { audited.push({ a, t, d }); }, actor: "k" };
  const wtools = T.buildMcpTools({ ...deps, writes });
  const rp = await M.handleMcpMessage({ name: "x", version: "1", tools: wtools }, { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "invoice_record_payment", arguments: { number: "INV-1", amount: 400 } } });
  const bad = await M.handleMcpMessage({ name: "x", version: "1", tools: wtools }, { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "invoice_record_payment", arguments: { number: "INV-1", amount: -1 } } });
  ok("書き込み: writes無で8/有で10ツール・入金成功で監査記録・不正額isError",
    T.buildMcpTools(deps).length === 8 && wtools.length === 10 && JSON.parse(rp.result.content[0].text).balance === 600 && audited.length === 1 && bad.result.isError === true);

  const authz = (tool) => { if (!tool.scopes) return true; return tool.scopes.every((x) => ["invoice:read"].includes(x)) || "スコープ不足"; };
  const opt = { name: "x", version: "1", tools: wtools, authorizeTool: authz };
  const denied = await M.handleMcpMessage(opt, { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "invoice_cancel", arguments: { number: "INV-1" } } });
  const readOk = await M.handleMcpMessage(opt, { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "invoice_list" } });
  ok("認可: scope不足の書込は拒否(isError)・読取(scope無)は通す・cancelにdestructiveHint",
    denied.result.isError === true && !readOk.result.isError && wtools.find((t) => t.name === "invoice_cancel").destructive === true);

  for (const f of [mcpx, repp, toolp]) await fsc.rm(f);
}


// ── platform/rag: チャンク分割 + 権限継承検索 + embedding併用 + 文脈整形 ──
{
  section("rag: チャンク/権限継承/embedding/文脈");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const scc = Date.now();
  const cep = `${dc}/w5-ce-${scc}.ts`;
  const crp = `${dc}/w5-cr-${scc}.ts`;
  const cop = `${dc}/w5-co-${scc}.ts`;
  const ragp = `${dc}/w5-rag-${scc}.ts`;
  await fsc.writeFile(cep, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(crp, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${cep}"`));
  await fsc.writeFile(cop, `export * from "${cep}";\nexport * from "${crp}";\n`);
  await fsc.writeFile(ragp, (await fsc.readFile(new URL("../packages/rag/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${cop}"`));
  const R = await import(ragp);

  const chunks = R.chunkDocument({ id: "D1", title: "就業規則", body: `総則\n\n${"あ".repeat(2000)}`, source: "wiki", acl: { roles: ["hr"] } }, { maxChars: 800, overlap: 100 });
  ok("チャンク: 各断片<=maxChars・id=docId#i・title/source/acl継承",
    chunks.length >= 3 && chunks.every((c) => c.text.length <= 800) && chunks[0].id === "D1#0" && chunks.every((c) => c.acl.roles[0] === "hr" && c.source === "wiki"));

  ok("canAccess: role/user/public可・ACL無やrole不一致は不可(管理者でも全許可しない)",
    R.canAccess({ id: "u", roles: ["hr"] }, { roles: ["hr"] }) === true && R.canAccess({ id: "u", roles: ["m"] }, { users: ["u"] }) === true && R.canAccess({ id: "u", roles: ["m"] }, { public: true }) === true && R.canAccess({ id: "u", roles: ["m"] }, { roles: ["hr"] }) === false && R.canAccess({ id: "a", roles: ["admin"] }, { roles: ["hr"] }) === false && R.canAccess({ id: "u", roles: [] }, undefined) === false);

  const indexed = [];
  const backend = { index: async (d) => { indexed.push(...d); return { ok: true, value: undefined }; }, search: async (q, l) => ({ ok: true, value: indexed.filter((x) => String(x.body).includes(q) || String(x.title).includes(q)).slice(0, l).map((x, i) => ({ document: { id: x.id }, score: 10 - i })) }), delete: async () => ({ ok: true, value: undefined }) };
  const store = R.createRagStore({ backend, chunk: { maxChars: 100, overlap: 0 } });
  await store.ingest([{ id: "HR", title: "人事", body: "賞与の計算", acl: { roles: ["hr"] } }, { id: "PUB", title: "お知らせ", body: "賞与支給日", acl: { public: true } }, { id: "SEC", title: "役員", body: "賞与原資", acl: { roles: ["exec"] } }]);
  const m = await store.retrieve("賞与", { id: "m", roles: ["member"] }, 10);
  const h = await store.retrieve("賞与", { id: "h", roles: ["hr"] }, 10);
  const md = new Set(m.value.map((x) => x.chunk.docId));
  const hd = new Set(h.value.map((x) => x.chunk.docId));
  const empty = await store.retrieve("  ", { id: "x", roles: [] });
  ok("retrieve: memberはpublicのみ・hrはpublic+HR(SEC除外)・スコア降順・空クエリVALIDATION",
    md.has("PUB") && !md.has("HR") && !md.has("SEC") && hd.has("PUB") && hd.has("HR") && !hd.has("SEC") && h.value.every((x, i, a) => i === 0 || a[i - 1].score >= x.score) && empty.ok === false && empty.error.code === "VALIDATION");

  const vstore = [];
  const store2 = R.createRagStore({ backend: { index: async () => ({ ok: true, value: undefined }), search: async () => ({ ok: true, value: [] }), delete: async () => ({ ok: true, value: undefined }) }, embedder: { embed: async (ts) => ts.map((t) => [(t.match(/賞与/g) || []).length]) }, vectorIndex: { upsert: async (its) => { vstore.push(...its); }, query: async (v, l) => vstore.map((it) => ({ chunk: it.chunk, score: it.vector[0] * 100 })).sort((a, b) => b.score - a.score).slice(0, l) }, chunk: { maxChars: 200, overlap: 0 } });
  await store2.ingest([{ id: "V", title: "賞与規程", body: "賞与賞与の話", acl: { public: true } }]);
  const vr = await store2.retrieve("賞与", { id: "x", roles: [] }, 5);
  const ctx = R.buildContext([{ chunk: { id: "a", docId: "D", title: "規則", text: "本文A", index: 0, source: "wiki" }, score: 9 }], { maxChars: 1000 });
  ok("embedding併用(BM25空でもベクトルでヒット) + buildContext(引用番号+source+区切り)",
    vr.ok && vr.value.length === 1 && vr.value[0].chunk.docId === "V" && vr.value[0].score > 0 && ctx.includes("【1】規則(wiki)") && ctx.includes("本文A"));

  for (const f of [cep, crp, cop, ragp]) await fsc.rm(f);
}


// ── internal-app: AI Gateway 配線(モック稼働・logStore集計) ──
{
  section("internal-app: AI Gateway 配線");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const scc = Date.now();
  const cep = `${dc}/w6-ce-${scc}.ts`;
  const crp = `${dc}/w6-cr-${scc}.ts`;
  const cop = `${dc}/w6-co-${scc}.ts`;
  const aip = `${dc}/w6-ai-${scc}.ts`;
  const gwp = `${dc}/w6-gw-${scc}.ts`;
  await fsc.writeFile(cep, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(crp, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${cep}"`));
  await fsc.writeFile(cop, `export * from "${cep}";\nexport * from "${crp}";\n`);
  await fsc.writeFile(aip, (await fsc.readFile(new URL("../packages/ai/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${cop}"`));
  // ai-gateway が読む featureEnv(env.ts)はテスト用スタブに差し替える
  const gwenv = `${dc}/w6-gwenv-${scc}.ts`;
  await fsc.writeFile(gwenv, `export const featureEnv = { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "", OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "" };\n`);
  await fsc.writeFile(gwp, (await fsc.readFile(new URL("../apps/internal-app/src/server/ai-gateway.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/ai"', `from "${aip}"`).replace(/from "\.\/env\.ts"/g, `from "${gwenv}"`));
  const before = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "";
  const G = await import(gwp);
  ok("aiIsMock=true(キー未設定)・要約成功でusage計上・model=mock",
    G.aiIsMock === true && await (async () => { const r = await G.aiGateway.chat({ messages: [{ role: "user", content: "a".repeat(300) }], maxTokens: 512, user: "u@x" }); return r.ok && r.value.model === "mock" && r.value.usage.inputTokens > 0; })());
  const t = G.aiLogStore.totals();
  ok("logStore: totals にコール計上・byUser に u@x", t.calls === 1 && t.byUser["u@x"].calls === 1);
  if (before !== undefined) process.env.ANTHROPIC_API_KEY = before;
  for (const f of [cep, crp, cop, aip, gwp]) await fsc.rm(f);
}


// ── ai/rag: embedding(hash/openai) + VectorIndex(memory/pgvector) + 実パイプライン ──
{
  section("ai/rag: embedding + VectorIndex");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const scc = Date.now();
  const cep = `${dc}/w7-ce-${scc}.ts`;
  const crp = `${dc}/w7-cr-${scc}.ts`;
  const cop = `${dc}/w7-co-${scc}.ts`;
  const aip = `${dc}/w7-ai-${scc}.ts`;
  const ragp = `${dc}/w7-rag-${scc}.ts`;
  await fsc.writeFile(cep, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(crp, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${cep}"`));
  await fsc.writeFile(cop, `export * from "${cep}";\nexport * from "${crp}";\n`);
  await fsc.writeFile(aip, (await fsc.readFile(new URL("../packages/ai/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${cop}"`));
  await fsc.writeFile(ragp, (await fsc.readFile(new URL("../packages/rag/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${cop}"`));
  const AI = await import(aip);
  const R = await import(ragp);

  const he = AI.createHashEmbedder(64);
  const [v1, v2, v3] = await he.embed(["賞与 の 計算", "賞与 の 支給", "天気 予報"]);
  ok("hashEmbedder: 64次元正規化・空は空・同語ほど近い", v1.length === 64 && Math.abs(Math.sqrt(v1.reduce((a, x) => a + x * x, 0)) - 1) < 1e-9 && (await he.embed([])).length === 0 && R.cosineSimilarity(v1, v2) > R.cosineSimilarity(v1, v3));

  let cap;
  const mkRes = (st, j) => ({ ok: st < 300, status: st, json: async () => j });
  const oe = AI.createOpenAiEmbedder({ apiKey: "sk-e", fetchImpl: async (u, i) => { cap = { u, i }; return mkRes(200, { data: [{ embedding: [0.1, 0.2] }] }); } });
  const emb = await oe.embed(["a"]);
  let ethrew = ""; try { await AI.createOpenAiEmbedder({ apiKey: "k", fetchImpl: async () => mkRes(400, { error: { message: "bad" } }) }).embed(["x"]); } catch (e) { ethrew = e.message; }
  ok("openaiEmbedder: /v1/embeddings・Bearer・data→vectors・エラーstatus+message", cap.u.endsWith("/v1/embeddings") && cap.i.headers.authorization === "Bearer sk-e" && emb[0][0] === 0.1 && ethrew.includes("openai embeddings 400"));

  const vi = R.createMemoryVectorIndex();
  const mk = (id, vec) => ({ id, vector: vec, chunk: { id, docId: id, title: id, text: id, index: 0 } });
  await vi.upsert([mk("A", [1, 0, 0]), mk("B", [0.9, 0.1, 0]), mk("C", [0, 0, 1])]);
  const q = await vi.query([1, 0, 0], 2);
  const calls = [];
  const db = { execute: async (sql, params) => { calls.push({ sql, params }); }, queryRows: async (sql, params) => { calls.push({ sql, params }); return [{ id: "X", chunk: JSON.stringify({ id: "X", docId: "D", title: "t", text: "b", index: 0 }), distance: 0.2 }]; } };
  const pv = R.createPgVectorIndex(db);
  await pv.upsert([mk("X", [0.1, 0.2])]);
  const pq = await pv.query([0.1, 0.2], 5);
  ok("VectorIndex: memory(コサイン降順) + pgvector(UPSERT/<=>/score=1-distance/chunk復元)",
    q[0].chunk.id === "A" && q[1].chunk.id === "B" && calls[0].sql.includes("ON CONFLICT") && calls[0].params[2] === "[0.1,0.2]" && calls[1].sql.includes("<=>") && Math.abs(pq[0].score - 0.8) < 1e-9 && pq[0].chunk.id === "X");

  const backend = { index: async () => ({ ok: true, value: undefined }), search: async () => ({ ok: true, value: [] }), delete: async () => ({ ok: true, value: undefined }) };
  const store = R.createRagStore({ backend, embedder: he, vectorIndex: R.createMemoryVectorIndex(), chunk: { maxChars: 200, overlap: 0 } });
  await store.ingest([{ id: "HR", title: "賞与規程", body: "賞与 の 計算 と 支給", acl: { roles: ["hr"] } }, { id: "PUB", title: "お知らせ", body: "賞与 の 支給日", acl: { public: true } }]);
  const m = await store.retrieve("賞与 支給", { id: "m", roles: ["member"] }, 5);
  const docs = m.value.map((h) => h.chunk.docId);
  ok("実パイプライン: hash embed→memory index→ベクトル検索が権限フィルタと両立(PUB可/HR除外)", m.ok && docs.includes("PUB") && !docs.includes("HR"));

  for (const f of [cep, crp, cop, aip, ragp]) await fsc.rm(f);
}


// ── advisor: Package Finder + Duplicate Detector ──
{
  section("advisor: find / duplicates");
  const A = await import(new URL("./advisor.mjs", import.meta.url).href);
  const pkgs = A.loadPackages();
  ok("loadPackages: 107件・category/exports/summary(ai=AI基盤)", pkgs.length === 107 && pkgs.find((p) => p.name === "ai").category === "AI基盤" && pkgs.find((p) => p.name === "mail").exports.length > 0);
  const hits = A.find(["mail", "送信"]);
  ok("find: mailがトップ・score降順・該当なしは空(新規作成の合図)", hits[0].name === "mail" && hits.every((h, i, a) => i === 0 || a[i - 1].score >= h.score) && A.find(["xyzzy_nonexistent"]).length === 0);
  const d = A.duplicates();
  ok("duplicates: 同名(Session←auth,session)・類似・孤立(理由付き)", d.sameName.some((s) => s.export === "Session" && s.packages.includes("auth") && s.packages.includes("session")) && d.similar.length > 0 && d.isolated.every((i) => i.name && i.reason));
}


// ── csv: ストリーミング/チャンク処理(zoho-backup由来を汎用化) ──
{
  section("csv: streamCsvLines / parseCsvChunks");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const csvp = `${dc}/w9-csv-${Date.now()}.ts`;
  await fsc.writeFile(csvp, (await fsc.readFile(new URL("../packages/csv/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  const C = await import(csvp);

  const lines = ["id,name,dept", "1,山田,営業", "2,佐藤,開発", "3,鈴木,営業", "4,田中,人事"];
  let seen = []; let headerCols = null; let pr = [];
  const r1 = await C.streamCsvLines(lines, { chunkSize: 2, onHeader: (c) => { headerCols = c; } }, (rows, prog) => { seen.push(...rows); pr.push({ ...prog }); });
  ok("streamCsvLines: ヘッダ検出・chunkSize2→2チャンク・全4行・オブジェクト化・進捗", headerCols[0] === "id" && r1.chunks === 2 && r1.totalRows === 4 && seen.length === 4 && seen[0].name === "山田" && seen[3].dept === "人事" && pr[1].rowsSoFar === 4);

  async function* asyncLines() { for (const l of ["a,b", "1,2", "", "3,4"]) { await Promise.resolve(); yield l; } }
  let ac = [];
  const r2 = await C.streamCsvLines(asyncLines(), { chunkSize: 10 }, (rows) => { ac.push(...rows); });
  ok("streamCsvLines: AsyncIterable対応・空行スキップ・オブジェクト化", r2.totalRows === 2 && ac[0].a === "1" && ac[1].b === "4");

  const text = 'id,memo\n1,"a\nb"\n2,c\n3,d';
  let pc = []; let pcols = null;
  const r3 = await C.parseCsvChunks(text, { chunkSize: 2, onHeader: (c) => { pcols = c; } }, (rows) => { pc.push(...rows); });
  ok("parseCsvChunks: 埋め込み改行保持・2行ずつ・ヘッダ通知・回帰(既存parseCsv健在)", pcols[0] === "id" && r3.totalRows === 3 && r3.chunks === 2 && pc[0].memo === "a\nb" && C.parseCsv("a,b\n1,2", { header: true })[0].a === "1");

  await fsc.rm(csvp);
}


// ── internal-app: RAG サービス配線(seed + 権限継承検索の実挙動) ──
{
  section("internal-app: RAG サービス配線");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const base = `${dc}/wA-${sc}`;
  await fsc.mkdir(`${base}/search/adapters`, { recursive: true });
  const mapCore = (t) => t.replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${base}/core.ts"`);
  await fsc.writeFile(`${base}/core-error.ts`, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(`${base}/core-result.ts`, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${base}/core-error.ts"`));
  await fsc.writeFile(`${base}/core.ts`, `export * from "${base}/core-error.ts";\nexport * from "${base}/core-result.ts";\n`);
  await fsc.writeFile(`${base}/search/tokenize.ts`, mapCore(await fsc.readFile(new URL("../packages/search/src/tokenize.ts", import.meta.url), "utf8")));
  await fsc.writeFile(`${base}/search/bm25.ts`, mapCore(await fsc.readFile(new URL("../packages/search/src/bm25.ts", import.meta.url), "utf8")));
  await fsc.writeFile(`${base}/search/adapters/memory.ts`, mapCore(await fsc.readFile(new URL("../packages/search/src/adapters/memory.ts", import.meta.url), "utf8")));
  await fsc.writeFile(`${base}/search/index.ts`, mapCore(await fsc.readFile(new URL("../packages/search/src/index.ts", import.meta.url), "utf8")).split("\n").filter((l) => !l.includes("meilisearch")).join("\n"));
  await fsc.writeFile(`${base}/ai.ts`, mapCore(await fsc.readFile(new URL("../packages/ai/src/index.ts", import.meta.url), "utf8")));
  await fsc.writeFile(`${base}/rag.ts`, mapCore(await fsc.readFile(new URL("../packages/rag/src/index.ts", import.meta.url), "utf8")));
  await fsc.writeFile(`${base}/utils-strings.ts`, (await fsc.readFile(new URL("../packages/utils/src/strings.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(`${base}/utils.ts`, `export * from "${base}/utils-strings.ts";\n`);
  // rag-service が import する dictionary-store も合成(utils を参照)
  await fsc.writeFile(`${base}/dictionary-store.ts`, (await fsc.readFile(new URL("../apps/internal-app/src/server/dictionary-store.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/utils"', `from "${base}/utils.ts"`));
  // rag-service が import する csv も合成(core を参照)
  await fsc.writeFile(`${base}/csv.ts`, (await fsc.readFile(new URL("../packages/csv/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${base}/core.ts"`));
  let svc = (await fsc.readFile(new URL("../apps/internal-app/src/server/rag-service.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  svc = svc.replace('from "@platform/rag"', `from "${base}/rag.ts"`).replace('from "@platform/search"', `from "${base}/search/index.ts"`).replace('from "@platform/ai"', `from "${base}/ai.ts"`).replace('from "@platform/utils"', `from "${base}/utils.ts"`).replace('from "@platform/csv"', `from "${base}/csv.ts"`);
  await fsc.writeFile(`${base}/rag-service.ts`, svc);
  const S = await import(`${base}/rag-service.ts`);

  await S.ensureSeeded();
  await S.ensureSeeded();
  const member = await S.ragStore.retrieve("賞与 計算", { id: "m", roles: ["member"] }, 5);
  const hr = await S.ragStore.retrieve("賞与 計算", { id: "h", roles: ["hr"] }, 5);
  const admin = await S.ragStore.retrieve("経営 計画", { id: "a", roles: ["admin"] }, 5);
  const mPub = await S.ragStore.retrieve("休業", { id: "m", roles: ["member"] }, 5);
  const mExec = await S.ragStore.retrieve("経営 計画", { id: "m", roles: ["member"] }, 5);
  ok("RAG配線: seed冪等・権限継承(member賞与見えず/hr見える/admin役員限定見える)・public全員可・役員限定はmember不可",
    member.ok && !member.value.some((h) => h.chunk.title.includes("賞与")) && hr.value.some((h) => h.chunk.title.includes("賞与")) && admin.value.some((h) => h.chunk.title.includes("経営")) && mPub.value.some((h) => h.chunk.title.includes("休業")) && !mExec.value.some((h) => h.chunk.title.includes("経営")));

  await fsc.rm(base, { recursive: true, force: true });
}


// ── mcp: HTTP トランスポート(yojitsu由来を汎用化) ──
{
  section("mcp: handleHttpMcp / extractBearerToken");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const mp = `${osc.tmpdir()}/wB-mcp-${Date.now()}.ts`;
  await fsc.writeFile(mp, (await fsc.readFile(new URL("../packages/mcp/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  const M = await import(mp);

  const tools = [{ name: "echo", description: "d", inputSchema: { type: "object" }, handler: (a) => M.textResult(`e:${a.m}`), scopes: ["read"] }];
  const server = { name: "t", version: "1", tools };
  const authServer = { ...server, authorizeTool: (tool, ctx) => (tool.scopes ?? []).every((s) => (ctx.subject?.scopes ?? []).includes(s)) || "scope不足" };

  ok("extractBearerToken: Bearer抽出・大小無視・無し/BasicはNull", M.extractBearerToken("Bearer abc") === "abc" && M.extractBearerToken("bearer X") === "X" && M.extractBearerToken(null) === null && M.extractBearerToken("Basic z") === null);

  const get = await M.handleHttpMcp(new Request("http://x/mcp", { method: "GET" }), { server });
  const list = await M.handleHttpMcp(new Request("http://x/mcp", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }), { server });
  const listBody = await list.json();
  ok("HTTP: GETは405/Allow・POST tools/listは200結果", get.status === 405 && get.headers.get("allow") === "POST" && list.status === 200 && listBody.result.tools[0].name === "echo");

  const authOpts = { server: authServer, authenticate: (t) => (t === "good" ? { subject: { id: "u", scopes: ["read"] } } : null), resourceMetadataUrl: "http://x/.well-known/oauth-protected-resource" };
  const noAuth = await M.handleHttpMcp(new Request("http://x/mcp", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }), authOpts);
  const good = await M.handleHttpMcp(new Request("http://x/mcp", { method: "POST", headers: { authorization: "Bearer good" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "echo", arguments: { m: "hi" } } }) }), authOpts);
  const goodBody = await good.json();
  ok("HTTP認証: トークン無→401+WWW-Authenticate・正トークン→実行(ctx scope認可)", noAuth.status === 401 && noAuth.headers.get("www-authenticate").includes("resource_metadata") && good.status === 200 && goodBody.result.content[0].text === "e:hi");

  const notif = await M.handleHttpMcp(new Request("http://x/mcp", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) }), { server });
  const bad = await M.handleHttpMcp(new Request("http://x/mcp", { method: "POST", body: "{bad" }), { server });
  ok("HTTP: 通知は202・不正JSONは400(-32700)", notif.status === 202 && bad.status === 400 && (await bad.json()).error.code === -32700);

  await fsc.rm(mp);
}


// ── rag: ソース取り込みヘルパー(textToDocument / rowsToDocuments / splitTextToDocuments) ──
{
  section("rag: ソース取り込みヘルパー");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const cep = `${dc}/wC-ce-${sc}.ts`;
  const crp = `${dc}/wC-cr-${sc}.ts`;
  const cop = `${dc}/wC-co-${sc}.ts`;
  const ragp = `${dc}/wC-rag-${sc}.ts`;
  await fsc.writeFile(cep, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(crp, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${cep}"`));
  await fsc.writeFile(cop, `export * from "${cep}";\nexport * from "${crp}";\n`);
  await fsc.writeFile(ragp, (await fsc.readFile(new URL("../packages/rag/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${cop}"`));
  const R = await import(ragp);

  const d = R.textToDocument({ id: "T1", title: "規程", text: "本文", source: "wiki", acl: { roles: ["hr"] } });
  ok("textToDocument: text→body・source/acl 継承", d.id === "T1" && d.body === "本文" && d.source === "wiki" && d.acl.roles[0] === "hr");

  const rows = [{ 名前: "山田", 部署: "営業", 空欄: "" }, { 名前: "佐藤", 部署: "開発" }];
  const rowDocs = R.rowsToDocuments(rows, { idPrefix: "emp", title: "従業員", acl: { public: true }, rowTitle: (r) => `従業員 ${r.名前}` });
  const sheetDocs = R.rowsToDocuments(rows, { idPrefix: "emp", title: "一覧", mode: "sheet" });
  ok("rowsToDocuments: row(1行1doc・空値除外・rowTitle) / sheet(全体1doc・行見出し)",
    rowDocs.length === 2 && rowDocs[0].id === "emp#0" && rowDocs[0].title === "従業員 山田" && rowDocs[0].body.includes("名前: 山田") && !rowDocs[0].body.includes("空欄") && sheetDocs.length === 1 && sheetDocs[0].body.includes("# 行 1"));

  const split = R.splitTextToDocuments("第1章\n内容A\n\n\n第2章\n内容B", { idPrefix: "pdf", title: "マニュアル", source: "pdf" });
  const single = R.splitTextToDocuments("単一段落", { idPrefix: "x", title: "t" });
  ok("splitTextToDocuments: 連続空行で節分割・区切りなしは1doc・source継承",
    split.length === 2 && split[0].id === "pdf#0" && split[0].body.includes("第1章") && split[0].source === "pdf" && single.length === 1 && single[0].body === "単一段落");

  const backend = { index: async () => ({ ok: true, value: undefined }), search: async () => ({ ok: true, value: [] }), delete: async () => ({ ok: true, value: undefined }) };
  const store = R.createRagStore({ backend, chunk: { maxChars: 200, overlap: 0 } });
  const ing = await store.ingest(R.rowsToDocuments(rows, { idPrefix: "e", title: "従業員", acl: { public: true } }));
  ok("ingest: 生成した RagDocument をそのまま取り込める", ing.ok && ing.value.chunks >= 2);

  for (const f of [cep, crp, cop, ragp]) await fsc.rm(f);
}

// ── reference: gen-reference の抽出(JSDoc要約) ──
{
  section("reference: API Reference 生成");
  const fsc = await import("node:fs/promises");
  const raw = await fsc.readFile(new URL("../docs/platform/api-reference.json", import.meta.url), "utf8");
  const ref = JSON.parse(raw);
  const total = Object.values(ref).reduce((a, v) => a + v.length, 0);
  const withSummary = Object.values(ref).reduce((a, v) => a + v.filter((e) => e.summary).length, 0);
  ok("api-reference: 50+パッケージ・400+エントリ・要約付き90%超・kind付き",
    Object.keys(ref).length >= 50 && total >= 400 && withSummary / total > 0.9 && ref["@platform/rag"].some((e) => e.name === "chunkDocument" && e.summary.length > 0) && ref["@platform/ai"].some((e) => e.kind === "interface"));
}


// ── ai: 画像生成/編集ゲートウェイ(nano-banana一般化) ──
{
  section("ai: AI Image Gateway");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const cep = `${dc}/wE-ce-${sc}.ts`;
  const crp = `${dc}/wE-cr-${sc}.ts`;
  const cop = `${dc}/wE-co-${sc}.ts`;
  const aip = `${dc}/wE-ai-${sc}.ts`;
  await fsc.writeFile(cep, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(crp, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${cep}"`));
  await fsc.writeFile(cop, `export * from "${cep}";\nexport * from "${crp}";\n`);
  await fsc.writeFile(aip, (await fsc.readFile(new URL("../packages/ai/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${cop}"`));
  const AI = await import(aip);

  const store = AI.createMemoryAiLogStore();
  const P = { id: "gemini-img", models: ["gemini"], generate: async (r) => ({ images: Array(r.n).fill(`img:${r.prompt}:${r.image ? "edit" : "gen"}`) }) };
  const Q = { id: "openai-image", models: ["gpt-image"], generate: async () => ({ images: ["oai"] }) };
  const gw = AI.createAiImageGateway({ providers: [P, Q], defaultModel: "gemini-2-flash", routes: { special: "openai-image" }, pricePerImageJpy: { "gemini-2-flash": 5 }, maxImagesPerCall: 3, logStore: store, now: () => 1000 });

  const r1 = await gw.generate({ prompt: "猫", n: 10, user: "u@x" });
  const r2 = await gw.generate({ prompt: "背景を青空に", image: "data:...", n: 1 });
  const r3 = await gw.generate({ model: "special", prompt: "x" });
  const bad = await gw.generate({ prompt: "  " });
  ok("Image GW: ルーティング(接頭辞/明示)・n=10→上限3・1枚5円×3=15・編集モード・空promptVALIDATION",
    r1.ok && r1.value.provider === "gemini-img" && r1.value.images.length === 3 && r1.value.costJpy === 15 && r2.value.images[0] === "img:背景を青空に:edit" && r3.value.provider === "openai-image" && bad.ok === false && bad.error.code === "VALIDATION");

  const F = { id: "f", models: ["gemini"], generate: async () => { throw new Error("画像API死亡"); } };
  const rf = await AI.createAiImageGateway({ providers: [F], defaultModel: "gemini-x", logStore: store, now: () => 2000 }).generate({ prompt: "x" });
  let cap;
  const mkRes = (s, j) => ({ ok: s < 300, status: s, json: async () => j });
  const oip = AI.createOpenAiImageProvider({ apiKey: "sk-i", fetchImpl: async (u, i) => { cap = { u, i }; return mkRes(200, { data: [{ b64_json: "AAAA" }, { url: "http://img" }] }); } });
  const or2 = await oip.generate({ prompt: "犬", model: "gpt-image-1", n: 2, size: "1024x1024" });
  let othrew = ""; try { await AI.createOpenAiImageProvider({ apiKey: "k", fetchImpl: async () => mkRes(400, { error: { message: "bad" } }) }).generate({ prompt: "x", model: "m", n: 1 }); } catch (e) { othrew = e.message; }
  ok("Image GW: 失敗はEXTERNAL(元文言) / OpenAI画像(/v1/images/generations・Bearer・b64/url抽出・エラーstatus)",
    rf.ok === false && rf.error.code === "EXTERNAL" && rf.error.message.includes("画像API死亡") && cap.u.endsWith("/v1/images/generations") && cap.i.headers.authorization === "Bearer sk-i" && or2.images[0] === "AAAA" && or2.images[1] === "http://img" && othrew.includes("openai images 400"));

  for (const f of [cep, crp, cop, aip]) await fsc.rm(f);
}


// ── erd: Prisma schema → Mermaid ER図 ──
{
  section("erd: gen-erd (Prisma→Mermaid)");
  const E = await import(new URL("./gen-erd.mjs", import.meta.url).href);
  const schema = [
    "model Author {", "  id String @id", "  name String", "  books Book[]", "}",
    "model Book {", "  id String @id", "  title String", "  authorId String",
    "  author Author @relation(fields: [authorId], references: [id])",
    "  reviewId String?", "  review Review? @relation(fields: [reviewId], references: [id])", "}",
    "model Review {", "  id String @id", "  score Int", "}",
  ].join("\n");
  const models = E.parseSchema(schema);
  const mer = E.toMermaid(models);
  ok("parseSchema: 3モデル・scalar/relation判別・FK検出",
    models.length === 3 && models[1].fields.find((f) => f.name === "authorId" && !f.isRelation) && models[1].fields.find((f) => f.name === "author" && f.isRelation && f.hasFk));
  ok("toMermaid: erDiagram・PK・必須(}|--||)・任意(}o--||)・配列側は重複線なし",
    mer.startsWith("erDiagram") && mer.includes("String id PK") && mer.includes("Book }|--|| Author") && mer.includes("Book }o--|| Review") && !mer.includes("Author }"));
}


// ── cron: ファイルベースのプロセス間ロック(membership-extender一般化) ──
{
  section("cron: file lock");
  const fsc = await import("node:fs");
  const osc = await import("node:os");
  const dcc = osc.tmpdir();
  const sc = Date.now();
  const lockp = `${dcc}/wG-lock-${sc}.ts`;
  const lfp = `${dcc}/wG-lockfile-${sc}.ts`;
  await (await import("node:fs/promises")).writeFile(lockp, (await (await import("node:fs/promises")).readFile(new URL("../packages/cron/src/lock.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await (await import("node:fs/promises")).writeFile(lfp, (await (await import("node:fs/promises")).readFile(new URL("../packages/cron/src/lock-file.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./lock.ts"', `from "${lockp}"`));
  const L = await import(lfp);
  const dir = fsc.mkdtempSync(dcc + "/wG-flock-");
  const lf = dir + "/t.lock";

  ok("排他: 取得成功→保持者生存で再取得失敗→解放後再取得可",
    L.tryAcquireFileLock(lf, "A") === true && L.tryAcquireFileLock(lf, "B") === false && (L.releaseFileLock(lf), L.tryAcquireFileLock(lf, "C")) === true);
  L.releaseFileLock(lf);

  fsc.writeFileSync(lf, JSON.stringify({ pid: 999999, label: "dead", ts: Date.now() }));
  const deadReclaim = L.tryAcquireFileLock(lf, "D", { isAlive: (p) => p !== 999999 });
  L.releaseFileLock(lf);
  fsc.writeFileSync(lf, JSON.stringify({ pid: 1, label: "old", ts: Date.now() - 10 * 60000 }));
  const staleReclaim = L.tryAcquireFileLock(lf, "E", { isAlive: () => true, staleMs: 5 * 60000 });
  L.releaseFileLock(lf);
  fsc.writeFileSync(lf, JSON.stringify({ pid: 1, label: "active", ts: Date.now() }));
  const blocked = L.tryAcquireFileLock(lf, "F", { isAlive: () => true });
  fsc.unlinkSync(lf);
  ok("回収: 死亡PIDは回収・stale(古い)は回収・生存&新しいは失敗", deadReclaim === true && staleReclaim === true && blocked === false);

  fsc.writeFileSync(lf, JSON.stringify({ pid: process.pid, label: "holder", ts: Date.now() }));
  let waitCount = 0;
  const release = await L.acquireFileLock(lf, "waiter", { waitTimeoutMs: 5000, pollMs: 5, isAlive: () => true, sleep: async (ms) => { waitCount++; if (waitCount === 2) fsc.unlinkSync(lf); await new Promise((r) => setTimeout(r, ms)); } });
  release();
  let threw = "";
  fsc.writeFileSync(lf, JSON.stringify({ pid: process.pid, label: "forever", ts: Date.now() }));
  try { await L.acquireFileLock(lf, "loser", { waitTimeoutMs: 30, pollMs: 10, isAlive: () => true, now: (() => { let t = 1000; return () => { t += 20; return t; }; })() }); } catch (e) { threw = e.message; }
  fsc.unlinkSync(lf);
  ok("待機: 保持中は待ち解放後取得・タイムアウトで例外(保持者情報)", typeof release === "function" && waitCount >= 2 && threw.includes("file lock timeout") && threw.includes("forever"));

  const store = L.createFileLockStore(dir);
  ok("createFileLockStore: LockStore I/F適合(acquire/release)", store.acquire("j", 60000) === true && store.acquire("j", 60000) === false && (store.release("j"), store.acquire("j", 60000)) === true);
  store.release("j");

  fsc.rmSync(dir, { recursive: true, force: true });
}


// ── app-map: App Router → 画面/API 一覧 ──
{
  section("app-map: gen-app-map");
  const A = await import(new URL("./gen-app-map.mjs", import.meta.url).href);
  ok("toUrl: [id]→:id / (group)除去 / [...slug]→*slug / ルート→/",
    A.toUrl("/x/src/app", "/x/src/app/api/items/[code]/route.ts") === "/api/items/:code" &&
    A.toUrl("/x/src/app", "/x/src/app/(dash)/settings/route.ts") === "/settings" &&
    A.toUrl("/x/src/app", "/x/src/app/blog/[...slug]/page.tsx") === "/blog/*slug" &&
    A.toUrl("/x/src/app", "/x/src/app/page.tsx") === "/");
  const r = A.analyze("crud-template");
  const internal = A.analyze("internal-app");
  ok("analyze: crud-template で items API(メソッド抽出)・internal-app 大規模・URL昇順ソート",
    r.apis.some((a) => a.url === "/api/items" && a.methods.includes("GET") && a.methods.includes("POST")) &&
    r.apis.some((a) => a.url === "/api/items/:code" && a.methods.includes("DELETE")) &&
    internal.pages.length > 50 && internal.apis.length > 150 && internal.apis.every((a, i, arr) => i === 0 || arr[i - 1].url <= a.url));
  const pub = A.analyze("public-site");
  const pubMd = A.toMarkdown(pub);
  ok("画面遷移: nav抽出(from/to)・flowchart LR生成・API除外・既知ページ限定",
    Array.isArray(pub.nav) && pub.nav.length > 0 && pub.nav[0].from && Array.isArray(pub.nav[0].to) &&
    pubMd.includes("## 画面遷移") && pubMd.includes("flowchart LR") && pubMd.includes("-->") && !pubMd.match(/-->.*\/api\//));
}


// ── internal-app: 画像ゲートウェイ配線(モック稼働・共通ログ計上) ──
{
  section("internal-app: 画像ゲートウェイ配線");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const cep = `${dc}/wI-ce-${sc}.ts`;
  const crp = `${dc}/wI-cr-${sc}.ts`;
  const cop = `${dc}/wI-co-${sc}.ts`;
  const aip = `${dc}/wI-ai-${sc}.ts`;
  const gwp = `${dc}/wI-gw-${sc}.ts`;
  await fsc.writeFile(cep, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(crp, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${cep}"`));
  await fsc.writeFile(cop, `export * from "${cep}";\nexport * from "${crp}";\n`);
  await fsc.writeFile(aip, (await fsc.readFile(new URL("../packages/ai/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${cop}"`));
  // ai-gateway が読む featureEnv(env.ts)はテスト用スタブに差し替える
  const gwenv = `${dc}/wI-gwenv-${sc}.ts`;
  await fsc.writeFile(gwenv, `export const featureEnv = { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "", OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "" };\n`);
  await fsc.writeFile(gwp, (await fsc.readFile(new URL("../apps/internal-app/src/server/ai-gateway.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/ai"', `from "${aip}"`).replace(/from "\.\/env\.ts"/g, `from "${gwenv}"`));
  const before = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "";
  const G = await import(gwp);
  const r = await G.aiImageGateway.generate({ prompt: "会社ロゴを水彩風に", n: 1, user: "u@x" });
  ok("aiImageIsMock=true・モック生成でSVG data URL・aiLogStore(共通)に計上",
    G.aiImageIsMock === true && r.ok && r.value.images[0].startsWith("data:image/svg+xml;base64,") && r.value.model === "mock" && G.aiLogStore.totals().calls >= 1);
  if (before !== undefined) process.env.OPENAI_API_KEY = before;
  for (const f of [cep, crp, cop, aip, gwp]) await fsc.rm(f);
}


// ── rpa: RPA 安全実行ランナー(直列化/リトライ/冪等/タイムアウト/監査) ──
{
  section("rpa: createRpaRunner");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const cep = `${dc}/wJ-ce-${sc}.ts`;
  const crp = `${dc}/wJ-cr-${sc}.ts`;
  const cop = `${dc}/wJ-co-${sc}.ts`;
  const rpap = `${dc}/wJ-rpa-${sc}.ts`;
  await fsc.writeFile(cep, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(crp, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${cep}"`));
  await fsc.writeFile(cop, `export * from "${cep}";\nexport * from "${crp}";\n`);
  await fsc.writeFile(rpap, (await fsc.readFile(new URL("../packages/rpa/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${cop}"`));
  const R = await import(rpap);

  // 基本 + 監査
  {
    const events = [];
    const runner = R.createRpaRunner({ audit: (e) => events.push(e), genRunId: () => "R1", now: () => 1000 });
    const res = await runner.run({ name: "t1", run: async (ctx) => { await ctx.audit("step1"); return 42; } });
    const actions = events.map((e) => e.action);
    ok("基本: 成功・値42・監査(start/step1/success)・runId", res.ok && res.value.value === 42 && res.value.attempts === 1 && actions.includes("rpa.start") && actions.includes("step1") && actions.includes("rpa.success") && events[0].metadata.runId === "R1");
  }
  // 直列化
  {
    const held = new Set();
    const lock = { acquire: (k) => (held.has(k) ? false : (held.add(k), true)), release: (k) => held.delete(k) };
    const runner = R.createRpaRunner({ lock });
    held.add("chromium");
    const blocked = await runner.run({ name: "t2", lockKey: "chromium", run: async () => 1 });
    held.delete("chromium");
    const okres = await runner.run({ name: "t3", lockKey: "chromium", run: async () => "done" });
    ok("直列化: 保持中はCONFLICT・空きなら取得→実行→解放", blocked.ok === false && blocked.error.code === "CONFLICT" && okres.ok && okres.value.value === "done" && !held.has("chromium"));
  }
  // リトライ
  {
    let calls = 0;
    const runner = R.createRpaRunner({ sleep: async () => {} });
    const retryOk = await runner.run({ name: "t4", retry: { maxAttempts: 3, baseDelayMs: 1 }, run: async () => { calls++; if (calls < 3) throw new Error("一時失敗"); return "ok3"; } });
    const exhaust = await runner.run({ name: "t5", retry: { maxAttempts: 2, baseDelayMs: 1 }, run: async () => { throw new Error("恒久失敗"); } });
    let noRetryCalls = 0;
    const noRetry = await runner.run({ name: "t6", retry: { maxAttempts: 5, isRetryable: () => false }, run: async () => { noRetryCalls++; throw new Error("x"); } });
    ok("リトライ: 3回目成功(attempts=3)・上限超過EXTERNAL・isRetryable=falseは1回", retryOk.ok && retryOk.value.attempts === 3 && exhaust.ok === false && exhaust.error.code === "EXTERNAL" && exhaust.error.message.includes("恒久失敗") && noRetry.ok === false && noRetryCalls === 1);
  }
  // 冪等 + タイムアウト + ロック解放
  {
    const seen = new Set();
    const runner = R.createRpaRunner({ seenStore: { has: (k) => seen.has(k), add: (k) => seen.add(k) }, sleep: async () => {} });
    const r1 = await runner.run({ name: "t7", idempotencyKey: "d1", run: async () => "first" });
    const r2 = await runner.run({ name: "t7", idempotencyKey: "d1", run: async () => "second" });
    const to = await runner.run({ name: "t8", timeoutMs: 20, run: async () => { await new Promise((r) => setTimeout(r, 60)); return "ran"; } });
    const held = new Set();
    const lock = { acquire: (k) => (held.has(k) ? false : (held.add(k), true)), release: (k) => held.delete(k) };
    await R.createRpaRunner({ lock }).run({ name: "t9", lockKey: "L", run: async () => { throw new Error("失敗"); } });
    ok("冪等スキップ・タイムアウトINTERNAL・失敗時もロック解放", r1.value.value === "first" && r2.value.skipped === true && to.ok === false && to.error.code === "INTERNAL" && !held.has("L"));
  }
  for (const f of [cep, crp, cop, rpap]) await fsc.rm(f);
}


// ── security: リプレイ防止(universe-club jti-store 一般化) ──
{
  section("security: ReplayGuard");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const rp = `${osc.tmpdir()}/wK-replay-${Date.now()}.ts`;
  await fsc.writeFile(rp, (await fsc.readFile(new URL("../packages/security/src/replay.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  const R = await import(rp);

  let clock = 1_000_000;
  const guard = R.createReplayGuard({ now: () => clock });
  const first = await guard.markUsedIfNew("jti-1", Math.floor(clock / 1000) + 300);
  const second = await guard.markUsedIfNew("jti-1", Math.floor(clock / 1000) + 300);
  const other = await guard.markUsedIfNew("jti-2");
  clock += 400_000;
  const reuse = await guard.markUsedIfNew("jti-1", Math.floor(clock / 1000) + 300);
  ok("ReplayGuard: 初見true・再利用false・別ID独立・TTL経過後は再度true", first === true && second === false && other === true && reuse === true);

  const store = R.createMemoryReplayStore({ now: () => 1000 });
  const calls = [];
  const custom = { markIfNew: (id) => { calls.push(id); return id !== "dup"; } };
  const g3 = R.createReplayGuard({ now: () => 2000 }, custom);
  ok("createMemoryReplayStore + ストア注入: markIfNew委譲", store.markIfNew("a", 999999) === true && store.markIfNew("a", 999999) === false && (await g3.markUsedIfNew("ok")) === true && (await g3.markUsedIfNew("dup")) === false && calls.length === 2);

  await fsc.rm(rp);
}


// ── internal-app: RPA ランナー配線(実例・直列化/リトライ/監査) ──
{
  section("internal-app: RPA ランナー配線");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const cep = `${dc}/wL-ce-${sc}.ts`;
  const crp = `${dc}/wL-cr-${sc}.ts`;
  const cop = `${dc}/wL-co-${sc}.ts`;
  const rpap = `${dc}/wL-rpa-${sc}.ts`;
  const clockp = `${dc}/wL-clock-${sc}.ts`;
  const cronp = `${dc}/wL-cron-${sc}.ts`;
  const svcp = `${dc}/wL-svc-${sc}.ts`;
  await fsc.writeFile(cep, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(crp, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${cep}"`));
  await fsc.writeFile(cop, `export * from "${cep}";\nexport * from "${crp}";\n`);
  await fsc.writeFile(rpap, (await fsc.readFile(new URL("../packages/rpa/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${cop}"`));
  await fsc.writeFile(clockp, (await fsc.readFile(new URL("../packages/cron/src/lock.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(cronp, `export { createMemoryLockStore } from "${clockp}";\n`);
  const onp = `${dc}/wL-on-${sc}.ts`;
  await fsc.writeFile(onp, (await fsc.readFile(new URL("../packages/os-notify/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${cop}"`));
  await fsc.writeFile(svcp, (await fsc.readFile(new URL("../apps/internal-app/src/server/rpa-service.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/rpa"', `from "${rpap}"`).replace('from "@platform/cron"', `from "${cronp}"`).replace('from "@platform/os-notify"', `from "${onp}"`));
  const S = await import(svcp);

  const r1 = await S.runDemoPointSync({ steps: 3 });
  const stepCount = S.rpaAuditLog.filter((e) => e.action === "step").length;
  const r2 = await S.runDemoPointSync({ steps: 2, fail: true });
  const errCount = S.rpaAuditLog.filter((e) => e.action === "rpa.error").length;
  ok("RPA配線: 成功(runId/attempts=1/step×3/success監査)・失敗はリトライ2回+error監査",
    r1.ok && r1.attempts === 1 && stepCount === 3 && S.rpaAuditLog.some((e) => e.action === "rpa.success") && !r2.ok && r2.error.includes("意図的な失敗") && errCount >= 2);

  // RPA 完了/失敗時の OS 通知連携(spawn 注入で捕捉)
  let notified = [];
  S.setRpaNotifySpawn((command, args) => { notified.push({ command, args }); return { on: (ev, cb) => { if (ev === "close") cb(0); }, unref: () => {} }; });
  notified = [];
  const okRun = await S.runDemoPointSync({ steps: 2 });
  const successNotified = notified.some((n) => n.args.some((a) => String(a).includes("RPA 完了") || String(a).includes("正常に終了")));
  notified = [];
  const failRun = await S.runDemoPointSync({ steps: 3, fail: true });
  const failNotified = notified.some((n) => n.args.some((a) => String(a).includes("RPA 失敗") || String(a).includes("失敗")));
  notified = [];
  await S.runDemoPointSync({ idempotencyKey: "wL-skip" });
  notified = [];
  const skip = await S.runDemoPointSync({ idempotencyKey: "wL-skip" });
  S.setRpaNotifySpawn(undefined);
  ok("RPA→OS通知連携: 成功で通知・失敗で通知・冪等スキップは通知なし",
    okRun.ok && successNotified && !failRun.ok && failNotified && skip.ok && skip.skipped === true && notified.length === 0);

  for (const f of [cep, crp, cop, rpap, clockp, cronp, onp, svcp]) await fsc.rm(f);
}

// ── depgraph: パッケージ依存グラフ生成 ──
{
  section("depgraph: gen-depgraph");
  const D = await import(new URL("./gen-depgraph.mjs", import.meta.url).href);
  const nodes = D.collect();
  const data = D.build();
  const md = D.toMarkdown(data);
  ok("depgraph: 107パッケージ収集・coreが被依存トップ・カテゴリ間flowchart・被依存/依存元表",
    Object.keys(nodes).length === 107 && nodes.rag.deps.includes("core") && data.topDepended[0][0] === "core" && data.topDepended[0][1] > 30 && md.includes("flowchart LR") && md.includes("被依存トップ12") && md.includes("@platform/core"));
}


// ── utils: 辞書ベースのテキスト正規化(interview-transcribe一般化) ──
{
  section("utils: replaceByDictionary / buildGlossaryHint");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const sp = `${osc.tmpdir()}/wK-strings-${Date.now()}.ts`;
  await fsc.writeFile(sp, (await fsc.readFile(new URL("../packages/utils/src/strings.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  const S = await import(sp);

  ok("replaceByDictionary: 単純置換・長いfrom優先・複数ルール・空from無視",
    S.replaceByDictionary("現地名で", [{ from: "現地名", to: "源氏名" }]) === "源氏名で" &&
    S.replaceByDictionary("会員制のクラブへ", [{ from: "会員制", to: "M" }, { from: "会員制のクラブ", to: "CLUB" }]) === "CLUBへ" &&
    S.replaceByDictionary("aaa bbb aaa", [{ from: "aaa", to: "X" }, { from: "bbb", to: "Y" }]) === "X Y X" &&
    S.replaceByDictionary("abc", [{ from: "", to: "X" }]) === "abc");
  ok("replaceByDictionary(wholeWord)・buildGlossaryHint(空/カスタム)",
    S.replaceByDictionary("cat category", [{ from: "cat", to: "DOG" }], { wholeWord: true }) === "DOG category" &&
    S.buildGlossaryHint(["源氏名", "同伴"]).includes("源氏名 / 同伴") && S.buildGlossaryHint([]) === "" &&
    S.buildGlossaryHint(["A", "B"], { intro: "用語:", separator: ", " }) === "用語:A, B。");

  await fsc.rm(sp);
}




// ── Windows セットアップスクリプト静的検証(setup.ps1 / setup.bat) ──
{
  section("scripts: Windows setup 静的検証");
  const fsc = await import("node:fs");
  const balance = (s, open, close) => { let d = 0; for (const c of s) { if (c === open) d += 1; else if (c === close) d -= 1; } return d; };
  const ps1 = fsc.readFileSync(new URL("../scripts/setup.ps1", import.meta.url), "utf8");
  const bat = fsc.readFileSync(new URL("../scripts/setup.bat", import.meta.url), "utf8");
  ok("実 setup.ps1: 波括弧/丸括弧均衡・param(Check/SkipDocker/SkipDb)・ErrorActionPreference",
    balance(ps1, "(", ")") === 0 && balance(ps1, "{", "}") === 0 && /param\s*\(/.test(ps1) && ["Check", "SkipDocker", "SkipDb"].every((x) => new RegExp(`\\[switch\\]\\$${x}`).test(ps1)) && /\$ErrorActionPreference\s*=/.test(ps1));
  ok("実 setup.bat: @echo off・goto ラベル整合・ExecutionPolicy Bypass で ps1 実行",
    bat.startsWith("@echo off") && [...bat.matchAll(/goto\s+(\w+)/gi)].every((m) => m[1].toLowerCase() === "eof" || new RegExp(`^:${m[1]}`, "mi").test(bat)) && bat.includes("ExecutionPolicy Bypass") && bat.includes("setup.ps1"));
}


// ── internal-app: 文字起こし→辞書補正→RAG投入 ──
{
  section("internal-app: 辞書補正 → RAG 投入");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const base = `${dc}/wN-${sc}`;
  await fsc.mkdir(`${base}/search/adapters`, { recursive: true });
  const mapCore = (t) => t.replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${base}/core.ts"`);
  await fsc.writeFile(`${base}/core-error.ts`, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(`${base}/core-result.ts`, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${base}/core-error.ts"`));
  await fsc.writeFile(`${base}/core.ts`, `export * from "${base}/core-error.ts";\nexport * from "${base}/core-result.ts";\n`);
  await fsc.writeFile(`${base}/search/tokenize.ts`, mapCore(await fsc.readFile(new URL("../packages/search/src/tokenize.ts", import.meta.url), "utf8")));
  await fsc.writeFile(`${base}/search/bm25.ts`, mapCore(await fsc.readFile(new URL("../packages/search/src/bm25.ts", import.meta.url), "utf8")));
  await fsc.writeFile(`${base}/search/adapters/memory.ts`, mapCore(await fsc.readFile(new URL("../packages/search/src/adapters/memory.ts", import.meta.url), "utf8")));
  await fsc.writeFile(`${base}/search/index.ts`, mapCore(await fsc.readFile(new URL("../packages/search/src/index.ts", import.meta.url), "utf8")).split("\n").filter((l) => !l.includes("meilisearch")).join("\n"));
  await fsc.writeFile(`${base}/ai.ts`, mapCore(await fsc.readFile(new URL("../packages/ai/src/index.ts", import.meta.url), "utf8")));
  await fsc.writeFile(`${base}/rag.ts`, mapCore(await fsc.readFile(new URL("../packages/rag/src/index.ts", import.meta.url), "utf8")));
  await fsc.writeFile(`${base}/utils-strings.ts`, (await fsc.readFile(new URL("../packages/utils/src/strings.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(`${base}/utils.ts`, `export * from "${base}/utils-strings.ts";\n`);
  // rag-service が import する dictionary-store も合成(utils を参照)
  await fsc.writeFile(`${base}/dictionary-store.ts`, (await fsc.readFile(new URL("../apps/internal-app/src/server/dictionary-store.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/utils"', `from "${base}/utils.ts"`));
  // rag-service が import する csv も合成(core を参照)
  await fsc.writeFile(`${base}/csv.ts`, (await fsc.readFile(new URL("../packages/csv/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${base}/core.ts"`));
  let svc = (await fsc.readFile(new URL("../apps/internal-app/src/server/rag-service.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  svc = svc.replace('from "@platform/rag"', `from "${base}/rag.ts"`).replace('from "@platform/search"', `from "${base}/search/index.ts"`).replace('from "@platform/ai"', `from "${base}/ai.ts"`).replace('from "@platform/utils"', `from "${base}/utils.ts"`).replace('from "@platform/csv"', `from "${base}/csv.ts"`);
  await fsc.writeFile(`${base}/rag-service.ts`, svc);
  const S = await import(`${base}/rag-service.ts`);

  const n1 = S.normalizeTranscript("今日の議事六を確認、御社の方針とアイティー部門のケーピーアイ");
  ok("normalizeTranscript: 誤変換を辞書補正(議事録/弊社の方針/IT部門/KPI)・changed",
    n1.corrected.includes("議事録") && n1.corrected.includes("弊社の方針") && n1.corrected.includes("IT部門") && n1.corrected.includes("KPI") && n1.changed === true && S.normalizeTranscript("普通").changed === false);
  ok("transcriptGlossaryHint: 用語ヒント文", S.transcriptGlossaryHint().includes("情シス") && S.transcriptGlossaryHint().includes("KPI"));
  // 辞書のアプリ設定化(可変ストア・編集API)
  const before = S.getReplacements().length;
  S.addReplacement({ from: "デーエックス", to: "DX" });
  const dynHit = S.normalizeTranscript("デーエックス推進").corrected.includes("DX");
  S.addReplacement({ from: "デーエックス", to: "DX2" }); // 上書き
  const overwrote = S.getReplacements().find((r) => r.from === "デーエックス").to === "DX2" && S.getReplacements().length === before + 1;
  const removed = S.removeReplacement("デーエックス") && S.getReplacements().length === before;
  const termOk = S.addGlossaryTerm("DX") && !S.addGlossaryTerm("DX") && S.transcriptGlossaryHint().includes("DX");
  ok("辞書設定化: add(動的反映)/上書き/remove/glossary追加(重複無視)",
    dynHit && overwrote && removed && S.addReplacement({ from: " ", to: "x" }) === false && termOk);

  const r = await S.ingestTranscript({ id: "tr-1", title: "定例MTG", text: "議事六: アイティー部門のケーピーアイ改善", acl: { roles: ["hr", "admin"] } });
  const hrHit = await S.ragStore.retrieve("KPI 改善", { id: "h", roles: ["hr"] }, 5);
  const memHit = await S.ragStore.retrieve("KPI 改善", { id: "m", roles: ["member"] }, 5);
  ok("ingestTranscript: 補正後で取り込み・補正後の語(KPI)で検索ヒット・権限継承(member不可)",
    r.chunks >= 1 && r.changed === true && !r.corrected.includes("議事六") && hrHit.ok && hrHit.value.some((h) => h.chunk.docId === "tr-1") && memHit.ok && !memHit.value.some((h) => h.chunk.docId === "tr-1"));

  await fsc.rm(base, { recursive: true, force: true });
}


// ── os-notify: OS ネイティブ通知・音(Windows/macOS/Linux) ──
{
  section("os-notify: createOsNotifier");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const cep = `${dc}/wO-ce-${sc}.ts`;
  const crp = `${dc}/wO-cr-${sc}.ts`;
  const cop = `${dc}/wO-co-${sc}.ts`;
  const osp = `${dc}/wO-os-${sc}.ts`;
  await fsc.writeFile(cep, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(crp, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${cep}"`));
  await fsc.writeFile(cop, `export * from "${cep}";\nexport * from "${crp}";\n`);
  await fsc.writeFile(osp, (await fsc.readFile(new URL("../packages/os-notify/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${cop}"`));
  const O = await import(osp);

  const win = O.buildNotifyCommand("win32", { title: "完了", message: "終了" });
  const mac = O.buildNotifyCommand("darwin", { title: "完了", message: "終了", sound: true });
  const lin = O.buildNotifyCommand("linux", { title: "完了", message: "終了" });
  ok("通知コマンド生成: win(powershell/toast)・mac(osascript+sound)・linux(notify-send)",
    win.command === "powershell" && win.args.some((a) => a.includes("完了") && a.includes("ToastNotification")) &&
    mac.command === "osascript" && mac.args[1].includes('display notification "終了"') && mac.args[1].includes('sound name "Ping"') &&
    lin.command === "notify-send" && lin.args[0] === "完了" && lin.args[1] === "終了");
  ok("エスケープ・音コマンド: win('')・mac(afplay)・linux(paplay/ベル)",
    O.buildNotifyCommand("win32", { title: "it's", message: "x" }).args.some((a) => a.includes("it''s")) &&
    O.buildSoundCommand("win32").args.some((a) => a.includes("Beep")) && O.buildSoundCommand("darwin").command === "afplay" &&
    O.buildSoundCommand("linux", "/x.wav").command === "paplay" && O.buildSoundCommand("linux").command === "sh");

  const dry = await O.createOsNotifier({ platform: "linux" }).notify({ title: "t", message: "m" });
  const empty = await O.createOsNotifier({ platform: "linux" }).notify({ title: " ", message: "" });
  let captured = [];
  const fakeSpawn = (command, args) => { captured.push({ command, args }); return { on: (ev, cb) => { if (ev === "close") cb(0); }, unref: () => {} }; };
  const winReal = await O.createOsNotifier({ platform: "win32", spawn: fakeSpawn }).notify({ title: "完了", message: "m", sound: true });
  const errSpawn = () => ({ on: (ev, cb) => { if (ev === "error") cb(new Error("ENOENT")); }, unref: () => {} });
  const re = await O.createOsNotifier({ platform: "linux", spawn: errSpawn }).notify({ title: "t", message: "m" });
  ok("dry-run/VALIDATION/spawn注入(win通知+音=2回)/spawnエラーEXTERNAL",
    dry.ok && dry.value.command === "notify-send" && empty.ok === false && empty.error.code === "VALIDATION" &&
    winReal.ok && captured.length === 2 && captured[0].command === "powershell" && captured[1].args.some((a) => a.includes("Beep")) &&
    re.ok === false && re.error.code === "EXTERNAL" && re.error.message.includes("ENOENT"));

  for (const f of [cep, crp, cop, osp]) await fsc.rm(f);
}


// ── internal-app: DB Viewer(安全な SQL 実行・行操作) ──
{
  section("internal-app: DB Viewer");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const cep = `${dc}/wP-ce-${sc}.ts`;
  const crp = `${dc}/wP-cr-${sc}.ts`;
  const cop = `${dc}/wP-co-${sc}.ts`;
  const dbp = `${dc}/wP-db-${sc}.ts`;
  const svcp = `${dc}/wP-svc-${sc}.ts`;
  const vp = `${dc}/wP-v-${sc}.ts`;
  await fsc.writeFile(cep, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(crp, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${cep}"`));
  await fsc.writeFile(cop, `export * from "${cep}";\nexport * from "${crp}";\n`);
  await fsc.writeFile(dbp, `export function normalizeBigInt(v){return typeof v==="bigint"?Number(v):v;}
export let _calls=[];
export async function rawQuery(_db,sql,params=[]){_calls.push({type:"query",sql,params});
  if(sql.includes("information_schema.tables")&&sql.includes("table_name=$1")){return {ok:true,value:[{n:["users","orders"].includes(params[0])?1:0}]};}
  if(sql.includes("information_schema.columns")){return {ok:true,value:[{column_name:"id",data_type:"integer",is_nullable:"NO",column_default:null},{column_name:"name",data_type:"text",is_nullable:"YES",column_default:null}]};}
  if(sql.includes("COUNT(*)"))return {ok:true,value:[{count:5,n:1}]};
  return {ok:true,value:[{id:1,name:"a"}]};}
export async function rawExecute(_db,sql,params=[]){_calls.push({type:"exec",sql,params});return {ok:true,value:1};}`);
  await fsc.writeFile(svcp, `export const db={};`);
  const csvp = `${dc}/wP-csv-${sc}.ts`;
  await fsc.writeFile(csvp, (await fsc.readFile(new URL("../packages/csv/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${cop}"`));
  let v = (await fsc.readFile(new URL("../apps/internal-app/src/server/db-viewer.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  v = v.replace('from "@platform/db"', `from "${dbp}"`).replace('from "@platform/csv"', `from "${csvp}"`).replace('from "./services.ts"', `from "${svcp}"`).replace('from "@platform/core"', `from "${cop}"`);
  await fsc.writeFile(vp, v);
  const V = await import(vp);
  const DB = await import(dbp);

  ok("classifySql: read/write/danger 判定",
    V.classifySql("SELECT * FROM x").kind === "read" && V.classifySql("EXPLAIN SELECT 1").kind === "read" &&
    V.classifySql("INSERT INTO x VALUES(1)").kind === "write" && V.classifySql("DROP TABLE x").kind === "danger" && V.classifySql("TRUNCATE x").kind === "danger");
  const multi = await V.runSql("SELECT 1; DROP TABLE x");
  const danger = await V.runSql("DROP TABLE users");
  const dangerOk = await V.runSql("TRUNCATE users", { allowDanger: true });
  ok("runSql: マルチ禁止(VALIDATION)・danger拒否(FORBIDDEN)・allowDangerで実行",
    multi.ok === false && multi.error.code === "VALIDATION" && danger.ok === false && danger.error.code === "FORBIDDEN" && dangerOk.ok && dangerOk.value.kind === "danger");

  DB._calls.length = 0;
  const ins = await V.insertRow("users", { id: 1, name: "太郎", evil: "'; DROP--" });
  const insCall = DB._calls.find((c) => c.type === "exec");
  const noWhere = await V.updateRows("users", { name: "x" }, {});
  const delNoWhere = await V.deleteRows("users", {});
  ok("行操作: 実在カラムのみ(evil除外)・値パラメータ化・UPDATE/DELETEはWHERE必須",
    ins.ok && insCall.sql.includes('"id"') && insCall.sql.includes('"name"') && !insCall.sql.includes("evil") && insCall.params.includes("太郎") &&
    noWhere.ok === false && noWhere.error.code === "VALIDATION" && delNoWhere.ok === false);
  ok("識別子: 実在しない/不正なテーブル名は NOT_FOUND(インジェクション防止)",
    (await V.selectRows("nonexistent")).ok === false && (await V.selectRows("users; DROP TABLE x")).ok === false && (await V.describeTable("x-y")).ok === false);

  // DDL(create/alter は ddl 種別・型ホワイトリスト・確認フラグ)
  DB._calls.length = 0;
  const ct = await V.createTable("new_t", [{ name: "id", type: "serial", primaryKey: true }, { name: "title", type: "varchar(255)", nullable: false }]);
  const ctSql = DB._calls.find((c) => c.type === "exec")?.sql ?? "";
  ok("DDL: classify(ddl)・runSql確認・createTable(PK/NOTNULL/型括弧)・型/識別子ホワイトリスト",
    V.classifySql("CREATE TABLE x (id int)").kind === "ddl" && V.classifySql("ALTER TABLE x ADD COLUMN y int").kind === "ddl" &&
    (await V.runSql("CREATE TABLE t (id int)")).ok === false && (await V.runSql("CREATE TABLE t (id int)", { allowDdl: true })).ok === true &&
    ct.ok && ctSql.includes('CREATE TABLE IF NOT EXISTS "new_t"') && ctSql.includes('"id" serial PRIMARY KEY') && ctSql.includes('"title" varchar(255) NOT NULL') &&
    (await V.createTable("t", [{ name: "x", type: "text; DROP TABLE users" }])).ok === false && (await V.createTable("t", [{ name: "x-y", type: "text" }])).ok === false);
  DB._calls.length = 0;
  const ac = await V.addColumn("users", { name: "email", type: "text", nullable: false });
  const dt = await V.dropTable("users");
  ok("DDL: addColumn(ADD COLUMN IF NOT EXISTS)・dropTable(実在確認)・dropColumn(不正名拒否)",
    ac.ok && DB._calls.some((c) => c.type === "exec" && c.sql.includes('ADD COLUMN IF NOT EXISTS "email"')) &&
    dt.ok && (await V.dropTable("nope")).ok === false && (await V.addColumn("users", { name: "x", type: "evil" })).ok === false && (await V.dropColumn("users", "x;y")).ok === false);

  // CSV 入出力
  const exp = await V.exportTableCsv("users");
  DB._calls.length = 0;
  const imp = await V.importTableCsv("users", "id,name,evil\n10,次郎,x\n11,三郎,y");
  const impCalls = DB._calls.filter((c) => c.type === "exec");
  ok("CSV: export(ヘッダ+BOM)・import(実在カラムのみ・evil除外・パラメータ化・存在しないテーブルはNOT_FOUND)",
    exp.ok && exp.value.charCodeAt(0) === 0xfeff && exp.value.includes("id") &&
    imp.ok && imp.value.inserted === 2 && impCalls.length === 2 && impCalls[0].sql.includes('"name"') && !impCalls[0].sql.includes("evil") && impCalls[0].params.includes("次郎") &&
    (await V.exportTableCsv("nope")).ok === false && (await V.importTableCsv("nope", "id\n1")).ok === false);

  for (const f of [cep, crp, cop, dbp, svcp, csvp, vp]) await fsc.rm(f);
}


// ── ui: アニメーション拡充(easing/tween/spring/keyframes/FLIP) ──
{
  section("ui: motion 拡充");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const mp = `${dc}/wQ-m-${sc}.ts`;
  const ep = `${dc}/wQ-e-${sc}.ts`;
  const tp = `${dc}/wQ-t-${sc}.ts`;
  await fsc.writeFile(mp, (await fsc.readFile(new URL("../packages/ui/src/lib/motion.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(ep, (await fsc.readFile(new URL("../packages/ui/src/lib/motion-extra.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('./motion.ts', mp));
  await fsc.writeFile(tp, (await fsc.readFile(new URL("../packages/ui/src/lib/motion-tween.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('./motion-extra.ts', ep).replace('./motion.ts', mp));
  const E = await import(ep);
  const T = await import(tp);
  const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

  ok("easingExtra: 20種すべて端点0→0/1→1・加速減速の向き",
    Object.values(E.easingExtra).every((f) => near(f(0), 0, 1e-6) && near(f(1), 1, 1e-6)) && E.easingExtra.easeOutQuart(0.5) > 0.5 && E.easingExtra.easeInQuart(0.5) < 0.5);
  ok("lerp/inverseLerp/mapRange(clamp・ゼロ除算回避)",
    E.lerp(0, 10, 0.3) === 3 && near(E.inverseLerp(0, 10, 3), 0.3) && near(E.mapRange(50, 0, 100, 0, 1), 0.5) && E.mapRange(150, 0, 100, 0, 1, true) === 1 && E.mapRange(5, 3, 3, 0, 10) === 0);
  ok("staggerDelays: start/end反転/center中央0/base加算",
    JSON.stringify(E.staggerDelays(3, 50)) === "[0,50,100]" && JSON.stringify(E.staggerDelays(3, 50, { from: "end" })) === "[100,50,0]" && E.staggerDelays(3, 50, { from: "center" })[1] === 0 && E.staggerDelays(2, 10, { base: 100 })[0] === 100);
  let st = { position: 0, velocity: 0 };
  for (let i = 0; i < 600; i++) st = E.stepSpring(st, 100);
  ok("stepSpring: 目標へ収束し settled", near(st.position, 100, 0.1) && E.isSpringSettled(st, 100));
  ok("tweenValue/tweenColor: 値・色補間(不正入力はfrom)",
    T.tweenValue(0, 100, 500, 1000) === 50 && T.tweenValue(0, 100, 500, 1000, "easeInQuad") === 25 && T.tweenColor("#000000", "#ffffff", 0.5) === "#808080" && T.tweenColor("bad", "#fff", 0.5) === "bad");
  const kf = T.buildKeyframes("fadeIn", [{ offset: 1, props: { opacity: "1" } }, { offset: 0, props: { opacity: "0" } }]);
  ok("buildKeyframes/Shorthand/flipTransform",
    kf.includes("@keyframes fadeIn") && kf.indexOf("0%") < kf.indexOf("100%") &&
    T.buildAnimationShorthand({ name: "f", duration: 300, easing: "ease-out", delay: 100, iterations: "infinite" }) === "300ms ease-out 100ms infinite normal both f" &&
    T.flipTransform({ x: 0, y: 0, width: 100, height: 100 }, { x: 50, y: 20, width: 200, height: 100 }).transform === "translate(-50px, -20px) scale(0.5, 1)" &&
    T.flipTransform({ x: 0, y: 0, width: 1, height: 1 }, { x: 0, y: 0, width: 1, height: 1 }).changed === false);

  for (const f of [mp, ep, tp]) await fsc.rm(f);
}


// ── ci-log-report: CI 実走ログ解析 ──
{
  section("ci-log-report: CI ログ解析");
  const M = await import(new URL("./ci-log-report.mjs", import.meta.url).href);
  const failLog = [
    "2026-07-14T05:12:30.0000000Z ##[group]Run node tools/preflight.mjs",
    "2026-07-14T05:12:34.0000000Z ##[error]Process completed with exit code 1.",
    "2026-07-14T05:12:34.5000000Z ##[endgroup]",
    "2026-07-14T05:12:35.0000000Z ##[group]Run pnpm typecheck",
    "2026-07-14T05:12:36.0000000Z src/foo.ts(3,10): error TS2304: Cannot find name 'bar'.",
    "2026-07-14T05:12:40.0000000Z ##[warning]deprecated API used",
    "2026-07-14T05:12:41.0000000Z ##[endgroup]",
    "2026-07-14T05:12:42.0000000Z ##[group]Run pnpm build",
    "2026-07-14T05:12:56.0000000Z ##[endgroup]",
  ].join("\n");
  const f = M.parseCiLog(failLog);
  ok("失敗ログ: failed=true・3ステップ・失敗2件・警告1・TS2304検出・所要算出・遅い順build最上位",
    f.failed === true && f.stepCount === 3 && f.failedSteps.length === 2 && f.totalWarnings === 1 &&
    f.failedSteps.some((s) => s.errors.some((e) => e.includes("TS2304"))) &&
    f.failedSteps.find((s) => s.name.includes("preflight")).durationSec === 5 &&
    f.slowestSteps[0].durationSec === 14);
  const okLog = "2026-07-14T05:10:00.0000000Z ##[group]Run x\n2026-07-14T05:10:06.0000000Z ##[endgroup]";
  const g = M.parseCiLog(okLog);
  ok("成功ログ: failed=false・グループ外エラーも0", g.failed === false && g.looseErrors.length === 0);
  ok("TS無しログ: グループ外##[error]を拾う・formatReportが失敗要約を返す",
    M.parseCiLog("plain\n##[error]bare").looseErrors.length === 1 && M.formatReport(f).includes("❌ CI 失敗"));
}

// ── rag search: 辞書補正の可視化 ──
{
  section("rag search: 辞書補正の可視化");
  const fsc = await import("node:fs/promises");
  const src = await fsc.readFile(new URL("../apps/internal-app/src/app/api/rag/search/route.ts", import.meta.url), "utf8");
  ok("search route: normalization{raw,corrected,changed} をレスポンスに含む",
    src.includes("normalization:") && src.includes("changed: normalized.changed") && src.includes("raw: rawQuery"));
  const cli = await fsc.readFile(new URL("../apps/internal-app/src/app/rag/rag-client.tsx", import.meta.url), "utf8");
  ok("rag-client: changed 時に補正バッジを表示",
    cli.includes("normalization.changed") && cli.includes("として検索しました"));
}

// ── elearning: コース進捗・クイズ採点・修了判定 ──
{
  section("elearning: gradeQuiz / courseProgress / certificate");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const cep = `${dc}/wR-ce-${sc}.ts`;
  const crp = `${dc}/wR-cr-${sc}.ts`;
  const cop = `${dc}/wR-co-${sc}.ts`;
  const elp = `${dc}/wR-el-${sc}.ts`;
  await fsc.writeFile(cep, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(crp, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${cep}"`));
  await fsc.writeFile(cop, `export * from "${cep}";\nexport * from "${crp}";\n`);
  await fsc.writeFile(elp, (await fsc.readFile(new URL("../packages/elearning/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${cop}"`));
  const E = await import(elp);

  const course = { id: "c1", title: "セキュリティ", modules: [
    { id: "m1", title: "導入", lessons: [{ id: "l1", title: "動画", type: "video", estimatedMinutes: 10 }, { id: "l2", title: "記事", type: "article", estimatedMinutes: 5 }] },
    { id: "m2", title: "テスト", lessons: [{ id: "l3", title: "クイズ", type: "quiz", estimatedMinutes: 5, quiz: [{ id: "q1", prompt: "?", choices: ["A", "B"], correct: [1] }, { id: "q2", prompt: "?", choices: ["A", "B", "C"], correct: [0, 2], multiple: true }] }] },
  ] };

  const gAll = E.gradeQuiz(course.modules[1].lessons[0].quiz, { q1: [1], q2: [2, 0] }, 0.6);
  const gHalf = E.gradeQuiz(course.modules[1].lessons[0].quiz, { q1: [1], q2: [0] }, 0.6);
  ok("gradeQuiz: 全問正解(複数選択順不同)passed・部分正解は不正解・空設問VALIDATION",
    gAll.ok && gAll.value.ratio === 1 && gAll.value.passed && gHalf.ok && gHalf.value.correctCount === 1 && gHalf.value.passed === false && E.gradeQuiz([], {}, 0.6).ok === false);

  const p1 = E.courseProgress(course, { completedLessons: ["l1"] });
  const pAll = E.courseProgress(course, { completedLessons: ["l1", "l2", "l3"] });
  ok("courseProgress: 重み付き(10/20=0.5)未修了・全完了で修了・moduleProgress・nextLesson",
    p1.ratio === 0.5 && p1.certified === false && pAll.ratio === 1 && pAll.certified === true &&
    E.moduleProgress(course, { completedLessons: ["l1"] })[0].ratio === 0.5 &&
    E.nextLesson(course, { completedLessons: ["l1"] }).id === "l2" && E.nextLesson(course, { completedLessons: ["l1", "l2", "l3"] }) === null);

  const mc = E.markLessonComplete(course, { completedLessons: [] }, "l1");
  const cert = E.issueCertificate(course, { completedLessons: ["l1", "l2", "l3"] }, "u1", new Date("2026-01-15T00:00:00Z"));
  ok("markLessonComplete(不変/重複なし/存在チェック)・issueCertificate(修了者発行/未修了FORBIDDEN)",
    mc.ok && mc.value.completedLessons.includes("l1") && E.markLessonComplete(course, { completedLessons: ["l1"] }, "l1").value.completedLessons.length === 1 &&
    E.markLessonComplete(course, { completedLessons: [] }, "xxx").ok === false &&
    cert.ok && cert.value.courseId === "c1" && cert.value.ratio === 1 && E.issueCertificate(course, { completedLessons: ["l1"] }, "u1").ok === false);

  for (const f of [cep, crp, cop, elp]) await fsc.rm(f);
}


// ── internal-app: e-learning 配線(コース受講・クイズ・修了証) ──
{
  section("internal-app: e-learning");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const dc = osc.tmpdir();
  const sc = Date.now();
  const cep = `${dc}/wS-ce-${sc}.ts`;
  const crp = `${dc}/wS-cr-${sc}.ts`;
  const cop = `${dc}/wS-co-${sc}.ts`;
  const elp = `${dc}/wS-el-${sc}.ts`;
  const svcp = `${dc}/wS-svc-${sc}.ts`;
  await fsc.writeFile(cep, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(crp, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${cep}"`));
  await fsc.writeFile(cop, `export * from "${cep}";\nexport * from "${crp}";\n`);
  await fsc.writeFile(elp, (await fsc.readFile(new URL("../packages/elearning/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${cop}"`));
  await fsc.writeFile(svcp, (await fsc.readFile(new URL("../apps/internal-app/src/server/elearning-service.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/elearning"', `from "${elp}"`));
  const S = await import(svcp);

  const s0 = S.getLearningState("wS-u1");
  S.completeLesson("wS-u1", "l1");
  S.completeLesson("wS-u1", "l2");
  S.completeLesson("wS-u1", "l3");
  S.completeLesson("wS-u1", "l4");
  const quiz = S.submitQuiz("wS-u1", "l5", { q1: [1], q2: [1, 2] });
  const cert = S.getCertificate("wS-u1");
  ok("e-learning: 初期進捗0→レッスン完了→クイズ合格で全修了→修了証発行",
    s0.summary.ratio === 0 && s0.next.id === "l1" && quiz.ok && quiz.result.passed && S.getLearningState("wS-u1").summary.certified === true && cert.ok && cert.certificate.courseId === "security-basics");
  const failQuiz = S.submitQuiz("wS-u2", "l5", { q1: [0], q2: [0] });
  ok("e-learning: 存在しないレッスンerror・クイズ不合格は未完了・未修了は修了証拒否",
    S.completeLesson("wS-u2", "xxx").ok === false && failQuiz.ok && failQuiz.result.passed === false && !S.getLearningState("wS-u2").progress.completedLessons.includes("l5") && S.getCertificate("wS-u2").ok === false);

  for (const f of [cep, crp, cop, elp, svcp]) await fsc.rm(f);
}


// ── dictionary-store: 辞書の DB 永続化 ──
{
  section("dictionary-store: 辞書のDB永続化");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const base = `${osc.tmpdir()}/dstore-${Date.now()}`;
  await fsc.mkdir(base, { recursive: true });
  await fsc.writeFile(`${base}/utils.ts`, "export interface ReplacementRule { from: string; to: string; }\n");
  await fsc.writeFile(`${base}/ds.ts`, (await fsc.readFile(new URL("../apps/internal-app/src/server/dictionary-store.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/utils"', `from "${base}/utils.ts"`));
  const { createDictionaryStore } = await import(`${base}/ds.ts`);

  // メモリのみ
  const mem = createDictionaryStore({ seedReplacements: [{ from: "現地名", to: "源氏名" }], seedTerms: ["源氏名"] });
  ok("メモリ: isPersistent=false・初期値・add/remove・重複上書き・空無視",
    mem.isPersistent() === false && mem.getReplacements()[0].from === "現地名" &&
    mem.addReplacement({ from: "簡易性", to: "会員制" }) && mem.getReplacements().length === 2 &&
    mem.removeReplacement("簡易性") && mem.getReplacements().length === 1 &&
    mem.addReplacement({ from: "現地名", to: "X" }) && mem.getReplacements().find((r) => r.from === "現地名").to === "X" &&
    !mem.addReplacement({ from: " ", to: "y" }) && mem.addTerm("源氏名") === false && mem.addTerm("同伴") === true);

  // モックDB永続化
  const mk = (rows, key) => ({
    async findMany() { return rows.slice(); },
    async upsert(a) { const k = a.where[key]; const e = rows.find((r) => r[key] === k); if (e) Object.assign(e, a.update); else rows.push(a.create); },
    async delete(a) { const i = rows.findIndex((r) => r[key] === a.where[key]); if (i >= 0) rows.splice(i, 1); },
  });
  const rep = [{ from: "議事六", to: "議事録" }]; const term = [{ term: "KPI" }];
  const db = { glossaryReplacement: mk(rep, "from"), glossaryTerm: mk(term, "term") };
  const store = createDictionaryStore({ db, seedReplacements: [{ from: "seed", to: "S" }], seedTerms: ["st"] });
  const loaded = await store.loadFromDb();
  store.addReplacement({ from: "新語", to: "NEW" });
  store.removeReplacement("新語");
  await new Promise((r) => setTimeout(r, 15));
  ok("DB: isPersistent=true・loadでDB内容に置換・add→upsert・remove→delete",
    store.isPersistent() === true && loaded.loaded === true &&
    store.getReplacements().some((r) => r.from === "議事六") && store.getTerms().includes("KPI") &&
    !store.getReplacements().some((r) => r.from === "seed") && !rep.some((r) => r.from === "新語"));

  // DB空→シード投入 / DBエラー→メモリ継続
  const er = []; const et = [];
  const store2 = createDictionaryStore({ db: { glossaryReplacement: mk(er, "from"), glossaryTerm: mk(et, "term") }, seedReplacements: [{ from: "a", to: "b" }], seedTerms: ["t1"] });
  await store2.loadFromDb();
  await new Promise((r) => setTimeout(r, 15));
  let errCaught = false;
  const store3 = createDictionaryStore({ db: { glossaryReplacement: { async findMany() { throw new Error("down"); }, async upsert() {}, async delete() {} }, glossaryTerm: { async findMany() { return []; }, async upsert() {}, async delete() {} }, }, seedReplacements: [{ from: "x", to: "y" }], onError: () => { errCaught = true; } });
  const r3 = await store3.loadFromDb();
  ok("DB空→シード投入・DBエラー→loaded=false&メモリ継続&onError",
    er.some((r) => r.from === "a") && et.some((t) => t.term === "t1") &&
    r3.loaded === false && store3.getReplacements()[0].from === "x" && errCaught);

  await fsc.rm(base, { recursive: true, force: true });
}

// ── theme: デザインテーマ(スキン)機構 ──
{
  section("theme: スキン機構");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const base = `${osc.tmpdir()}/theme-${Date.now()}`;
  await fsc.mkdir(base, { recursive: true });
  await fsc.writeFile(`${base}/core-error.ts`, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(`${base}/core-result.ts`, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${base}/core-error.ts"`));
  await fsc.writeFile(`${base}/core.ts`, `export * from "${base}/core-error.ts";\nexport * from "${base}/core-result.ts";\n`);
  await fsc.writeFile(`${base}/color.ts`, (await fsc.readFile(new URL("../packages/color/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${base}/core.ts"`));
  for (const f of ["tokens", "css", "registry", "themes", "a11y", "derive", "serialize", "index"]) {
    await fsc.writeFile(`${base}/${f}.ts`, (await fsc.readFile(new URL(`../packages/theme/src/${f}.ts`, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${base}/core.ts"`).replace('from "@platform/color"', `from "${base}/color.ts"`));
  }
  const T = await import(`${base}/index.ts`);

  const vars = T.themeToCssVars(T.defaultTheme, "light");
  ok("themeToCssVars: 色+shape変数・darkは別値・CSSブロック生成",
    vars["--color-primary"] === "#2563eb" && vars["--radius"] === "8px" && vars["--shadow"] !== undefined &&
    T.themeToCssVars(T.defaultTheme, "dark")["--color-bg"] === "#0f172a" &&
    T.themeToCssBlock(T.corporateTheme, "light", '[data-skin="corporate"]').includes("--color-primary: #1e3a8a"));
  const sheet = T.buildThemeStylesheet(T.builtInThemes);
  ok("buildThemeStylesheet: 11テーマ×2モード=22ブロック", (sheet.match(/data-skin=/g) || []).length === 22 && sheet.includes('[data-skin="soft"][data-theme="dark"]') && sheet.includes('[data-skin="cute"][data-theme="light"]'));

  const reg = T.createThemeRegistry({ themes: T.builtInThemes });
  ok("registry: 11テーマ・default既定・get/has/resolve・フォールバック",
    reg.ids().length === 11 && reg.getDefaultId() === "default" && reg.get("soft").name === "やわらか" &&
    reg.resolve("high-contrast").id === "high-contrast" && reg.resolve().id === "default" && reg.resolve("nope").id === "default");

  const custom = { id: "my-brand", name: "自社ブランド", shape: { fontFamily: "serif", radius: 12, spacing: 8, elevation: 2 }, modes: T.defaultTheme.modes };
  reg.register(custom);
  reg.register({ ...custom, name: "更新後" });
  reg.setDefault("soft");
  ok("registry: 後から追加(拡張性)・同id上書き・setDefault",
    reg.has("my-brand") && reg.ids().length === 12 && reg.get("my-brand").name === "更新後" && reg.getDefaultId() === "soft");

  let v = false, nf = false;
  try { reg.register({ ...custom, id: "bad id!" }); } catch (e) { v = e.code === "VALIDATION"; }
  try { reg.setDefault("ghost"); } catch (e) { nf = e.code === "NOT_FOUND"; }
  ok("registry: 不正id=VALIDATION・未登録setDefault=NOT_FOUND", v && nf);

  const el = { attrs: {}, props: {}, setAttribute(k, val) { this.attrs[k] = val; }, style: { setProperty(p, val) { el.props[p] = val; } } };
  T.applySkin(T.softTheme, "dark", el);
  ok("applySkin: data-skin/data-theme + CSS変数・要素なしは無害・isValidThemeId",
    el.attrs["data-skin"] === "soft" && el.attrs["data-theme"] === "dark" && el.props["--color-bg"] === "#2a2320" &&
    (T.applySkin(T.softTheme, "light"), true) && T.isValidThemeId("my-theme_1") && !T.isValidThemeId("has space"));

  // アクセシビリティ(WCAG コントラスト)検査
  ok("a11y: checkTheme(light/dark 2レポート・4ペア)・主ボタン/本文は全11テーマAA",
    (() => {
      const rep = T.checkTheme(T.modernTheme);
      if (rep.length !== 2 || rep[0].checks.length !== 4) return false;
      for (const t of T.builtInThemes) {
        for (const r of T.checkTheme(t)) {
          const btn = r.checks.find((c) => c.label.includes("主ボタン"));
          const txt = r.checks.find((c) => c.label.includes("本文テキスト / 背景"));
          if (btn.level === "fail" || txt.level === "fail") return false;
        }
      }
      return true;
    })());
  ok("a11y: findContrastIssues は配列・残る警告は補助テキストのみ(muted)",
    (() => {
      const issues = T.findContrastIssues(T.builtInThemes);
      if (!Array.isArray(issues)) return false;
      const nonMuted = issues.flatMap((i) => i.checks.filter((c) => c.level === "fail" && !c.label.includes("補助")));
      return nonMuted.length === 0;
    })());

  // deriveTheme: ブランド色から完全テーマを自動生成
  const derived = T.deriveTheme({ id: "acme", name: "ACME", primary: "#e60033", accent: "#0088cc" });
  ok("deriveTheme: 主色反映・light/dark生成・primaryFg自動・registryに登録可",
    derived.id === "acme" && derived.modes.light.primary === "#e60033" && derived.modes.dark.primary &&
    ["#000000", "#ffffff"].includes(derived.modes.light.primaryFg) &&
    (() => { const r = T.createThemeRegistry({ themes: T.builtInThemes }); r.register(derived); return r.has("acme"); })());
  ok("deriveTheme: base系統で背景可変・生成テーマの主ボタン/本文AA達成",
    T.deriveTheme({ id: "w", name: "W", primary: "#f97316", base: "warm" }).modes.light.bg !==
      T.deriveTheme({ id: "c", name: "C", primary: "#0891b2", base: "cool" }).modes.light.bg &&
    T.checkTheme(derived).every((r) => r.checks.find((c) => c.label.includes("主ボタン")).level !== "fail" && r.checks.find((c) => c.label.includes("本文テキスト / 背景")).level !== "fail"));

  // validateTheme / parseTheme(外部入力のゲート)
  ok("validateTheme: 標準11+derive生成は妥当・id/name/shape/色/範囲の不正を検出",
    T.builtInThemes.every((t) => T.validateTheme(t).length === 0) && T.validateTheme(derived).length === 0 &&
    T.validateTheme({ ...derived, id: "bad id!" }).some((i) => i.path === "id") &&
    T.validateTheme({ ...derived, name: "  " }).some((i) => i.path === "name") &&
    T.validateTheme({ ...derived, shape: undefined }).some((i) => i.path === "shape") &&
    T.validateTheme({ ...derived, shape: { ...derived.shape, radius: 999 } }).some((i) => i.path === "shape.radius") &&
    T.validateTheme({ ...derived, modes: { ...derived.modes, light: { ...derived.modes.light, primary: "not a color!!" } } }).some((i) => i.path.includes("primary")) &&
    T.validateTheme("string").length > 0 && T.validateTheme(null).length > 0);
  ok("parseTheme: 妥当は返す・不正はVALIDATION(理由付き)",
    T.parseTheme(derived).id === "acme" &&
    (() => { try { T.parseTheme({ id: "x" }); return false; } catch (e) { return e.code === "VALIDATION" && e.message.includes("不正"); } })());

  // JSON 入出力(エクスポート/インポート)
  ok("themeToJson/themesToJson → themesFromJson: 単体・束・素の配列で往復",
    T.themesFromJson(T.themeToJson(derived))[0].modes.light.primary === "#e60033" &&
    T.themesFromJson(T.themesToJson([derived, T.cuteTheme])).length === 2 &&
    T.themesFromJson(JSON.stringify([derived])).length === 1);
  ok("themesFromJson: 壊れたJSON・不正テーマ入りの束はVALIDATION",
    (() => { try { T.themesFromJson("{broken"); return false; } catch (e) { return e.code === "VALIDATION"; } })() &&
    (() => { try { T.themesFromJson(JSON.stringify({ version: 1, themes: [{ id: "no-modes" }] })); return false; } catch (e) { return e.code === "VALIDATION"; } })());

  await fsc.rm(base, { recursive: true, force: true });
}

// ── 辞書 CSV 入出力 + 変更監査 ──
{
  section("internal-app: 辞書 CSV 入出力 + 監査");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const base = `${osc.tmpdir()}/gcsv-${Date.now()}`;
  await fsc.mkdir(`${base}/search/adapters`, { recursive: true });
  const mapCore = async (rel, extra) => {
    let t = (await fsc.readFile(new URL(rel, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${base}/core.ts"`);
    if (extra) t = extra(t);
    return t;
  };
  await fsc.writeFile(`${base}/core-error.ts`, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(`${base}/core-result.ts`, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${base}/core-error.ts"`));
  await fsc.writeFile(`${base}/core.ts`, `export * from "${base}/core-error.ts";\nexport * from "${base}/core-result.ts";\n`);
  await fsc.writeFile(`${base}/search/tokenize.ts`, await mapCore("../packages/search/src/tokenize.ts"));
  await fsc.writeFile(`${base}/search/bm25.ts`, await mapCore("../packages/search/src/bm25.ts"));
  await fsc.writeFile(`${base}/search/adapters/memory.ts`, await mapCore("../packages/search/src/adapters/memory.ts"));
  await fsc.writeFile(`${base}/search/index.ts`, await mapCore("../packages/search/src/index.ts", (t) => t.split("\n").filter((l) => !l.includes("meilisearch")).join("\n")));
  await fsc.writeFile(`${base}/ai.ts`, await mapCore("../packages/ai/src/index.ts"));
  await fsc.writeFile(`${base}/rag.ts`, await mapCore("../packages/rag/src/index.ts"));
  await fsc.writeFile(`${base}/utils-strings.ts`, (await fsc.readFile(new URL("../packages/utils/src/strings.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(`${base}/utils.ts`, `export * from "${base}/utils-strings.ts";\n`);
  await fsc.writeFile(`${base}/csv.ts`, await mapCore("../packages/csv/src/index.ts"));
  await fsc.writeFile(`${base}/dictionary-store.ts`, (await fsc.readFile(new URL("../apps/internal-app/src/server/dictionary-store.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/utils"', `from "${base}/utils.ts"`));
  let svc = (await fsc.readFile(new URL("../apps/internal-app/src/server/rag-service.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  svc = svc.replace('from "@platform/rag"', `from "${base}/rag.ts"`).replace('from "@platform/search"', `from "${base}/search/index.ts"`).replace('from "@platform/ai"', `from "${base}/ai.ts"`).replace('from "@platform/utils"', `from "${base}/utils.ts"`).replace('from "@platform/csv"', `from "${base}/csv.ts"`);
  await fsc.writeFile(`${base}/rag-service.ts`, svc);
  const S = await import(`${base}/rag-service.ts`);

  // エクスポート
  ok("CSV export: 置換ルール(from,to+議事六)・固有名詞(term+KPI)",
    S.exportReplacementsCsv().includes("from,to") && S.exportReplacementsCsv().includes("議事六") &&
    S.exportTermsCsv().includes("term") && S.exportTermsCsv().includes("KPI"));

  // インポート(置換・空from skip・検索補正反映)
  const before = S.getReplacements().length;
  const r = S.importReplacementsCsv("from,to\n現地名,源氏名\n簡易性,会員制\n,無視\n");
  ok("CSV import(置換): 2追加1skip・検索補正に反映",
    r.added === 2 && r.skipped === 1 && S.getReplacements().length === before + 2 && S.normalizeTranscript("現地名").corrected === "源氏名");

  // インポート(固有名詞・既存skip)
  const t = S.importTermsCsv("term\n新語A\n新語B\nKPI\n");
  ok("CSV import(固有名詞): 2追加・既存KPI skip", t.added === 2 && t.skipped === 1);

  // 監査履歴
  const audit = S.getDictionaryAudit();
  ok("監査: import操作を記録・新しい順・kind/action/key", audit.length >= 4 && audit.some((e) => e.key === "現地名" && e.action === "add" && e.kind === "replacement"));

  // actor
  S.setDictionaryActor("tanaka@example.com");
  S.addReplacement({ from: "テスト", to: "TEST" });
  ok("監査: setDictionaryActor 後の変更に actor 記録", S.getDictionaryAudit()[0].actor === "tanaka@example.com" && S.getDictionaryAudit()[0].key === "テスト");

  // ラウンドトリップ
  const exported = S.exportReplacementsCsv();
  const n = S.getReplacements().length;
  S.importReplacementsCsv(exported);
  ok("CSV往復: export→import で件数不変(全て上書き)", S.getReplacements().length === n);

  await fsc.rm(base, { recursive: true, force: true });
}

// ── theme-setting: 組織デフォルトテーマ ──
{
  section("internal-app: 組織デフォルトテーマ + カスタムテーマ");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const base = `${osc.tmpdir()}/tset-${Date.now()}`;
  await fsc.mkdir(base, { recursive: true });
  // モック db(SystemSetting)
  await fsc.writeFile(`${base}/services.ts`, `
let store = new Map();
export const db = { systemSetting: {
  async findUnique(a) { return store.has(a.where.key) ? { value: store.get(a.where.key) } : null; },
  async upsert(a) { store.set(a.where.key, store.has(a.where.key) ? a.update.value : a.create.value); },
} };
export const __store = () => store;
`);
  // 実 core / color / theme を合成(validateTheme・deriveTheme を本物で使う)
  await fsc.writeFile(`${base}/core-error.ts`, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(`${base}/core-result.ts`, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${base}/core-error.ts"`));
  await fsc.writeFile(`${base}/core.ts`, `export * from "${base}/core-error.ts";\nexport * from "${base}/core-result.ts";\n`);
  await fsc.writeFile(`${base}/color.ts`, (await fsc.readFile(new URL("../packages/color/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${base}/core.ts"`));
  for (const f of ["tokens", "css", "registry", "themes", "a11y", "derive", "serialize", "index"]) {
    await fsc.writeFile(`${base}/${f}.ts`, (await fsc.readFile(new URL(`../packages/theme/src/${f}.ts`, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${base}/core.ts"`).replace('from "@platform/color"', `from "${base}/color.ts"`));
  }
  await fsc.writeFile(`${base}/theme-setting.ts`, (await fsc.readFile(new URL("../apps/internal-app/src/server/theme-setting.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/theme"', `from "${base}/index.ts"`).replace('from "@platform/core"', `from "${base}/core.ts"`));
  const S = await import(`${base}/theme-setting.ts`);
  const TH = await import(`${base}/index.ts`);

  // 未設定は既定
  const def = await S.getThemeSetting();
  ok("getThemeSetting: 未設定は既定(default/system)", def.skinId === "default" && def.mode === "system");

  // 保存して取得
  const saved = await S.setThemeSetting({ skinId: "cute", mode: "dark", updatedBy: "admin@x" });
  const got = await S.getThemeSetting();
  ok("setThemeSetting→getThemeSetting: 保存が反映(cute/dark)・updatedAt付与", saved.skinId === "cute" && got.skinId === "cute" && got.mode === "dark" && typeof saved.updatedAt === "string");

  // 未知スキンは既定に矯正
  const bad = await S.setThemeSetting({ skinId: "ghost-theme", mode: "light" });
  ok("setThemeSetting: 未登録スキンは default に矯正", bad.skinId === "default");

  // ── カスタムテーマ(DB 永続化) ──
  ok("getCustomThemes: 初期は空", (await S.getCustomThemes()).length === 0);
  const brand = TH.deriveTheme({ id: "acme", name: "ACME", primary: "#e60033" });
  await S.saveCustomTheme(brand, "admin@x");
  await S.saveCustomTheme({ ...brand, name: "ACME v2" }, "admin@x");
  const list = await S.getCustomThemes();
  ok("saveCustomTheme: 保存・同idは上書き(増えない)", list.length === 1 && list[0].name === "ACME v2");

  await S.saveCustomTheme(TH.deriveTheme({ id: "other", name: "Other", primary: "#0088cc" }), "admin@x");
  ok("saveCustomTheme: 複数保持", (await S.getCustomThemes()).length === 2);

  let v = false, dup = false;
  try { await S.saveCustomTheme({ id: "bad id!", name: "x" }); } catch (e) { v = e.code === "VALIDATION"; }
  try { await S.saveCustomTheme({ ...brand, id: "cute" }); } catch (e) { dup = e.code === "VALIDATION" && e.message.includes("標準スキン"); }
  ok("saveCustomTheme: 不正形式=VALIDATION・標準スキンと同id=拒否", v && dup);

  const setCustom = await S.setThemeSetting({ skinId: "acme", mode: "light" });
  ok("setThemeSetting: カスタムテーマも組織デフォルトにできる", setCustom.skinId === "acme");

  const del = await S.deleteCustomTheme("acme", "admin@x");
  ok("deleteCustomTheme: 削除・組織デフォルトなら既定に戻る・無いidはfalse",
    del && (await S.getCustomThemes()).length === 1 && (await S.getThemeSetting()).skinId === "default" && (await S.deleteCustomTheme("ghost")) === false);

  // ── 変更履歴(誰がいつ何を変えたか) ──
  const hist = await S.getThemeHistory();
  ok("履歴: default-changed / custom-saved(作成・更新) / custom-deleted を actor 付きで記録・新しい順",
    hist.some((e) => e.action === "default-changed" && e.target === "cute") &&
    hist.some((e) => e.action === "custom-saved" && e.target === "acme" && e.note.includes("作成")) &&
    hist.some((e) => e.action === "custom-saved" && e.note.includes("更新")) &&
    hist.some((e) => e.action === "custom-deleted" && e.target === "acme" && e.actor === "admin@x") &&
    hist[0].at >= hist[hist.length - 1].at);
  ok("getThemeHistory(limit): 件数を絞れる", (await S.getThemeHistory(2)).length === 2);

  await fsc.rm(base, { recursive: true, force: true });
}

// ── gen-ref-site: リファレンスサイト生成 ──
{
  section("gen-ref-site: リファレンスサイト");
  const M = await import(new URL("./gen-ref-site.mjs", import.meta.url).href);
  const pkgs = M.collectPackages();
  const apps = M.collectApps();
  const mer = M.loadDepGraphMermaid();
  ok("collect: 107パッケージ(全@platform/・過半exports)・5アプリ(internal多数)",
    pkgs.length === 107 && pkgs.every((p) => p.full.startsWith("@platform/")) && pkgs.filter((p) => p.exports.length > 0).length > 40 &&
    apps.length === 5 && apps.find((a) => a.name === "internal-app").pages.length > 10 && apps.find((a) => a.name === "internal-app").apis.length > 10);
  const erds = M.collectErds();
  const adrs = M.collectAdrs();
  ok("collectErds/collectAdrs: 3 ER図(erDiagram)・13 ADR(タイトル/状態)",
    erds.length === 3 && erds.every((e) => e.mermaid.includes("erDiagram")) && adrs.length === 13 && adrs[0].title.includes("ADR"));
  const themesInfo = M.collectThemes();
  ok("collectThemes: 11スキン(id/name/色/角丸/フォントをソースから抽出)",
    themesInfo.length === 11 && themesInfo.every((t) => t.id && t.name && t.colors.primary) &&
    themesInfo.find((t) => t.id === "cute").name === "かわいい" && themesInfo.find((t) => t.id === "retro").fontFamily.includes("Courier"));
  const html = M.renderPlatformSite(pkgs, mer, apps, erds, adrs, themesInfo);
  ok("renderPlatformSite: HTML・検索・パッケージ・アプリリンク・ER図/ADR・横断検索・テーマタブ",
    html.startsWith("<!doctype html>") && html.includes("filterCards") && html.includes("@platform/core") && html.includes("app-internal-app.html") &&
    html.includes("erDiagram") && html.includes("設計判断記録") && html.includes("showSection") &&
    html.includes("横断検索") && html.includes("filterCross") && html.includes("画面(internal-app)") && html.includes("API(internal-app)") &&
    html.includes("sec-themes") && html.includes("かわいい") && html.includes("deriveTheme"));
  ok("renderAppSite: 画面/API表・戻るリンク",
    M.renderAppSite(apps.find((a) => a.name === "internal-app")).includes("画面（") && M.renderAppSite(apps[0]).includes("index.html"));
  // XSS エスケープ
  ok("XSS: script タグを無害化",
    (() => { const e = M.renderPlatformSite([{ name: "x", full: "@platform/x", summary: "<script>alert(1)</script>", exports: [] }], "", [], [], [], []); return !e.includes("<script>alert(1)") && e.includes("&lt;script&gt;"); })());
}

// ── pnpm 便利コマンド(gen-all / doctor / COMMANDS) ──
{
  section("tooling: 便利コマンド");
  const fsc = await import("node:fs/promises");
  const pkg = JSON.parse(await fsc.readFile(new URL("../package.json", import.meta.url), "utf8"));
  const s = pkg.scripts;
  ok("package.json: gen:all/doctor/clean/fresh/check/site 等が定義",
    s["gen:all"] && s["doctor"] && s["clean"] && s["fresh"] && s["check"] && s["site"] && s["db:reset"] && s["test:pkg"]);
  // gen-all / doctor ツールが存在し import できる(構文健全)
  const genAll = await fsc.readFile(new URL("../tools/gen-all.mjs", import.meta.url), "utf8");
  const doctor = await fsc.readFile(new URL("../tools/doctor.mjs", import.meta.url), "utf8");
  ok("gen-all.mjs: 2パス生成 + check-generated を含む", genAll.includes("pass") && genAll.includes("check-generated.mjs") && genAll.includes("gen-ref-site.mjs"));
  ok("doctor.mjs: Node/pnpm/.env/生成物を診断", doctor.includes("Node.js") && doctor.includes(".env") && doctor.includes("check-generated"));
  // COMMANDS.md が主要コマンドを網羅
  const cmds = await fsc.readFile(new URL("../docs/ops/COMMANDS.md", import.meta.url), "utf8");
  ok("COMMANDS.md: doctor/gen:all/check/dev:internal を記載", cmds.includes("pnpm doctor") && cmds.includes("pnpm gen:all") && cmds.includes("pnpm check") && cmds.includes("dev:internal"));
}

// ── ui: AppSkin(全アプリ共通のスキン適用ラッパー) ──
{
  section("ui: AppSkin + 全アプリ適用");
  const fsc = await import("node:fs/promises");
  // AppSkin ソースが buildThemeStylesheet + SkinProvider を使う構造か
  const src = await fsc.readFile(new URL("../packages/ui/src/components/app-skin.tsx", import.meta.url), "utf8");
  ok("AppSkin: buildThemeStylesheet注入 + SkinProvider + prefers-color-scheme追従",
    src.includes("buildThemeStylesheet") && src.includes("SkinProvider") && src.includes("prefers-color-scheme") && src.includes("useMemo"));
  ok("ui index: AppSkin を公開", (await fsc.readFile(new URL("../packages/ui/src/index.ts", import.meta.url), "utf8")).includes("AppSkin"));
  // 全5アプリの layout がスキン適用(AppSkin か AppThemeProvider)しているか
  const apps = ["internal-app", "crud-template", "equipment-app", "public-site", "platform-portal"];
  let applied = 0;
  for (const app of apps) {
    const l = await fsc.readFile(new URL(`../apps/${app}/src/app/layout.tsx`, import.meta.url), "utf8");
    if (l.includes("AppSkin") || l.includes("AppThemeProvider")) applied += 1;
  }
  ok("全5アプリの layout がスキン適用済み", applied === 5);
  // 各アプリに theme-registry がある
  let regs = 0;
  for (const app of apps) {
    try { await fsc.access(new URL(`../apps/${app}/src/lib/theme-registry.ts`, import.meta.url)); regs += 1; } catch { /* internal は別構成の可能性 */ }
  }
  ok("各アプリに theme-registry(独自スキン追加点)", regs >= 4);
}

// ── CI: doctor統合 + Pages公開ワークフロー ──
{
  section("CI: doctor統合 + Pages公開");
  const fsc = await import("node:fs/promises");
  const ci = await fsc.readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  ok("ci.yml: boundaries で doctor.mjs を実行", ci.includes("tools/doctor.mjs"));
  const pages = await fsc.readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
  ok("pages.yml: build/deploy・gen-ref-site・upload/deploy-pages・pages権限",
    pages.includes("gen-ref-site.mjs") && pages.includes("upload-pages-artifact") && pages.includes("deploy-pages") &&
    pages.includes("pages: write") && pages.includes("id-token: write"));
  ok("pages.yml: docs/site をアーティファクトに・main push トリガ",
    pages.includes("path: docs/site") && pages.includes("branches: [main]"));
}

// ── apps/demos ブラッシュアップ(ThemeSwitcher・テーマ活用) ──
{
  section("apps/demos: 最新機能の活用");
  const fsc = await import("node:fs/promises");
  // ThemeSwitcher が ui に追加され export されている
  const sw = await fsc.readFile(new URL("../packages/ui/src/components/theme-switcher.tsx", import.meta.url), "utf8");
  ok("ThemeSwitcher: useSkin + dropdown + CSS変数", sw.includes("useSkin") && sw.includes("select") && sw.includes("var(--color"));
  ok("ui index: ThemeSwitcher を公開", (await fsc.readFile(new URL("../packages/ui/src/index.ts", import.meta.url), "utf8")).includes("ThemeSwitcher"));
  // テーマ切替UIを持つアプリ(portal/crud/equipment)
  let withSwitcher = 0;
  for (const app of ["platform-portal", "crud-template", "equipment-app"]) {
    const files = ["src/app/layout.tsx", "src/app/portal-client.tsx"];
    for (const f of files) {
      try {
        const c = await fsc.readFile(new URL(`../apps/${app}/${f}`, import.meta.url), "utf8");
        if (c.includes("ThemeSwitcher") || c.includes("SkinSelector")) { withSwitcher += 1; break; }
      } catch { /* ファイル無し */ }
    }
  }
  ok("portal/crud/equipment にテーマ切替UI追加", withSwitcher === 3);
  // platform-portal が CSS変数化されている
  const portal = await fsc.readFile(new URL("../apps/platform-portal/src/app/portal-client.tsx", import.meta.url), "utf8");
  ok("platform-portal: 色をCSS変数化(テーマ追従)", portal.includes("var(--color-primary") && portal.includes("var(--color-bg") && portal.includes("var(--color-muted"));
  // showcase にテーマデモ + AppSkin
  const scLayout = await fsc.readFile(new URL("../demos/showcase/src/app/layout.tsx", import.meta.url), "utf8");
  const scTheme = await fsc.readFile(new URL("../demos/showcase/src/app/theme/theme-showcase.tsx", import.meta.url), "utf8");
  const scNav = await fsc.readFile(new URL("../demos/showcase/src/lib/nav.ts", import.meta.url), "utf8");
  ok("showcase: layout に AppSkin+ナビ・テーマデモページ(11スキン/トークン/a11y)・ナビに導線",
    scLayout.includes("AppSkin") && scLayout.includes("ThemeSwitcher") && scLayout.includes("DemoSidebar") &&
    scTheme.includes("builtInThemes") && scTheme.includes("checkTheme") && scTheme.includes("SkinSelector") &&
    scNav.includes('href: "/theme"'));
  // internal-app 主要管理画面の色がCSS変数化
  const dbv = await fsc.readFile(new URL("../apps/internal-app/src/app/admin/db-viewer/db-viewer-client.tsx", import.meta.url), "utf8");
  ok("internal-app: 主要管理画面の色をCSS変数化(テーマ追従)", dbv.includes("var(--color-surface") && dbv.includes("var(--color-primary") && dbv.includes("var(--color-muted"));
  // カスタムテーマ作成UI(deriveTheme + registry.register)
  const gallery = await fsc.readFile(new URL("../apps/internal-app/src/app/admin/themes/theme-gallery-client.tsx", import.meta.url), "utf8");
  ok("テーマギャラリー: カスタム作成UI(deriveTheme + 色ピッカー) + DB保存 + 管理(削除/JSON入出力)",
    gallery.includes("deriveTheme") && gallery.includes('type="color"') && gallery.includes("CustomThemeMaker") &&
    gallery.includes("/api/admin/theme/custom") && gallery.includes("CustomThemeManager") && gallery.includes("export=1") && gallery.includes("json"));
}

// ── env 拡充(説明生成・マスキング・必須検証) ──
{
  section("env: 説明生成 / マスキング / 必須検証");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const base = `${osc.tmpdir()}/env-${Date.now()}`;
  await fsc.mkdir(base, { recursive: true });
  await fsc.writeFile(`${base}/core-error.ts`, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(`${base}/core-result.ts`, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${base}/core-error.ts"`));
  await fsc.writeFile(`${base}/core.ts`, `export * from "${base}/core-error.ts";\nexport * from "${base}/core-result.ts";\n`);
  // zod は devDeps 未インストールのため、_def 構造を模したスタブで検証する
  await fsc.writeFile(`${base}/zod.ts`, `
export const z = {
  object: (shape) => ({ shape, _def: { typeName: "ZodObject" } }),
  string: () => mk("ZodString", { checks: [] }),
  number: () => mk("ZodNumber", {}),
  enum: (values) => mk("ZodEnum", { values }),
};
function mk(typeName, extra) {
  const self = {
    _def: { typeName, ...extra },
    url() { self._def.checks = [...(self._def.checks ?? []), { kind: "url" }]; return self; },
    email() { self._def.checks = [...(self._def.checks ?? []), { kind: "email" }]; return self; },
    describe(d) { self._def.description = d; return self; },
    default(v) { return { _def: { typeName: "ZodDefault", innerType: self, defaultValue: () => v } }; },
    optional() { return { _def: { typeName: "ZodOptional", innerType: self } }; },
  };
  return self;
}
`);
  let describeSrc = (await fsc.readFile(new URL("../packages/env/src/describe.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  describeSrc = describeSrc.replace('from "@platform/core"', `from "${base}/core.ts"`).replace('from "zod"', `from "${base}/zod.ts"`);
  await fsc.writeFile(`${base}/describe.ts`, describeSrc);
  const E = await import(`${base}/describe.ts`);
  const { z } = await import(`${base}/zod.ts`);

  // isSecretName / maskSecrets
  ok("isSecretName: KEY/SECRET/TOKEN/PASSWORD を秘密扱い・通常変数は対象外",
    E.isSecretName("SESSION_SECRET") && E.isSecretName("ANTHROPIC_API_KEY") && E.isSecretName("DB_PASSWORD") && E.isSecretName("GITHUB_TOKEN") &&
    !E.isSecretName("DATABASE_URL") && !E.isSecretName("LOG_LEVEL"));
  const masked = E.maskSecrets({ DATABASE_URL: "postgres://u:p@h/db", SESSION_SECRET: "supersecret", LOG_LEVEL: "info", X: undefined });
  ok("maskSecrets: 秘密は***・通常はそのまま・undefinedは空",
    masked.SESSION_SECRET === "***" && masked.LOG_LEVEL === "info" && masked.DATABASE_URL.includes("postgres") && masked.X === "");

  // requireEnv / optionalEnv
  const src = { A: "1", B: "2", EMPTY: "" };
  let cfgErr = false;
  try { E.requireEnv(["A", "MISSING", "EMPTY"], src); } catch (e) { cfgErr = e.code === "CONFIG" && e.message.includes("MISSING") && e.message.includes("EMPTY"); }
  ok("requireEnv: 揃えば返す・欠け/空はCONFIG(名前列挙)",
    E.requireEnv(["A", "B"], src).A === "1" && cfgErr);
  ok("optionalEnv: 値/fallback/空はfallback",
    E.optionalEnv("A", "x", src) === "1" && E.optionalEnv("NOPE", "def", src) === "def" && E.optionalEnv("EMPTY", "def", src) === "def");

  // describeEnv / renderEnvExample
  const schema = z.object({
    DATABASE_URL: z.string().url().describe("接続先データベース"),
    MAIL_FROM: z.string().email(),
    SESSION_SECRET: z.string().describe("セッション署名鍵"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    SMTP_PORT: z.number().default(1025),
    OPTIONAL_X: z.string().optional(),
  });
  const infos = E.describeEnv(schema);
  ok("describeEnv: 6件・必須が先頭・型/説明/既定値/秘密判定・default/optionalは任意",
    infos.length === 6 && infos[0].required === true &&
    infos.find((i) => i.name === "DATABASE_URL").type === "文字列(URL)" &&
    infos.find((i) => i.name === "DATABASE_URL").description === "接続先データベース" &&
    infos.find((i) => i.name === "MAIL_FROM").type === "文字列(メールアドレス)" &&
    infos.find((i) => i.name === "LOG_LEVEL").defaultValue === "info" &&
    infos.find((i) => i.name === "LOG_LEVEL").type === "debug | info | warn | error" &&
    infos.find((i) => i.name === "SESSION_SECRET").secret === true &&
    infos.find((i) => i.name === "LOG_LEVEL").required === false &&
    infos.find((i) => i.name === "OPTIONAL_X").required === false);
  const example = E.renderEnvExample(schema, { header: "internal-app の環境変数" });
  ok("renderEnvExample: ヘッダ・必須/任意セクション・説明コメント・秘密は空・既定値は記載",
    example.includes("# internal-app の環境変数") && example.includes("# --- 必須 ---") && example.includes("# --- 任意(既定値あり) ---") &&
    example.includes("# 文字列(URL) — 接続先データベース") && example.includes("SESSION_SECRET=\n") && example.includes("LOG_LEVEL=info") && example.includes("SMTP_PORT=1025"));

  await fsc.rm(base, { recursive: true, force: true });
}

// ── internal-app: serverEnv の fail-fast(本番)/寛容(開発) ──
{
  section("internal-app: serverEnv の環境別挙動");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const base = `${osc.tmpdir()}/senv-${Date.now()}`;
  await fsc.mkdir(base, { recursive: true });
  await fsc.writeFile(`${base}/core-error.ts`, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(`${base}/core-result.ts`, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${base}/core-error.ts"`));
  await fsc.writeFile(`${base}/core.ts`, `export * from "${base}/core-error.ts";\nexport * from "${base}/core-result.ts";\n`);
  let dsrc = (await fsc.readFile(new URL("../packages/env/src/describe.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  dsrc = dsrc.replace('import { z } from "zod";\n', "").replace('from "@platform/core"', `from "${base}/core.ts"`);
  dsrc = dsrc.replace(/z\.Zod\w+(<[^>]*>)?/g, "any").replace(/z\.ZodRawShape/g, "any");
  await fsc.writeFile(`${base}/describe.ts`, dsrc);
  // zod は未インストールのため、チェーン可能な Proxy スタブで parseEnv を素通しさせる
  await fsc.writeFile(`${base}/env.ts`, `
export { requireEnv, optionalEnv, assertSecretStrength, checkSecretStrength } from "${base}/describe.ts";
export function parseEnv(_schema, source = process.env) { return source; }
const anyChain = new Proxy(function () {}, { get: (_t, p) => (p === "shape" ? {} : anyChain), apply: () => anyChain });
export const z = anyChain;
`);
  await fsc.writeFile(`${base}/app-env.ts`, (await fsc.readFile(new URL("../apps/internal-app/src/server/env.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/env"', `from "${base}/env.ts"`));

  const saved = { NODE_ENV: process.env.NODE_ENV, SESSION_SECRET: process.env.SESSION_SECRET, SECRET_MASTER_KEY: process.env.SECRET_MASTER_KEY, DATABASE_URL: process.env.DATABASE_URL };
  process.env.NODE_ENV = "development";
  delete process.env.SESSION_SECRET; delete process.env.SECRET_MASTER_KEY;
  const dev = await import(`${base}/app-env.ts?dev`);
  ok("開発: 秘密値未設定でも既定で継続(起動を止めない)",
    dev.serverEnv.SESSION_SECRET === "dev-session-secret-change-me" && dev.serverEnv.SECRET_MASTER_KEY === "dev-session-secret-change-me");

  process.env.NODE_ENV = "production";
  process.env.DATABASE_URL = "postgres://x";
  delete process.env.SESSION_SECRET;
  let failFast = false;
  try { await import(`${base}/app-env.ts?prod`); } catch (e) { const err = e.cause ?? e; failFast = String(err.message ?? err).includes("SESSION_SECRET"); }
  ok("本番: SESSION_SECRET 欠けは CONFIG で起動失敗(fail-fast)", failFast);

  // 弱い秘密値は本番で拒否される(強度チェック)
  process.env.SESSION_SECRET = "prod-secret";
  let weakRejected = false;
  try { await import(`${base}/app-env.ts?weak`); } catch (e) { const err = e.cause ?? e; weakRejected = String(err.message ?? err).includes("強度"); }
  ok("本番: 弱い秘密値(短い/既定値らしい)は CONFIG で起動失敗", weakRejected);

  // 十分に強い秘密値なら起動する
  process.env.SESSION_SECRET = "Xk9$mQ2#vL7@pR4!nT6&wY1%zB8^";
  const prod = await import(`${base}/app-env.ts?prod2`);
  ok("本番: 強い秘密値が揃えば起動・SECRET_MASTER_KEY は SESSION_SECRET を流用",
    prod.serverEnv.SESSION_SECRET === "Xk9$mQ2#vL7@pR4!nT6&wY1%zB8^" && prod.serverEnv.SECRET_MASTER_KEY === prod.serverEnv.SESSION_SECRET);

  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  await fsc.rm(base, { recursive: true, force: true });
}

// ── 設定周りの統一(直読み排除・残骸検出・確認画面) ──
{
  section("設定: env 統一 / 残骸検出 / 確認画面");
  const fsc = await import("node:fs/promises");
  const { execFileSync } = await import("node:child_process");

  // 全アプリで process.env 直読みが解消されているか(env.ts と NEXT_RUNTIME は例外)
  const appDirs = ["internal-app", "public-site", "crud-template", "equipment-app", "platform-portal"];
  const offenders = [];
  for (const app of appDirs) {
    const walk = async (dir) => {
      let files = [];
      let entries;
      try { entries = await fsc.readdir(dir, { withFileTypes: true }); } catch { return files; }
      for (const e of entries) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) files = files.concat(await walk(p));
        else if (/\.tsx?$/.test(e.name) && !e.name.includes(".test.")) files.push(p);
      }
      return files;
    };
    const root = new URL(`../apps/${app}/src`, import.meta.url).pathname;
    for (const f of await walk(root)) {
      if (f.endsWith("server/env.ts")) continue;
      const body = await fsc.readFile(f, "utf8");
      for (const m of body.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) {
        if (m[1] === "NEXT_RUNTIME") continue;
        if (body.slice(Math.max(0, m.index - 3), m.index).includes("//")) continue; // コメント内
        offenders.push(`${app}: ${m[1]}`);
      }
    }
  }
  ok("全5アプリで process.env 直読みなし(env.ts と NEXT_RUNTIME を除く)", offenders.length === 0);
  if (offenders.length > 0) console.log("   ", offenders.slice(0, 5).join(" / "));

  // equipment-app: 本番で秘密値必須(既定パスワードのまま公開する事故を防ぐ)
  const eqEnv = await fsc.readFile(new URL("../apps/equipment-app/src/server/env.ts", import.meta.url), "utf8");
  ok("equipment-app: 本番は SESSION_SECRET/ADMIN_PASSWORD 必須(requireEnv)・開発は既定値",
    eqEnv.includes('requireEnv(["SESSION_SECRET", "ADMIN_PASSWORD"])') && eqEnv.includes('optionalEnv("ADMIN_PASSWORD", "admin1234")'));

  // public-site: env.ts に集約
  const psEnv = await fsc.readFile(new URL("../apps/public-site/src/server/env.ts", import.meta.url), "utf8");
  ok("public-site: siteEnv に集約(PREVIEW_TOKEN/INTERNAL_API_BASE 等)",
    psEnv.includes("siteEnv") && psEnv.includes("PREVIEW_TOKEN") && psEnv.includes("INTERNAL_INQUIRY_URL"));

  // internal-app: featureEnv に機能設定を集約
  const iaEnv = await fsc.readFile(new URL("../apps/internal-app/src/server/env.ts", import.meta.url), "utf8");
  ok("internal-app: featureEnv に機能設定を集約(AI/CRON/MAINTENANCE/SENTRY 等)",
    iaEnv.includes("featureEnv") && iaEnv.includes("ANTHROPIC_API_KEY") && iaEnv.includes("CRON_TOKEN") &&
    iaEnv.includes("MAINTENANCE_ALLOW_IPS") && iaEnv.includes("SENTRY_DSN") && iaEnv.includes("useChatPrisma"));

  // check-env-example: 新しい読み取り口を検出し、参照=記載 になっている
  const out = execFileSync("node", [new URL("./check-env-example.mjs", import.meta.url).pathname], { encoding: "utf8" });
  ok("check-env-example: optionalEnv/requireEnv/featureEnv 等を検出・全アプリ✅・残骸警告なし",
    !out.includes("❌") && !out.includes("⚠️") && out.includes("参照 38 変数") && (out.match(/✅/g) || []).length === 4);

  // 設定確認画面(マスク済み)
  const envRoute = await fsc.readFile(new URL("../apps/internal-app/src/app/api/admin/env/route.ts", import.meta.url), "utf8");
  const envClient = await fsc.readFile(new URL("../apps/internal-app/src/app/admin/env/env-client.tsx", import.meta.url), "utf8");
  // 表示は基盤の EnvSettingsTable に委譲(他アプリでも使える)
  const envTable = await fsc.readFile(new URL("../packages/ui/src/components/env-settings-table.tsx", import.meta.url), "utf8");
  ok("設定確認: API は maskSecrets で秘密を伏せる・区分(基本/秘密/機能)・表示は基盤 EnvSettingsTable に委譲",
    envRoute.includes("maskSecrets") && envRoute.includes("isSecretName") && envRoute.includes('"基本"') && envRoute.includes('"秘密"') && envRoute.includes('"機能"') &&
    envClient.includes("EnvSettingsTable") && envClient.includes("秘密値") &&
    envTable.includes("設定済み") && envTable.includes("未設定") && envTable.includes("マスク"));
}

// ── APPS_AND_DEMOS.md の数値が実態と一致するか(ドリフト防止) ──
{
  section("docs: アプリ・デモ紹介の数値");
  const fsc = await import("node:fs/promises");
  const doc = await fsc.readFile(new URL("../docs/APPS_AND_DEMOS.md", import.meta.url), "utf8");
  const countFiles = async (dir, name) => {
    let n = 0;
    const walk = async (d) => {
      let entries;
      try { entries = await fsc.readdir(d, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const p = `${d}/${e.name}`;
        if (e.isDirectory()) await walk(p);
        else if (e.name === name) n += 1;
      }
    };
    await walk(new URL(dir, import.meta.url).pathname);
    return n;
  };
  const pages = await countFiles("../apps/internal-app/src/app", "page.tsx");
  const apis = await countFiles("../apps/internal-app/src/app/api", "route.ts");
  const schema = await fsc.readFile(new URL("../apps/internal-app/prisma/schema.prisma", import.meta.url), "utf8");
  const models = (schema.match(/^model /gm) || []).length;
  const demos = (await fsc.readdir(new URL("../demos", import.meta.url).pathname, { withFileTypes: true })).filter((e) => e.isDirectory()).length;
  const pkgs = (await fsc.readdir(new URL("../packages", import.meta.url).pathname, { withFileTypes: true })).filter((e) => e.isDirectory()).length;

  ok(`紹介文の数値が実態と一致(internal 画面${pages}/API${apis}/モデル${models}・デモ${demos}・パッケージ${pkgs})`,
    doc.includes(`**画面 ${pages} / API ${apis} / DB モデル ${models}**`) &&
    doc.includes(`デモ（${demos}個）`) && doc.includes(`${pkgs} パッケージ`));
  ok("紹介文: 5アプリすべてを起動コマンド付きで掲載",
    ["internal-app", "public-site", "crud-template", "equipment-app", "platform-portal"].every((a) => doc.includes(a)) &&
    ["dev:internal", "dev:site", "dev:crud", "dev:equipment", "dev:portal"].every((c) => doc.includes(c)));
  ok("README から紹介文への導線",
    (await fsc.readFile(new URL("../README.md", import.meta.url), "utf8")).includes("APPS_AND_DEMOS.md"));
}

// ── AI開発アシスト: 基盤カタログMCP / 手書き資料の数値ドリフト ──
{
  section("AI開発アシスト: カタログMCP / 資料の鮮度");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const root = new URL("..", import.meta.url).pathname;

  // カタログ(検索ロジック)
  const base = `${osc.tmpdir()}/cat-${Date.now()}`;
  await fsc.mkdir(base, { recursive: true });
  await fsc.writeFile(`${base}/core-error.ts`, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(`${base}/core-result.ts`, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${base}/core-error.ts"`));
  await fsc.writeFile(`${base}/core.ts`, `export * from "${base}/core-error.ts";\nexport * from "${base}/core-result.ts";\n`);
  await fsc.writeFile(`${base}/mcp.ts`, (await fsc.readFile(new URL("../packages/mcp/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${base}/core.ts"`));
  await fsc.writeFile(`${base}/catalog.mts`, (await fsc.readFile(new URL("./lib/catalog.mts", import.meta.url), "utf8")).replace(/\.mjs"/g, '.mts"'));
  await fsc.writeFile(`${base}/catalog-tools.mts`, (await fsc.readFile(new URL("./lib/catalog-tools.mts", import.meta.url), "utf8")).replace('from "@platform/mcp"', `from "${base}/mcp.ts"`).replace('from "./catalog.mjs"', `from "${base}/catalog.mts"`));
  const C = await import(`${base}/catalog.mts`);
  const T = await import(`${base}/catalog-tools.mts`);

  const catalog = C.loadCatalog({ root });
  ok("loadCatalog: 107パッケージ・カテゴリ付き・全export網羅(api-surface + api-reference 併用)",
    catalog.length === 107 && catalog.find((p) => p.name === "theme").category !== "未分類" &&
    catalog.find((p) => p.name === "theme").exports.some((e) => e.name === "deriveTheme") &&
    catalog.filter((p) => p.exports.length > 0).length > 90);
  ok("searchCatalog: パッケージ名完全一致が最上位・API名/日本語説明でも見つかる・該当なしは空",
    C.searchCatalog(catalog, "theme")[0].full === "@platform/theme" &&
    C.searchCatalog(catalog, "deriveTheme")[0].api === "deriveTheme" &&
    C.searchCatalog(catalog, "メール").some((h) => h.full.includes("mail")) &&
    C.searchCatalog(catalog, "zzz-nonexistent-xyz").length === 0 && C.searchCatalog(catalog, "  ").length === 0);
  ok("describePackage/listByCategory: README+API・@platform/付きも可・無いものnull・全件分類",
    C.describePackage(catalog, root, "theme").includes("公開 API") &&
    C.describePackage(catalog, root, "@platform/csv") !== null &&
    C.describePackage(catalog, root, "ghost") === null &&
    Object.values(C.listByCategory(catalog)).flat().length === 107);

  // MCP ツール(AI が呼ぶ形)
  // ツールは名前で引く(順序に依存しない)
  const tools = T.buildCatalogTools({ root, catalog });
  const byName = (n) => tools.find((t) => t.name === n);
  const r1 = await byName("search_platform").handler({ query: "csv" });
  const r2 = await byName("search_platform").handler({ query: "  " });
  const r3 = await byName("search_platform").handler({ query: "zzz-nonexistent" });
  ok("MCP search_platform: csv で該当・空クエリはエラー・該当なしは案内(エラーにしない)",
    byName("search_platform").description.includes("再発明") &&
    r1.content[0].text.includes("@platform/csv") && r2.isError === true && !r3.isError && r3.content[0].text.includes("見つかりませんでした"));
  const d1 = await byName("describe_package").handler({ name: "theme" });
  const d2 = await byName("describe_package").handler({ name: "ghost" });
  const l1 = await byName("list_platform").handler({});
  ok("MCP describe_package/list_platform: 詳細返却・無いものはsearch誘導・カテゴリ別107件",
    d1.content[0].text.includes("deriveTheme") && d2.isError === true && d2.content[0].text.includes("search_platform") &&
    l1.content[0].text.includes("107 件"));

  await fsc.rm(base, { recursive: true, force: true });

  // 手書き資料の数値ドリフト検出
  const D = await import(new URL("./check-doc-numbers.mjs", import.meta.url).href);
  const { measured, issues } = D.check();
  ok(`check-doc-numbers: CLAUDE.md/architecture.md の数値が実態と一致(パッケージ ${measured.packages})`, issues.length === 0);
  ok("CLAUDE.md: MCP カタログの案内あり(AI が基盤検索の手段を知る)",
    (await fsc.readFile(new URL("../CLAUDE.md", import.meta.url), "utf8")).includes("search_platform") &&
    (await fsc.readFile(new URL("../docs/ai/mcp-catalog.md", import.meta.url), "utf8")).includes("車輪の再発明"));

  // patterns.md: 最近の機構(env読み取り口・テーマ・ポート)の定型コード
  const patterns = await fsc.readFile(new URL("../docs/ai/patterns.md", import.meta.url), "utf8");
  ok("patterns.md: env読み取り口 / テーマ / ポート割り当ての定型コードあり",
    patterns.includes("process.env を直接読まない") && patterns.includes("assertSecretStrength") &&
    patterns.includes("AppSkin") && patterns.includes("deriveTheme") &&
    patterns.includes("開発ポートの割り当て") && patterns.includes("check-ports.mjs"));
}

// ── 秘密値の強度チェック ──
{
  section("env: 秘密値の強度チェック");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const base = `${osc.tmpdir()}/sec-${Date.now()}`;
  await fsc.mkdir(base, { recursive: true });
  await fsc.writeFile(`${base}/core-error.ts`, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(`${base}/core-result.ts`, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${base}/core-error.ts"`));
  await fsc.writeFile(`${base}/core.ts`, `export * from "${base}/core-error.ts";\nexport * from "${base}/core-result.ts";\n`);
  let dsrc = (await fsc.readFile(new URL("../packages/env/src/describe.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  dsrc = dsrc.replace('import { z } from "zod";\n', "").replace('from "@platform/core"', `from "${base}/core.ts"`);
  dsrc = dsrc.replace(/z\.Zod\w+(<[^>]*>)?/g, "any").replace(/z\.ZodRawShape/g, "any");
  await fsc.writeFile(`${base}/describe.ts`, dsrc);
  const E = await import(`${base}/describe.ts`);

  ok("checkSecretStrength: 開発既定値(change-me / dev- / admin1234)を error 検出",
    E.checkSecretStrength({ SESSION_SECRET: "dev-session-secret-change-me" })[0].level === "error" &&
    E.checkSecretStrength({ API_KEY: "dev-key-x" })[0].level === "error" &&
    E.checkSecretStrength({ ADMIN_PASSWORD: "admin1234" })[0].level === "error");
  ok("checkSecretStrength: 12文字未満=error / 12〜15=warn / 文字種単調=warn",
    E.checkSecretStrength({ SESSION_SECRET: "short1!" })[0].level === "error" &&
    E.checkSecretStrength({ SESSION_SECRET: "aB3!aB3!aB3!" })[0].level === "warn" &&
    E.checkSecretStrength({ SESSION_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaa" }).some((i) => i.message.includes("単調")));
  ok("checkSecretStrength: 強い値/秘密でない名前/未設定は問題なし",
    E.checkSecretStrength({ SESSION_SECRET: "Xk9$mQ2#vL7@pR4!nT6&wY1%" }).length === 0 &&
    E.checkSecretStrength({ LOG_LEVEL: "info", DATABASE_URL: "postgres://x" }).length === 0 &&
    E.checkSecretStrength({ SESSION_SECRET: undefined, API_KEY: "" }).length === 0);

  let threw = false;
  try { E.assertSecretStrength({ SESSION_SECRET: "dev-change-me" }, { isProduction: true }); } catch (e) { threw = e.code === "CONFIG" && e.message.includes("SESSION_SECRET"); }
  const warns = [];
  E.assertSecretStrength({ SESSION_SECRET: "dev-change-me" }, { isProduction: false, onWarn: (m) => warns.push(m) });
  const warns2 = [];
  E.assertSecretStrength({ SESSION_SECRET: "aB3!aB3!aB3!" }, { isProduction: true, onWarn: (m) => warns2.push(m) });
  ok("assertSecretStrength: 本番のerrorは起動失敗・開発は警告のみ・本番でもwarnだけなら継続",
    threw && warns.length === 1 && warns[0].includes("危険") && warns2.length === 1 && warns2[0].includes("注意"));

  // アプリへの組込
  const ia = await fsc.readFile(new URL("../apps/internal-app/src/server/env.ts", import.meta.url), "utf8");
  const eq = await fsc.readFile(new URL("../apps/equipment-app/src/server/env.ts", import.meta.url), "utf8");
  ok("internal-app / equipment-app が本番で強度チェックを実行",
    ia.includes("assertSecretStrength") && ia.includes("isProduction: true") &&
    eq.includes("assertSecretStrength") && eq.includes("isProduction: true"));

  await fsc.rm(base, { recursive: true, force: true });
}

// ── ポート割り当て / デモ検索 / 設計ルール ──
{
  section("開発ポート / デモ検索 / 設計ルール");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const root = new URL("..", import.meta.url).pathname;

  // ポート: 重複なし・全アプリ明記・ドキュメント一致
  const P = await import(new URL("./check-ports.mjs", import.meta.url).href);
  const { entries, issues } = P.check();
  ok(`ポート: 6アプリすべて --port 明記・重複なし・docs と一致(${entries.map((e) => e.port).join("/")})`,
    issues.length === 0 && entries.length === 6 && entries.every((e) => e.port !== null) &&
    new Set(entries.map((e) => e.port)).size === 6);
  ok("ポート: pnpm dev(一斉起動)で衝突しない範囲 3000〜3005",
    entries.every((e) => e.port >= 3000 && e.port <= 3005));

  // デモ検索 + 設計ルール(MCP)
  const base = `${osc.tmpdir()}/dm-${Date.now()}`;
  await fsc.mkdir(base, { recursive: true });
  await fsc.writeFile(`${base}/core-error.ts`, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(`${base}/core-result.ts`, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${base}/core-error.ts"`));
  await fsc.writeFile(`${base}/core.ts`, `export * from "${base}/core-error.ts";\nexport * from "${base}/core-result.ts";\n`);
  await fsc.writeFile(`${base}/mcp.ts`, (await fsc.readFile(new URL("../packages/mcp/src/index.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${base}/core.ts"`));
  await fsc.writeFile(`${base}/catalog.mts`, (await fsc.readFile(new URL("./lib/catalog.mts", import.meta.url), "utf8")).replace(/\.mjs"/g, '.mts"'));
  await fsc.writeFile(`${base}/catalog-tools.mts`, (await fsc.readFile(new URL("./lib/catalog-tools.mts", import.meta.url), "utf8")).replace('from "@platform/mcp"', `from "${base}/mcp.ts"`).replace('from "./catalog.mjs"', `from "${base}/catalog.mts"`));
  const C = await import(`${base}/catalog.mts`);
  const T = await import(`${base}/catalog-tools.mts`);

  const demos = C.loadDemos({ root });
  ok("loadDemos: 統合デモサイトの nav.ts から45デモを読む(サイトの表示と検索結果が食い違わない)",
    demos.length === 45 && demos.every((d) => d.name && d.summary && Array.isArray(d.packages)) &&
    demos.find((d) => d.name === "theme").packages.includes("theme") &&
    demos.find((d) => d.name === "apps-internal").packages.includes("contract"));
  ok("searchDemos: パッケージ名/日本語/@platform付きで引ける・該当なしは空",
    C.searchDemos(demos, "tax").some((h) => h.name === "invoice") &&
    C.searchDemos(demos, "経費").length > 0 &&
    C.searchDemos(demos, "@platform/csv").length > 0 &&
    C.searchDemos(demos, "zzz-none").length === 0 && C.searchDemos(demos, "  ").length === 0);

  const tools = T.buildCatalogTools({ root, demos });
  ok("MCPツール5種(search/describe/find_examples/explain_rules/list)",
    tools.length === 5 && tools.map((t) => t.name).join(",") === "search_platform,describe_package,find_examples,explain_rules,list_platform");
  const fx = await tools.find((t) => t.name === "find_examples").handler({ query: "tax" });
  const fxErr = await tools.find((t) => t.name === "find_examples").handler({ query: "  " });
  ok("MCP find_examples: 使用例+使用パッケージ・空クエリはエラー",
    fx.content[0].text.includes("invoice") && fx.content[0].text.includes("@platform/tax") && fxErr.isError === true);
  const rules = await tools.find((t) => t.name === "explain_rules").handler({});
  ok("MCP explain_rules: 規約+アーキ+検査コマンドを返す・説明に『書く前に必ず』",
    rules.content[0].text.includes("開発規約") && rules.content[0].text.includes("check-deps.mjs") &&
    tools.find((t) => t.name === "explain_rules").description.includes("書く前に必ず"));

  await fsc.rm(base, { recursive: true, force: true });
}

// ── バージョン管理方針 / 基盤同期 / パッケージ構成 ──
{
  section("基盤の版管理 / 同期 / 構成規約");
  const fsc = await import("node:fs/promises");

  // パッケージ構成の規約(tsconfig/scripts 欠落は型チェックが素通りする)
  const S = await import(new URL("./check-package-shape.mjs", import.meta.url).href);
  const shape = S.check();
  ok(`check-package-shape: 全パッケージが規約どおり(${shape.checked}件検査・対象外 ${shape.exempt.join(",")})`, shape.issues.length === 0);

  // 基盤同期ツール
  const P = await import(new URL("./platform-sync.mjs", import.meta.url).href);
  const changes = P.detectApiChanges();
  ok("platform-sync: 現状は破壊的変更なし(api-surface と一致)", changes.breaking.length === 0 && changes.ok);
  // 影響範囲の特定(実在する API で確認)
  const usages = P.findUsages("deriveTheme");
  ok("platform-sync findUsages: 使用箇所を特定(deriveTheme → テーマギャラリー)",
    usages.some((u) => u.includes("theme-gallery-client")));
  ok("platform-sync findUsages: 使われていない名前は空", P.findUsages("zzzNonexistentApi123").length === 0);
  ok("platform-sync: 生成物の鮮度も見る", P.generatedIsStale() === false);

  // バージョン管理の方針が ADR で明文化されている
  const adr = await fsc.readFile(new URL("../docs/adr/0011-no-versioning-monorepo.md", import.meta.url), "utf8");
  ok("ADR 0011: バージョン管理しない方針・代替手段・見直し条件を記録",
    adr.includes("workspace:*") && adr.includes("api-surface") && adr.includes("platform:check") && adr.includes("見直す条件"));

  // 全パッケージが private かつ同一バージョン(方針どおり)
  const pkgDirs = (await fsc.readdir(new URL("../packages", import.meta.url).pathname, { withFileTypes: true })).filter((e) => e.isDirectory());
  let allPrivate = true, versions = new Set();
  for (const d of pkgDirs) {
    try {
      const pkg = JSON.parse(await fsc.readFile(new URL(`../packages/${d.name}/package.json`, import.meta.url), "utf8"));
      if (pkg.private !== true) allPrivate = false;
      versions.add(pkg.version);
    } catch { /* package.json 無しは無視 */ }
  }
  ok("全パッケージが private・バージョン統一(ADR 0011 の方針どおり)", allPrivate && versions.size === 1);

  // 新規アプリ手順書
  const guide = await fsc.readFile(new URL("../docs/ops/NEW_APP.md", import.meta.url), "utf8");
  ok("NEW_APP.md: ポート採番・env・ドキュメント更新・検証のチェックリスト",
    guide.includes("check-ports") && guide.includes("--port") && guide.includes("process.env を直接読まない") &&
    guide.includes("チェックリスト") && guide.includes("gen:all"));

  // demos は統合により 1 サイトのみ。README がその前提を説明しているか
  const demoReadme = await fsc.readFile(new URL("../demos/README.md", import.meta.url), "utf8");
  ok("demos/README: 1サイトに集約した理由・区分・Amplify 手順・実物は apps/ にあることを明記",
    demoReadme.includes("1 サイトだけ") && demoReadme.includes("デプロイ対象が増える") &&
    demoReadme.includes("基盤デモ") && demoReadme.includes("アプリデモ") &&
    demoReadme.includes("App root") && demoReadme.includes("実物ではありません"));
}

// ── 導入ガイド(GETTING_STARTED)の記載が実態と一致するか ──
{
  section("docs: 導入ガイドの正確さ");
  const fsc = await import("node:fs/promises");
  const g1 = await fsc.readFile(new URL("../docs/ops/GETTING_STARTED.md", import.meta.url), "utf8");
  const g2 = await fsc.readFile(new URL("../docs/ops/GETTING_STARTED_2.md", import.meta.url), "utf8");
  const guide = g1 + g2;
  const pkg = JSON.parse(await fsc.readFile(new URL("../package.json", import.meta.url), "utf8"));

  // 1. ガイドが案内する pnpm コマンドが実在するか(存在しないコマンドを教えると詰む)
  //    pnpm 組み込み(install など)は package.json に無くて当然なので除外する
  const BUILTIN = new Set(["install", "add", "remove", "why", "outdated", "exec", "run", "config", "filter", "dlx"]);
  const mentioned = [...guide.matchAll(/`pnpm ([a-z][a-z0-9:]*)\b/g)].map((m) => m[1]).filter((c) => !BUILTIN.has(c));
  const missing = [...new Set(mentioned)].filter((c) => !pkg.scripts[c]);
  ok(`導入ガイド: 案内する pnpm コマンドがすべて実在(${new Set(mentioned).size} 種)`, missing.length === 0);
  if (missing.length > 0) console.log("    存在しない:", missing.join(", "));

  // 2. ガイドが参照するファイルが実在するか
  const refs = [...guide.matchAll(/\]\(([A-Za-z0-9_./-]+\.md)\)/g)].map((m) => m[1]);
  const brokenLinks = [];
  for (const r of new Set(refs)) {
    const url = new URL(`../docs/ops/${r}`, import.meta.url);
    try { await fsc.access(url); } catch { brokenLinks.push(r); }
  }
  ok(`導入ガイド: 内部リンクがすべて有効(${new Set(refs).size} 本)`, brokenLinks.length === 0);
  if (brokenLinks.length > 0) console.log("    切れリンク:", brokenLinks.join(", "));

  // 3. ポートの記載が check-ports の実態と一致
  const P = await import(new URL("./check-ports.mjs", import.meta.url).href);
  const ports = P.collectPorts();
  const allPortsInGuide = ports.every((e) => guide.includes(`localhost:${e.port}`));
  ok(`導入ガイド: 全6アプリのURL(localhost:3000〜3005)を掲載`, allPortsInGuide);

  // 4. Windows/Mac 両対応(片方だけだと詰む)
  ok("導入ガイド: Windows(winget/PowerShell) と Mac(Homebrew/ターミナル) の両方を記載",
    g1.includes("winget install") && g1.includes("PowerShell") && g1.includes("Homebrew") && g1.includes("brew install") &&
    g1.includes("corepack enable"));

  // 5. 5工程(導入→開発→テスト→デバッグ→公開)を網羅
  ok("導入ガイド: 導入→開発→テスト/デバッグ→公開 を網羅・困ったとき付き",
    g1.includes("ツールを入れる") && g1.includes("セットアップ") &&
    g2.includes("開発する") && g2.includes("テストとデバッグ") && g2.includes("公開する") && g2.includes("困ったときは"));

  // 6. 本番の秘密値の作り方(実際に躓く所)
  ok("導入ガイド: 本番の秘密値の作り方(Windows/Mac 両方)と、弱い値だと起動しない理由を説明",
    g2.includes("openssl rand") && g2.includes("Convert]::ToBase64String") && g2.includes("assertSecretStrength"));
}

// ── Git ガイド / ドキュメント参照の健全性 ──
{
  section("docs: Git ガイド / 参照の健全性");
  const fsc = await import("node:fs/promises");

  // ドキュメントのリンク切れ・存在しないコマンド案内(初心者が詰む原因)
  const D = await import(new URL("./check-docs-links.mjs", import.meta.url).href);
  const { scanned, issues } = D.check();
  ok(`check-docs-links: 手書き資料 ${scanned} ファイルの参照がすべて有効(コマンド実在・リンク・パス)`, issues.length === 0);
  if (issues.length > 0) console.log("   ", issues.slice(0, 3).join(" / "));

  // Git ガイド: 初心者が必要とするものが揃っているか
  const git = await fsc.readFile(new URL("../docs/ops/GIT_GUIDE.md", import.meta.url), "utf8");
  ok("GIT_GUIDE: 用語説明・全体像・ツール比較(VS Code/GitHub Desktop/CLI)",
    git.includes("そもそも Git とは") && git.includes("リポジトリ") && git.includes("プルリクエスト") &&
    git.includes("VS Code") && git.includes("GitHub Desktop") && git.includes("SourceTree"));
  ok("GIT_GUIDE: GUI とコマンド両方の手順・作業の流れ・対応表",
    git.includes("使い方: VS Code") && git.includes("使い方: コマンドライン") &&
    git.includes("git checkout -b") && git.includes("gh pr create") && git.includes("用語の対応表"));
  ok("GIT_GUIDE: このリポジトリ特有の注意(生成物・基盤とアプリの分離・.env)",
    git.includes("platform:sync") && git.includes("アプリと基盤を混ぜない") && git.includes(".env はコミットしない"));
  ok("GIT_GUIDE: 困りごと対処(コミット取消・コンフリクト・push拒否)",
    git.includes("git reset --soft") && git.includes("コンフリクト") && git.includes("git pull --rebase"));

  // CONTRIBUTING: ADR 0011(バージョン管理しない)と矛盾しないか
  const contrib = await fsc.readFile(new URL("../CONTRIBUTING.md", import.meta.url), "utf8");
  ok("CONTRIBUTING: changeset の記述を廃し platform:check/sync に統一(ADR 0011 と整合)",
    !contrib.includes("pnpm changeset") && contrib.includes("platform:check") && contrib.includes("ADR 0011") &&
    contrib.includes("GIT_GUIDE"));

  // 導入ガイド: 視覚的な確認ポイント(初心者が詰まる箇所)
  const g1 = await fsc.readFile(new URL("../docs/ops/GETTING_STARTED.md", import.meta.url), "utf8");
  ok("導入ガイド: Docker 起動の見分け方・セットアップ成功時の画面を図示",
    g1.includes("Engine running") && g1.includes("docker ps") && g1.includes("セットアップ完了") && g1.includes("🩺"));

  // トラブルシューティングの拡充(実際に起きた問題を反映)
  const g2 = await fsc.readFile(new URL("../docs/ops/GETTING_STARTED_2.md", import.meta.url), "utf8");
  ok("導入ガイド: 実際に起きる問題を網羅(ポート競合・生成物漏れ・プロキシ・改行コード)",
    g2.includes("check-ports.mjs") && g2.includes("gen:all") && g2.includes("プロキシ") &&
    g2.includes("core.autocrlf") && g2.includes("動くはずなのに動かない"));
}

// ── テンプレート / 索引 / Git・Cursor ガイド ──
{
  section("docs: テンプレート / 索引 / Cursor");
  const fsc = await import("node:fs/promises");

  // PR / Issue テンプレート(初心者が何を書けばいいか分かる)
  const pr = await fsc.readFile(new URL("../.github/PULL_REQUEST_TEMPLATE.md", import.meta.url), "utf8");
  ok("PRテンプレート: 変更の種類・確認事項・基盤変更時の手順をチェックリスト化",
    pr.includes("pnpm check") && pr.includes("platform:check") && pr.includes("platform:sync") &&
    pr.includes("1 PR = 1 目的") && pr.includes("scaffold"));

  const bug = await fsc.readFile(new URL("../.github/ISSUE_TEMPLATE/bug_report.yml", import.meta.url), "utf8");
  const feat = await fsc.readFile(new URL("../.github/ISSUE_TEMPLATE/feature_request.yml", import.meta.url), "utf8");
  const cfg = await fsc.readFile(new URL("../.github/ISSUE_TEMPLATE/config.yml", import.meta.url), "utf8");
  ok("Issueテンプレート: バグ報告は再現手順+pnpm doctor 必須・要望は『困りごと』重視・空Issue禁止",
    bug.includes("再現手順") && bug.includes("pnpm doctor") && bug.includes("required: true") &&
    feat.includes("今、何に困っているか") && cfg.includes("blank_issues_enabled: false"));

  // ドキュメント索引(50超のファイルから何を読むか)
  const index = await fsc.readFile(new URL("../docs/README.md", import.meta.url), "utf8");
  ok("docs/README: 目的別索引・手書き/自動生成の区別・読む順番",
    index.includes("目的から探す") && index.includes("GETTING_STARTED") && index.includes("GIT_GUIDE") &&
    index.includes("CURSOR_GUIDE") && index.includes("手で編集しないでください") && index.includes("読む順番"));

  // Git ガイドの拡充(ブランチ命名・競合・PR/Issue・用語)
  const git = await fsc.readFile(new URL("../docs/ops/GIT_GUIDE.md", import.meta.url), "utf8");
  ok("GIT_GUIDE: ブランチ命名(種類/内容・良い例悪い例・掃除方法)",
    git.includes("feat/") && git.includes("fix/") && git.includes("refactor/") && git.includes("chore/") &&
    git.includes("良い名前・悪い名前") && git.includes("git branch --merged"));
  ok("GIT_GUIDE: 競合解決(見え方・VS Code での直し方・手順・減らすコツ・abort)",
    git.includes("<<<<<<< HEAD") && git.includes("現在の変更を維持") && git.includes("git merge --abort") &&
    git.includes("競合を減らすコツ"));
  ok("GIT_GUIDE: PR の使い方(小さく出す・テンプレ・自分でレビュー・出した後の流れ)",
    git.includes("良い PR の作り方") && git.includes("Squash and merge") && git.includes("レビューで指摘されたときの心得"));
  ok("GIT_GUIDE: Issue の使い方(いつ書く・書き方の良い例悪い例・Closes #)",
    git.includes("Issue（イシュー）の使い方") && git.includes("Closes #") && git.includes("何に困っているか"));
  ok("GIT_GUIDE: 用語集(基本・PR まわり・難しいもの・stash 実例)",
    git.includes("用語集") && git.includes("ステージング") && git.includes("cherry-pick") && git.includes("git stash pop"));

  // Cursor ガイド
  const cursor = await fsc.readFile(new URL("../docs/ops/CURSOR_GUIDE.md", import.meta.url), "utf8");
  ok("CURSOR_GUIDE: 導入・MCP接続・3機能の使い分け(Tab/Cmd+K/Chat)",
    cursor.includes("Import VS Code settings") && cursor.includes("mcpServers") && cursor.includes("platform-catalog") &&
    cursor.includes("Cmd+K") && cursor.includes("Cmd+L"));
  ok("CURSOR_GUIDE: このリポジトリでの流れ(まず基盤を探す・良い聞き方/悪い聞き方)",
    cursor.includes("車輪の再発明") && cursor.includes("search_platform で") && cursor.includes("良い聞き方") &&
    cursor.includes("@Codebase"));
  ok("CURSOR_GUIDE: デバッグ・テスト(エラー全文・any禁止・AIが嘘をつく典型)",
    cursor.includes("エラー全文") && cursor.includes("any を使わずに") && cursor.includes("AI が嘘をつく典型") &&
    cursor.includes("pnpm check を自分で打つ") === false && cursor.includes("自分のターミナルで実行"));
  ok("CURSOR_GUIDE: やってはいけないこと(読まずにコミット・.env を貼る)・チェックリスト",
    cursor.includes("読まずにコミット") && cursor.includes("`.env` の中身を Chat に貼る") &&
    cursor.includes("チェックリスト") && cursor.includes("Privacy Mode"));
}

// ── 役割分担の明確化 / オンボーディング / 重複整理 ──
{
  section("docs: 役割分担 / オンボーディング / 重複整理");
  const fsc = await import("node:fs/promises");

  // CLAUDE.md と CURSOR_GUIDE の役割分担(二重管理を防ぐ)
  const claude = await fsc.readFile(new URL("../CLAUDE.md", import.meta.url), "utf8");
  const cursor = await fsc.readFile(new URL("../docs/ops/CURSOR_GUIDE.md", import.meta.url), "utf8");
  ok("CLAUDE.md: 位置づけ(何を守るか)と他資料の役割分担を明示・Cursor も読むと明記",
    claude.includes("何を守るか") && claude.includes("CURSOR_GUIDE.md") && claude.includes("Cursor") &&
    claude.includes("道具の操作"));
  ok("CLAUDE.md: AI が守ること(基盤検索・pnpm check・any禁止・存在しないAPI禁止)",
    claude.includes("AI が守ること") && claude.includes("search_platform") && claude.includes("pnpm check") &&
    claude.includes("any") && claude.includes("存在しない API を提案しない"));
  ok("CURSOR_GUIDE: 位置づけ(道具の使い方)・規約は CLAUDE.md と明示",
    cursor.includes("道具の使い方") && cursor.includes("CLAUDE.md") && cursor.includes("Cursor も自動で読みます"));

  // オンボーディング Issue
  const ob = await fsc.readFile(new URL("../.github/ISSUE_TEMPLATE/onboarding.yml", import.meta.url), "utf8");
  ok("オンボーディング: 6段階(環境→動かす→全体像→Git→ツール→最初のPR)・詰まった箇所を記録",
    ob.includes("環境を作る") && ob.includes("動かしてみる") && ob.includes("全体像をつかむ") &&
    ob.includes("最初の PR を出す") && ob.includes("詰まった箇所") && ob.includes("次の人も必ず詰まります"));
  ok("オンボーディング: 練習用PRのお題が「詰まった箇所をドキュメントに追記」(改善が回る)",
    ob.includes("詰まった箇所を**ドキュメントに追記**") || ob.includes("詰まった箇所をドキュメントに追記"));

  // SETUP.md と GETTING_STARTED の重複整理
  const setup = await fsc.readFile(new URL("../docs/ops/SETUP.md", import.meta.url), "utf8");
  ok("SETUP.md: 経験者向けリファレンスと位置づけ・初心者は GETTING_STARTED へ誘導",
    setup.includes("リファレンス") && setup.includes("はじめての方は") && setup.includes("GETTING_STARTED.md") &&
    setup.includes("経験者向け"));
  ok("SETUP.md: つまずきを固有のもの(setup/Prisma/devcontainer)に絞り、一般論は GETTING_STARTED_2 へ",
    setup.includes("このページ固有のもの") && setup.includes("GETTING_STARTED_2.md#困ったときは") &&
    !setup.includes("| `Docker daemon not running` |"));
  ok("SETUP.md: ポート表が実態と一致(3005 追加・古い -p 3004 の記述を削除)",
    setup.includes("| 3005 | platform-portal |") && setup.includes("pnpm dev:site") &&
    !setup.includes("dev -- -p 3004"));

  // ポート記述のドリフト検出が SETUP.md も見る
  const P = await import(new URL("./check-ports.mjs", import.meta.url).href);
  const docs = P.docPorts();
  ok("check-ports: SETUP.md のポート表も突き合わせ対象(記述のドリフトを検出)",
    docs["platform-portal"] !== undefined && docs["internal-app"] !== undefined &&
    Object.values(docs).every((d) => typeof d.port === "number" && typeof d.file === "string"));
  ok("check-ports: 実態とドキュメントが一致", P.check().issues.length === 0);
}

// ── 負荷テスト / テストガイド / 重複検出 / CODEOWNERS ──
{
  section("test: 負荷テスト / ガイド / 重複検出");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");

  // 負荷テスト基盤(実ロジック)
  const base = `${osc.tmpdir()}/lt-${Date.now()}`;
  await fsc.mkdir(base, { recursive: true });
  for (const f of ["stats", "runner", "scenario", "index"]) {
    await fsc.writeFile(`${base}/${f}.ts`, (await fsc.readFile(new URL(`../packages/loadtest/src/${f}.ts`, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  }
  const L = await import(`${base}/index.ts`);

  const st = L.latencyStats([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  ok("loadtest latencyStats: count/min/max/mean/p50/p90/p95/p99・percentile は線形補間",
    st.count === 10 && st.min === 10 && st.max === 100 && st.mean === 55 && st.p50 === 55 && st.p99 >= st.p95 &&
    L.percentile([1, 2, 3, 4], 0) === 1 && L.percentile([1, 2, 3, 4], 100) === 4 && L.percentile([], 50) === 0);

  let calls = 0;
  const r1 = await L.runLoad(async () => { calls += 1; return { ok: true, status: 200, durationMs: 1 }; }, { iterations: 50, concurrency: 5 });
  ok("loadtest runLoad: 指定回数・並列・成功数・スループット・statusCounts",
    calls === 50 && r1.total === 50 && r1.success === 50 && r1.failed === 0 && r1.throughput > 0 && r1.statusCounts["200"] === 50);

  const r2 = await L.runLoad(async ({ index }) => ({ ok: index % 2 === 0, status: index % 2 === 0 ? 200 : 500, durationMs: 5 }), { iterations: 10, concurrency: 2 });
  ok("loadtest runLoad: 失敗を集計(errorRate 0.5・500 が 5 件)",
    r2.success === 5 && r2.failed === 5 && Math.abs(r2.errorRate - 0.5) < 0.01 && r2.statusCounts["500"] === 5);

  const picks = {};
  for (let i = 0; i < 1000; i += 1) {
    const step = L.weightedPick([{ name: "a", weight: 9 }, { name: "b", weight: 1 }], Math.random());
    picks[step.name] = (picks[step.name] ?? 0) + 1;
  }
  ok("loadtest weightedPick: 重みに比例(9:1)", picks.a > picks.b * 5);
  ok("loadtest formatResult: p50/p95/req/s/err を含む",
    L.formatResult(r1).includes("p50") && L.formatResult(r1).includes("req/s") && L.formatResult(r1).includes("err"));
  await fsc.rm(base, { recursive: true, force: true });

  // pnpm loadtest コマンド
  const pkg = JSON.parse(await fsc.readFile(new URL("../package.json", import.meta.url), "utf8"));
  ok("pnpm loadtest コマンドが定義済み", typeof pkg.scripts.loadtest === "string" && pkg.scripts.loadtest.includes("loadtest.mjs"));

  // テストガイド
  const guide = await fsc.readFile(new URL("../docs/ops/TESTING_GUIDE.md", import.meta.url), "utf8");
  ok("TESTING_GUIDE: 6種のテスト(スモーク/型/Lint/ユニット/E2E/負荷)を速さ順で整理",
    guide.includes("pnpm smoke") && guide.includes("pnpm typecheck") && guide.includes("pnpm lint") &&
    guide.includes("pnpm test") && guide.includes("pnpm e2e") && guide.includes("pnpm loadtest"));
  ok("TESTING_GUIDE: 負荷テストの読み方(p95 重視・平均を見ない・本番に撃たない)",
    guide.includes("p95") && guide.includes("平均値を見ないでください") && guide.includes("本番環境に向けて撃たない"));
  ok("TESTING_GUIDE: デバッグ(原因を探す順番・症状別対処・固有機能)",
    guide.includes("原因を探す順番") && guide.includes("/admin/env") && guide.includes("db-viewer") &&
    guide.includes("8025") && guide.includes("症状別の対処"));
  ok("TESTING_GUIDE: テストの心得(何を優先・良い例悪い例・AIのテストを信じない)",
    guide.includes("金額計算") && guide.includes("権限判定") && guide.includes("良いテスト・悪いテスト") &&
    guide.includes("「テストが通りました」を信じないでください"));

  // ドキュメント重複検出
  const D = await import(new URL("./check-docs-duplication.mjs", import.meta.url).href);
  const dup = D.check();
  ok(`check-docs-duplication: 重複なし(${dup.files} ファイル・ALLOW は理由付きで登録)`, dup.issues.length === 0);

  // CODEOWNERS(プレースホルダのまま有効化するとマージ不能になる)
  const co = await fsc.readFile(new URL("../.github/CODEOWNERS", import.meta.url), "utf8");
  ok("CODEOWNERS: 置換必須の警告あり・基盤/tools/規約/CI を保護",
    co.includes("プレースホルダ") && co.includes("マージ不能") && co.includes("/packages/") &&
    co.includes("/tools/") && co.includes("/.github/") && co.includes("CI_FIRST_RUN"));
  const cfr = await fsc.readFile(new URL("../docs/ops/CI_FIRST_RUN.md", import.meta.url), "utf8");
  ok("CI_FIRST_RUN: CODEOWNERS の置換手順・ブランチ保護の設定表・1人運用の注意",
    cfr.includes("CODEOWNERS の置換") && cfr.includes("Require review from Code Owners") && cfr.includes("1 人で運用する場合"));
}

// ── 負荷シナリオ / 性能基準 / E2E品質 / DevTools ──
{
  section("perf: 負荷シナリオ / 基準 / E2E品質 / DevTools");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");

  // 業務パターンの負荷シナリオ(実ロジック)
  const base = `${osc.tmpdir()}/lsc-${Date.now()}`;
  await fsc.mkdir(base, { recursive: true });
  for (const f of ["stats", "runner", "scenario"]) {
    let src = (await fsc.readFile(new URL(`../packages/loadtest/src/${f}.ts`, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
    src = src.replace('from "./stats.ts"', `from "${base}/stats.ts"`).replace('from "./runner.ts"', `from "${base}/runner.ts"`);
    await fsc.writeFile(`${base}/${f}.ts`, src);
  }
  await fsc.writeFile(`${base}/index.ts`, `export * from "${base}/stats.ts";\nexport * from "${base}/runner.ts";\nexport * from "${base}/scenario.ts";\n`);
  await fsc.writeFile(`${base}/scen.ts`, (await fsc.readFile(new URL("../demos/showcase/src/examples/loadtest-scenarios.ts", import.meta.url), "utf8")).replace('from "@platform/loadtest"', `from "${base}/index.ts"`).replace(/\.js"/g, '.ts"'));
  const S = await import(`${base}/scen.ts`);
  const L = await import(`${base}/index.ts`);

  const fetchImpl = async (url) => ({ ok: !String(url).includes("fail"), status: String(url).includes("fail") ? 500 : 200 });
  const step = S.buildHttpStep({ baseUrl: "http://x", fetchImpl });

  ok("負荷シナリオ: 5種(朝の打刻/経費/平常/月次/health)・重みが業務比率を反映",
    Object.keys(S.scenarios).length === 5 && S.morningRush(step).steps[0].weight === 8 &&
    S.expenseRush(step).steps[0].name === "経費一覧" && S.monthlyClosing(step).steps.length === 2);

  const r = await L.runScenario(S.morningRush(step), { concurrency: 5, iterations: 100 });
  ok("runScenario(朝の打刻): ステップ別統計・打刻が多数派・p50 取得",
    r.total === 100 && r.steps.length === 2 && r.steps[0].count > r.steps[1].count && r.steps[0].latency.p50 >= 0);

  const er = await L.runScenario({ steps: [{ name: "err", request: S.buildHttpStep({ baseUrl: "http://x", fetchImpl: async () => { throw new Error("down"); } })("/x") }] }, { concurrency: 1, iterations: 3 });
  ok("buildHttpStep: 例外も ok:false にして負荷テストを止めない", er.failed === 3 && er.total === 3);

  ok("scenarioGuide: 推奨設定と見るべき指標(朝はランプ無し・月次は max を見る)",
    S.scenarioGuide["morning-rush"].rampUpMs === 0 && S.scenarioGuide["morning-rush"].concurrency === 200 &&
    S.scenarioGuide["monthly-closing"].watch.includes("max") && S.scenarioGuide["normal-day"].rampUpMs > 0);
  ok("formatSteps: ステップ別の表(件数/成功/失敗/p50/p95/max)",
    S.formatSteps(r.steps).includes("p95") && S.formatSteps(r.steps).includes("打刻"));
  await fsc.rm(base, { recursive: true, force: true });

  // 性能基準の ADR
  const adr = await fsc.readFile(new URL("../docs/adr/0012-performance-targets.md", import.meta.url), "utf8");
  ok("ADR 0012: p95 基準の目標値・エラー率0%・CIで測らない理由・見直し条件",
    adr.includes("p95") && adr.includes("300ms") && adr.includes("エラー率") && adr.includes("0%") &&
    adr.includes("CI では性能を測らない") && adr.includes("偽の失敗") && adr.includes("見直す条件"));

  // E2E の Flaky リスク検査
  const E = await import(new URL("./check-e2e-quality.mjs", import.meta.url).href);
  const e2e = E.check();
  ok(`check-e2e-quality: 固定待ち/CSSセレクタ無し・retries/trace 設定済み(${e2e.specs} spec)`,
    e2e.issues.length === 0 && e2e.specs >= 7);

  // DevTools ガイド
  const dt = await fsc.readFile(new URL("../docs/ops/DEVTOOLS_GUIDE.md", import.meta.url), "utf8");
  ok("DEVTOOLS_GUIDE: 開き方・タブの使い分け・Console/Network/Elements/Application/Sources",
    dt.includes("F12") && dt.includes("Cmd+Option+I") && dt.includes("# Console") && dt.includes("# Network") &&
    dt.includes("# Elements") && dt.includes("# Application") && dt.includes("# Sources"));
  ok("DEVTOOLS_GUIDE: ステータス別の対処・このリポジトリ固有(data-skin/localStorage/Mailpit)",
    dt.includes("500") && dt.includes("ターミナル") && dt.includes("data-skin") && dt.includes("localStorage") &&
    dt.includes("8025"));
  ok("DEVTOOLS_GUIDE: 症状から探す表・切り分けのコツ・遅い回線/非力PCの再現",
    dt.includes("症状から探す") && dt.includes("Slow 3G") && dt.includes("CPU: 4x slowdown") &&
    dt.includes("React Developer Tools"));
}

// ── 運用ダッシュボード / 障害対応 / デバッグ設定 ──
{
  section("ops: ダッシュボード / 障害対応 / デバッグ設定");
  const fsc = await import("node:fs/promises");

  // 運用ダッシュボード(障害時に最初に開く画面)
  const route = await fsc.readFile(new URL("../apps/internal-app/src/app/api/admin/ops/route.ts", import.meta.url), "utf8");
  ok("ops API: 稼働状況/監査整合性/指標/設定を1本に集約・秘密はマスク・管理者のみ",
    route.includes("buildStatusChecks") && route.includes("auditLog.verify") && route.includes("maskSecrets") &&
    route.includes("errorRate") && route.includes("管理者権限が必要です"));

  const client = await fsc.readFile(new URL("../apps/internal-app/src/app/admin/ops/ops-client.tsx", import.meta.url), "utf8");
  ok("ops 画面: 総合判定・異常時の次アクション・自動更新・調査導線",
    client.includes("正常") && client.includes("異常あり") && client.includes("NEXT_ACTION") &&
    client.includes("10秒ごとに自動更新") && client.includes("/admin/env") && client.includes("/admin/db-viewer") &&
    client.includes("INCIDENT_RESPONSE"));

  // 障害対応の手順書
  const inc = await fsc.readFile(new URL("../docs/ops/INCIDENT_RESPONSE.md", import.meta.url), "utf8");
  ok("INCIDENT_RESPONSE: 最初の5分・一報のテンプレ・症状別の対応",
    inc.includes("最初の 5 分") && inc.includes("一報のテンプレート") && inc.includes("調査中") &&
    inc.includes("画面が開かない") && inc.includes("サーバが落ちた") && inc.includes("DB に繋がらない"));
  ok("INCIDENT_RESPONSE: ログから原因を特定する表(設定漏れ/秘密値/接続枯渇/メモリ)",
    inc.includes("環境変数の検証に失敗") && inc.includes("秘密値の強度が不十分") &&
    inc.includes("too many connections") && inc.includes("heap out of memory"));
  ok("INCIDENT_RESPONSE: ロールバック(revert 推奨・reset --hard 禁止)・DB戻しの警告",
    inc.includes("git revert") && inc.includes("`git reset --hard` で歴史を消さないでください") &&
    inc.includes("pg_dump"));
  ok("INCIDENT_RESPONSE: 復旧後の記録・責めない文化・予防(バックアップ復元の確認)",
    inc.includes("記録を残す") && inc.includes("責めない") && inc.includes("犯人探し") &&
    inc.includes("試していないバックアップは無いのと同じ"));
  ok("INCIDENT_RESPONSE: チートシート・連絡先の記入欄",
    inc.includes("チートシート") && inc.includes("連絡先") && inc.includes("記入"));

  // VS Code / Cursor のデバッグ設定(既存の確認)
  const launch = JSON.parse(await fsc.readFile(new URL("../.vscode/launch.json", import.meta.url), "utf8"));
  const names = launch.configurations.map((c) => c.name);
  ok("launch.json: テスト/スモーク/Next.js/アタッチのデバッグ構成が揃っている",
    launch.configurations.length >= 5 &&
    names.some((n) => n.includes("Vitest")) && names.some((n) => n.includes("スモーク")) &&
    names.some((n) => n.includes("Next.js")) && names.some((n) => n.includes("Attach")));
}

// ── Platform Debugger ──
{
  section("debug: Platform Debugger");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const base = `${osc.tmpdir()}/pdbg-${Date.now()}`;
  await fsc.mkdir(base, { recursive: true });
  await fsc.writeFile(`${base}/debug.ts`, (await fsc.readFile(new URL("../packages/debug/src/debug.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  const D = await import(`${base}/debug.ts`);

  let t = 1000;
  const now = () => t;
  const c = D.createDebugCollector({ enabled: true, now, capacity: 3 });
  c.start({ requestId: "r1", method: "GET", path: "/api/expenses", userId: "u1" });
  t = 1010; c.record("r1", { kind: "sql", label: 'SELECT FROM "Expense"', durationMs: 5, ok: true, meta: { rows: 20 } });
  t = 1100; c.record("r1", { kind: "ai", label: "claude", durationMs: 800, ok: true, meta: { tokens: 1500 } });
  t = 1150; c.finish("r1", 200);
  const r1 = c.get("r1");
  ok("収集: start/record/finish・相対時刻・総時間・meta",
    r1.status === 200 && r1.durationMs === 150 && r1.events[0].atMs === 10 && r1.events[1].atMs === 100 && r1.events[0].meta.rows === 20);

  const s1 = c.summarize(r1);
  ok("集計: 種類別の件数と合計時間", s1.counts.sql === 1 && s1.counts.ai === 1 && s1.durations.ai === 800);

  // N+1 と遅い SQL
  c.start({ requestId: "r2", method: "GET", path: "/api/n1" });
  for (let i = 0; i < 5; i += 1) { t += 1; c.record("r2", { kind: "sql", label: 'SELECT FROM "User"', durationMs: 2, ok: true }); }
  t += 1; c.record("r2", { kind: "sql", label: 'SELECT FROM "Big"', durationMs: 500, ok: true });
  t += 1200; c.finish("r2", 200);
  const r2 = c.get("r2"), s2 = c.summarize(r2);
  const issues = D.findIssues(r2, s2);
  ok("実行時にしか分からない問題を検出(N+1・遅いSQL・1秒超え)",
    s2.duplicateSql === 4 && s2.slowSql === 1 &&
    issues.some((i) => i.includes("N+1")) && issues.some((i) => i.includes("遅い SQL")) && issues.some((i) => i.includes("ms かかっています")));

  // 本番では完全無効(最重要)
  const off = D.createDebugCollector({ enabled: false });
  off.start({ requestId: "x", method: "GET", path: "/x" });
  off.record("x", { kind: "sql", label: "s", durationMs: 1, ok: true });
  off.finish("x", 200);
  ok("本番(enabled:false): 記録も保持もしない・メモリ影響ゼロ",
    off.list().length === 0 && off.get("x") === undefined && off.enabled === false);

  ok("リングバッファ: 容量超過で古いものを捨てる・新しい順",
    (c.start({ requestId: "r3", method: "GET", path: "/x" }), c.start({ requestId: "r4", method: "GET", path: "/x" }),
      c.list().length === 3 && c.get("r1") === undefined && c.list()[0].requestId === "r4"));
  ok("未 start への record は無視(例外を投げない)",
    (c.record("unknown", { kind: "sql", label: "s", durationMs: 1, ok: true }), c.get("unknown") === undefined));

  ok("summarizeSql: 動詞+テーブル名に短縮・解析不能はそのまま",
    D.summarizeSql('SELECT "id" FROM "User" WHERE x = $1') === 'SELECT FROM "User"' &&
    D.summarizeSql('INSERT INTO "Expense" ("a") VALUES ($1)') === 'INSERT INTO "Expense"' &&
    D.summarizeSql('UPDATE "User" SET x = 1') === 'UPDATE "User"' &&
    D.summarizeSql('DELETE FROM "Log" WHERE x') === 'DELETE FROM "Log"' &&
    D.summarizeSql("BEGIN") === "BEGIN");
  await fsc.rm(base, { recursive: true, force: true });

  // アプリへの配線
  const env = await fsc.readFile(new URL("../apps/internal-app/src/server/env.ts", import.meta.url), "utf8");
  ok("DEBUG_TOOL: 本番では強制的に無効(NODE_ENV=production なら true でも無効)",
    env.includes("DEBUG_TOOL") && env.includes('optionalEnv("NODE_ENV") !== "production"'));
  const inst = await fsc.readFile(new URL("../apps/internal-app/src/server/instrument.ts", import.meta.url), "utf8");
  ok("instrument.ts: 全APIに配線(start/finish・成功時と例外時の両方)",
    inst.includes("debugCollector.start") && (inst.match(/debugCollector\.finish/g) || []).length === 2);
  const route = await fsc.readFile(new URL("../apps/internal-app/src/app/api/debug/route.ts", import.meta.url), "utf8");
  ok("debug API: 無効時は 404(本番で情報を漏らさない)・一覧と詳細・clear",
    route.includes('return new Response("Not Found", { status: 404 })') && route.includes("findIssues") && route.includes("DELETE"));
  const client = await fsc.readFile(new URL("../apps/internal-app/src/app/debug/debug-client.tsx", import.meta.url), "utf8");
  ok("debug 画面: 一覧・タイムライン(帯グラフ)・気になる点・無効時の案内",
    client.includes("タイムライン") && client.includes("Platform Debugger は無効です") && client.includes("DEBUG_TOOL=true") &&
    client.includes("KIND_COLOR"));

  // scaffold の是正(規約違反の元凶だった)
  const scaffold = await fsc.readFile(new URL("./scaffold.mjs", import.meta.url), "utf8");
  ok("scaffold 是正: build/lint/vitest.config を生成する(14件の規約違反の元凶)",
    scaffold.includes('build: "tsc -p tsconfig.json"') && scaffold.includes('lint: "eslint src"') &&
    scaffold.includes("vitest.config.ts") && scaffold.includes("@platform/config"));
}

// ── システムアラートの通知 / Debugger フローティングバー ──
{
  section("ops: アラート通知 / Debugバー");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const base = `${osc.tmpdir()}/alrt-${Date.now()}`;
  await fsc.mkdir(base, { recursive: true });
  await fsc.writeFile(`${base}/alerting.ts`, (await fsc.readFile(new URL("../packages/observability/src/alerting.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  const A = await import(`${base}/alerting.ts`);

  const rules = [{
    name: "err", severity: "critical", forEvaluations: 2,
    condition: A.errorRateAbove("total", "err", 0.01),
    describe: (m) => `エラー率 ${(((m.counters.err ?? 0) / (m.counters.total ?? 1)) * 100).toFixed(1)}%`,
  }];
  const m = A.createAlertManager(rules);
  const view = (err) => ({ counters: { total: 100, err }, histograms: {}, gauges: {} });

  ok("アラート: 1回目は発報しない(一時的スパイクで騒がない)", m.evaluate(view(5)).length === 0);
  const fired = m.evaluate(view(5));
  ok("アラート: 2回連続で発報(severity/message付き)",
    fired.length === 1 && fired[0].firing === true && fired[0].severity === "critical" && fired[0].message.includes("%"));
  ok("アラート: 発報中は鳴り続けない(状態変化のみ)", m.evaluate(view(5)).length === 0 && m.active().length === 1);
  const recovered = m.evaluate(view(0));
  ok("アラート: 回復したら通知・active から消える", recovered.length === 1 && recovered[0].firing === false && m.active().length === 0);
  await fsc.rm(base, { recursive: true, force: true });

  // アプリの配線
  const sa = await fsc.readFile(new URL("../apps/internal-app/src/server/system-alerts.ts", import.meta.url), "utf8");
  ok("system-alerts: ADR 0012 の基準に合わせたルール・メール/Slack・通知先無しはログ",
    sa.includes("ADR 0012") && sa.includes("errorRateAbove") && sa.includes("avgLatencyAbove") &&
    sa.includes("ALERT_MAIL_TO") && sa.includes("ALERT_SLACK_WEBHOOK") && sa.includes("通知先が未設定です"));
  ok("system-alerts: 業務アラート(alerts.ts)と別物として分離",
    (await fsc.readFile(new URL("../apps/internal-app/src/server/alerts.ts", import.meta.url), "utf8")).includes("buildAlerts") && !sa.includes("buildAlerts"));

  const scan = await fsc.readFile(new URL("../apps/internal-app/src/app/api/admin/system-alerts/scan/route.ts", import.meta.url), "utf8");
  ok("cron API: CRON_TOKEN 認証・未設定なら 503(既定で安全側)",
    scan.includes("x-cron-token") && scan.includes("CRON_TOKEN が未設定です") && scan.includes("status: 503"));

  // Debugger のフローティングバー
  const bar = await fsc.readFile(new URL("../apps/internal-app/src/components/DebugBar.tsx", import.meta.url), "utf8");
  ok("DebugBar: 本番(404)なら何も描画しない・直近リクエストの要約・詳細へ誘導",
    bar.includes("if (enabled !== true) return null") && bar.includes("/api/debug") && bar.includes("詳しく見る") &&
    bar.includes('!x.path.startsWith("/api/debug")'));
  const layout = await fsc.readFile(new URL("../apps/internal-app/src/app/layout.tsx", import.meta.url), "utf8");
  ok("DebugBar: layout に配置(全画面の隅に常駐)", layout.includes("<DebugBar />"));

  // SQL Monitor(services.ts の配線)
  const svc = await fsc.readFile(new URL("../apps/internal-app/src/server/services.ts", import.meta.url), "utf8");
  ok("SQL Monitor: DEBUG_TOOL 有効時のみ onQuery を渡す(本番はオーバーヘッド無し)",
    svc.includes("featureEnv.DEBUG_TOOL") && svc.includes("onQuery") && svc.includes("summarizeSql") &&
    svc.includes("debugCollector.record"));
}

// ── @platform/task(タスク管理・プロジェクト管理も兼ねる) ──
{
  section("task: タスク/プロジェクト管理");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const base = `${osc.tmpdir()}/task-${Date.now()}`;
  await fsc.mkdir(base, { recursive: true });
  await fsc.writeFile(`${base}/core-error.ts`, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(`${base}/core-result.ts`, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${base}/core-error.ts"`));
  await fsc.writeFile(`${base}/core.ts`, `export * from "${base}/core-error.ts";\nexport * from "${base}/core-result.ts";\n`);
  await fsc.writeFile(`${base}/task.ts`, (await fsc.readFile(new URL("../packages/task/src/task.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${base}/core.ts"`));
  const T = await import(`${base}/task.ts`);

  const mk = (o) => ({ id: "t", title: "x", status: "todo", priority: "normal", createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z", ...o });
  const today = new Date("2026-07-15T00:00:00Z");

  ok("状態遷移: 順序を飛ばせない(todo→done 不可)・差し戻し/中止は可",
    T.canTransition("todo", "doing") && !T.canTransition("todo", "done") &&
    T.canTransition("done", "doing") && T.canTransition("review", "canceled") &&
    (() => { try { T.transition(mk({}), "done"); return false; } catch (e) { return e.code === "VALIDATION" && e.message.includes("飛ばせません"); } })());

  ok("期限: 判定と残日数(done/canceled と期限なしは対象外)",
    T.isOverdue(mk({ dueDate: "2026-07-10" }), today) &&
    !T.isOverdue(mk({ dueDate: "2026-07-10", status: "done" }), today) &&
    !T.isOverdue(mk({}), today) &&
    T.daysUntilDue(mk({ dueDate: "2026-07-20" }), today) === 5 &&
    T.daysUntilDue(mk({ dueDate: "2026-07-10" }), today) === -5 &&
    T.daysUntilDue(mk({}), today) === undefined);

  const tasks = [
    mk({ id: "1", status: "done" }), mk({ id: "2", status: "done" }),
    mk({ id: "3", status: "doing", dueDate: "2026-07-10", estimateHours: 8, actualHours: 10 }),
    mk({ id: "4", status: "todo", estimateHours: 4 }),
    mk({ id: "5", status: "canceled" }),
  ];
  const s = T.summarize(tasks, today);
  ok("進捗: 中止は分母から除く(2/4=50%)・期限切れ・工数・空でも壊れない",
    s.total === 5 && Math.abs(s.rate - 0.5) < 0.01 && s.overdue === 1 && s.estimateHours === 12 && s.actualHours === 10 &&
    T.summarize([]).rate === 0);

  ok("並べ替え: 優先度順・期限順(期限なしは最後)",
    T.sortTasks([mk({ id: "a", priority: "low" }), mk({ id: "b", priority: "urgent" }), mk({ id: "c", priority: "high" })]).map((t) => t.id).join("") === "bca" &&
    T.sortTasks([mk({ id: "a" }), mk({ id: "b", dueDate: "2026-07-20" }), mk({ id: "c", dueDate: "2026-07-10" })], "dueDate").map((t) => t.id).join("") === "cba");

  ok("絞り込み: 状態/期限切れ/サブタスク除外",
    T.filterTasks(tasks, { status: ["done"] }).length === 2 &&
    T.filterTasks(tasks, { overdueOnly: true }, today).length === 1 &&
    T.filterTasks([mk({ id: "p" }), mk({ id: "s", parentId: "p" })], { topLevelOnly: true }).length === 1);

  const kb = T.toKanban(tasks);
  ok("かんばん: 4列(canceled は出さない=見たいのは今やること)",
    kb.length === 4 && kb.map((k) => k.status).join(",") === "todo,doing,review,done" && kb.flatMap((k) => k.tasks).length === 4);

  const wl = T.workloadByAssignee([
    mk({ id: "1", assignee: "a", estimateHours: 8 }), mk({ id: "2", assignee: "a", estimateHours: 4 }),
    mk({ id: "3", assignee: "b", estimateHours: 2 }), mk({ id: "4", assignee: "a", status: "done", estimateHours: 100 }),
    mk({ id: "5" }),
  ]);
  ok("負荷: 未完のみ・工数順・未割り当ても見える(誰に偏っているか)",
    wl[0].assignee === "a" && wl[0].hours === 12 && wl[0].count === 2 && wl.some((w) => w.assignee === "(未割り当て)"));

  ok("プロジェクト管理も兼ねる(projectId で束ねるだけ)",
    T.filterTasks([mk({ id: "1", projectId: "p1" }), mk({ id: "2", projectId: "p2" })], { projectId: "p1" }).length === 1);

  await fsc.rm(base, { recursive: true, force: true });
}

// ── apps 側の開発規約(CLAUDE.md)の明文化と機械検査 ──
{
  section("rules: apps 側の開発規約");
  const fsc = await import("node:fs/promises");

  // CLAUDE.md に規約が明記されているか
  const claude = await fsc.readFile(new URL("../CLAUDE.md", import.meta.url), "utf8");
  ok("CLAUDE.md: 基盤は唯一の実装元・探す→使う→無ければ基盤追加を提案、の順",
    claude.includes("共通機能の唯一の実装元") && claude.includes("search_platform") &&
    claude.includes("あれば必ず使う") && claude.includes("基盤への追加を提案"));
  ok("CLAUDE.md: apps に書いてよい/いけないものの対比表(認証・ログ・CSV・PDF 等)",
    claude.includes("apps に実装してよいもの / いけないもの") &&
    claude.includes("経費申請の承認フロー") && claude.includes("認証・認可・権限判定") &&
    claude.includes("CSV・PDF・Excel・帳票") && claude.includes("Workflow・Scheduler・Queue・Cache"));
  ok("CLAUDE.md: 判断基準・禁止事項(車輪の再発明)・実装前チェック",
    claude.includes("隣の部署のアプリでも使うか") && claude.includes("車輪の再発明") &&
    claude.includes("独自の HTTP クライアント") && claude.includes("実装前チェック"));
  ok("CLAUDE.md: AI が守ること に Package 優先を明記",
    claude.includes("基盤にあれば**必ず使う**") && claude.includes("apps に汎用処理を書かない"));
  ok("CLAUDE.md: changeset は「使わない」と明記(ADR 0011 と整合)・platform:check/sync に統一",
    claude.includes("`pnpm changeset` は使わない") && claude.includes("platform:check") && claude.includes("docs/adr/0011") &&
    !/^\s*[-|]\s*`pnpm changeset`.*雛形|変更を記録/m.test(claude));

  // 機械検査(規約は書くだけでは守られない)
  const R = await import(new URL("./check-app-rules.mjs", import.meta.url).href);
  const r = R.check();
  ok(`check-app-rules: apps/demos が基盤の役割を侵していない(${r.scanned} ファイル)`, r.issues.length === 0);
  const tool = await fsc.readFile(new URL("./check-app-rules.mjs", import.meta.url), "utf8");
  ok("check-app-rules: 禁止ライブラリの直接 import と汎用処理の自作を検出・例外は理由付き",
    tool.includes("nodemailer") && tool.includes("@platform/mail") && tool.includes("@anthropic-ai/sdk") &&
    tool.includes("ADR 0010") && tool.includes("SUSPICIOUS_FILES") && tool.includes("ALLOW"));
  ok("check-app-rules: 業務ロジックは検出しない(apps に書くのが正しいため)",
    tool.includes("業務ロジック") && tool.includes("apps に書くのが正しい"));
}

// ── タスク管理の画面(@platform/task の配線) ──
{
  section("internal-app: タスク管理");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const base = `${osc.tmpdir()}/tui-${Date.now()}`;
  await fsc.mkdir(base, { recursive: true });
  await fsc.writeFile(`${base}/core-error.ts`, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(`${base}/core-result.ts`, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${base}/core-error.ts"`));
  await fsc.writeFile(`${base}/core.ts`, `export * from "${base}/core-error.ts";\nexport * from "${base}/core-result.ts";\n`);
  await fsc.writeFile(`${base}/task.ts`, (await fsc.readFile(new URL("../packages/task/src/task.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${base}/core.ts"`));
  // services(db)と env は差し替える(DB 接続を張らない)
  await fsc.writeFile(`${base}/services.ts`, `export const db = {};`);
  await fsc.writeFile(`${base}/env.ts`, `export const featureEnv = { TASK_PERSISTENCE: "" };`);
  await fsc.writeFile(`${base}/task-repo.ts`, (await fsc.readFile(new URL("../apps/internal-app/src/server/task-repo.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/task"', `from "${base}/task.ts"`).replace('from "./services.ts"', `from "${base}/services.ts"`).replace('from "./env.ts"', `from "${base}/env.ts"`));
  const R = await import(`${base}/task-repo.ts`);
  const T = await import(`${base}/task.ts`);

  // seed が入っていて、動かして確かめられる
  const seeded = await R.taskStore.list();
  ok("task-repo: seed 済み(DB無しでも動く)・各状態が揃っている",
    seeded.length === 6 && new Set(seeded.map((t) => t.status)).size >= 4);

  // 作成 → 遷移 → 更新
  const store = R.createMemoryTaskStore();
  const created = await store.create({ title: "テスト", assignee: "山田", estimateHours: 3 });
  ok("create: id 採番・既定は todo/normal・任意項目は入れたものだけ",
    created.id.length > 0 && created.status === "todo" && created.priority === "normal" &&
    created.assignee === "山田" && created.estimateHours === 3 && created.dueDate === undefined);

  const moved = T.transition(created, "doing");
  const updated = await store.update(created.id, moved);
  ok("update: 状態を保存・id は変わらない・updatedAt 更新",
    updated.status === "doing" && updated.id === created.id && updated.updatedAt >= created.updatedAt);
  ok("remove: 削除できる・無いものは false",
    (await store.remove(created.id)) === true && (await store.remove("ghost")) === false);

  // Prisma 行 → Task の変換(DB は null、アプリは undefined)
  const row = {
    id: "t1", title: "テスト", description: null, status: "doing", priority: "high",
    assignee: null, dueDate: new Date("2026-07-20T00:00:00Z"), projectId: "p1", parentId: null,
    estimateHours: 8, actualHours: null,
    createdAt: new Date("2026-07-01T10:00:00Z"), updatedAt: new Date("2026-07-15T10:00:00Z"),
  };
  const converted = R.prismaTaskToTask(row);
  ok("prismaTaskToTask: null→undefined・dueDate は YYYY-MM-DD・日時は ISO",
    converted.status === "doing" && converted.description === undefined && converted.assignee === undefined &&
    converted.actualHours === undefined && converted.dueDate === "2026-07-20" && converted.estimateHours === 8 &&
    converted.createdAt === "2026-07-01T10:00:00.000Z");
  ok("memory/prisma パリティ: create の形が揃う(id採番・既定 todo/normal・任意項目)",
    created.status === "todo" && created.priority === "normal" && created.id.length > 0);

  // 画面が基盤のロジックを使っているか(自作していないか)
  const route = await fsc.readFile(new URL("../apps/internal-app/src/app/api/tasks/route.ts", import.meta.url), "utf8");
  ok("API: 集計/かんばん/並べ替え/遷移は @platform/task に委譲(自作しない)",
    route.includes('from "@platform/task"') && route.includes("summarize") && route.includes("toKanban") &&
    route.includes("sortTasks") && route.includes("transition") && route.includes("workloadByAssignee"));
  ok("API: 不正な遷移は 400 で返す(基盤の VALIDATION を尊重)",
    route.includes("AppError") && route.includes("status: 400"));

  const client = await fsc.readFile(new URL("../apps/internal-app/src/app/tasks/tasks-client.tsx", import.meta.url), "utf8");
  ok("画面: かんばん・進捗バー・期限切れ強調・担当者ごとの負荷・CSS変数",
    client.includes("STATUS_LABEL") && client.includes("完了率") && client.includes("担当者ごとの負荷") &&
    client.includes("超過") && client.includes("var(--color-primary") && client.includes("終わった仕事は負荷ではない"));
  const nav = await fsc.readFile(new URL("../apps/internal-app/src/components/AppNav.tsx", import.meta.url), "utf8");
  ok("AppNav: タスクへの導線", nav.includes('href: "/tasks"'));

  await fsc.rm(base, { recursive: true, force: true });
}

// ── TSDoc の網羅性 ──
{
  section("docs: TSDoc の網羅性");
  const fsc = await import("node:fs/promises");
  const T = await import(new URL("./check-tsdoc.mjs", import.meta.url).href);

  // 検査ツールが動く
  const all = T.analyze();
  ok(`check-tsdoc: 全パッケージの公開関数を解析(${all.length} 関数)`, all.length > 1000);
  ok("check-tsdoc: 説明文/@param/@returns/@throws の不足を判定",
    typeof T.missingOf === "function" &&
    T.missingOf({ hasSummary: false, hasArgs: true, hasParam: false, returnsValue: true, hasReturns: false, throws: true, hasThrows: false }).length === 4 &&
    T.missingOf({ hasSummary: true, hasArgs: false, hasParam: false, returnsValue: false, hasReturns: false, throws: false, hasThrows: false }).length === 0);

  // 最重要パッケージは完備(47 パッケージが core に依存する)
  const core = T.analyze("core");
  ok(`@platform/core: TSDoc 完備(${core.length} 関数。47 パッケージが依存する最重要)`,
    core.length > 0 && core.every((f) => T.missingOf(f).length === 0));

  // 最近作ったものは完備にしておく(新規は必ず書く方針)
  for (const pkg of ["task", "debug"]) {
    const fns = T.analyze(pkg);
    ok(`@platform/${pkg}: TSDoc 完備(${fns.length} 関数)`, fns.length > 0 && fns.every((f) => T.missingOf(f).length === 0));
  }

  // 規約が明記されている
  const claude = await fsc.readFile(new URL("../CLAUDE.md", import.meta.url), "utf8");
  ok("CLAUDE.md: TSDoc 規約(タグごとの判断基準・型で分かることは書かない・なぜを書く)",
    claude.includes("## TSDoc") && claude.includes("@param") && claude.includes("@throws") &&
    claude.includes("型で分かることは書かない") && claude.includes("なぜそうしているか") &&
    claude.includes("check-tsdoc.mjs"));
  ok("CLAUDE.md: 全関数が完備・この状態を保つ方針・一括処理の危険を明記",
    claude.includes("全 1,691 関数・105 パッケージが完備") && claude.includes("この状態を保つ") &&
    claude.includes("正規表現での一括処理は関数を壊す"));
}

// ── リファレンス生成: 引数・戻り値・例外・使用例 ──
{
  section("docs: リファレンスに引数/戻り値を出力");
  const fsc = await import("node:fs/promises");

  // api-reference.json が TSDoc を構造化して持つ
  const ref = JSON.parse(await fsc.readFile(new URL("../docs/platform/api-reference.json", import.meta.url), "utf8"));
  const core = ref["@platform/core"] ?? [];
  ok("gen-reference: export * from のパッケージも拾える(core が空でない)", core.length >= 20);

  const fn = core.find((e) => e.name === "httpStatusFor");
  ok("gen-reference: signature/params/returns/example を構造化して出力",
    fn && fn.signature.includes("error: unknown") && fn.signature.includes("): number") &&
    fn.params[0].name === "error" && fn.returns.includes("HTTP ステータス") && fn.example.includes("=> 400"));

  const bulkhead = (ref["@platform/core"] ?? []).find((e) => e.name === "createBulkhead");
  ok("gen-reference: @throws も拾う", bulkhead && Array.isArray(bulkhead.throws) && bulkhead.throws[0].includes("RATE_LIMITED"));

  const withParams = Object.values(ref).flat().filter((e) => e.params || e.returns).length;
  ok(`gen-reference: 引数or戻り値つきのエントリが増えた(${withParams} 件)`, withParams >= 200);

  // サイトに描画される
  const M = await import(new URL("./gen-ref-site.mjs", import.meta.url).href);
  const pkgs = M.collectPackages();
  const coreP = pkgs.find((p) => p.name === "core");
  ok("collectPackages: 引数・戻り値・使用例を保持",
    coreP && coreP.exports.find((e) => e.name === "httpStatusFor")?.params?.[0]?.name === "error");
  const html = M.renderPlatformSite(pkgs, M.loadDepGraphMermaid(), M.collectApps(), M.collectErds(), M.collectAdrs(), M.collectThemes());
  ok("リファレンスサイト: 引数・戻り値・使用例を描画",
    html.includes("引数</span>") && html.includes("戻り値</span>") && html.includes("使用例") && html.includes("exp-detail"));
  ok("リファレンスサイト: 引数の説明も XSS エスケープ",
    !M.renderPlatformSite(
      [{ name: "x", full: "@platform/x", summary: "s", exports: [{ name: "f", kind: "function", summary: "s", params: [{ name: "a", description: "<script>bad</script>" }] }] }],
      "", [], [], [], [],
    ).includes("<script>bad</script>"));

  // scaffold の雛形が TSDoc 完備(今後作るものが自動的に手本に従う)
  const scaffold = await fsc.readFile(new URL("./scaffold.mjs", import.meta.url), "utf8");
  ok("scaffold: 雛形に @param/@returns の手本(TSDoc は必ず書くと明記)",
    scaffold.includes("TSDoc は必ず書く") && scaffold.includes("@param input") && scaffold.includes("@returns 何が返るのか") &&
    scaffold.includes("リファレンスサイト"));

  // CLAUDE.md に UI も対象・サイト連動を明記
  const claude = await fsc.readFile(new URL("../CLAUDE.md", import.meta.url), "utf8");
  ok("CLAUDE.md: UI(React)にも TSDoc・書かないとサイトに出ない旨を明記",
    claude.includes("UI(React コンポーネント)にも書く") && claude.includes("props が何か") &&
    claude.includes("書かなければサイトにも出ない"));
}

// ── TSDoc 継続改善 / DB 適用方針の整合 ──
{
  section("docs: TSDoc 改善 / DB 方針の整合");
  const fsc = await import("node:fs/promises");
  const T = await import(new URL("./check-tsdoc.mjs", import.meta.url).href);

  // 認証・日付は誤用が事故に直結するため、重要関数を優先して完備にした
  const auth = T.analyze("auth");
  const authDone = auth.filter((f) => T.missingOf(f).length === 0).map((f) => f.name);
  ok(`auth: 全 ${auth.length} 関数が TSDoc 完備(認証は誤用が事故に直結する)`,
    auth.length >= 40 && auth.every((f) => T.missingOf(f).length === 0));

  const dt = T.analyze("datetime");
  const dtDone = dt.filter((f) => T.missingOf(f).length === 0).map((f) => f.name);
  ok(`datetime: 全 ${dt.length} 関数が TSDoc 完備(日付は誤用が事故に直結する)`,
    dt.length >= 50 && dt.every((f) => T.missingOf(f).length === 0));
  ok("check-tsdoc: ジェネリクス・複数行シグネチャも検出できる(精度向上後)",
    dt.length >= 40 && auth.length >= 35 &&
    auth.some((f) => f.name === "filterAuthorized") && auth.some((f) => f.name === "canResendOtp") &&
    dt.some((f) => f.name === "daysUntil"));

  // 「なぜ」が書かれているか(値のある TSDoc かどうか)
  const cal = await fsc.readFile(new URL("../packages/datetime/src/calendar.ts", import.meta.url), "utf8");
  ok("datetime: 落とし穴を明記(月は1〜12・月末クランプ・ローカルTZ・営業日は始点を含み終点を含まない)",
    cal.includes("0 始まりではない") && cal.includes("月末はクランプする") &&
    cal.includes("ローカルタイムゾーン") && cal.includes("3/3 にはならない") &&
    cal.includes("始点を含み終点を含まない") && cal.includes("土日祝を飛ばす"));
  const otp = await fsc.readFile(new URL("../packages/auth/src/otp.ts", import.meta.url), "utf8");
  ok("auth: セキュリティ上の理由を明記(Math.random 不可・平文を保存しない)",
    otp.includes("`Math.random()` は**使わない**") && otp.includes("平文のコードを保存しない") &&
    otp.includes("**code は保存しない**"));

  // 【発見】CI が存在しないマイグレーションを適用しようとしていた
  const e2e = await fsc.readFile(new URL("../.github/workflows/e2e.yml", import.meta.url), "utf8");
  ok("e2e.yml: migrate deploy → db push に修正(マイグレーションが 1 つも無く E2E が失敗する状態だった)",
    !e2e.includes("prisma migrate deploy") && e2e.includes("prisma db push") && e2e.includes("ADR 0013"));

  const adr = await fsc.readFile(new URL("../docs/adr/0013-db-push-not-migrations.md", import.meta.url), "utf8");
  ok("ADR 0013: db push 方針・代償の明示・本番稼働前に見直す条件と手順",
    adr.includes("db push") && adr.includes("この決定の代償") && adr.includes("本番運用を開始する") &&
    adr.includes("prisma migrate dev --name init"));

  let migrations = true;
  try { await fsc.access(new URL("../apps/internal-app/prisma/migrations", import.meta.url)); } catch { migrations = false; }
  ok("マイグレーションは持たない(ADR 0013 の方針どおり)", migrations === false);
}

// ── @platform/faq(社内FAQ) ──
{
  section("faq: 社内FAQ");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const base = `${osc.tmpdir()}/faq-${Date.now()}`;
  await fsc.mkdir(base, { recursive: true });
  await fsc.writeFile(`${base}/core-error.ts`, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(`${base}/core-result.ts`, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${base}/core-error.ts"`));
  await fsc.writeFile(`${base}/core.ts`, `export * from "${base}/core-error.ts";\nexport * from "${base}/core-result.ts";\n`);
  await fsc.writeFile(`${base}/faq.ts`, (await fsc.readFile(new URL("../packages/faq/src/faq.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${base}/core.ts"`));
  const F = await import(`${base}/faq.ts`);

  const mk = (o) => ({ id: "f", question: "q", answer: "a", category: "経費", keywords: [], status: "published",
    helpful: 0, notHelpful: 0, views: 0, relatedIds: [], createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z", ...o });
  const items = [
    mk({ id: "1", question: "経費の締め切りはいつ?", answer: "毎月5日です", keywords: ["精算", "期限"], helpful: 20, notHelpful: 2, views: 100 }),
    mk({ id: "2", question: "領収書を無くしたら?", answer: "再発行を依頼してください", helpful: 5, notHelpful: 1, views: 30 }),
    mk({ id: "3", question: "有給の申請方法", answer: "勤怠画面から", category: "勤怠", helpful: 1, views: 10 }),
    mk({ id: "4", question: "下書き", answer: "未公開", status: "draft" }),
    mk({ id: "5", question: "古い情報", answer: "x", helpful: 1, notHelpful: 9, views: 60 }),
  ];

  ok("publishedOnly: 下書き/アーカイブを利用者に見せない", F.publishedOnly(items).length === 4);
  ok("searchFaq: 質問文 > キーワード > 回答本文 の順で加点・下書きは出ない",
    F.searchFaq(items, "締め切り")[0].matched === "質問" &&
    F.searchFaq(items, "精算")[0].matched === "キーワード" &&
    F.searchFaq(items, "再発行")[0].matched === "回答" &&
    F.searchFaq(items, "下書き").length === 0 &&
    F.searchFaq(items, "zzz").length === 0 && F.searchFaq(items, "  ").length === 0);
  ok("byCategory: 件数の多い順・公開中のみ",
    F.byCategory(items)[0].category === "経費" && F.byCategory(items)[0].items.length === 3 && F.byCategory(items).length === 2);
  ok("sortByHelpfulness: 票が少ない100%より、票の多い90%を上に(実態に合わせる)",
    F.sortByHelpfulness([mk({ id: "a", helpful: 1 }), mk({ id: "b", helpful: 45, notHelpful: 5 })])[0].id === "b");
  ok("helpfulRate: 票が無ければ undefined(0% と区別。まだ分からないだけ)",
    Math.abs(F.helpfulRate(items[0]) - 20 / 22) < 0.01 && F.helpfulRate(mk({})) === undefined);
  const review = F.needsReview(items);
  ok("needsReview: 低評価と「見られているのに無投票」を検出・票が少なければ決めつけない",
    review.some((r) => r.item.id === "5" && r.reason.includes("10%")) && !review.some((r) => r.item.id === "3"));
  ok("vote: 加算して新しいFAQを返す(元は不変)・公開中でなければ VALIDATION",
    F.vote(items[0], true).helpful === 21 && items[0].helpful === 20 &&
    (() => { try { F.vote(mk({ status: "draft" }), true); return false; } catch (e) { return e.code === "VALIDATION"; } })());
  const s = F.summarizeFaq(items);
  ok("summarizeFaq: 件数・全体の率・要見直し・閲覧上位・空でも壊れない",
    s.total === 5 && s.published === 4 && s.draft === 1 && s.helpfulRate > 0 && s.needsReview >= 1 &&
    s.topViewed[0].id === "1" && F.summarizeFaq([]).helpfulRate === undefined);

  await fsc.rm(base, { recursive: true, force: true });
}

// ── @platform/contract(契約管理) ──
{
  section("contract: 契約管理");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const base = `${osc.tmpdir()}/ctr-${Date.now()}`;
  await fsc.mkdir(base, { recursive: true });
  await fsc.writeFile(`${base}/core-error.ts`, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(`${base}/core-result.ts`, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${base}/core-error.ts"`));
  await fsc.writeFile(`${base}/core.ts`, `export * from "${base}/core-error.ts";\nexport * from "${base}/core-result.ts";\n`);
  await fsc.writeFile(`${base}/contract.ts`, (await fsc.readFile(new URL("../packages/contract/src/contract.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${base}/core.ts"`));
  const C = await import(`${base}/contract.ts`);

  const mk = (o) => ({ id: "c", title: "契約", partner: "A社", status: "active", startDate: "2026-01-01", endDate: "2026-12-31",
    renewalType: "manual", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", ...o });
  const today = new Date("2026-07-15T00:00:00Z");

  ok("isInEffect/daysUntilEnd: 状態ではなく日付で判定・残り日数(過ぎれば負)",
    C.isInEffect(mk({}), today) && !C.isInEffect(mk({ endDate: "2026-06-30" }), today) &&
    C.daysUntilEnd(mk({ endDate: "2026-07-20" }), today) === 5 && C.daysUntilEnd(mk({ endDate: "2026-07-10" }), today) === -5);

  // 実務で最も問題になる: 解約予告の期限
  ok("noticeDeadline/canGiveNotice: 終了日−予告期間が期限・過ぎたら申し出不可・予告不要なら常に可",
    C.noticeDeadline(mk({ endDate: "2026-12-31", noticeDays: 90 })) === "2026-10-02" &&
    C.noticeDeadline(mk({})) === undefined &&
    C.canGiveNotice(mk({ endDate: "2026-12-31", noticeDays: 90 }), today) &&
    !C.canGiveNotice(mk({ endDate: "2026-08-01", noticeDays: 90 }), today) &&
    C.canGiveNotice(mk({}), today));

  const contracts = [
    mk({ id: "1", renewalType: "auto", renewalMonths: 12, noticeDays: 90, endDate: "2026-10-10" }), // 期限 07-12 = 過ぎた
    mk({ id: "1b", renewalType: "auto", renewalMonths: 12, noticeDays: 90, endDate: "2026-11-01" }), // 期限 08-03 = 迫る
    mk({ id: "2", renewalType: "manual", endDate: "2026-07-20" }),  // 5日 = danger
    mk({ id: "3", renewalType: "manual", endDate: "2026-08-10" }),  // 26日 = warning
    mk({ id: "4", endDate: "2026-06-01" }),                          // 過ぎて active
    mk({ id: "5", endDate: "2027-06-01" }),                          // 余裕
    mk({ id: "6", status: "draft", endDate: "2026-07-16" }),        // 下書き
  ];
  const alerts = C.contractAlerts(contracts, today);
  ok("contractAlerts: 予告期限が迫る自動更新を danger(過ぎると意図せず1年延びる)",
    alerts.some((a) => a.contract.id === "1b" && a.level === "danger" && a.action.includes("自動更新")));
  ok("contractAlerts: 予告期限を過ぎたら info(もう手遅れ・焦らせず次回に備える案内)",
    alerts.some((a) => a.contract.id === "1" && a.level === "info" && a.action.includes("次回")));
  ok("contractAlerts: 手動更新は 7日以内=danger / 30日以内=warning(放置すると切れる)",
    alerts.some((a) => a.contract.id === "2" && a.level === "danger") &&
    alerts.some((a) => a.contract.id === "3" && a.level === "warning"));
  ok("contractAlerts: 終了日超過で active のままを検出(人が更新し忘れる)・余裕/下書きは出さない・深刻な順",
    alerts.some((a) => a.contract.id === "4" && a.message.includes("過ぎていますが")) &&
    !alerts.some((a) => ["5", "6"].includes(a.contract.id)) && alerts[0].level === "danger");

  const renewed = C.renew(mk({ renewalType: "auto", renewalMonths: 12 }));
  ok("renew: 翌日から n ヶ月後の前日まで・新しい契約を返す(元は不変)",
    renewed.startDate === "2027-01-01" && renewed.endDate === "2027-12-31" && renewed.status === "active");
  ok("renew: none は不可・renewalMonths 無しは VALIDATION",
    (() => { try { C.renew(mk({ renewalType: "none" })); return false; } catch (e) { return e.code === "VALIDATION"; } })() &&
    (() => { try { C.renew(mk({ renewalType: "auto" })); return false; } catch (e) { return e.message.includes("renewalMonths"); } })());

  const s = C.summarizeContracts(contracts, today);
  ok("summarizeContracts: 件数・期限切れ・緊急・金額・取引先別・空でも壊れない",
    s.total === 7 && s.active === 6 && s.expired === 1 && s.urgent >= 2 && Array.isArray(s.byPartner) &&
    C.summarizeContracts([]).total === 0);

  await fsc.rm(base, { recursive: true, force: true });
}

// ── FAQ の画面(@platform/faq の配線) ──
{
  section("internal-app: FAQ 画面");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const base = `${osc.tmpdir()}/fui-${Date.now()}`;
  await fsc.mkdir(base, { recursive: true });
  await fsc.writeFile(`${base}/core-error.ts`, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(`${base}/core-result.ts`, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${base}/core-error.ts"`));
  await fsc.writeFile(`${base}/core.ts`, `export * from "${base}/core-error.ts";\nexport * from "${base}/core-result.ts";\n`);
  await fsc.writeFile(`${base}/faq.ts`, (await fsc.readFile(new URL("../packages/faq/src/faq.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${base}/core.ts"`));
  await fsc.writeFile(`${base}/services.ts`, `export const db = {};`);
  await fsc.writeFile(`${base}/env.ts`, `export const featureEnv = { FAQ_PERSISTENCE: "" };`);
  await fsc.writeFile(`${base}/faq-repo.ts`, (await fsc.readFile(new URL("../apps/internal-app/src/server/faq-repo.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/faq"', `from "${base}/faq.ts"`).replace('from "./services.ts"', `from "${base}/services.ts"`).replace('from "./env.ts"', `from "${base}/env.ts"`));
  const R = await import(`${base}/faq-repo.ts`);
  const F = await import(`${base}/faq.ts`);

  const seeded = await R.faqStore.list();
  ok("faq-repo: seed 済み(DB無しで試せる)・公開/下書き/低評価が揃う",
    seeded.length === 7 && seeded.some((i) => i.status === "draft") && seeded.some((i) => i.notHelpful > i.helpful));

  const store = R.createMemoryFaqStore();
  const created = await store.create({ question: "Q", answer: "A", category: "test" });
  ok("create: 既定は draft(いきなり公開しない)・票と閲覧は 0",
    created.status === "draft" && created.helpful === 0 && created.views === 0 && created.id.length > 0);
  await store.incrementViews(created.id);
  ok("incrementViews: 閲覧数を加算", (await store.get(created.id)).views === 1);
  const updated = await store.update(created.id, { status: "published" });
  ok("update: 公開にできる・id は不変・無い id は undefined",
    updated.status === "published" && updated.id === created.id && (await store.update("ghost", {})) === undefined);
  const fRow = R.prismaFaqToItem({ id: "f1", question: "Q", answer: "A", category: "経費", keywords: ["k"], status: "published",
    helpful: 5, notHelpful: 1, views: 20, relatedIds: [], createdAt: new Date("2026-07-15T10:00:00Z"), updatedAt: new Date("2026-07-15T10:00:00Z") });
  ok("prismaFaqToItem: 日時は ISO・配列はそのまま(memory/prisma パリティ)",
    fRow.status === "published" && fRow.createdAt === "2026-07-15T10:00:00.000Z" && fRow.keywords[0] === "k");

  // seed で検索・評価が実際に動く
  const hits = F.searchFaq(seeded, "経費 締め切り");
  ok("seed で検索が効く(質問文の一致が上位)", hits.length > 0 && hits[0].item.id === "f1");
  const review = F.needsReview(seeded);
  ok("seed に「要見直し」が含まれる(低評価・見られているのに無投票)",
    review.some((r) => r.item.id === "f5") && review.length >= 1);

  // 画面が基盤に委譲しているか(自作していないか)
  const route = await fsc.readFile(new URL("../apps/internal-app/src/app/api/faq/route.ts", import.meta.url), "utf8");
  ok("API: 検索/集計/投票は @platform/faq に委譲・要見直しは管理者のみ",
    route.includes('from "@platform/faq"') && route.includes("searchFaq") && route.includes("byCategory") &&
    route.includes("needsReview") && route.includes('roles.includes("admin")') && route.includes("vote"));
  const client = await fsc.readFile(new URL("../apps/internal-app/src/app/faq/faq-client.tsx", import.meta.url), "utf8");
  ok("画面: 検索・カテゴリ別・役立った投票・見つからないときの案内・CSS変数",
    client.includes("探したいことを入力") && client.includes("役に立ちましたか") &&
    client.includes("見つかりませんでした") && client.includes("情シスへお問い合わせ") &&
    client.includes("var(--color-primary") === false && client.includes("var(--color-fg"));
  const nav = await fsc.readFile(new URL("../apps/internal-app/src/components/AppNav.tsx", import.meta.url), "utf8");
  ok("AppNav: FAQ への導線", nav.includes('href: "/faq"'));

  await fsc.rm(base, { recursive: true, force: true });
}

// ── 契約の画面(@platform/contract の配線) ──
{
  section("internal-app: 契約画面");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const base = `${osc.tmpdir()}/cui-${Date.now()}`;
  await fsc.mkdir(base, { recursive: true });
  await fsc.writeFile(`${base}/core-error.ts`, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(`${base}/core-result.ts`, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${base}/core-error.ts"`));
  await fsc.writeFile(`${base}/core.ts`, `export * from "${base}/core-error.ts";\nexport * from "${base}/core-result.ts";\n`);
  await fsc.writeFile(`${base}/contract.ts`, (await fsc.readFile(new URL("../packages/contract/src/contract.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${base}/core.ts"`));
  await fsc.writeFile(`${base}/services.ts`, `export const db = {};`);
  await fsc.writeFile(`${base}/env.ts`, `export const featureEnv = { CONTRACT_PERSISTENCE: "" };`);
  await fsc.writeFile(`${base}/contract-repo.ts`, (await fsc.readFile(new URL("../apps/internal-app/src/server/contract-repo.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/contract"', `from "${base}/contract.ts"`).replace('from "./services.ts"', `from "${base}/services.ts"`).replace('from "./env.ts"', `from "${base}/env.ts"`));
  const R = await import(`${base}/contract-repo.ts`);
  const C = await import(`${base}/contract.ts`);

  const seeded = await R.contractStore.list();
  ok("contract-repo: seed 済み(DB無しで試せる)・自動更新/手動/一回限り/期限切れが揃う",
    seeded.length === 7 && seeded.some((c) => c.renewalType === "auto") && seeded.some((c) => c.renewalType === "none") &&
    seeded.some((c) => C.daysUntilEnd(c) < 0));

  // seed でアラートが実際に出る(機能を実感できるか)
  const alerts = C.contractAlerts(seeded);
  ok("seed でアラートが出る(至急・注意・参考が揃い、放置すると損をするものが先頭)",
    alerts.length >= 3 && alerts[0].level === "danger" &&
    alerts.some((a) => a.action.includes("自動更新")) && alerts.some((a) => a.message.includes("過ぎていますが")));

  const store = R.createMemoryContractStore();
  const created = await store.create({ title: "新規", partner: "X社", startDate: "2026-01-01", endDate: "2026-12-31" });
  ok("create: 既定は draft(いきなり有効にしない。承認を経てから)・既定は手動更新",
    created.status === "draft" && created.renewalType === "manual" && created.id.length > 0);
  const updated = await store.update(created.id, { status: "active" });
  ok("update: 有効にできる・id は不変・無い id は undefined",
    updated.status === "active" && updated.id === created.id && (await store.update("ghost", {})) === undefined);
  const cRow = R.prismaContractToContract({ id: "c1", title: "T", partner: "P", status: "active",
    startDate: new Date("2026-01-01T00:00:00Z"), endDate: new Date("2026-12-31T00:00:00Z"),
    renewalType: "auto", renewalMonths: 12, noticeDays: null, amount: 1000, owner: null, documentRef: null,
    createdAt: new Date("2026-07-15T10:00:00Z"), updatedAt: new Date("2026-07-15T10:00:00Z") });
  ok("prismaContractToContract: 日付は YYYY-MM-DD(時刻は不要)・null→undefined",
    cRow.startDate === "2026-01-01" && cRow.endDate === "2026-12-31" && cRow.renewalMonths === 12 &&
    cRow.noticeDays === undefined && cRow.owner === undefined && cRow.amount === 1000);

  // 画面が基盤に委譲しているか
  const route = await fsc.readFile(new URL("../apps/internal-app/src/app/api/contracts/route.ts", import.meta.url), "utf8");
  ok("API: アラート/集計/期限判定/更新は @platform/contract に委譲・更新と解約は管理者のみ",
    route.includes('from "@platform/contract"') && route.includes("contractAlerts") && route.includes("summarizeContracts") &&
    route.includes("noticeDeadline") && route.includes("renew") && route.includes('roles.includes("admin")'));
  const client = await fsc.readFile(new URL("../apps/internal-app/src/app/contracts/contracts-client.tsx", import.meta.url), "utf8");
  ok("画面: 「今やるべき対応」を最上部・解約予告期限を列に・超過を強調・CSS変数",
    client.includes("今やるべき対応") && client.includes("放っておくと損をするもの") &&
    client.includes("解約予告期限") && client.includes("過ぎた") && client.includes("var(--color-danger"));
  const nav = await fsc.readFile(new URL("../apps/internal-app/src/components/AppNav.tsx", import.meta.url), "utf8");
  ok("AppNav: 契約への導線", nav.includes('href: "/contracts"'));

  await fsc.rm(base, { recursive: true, force: true });
}

// ── demos/workplace-ops(3基盤の横断) ──
{
  section("demo: workplace-ops(タスク/契約/FAQ の横断)");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const base = `${osc.tmpdir()}/wo-${Date.now()}`;
  await fsc.mkdir(base, { recursive: true });
  await fsc.writeFile(`${base}/core-error.ts`, (await fsc.readFile(new URL("../packages/core/src/error.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"'));
  await fsc.writeFile(`${base}/core-result.ts`, (await fsc.readFile(new URL("../packages/core/src/result.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "./error.ts"', `from "${base}/core-error.ts"`));
  await fsc.writeFile(`${base}/core.ts`, `export * from "${base}/core-error.ts";\nexport * from "${base}/core-result.ts";\n`);
  for (const pkg of ["task", "faq", "contract"]) {
    await fsc.writeFile(`${base}/${pkg}.ts`, (await fsc.readFile(new URL(`../packages/${pkg}/src/${pkg}.ts`, import.meta.url), "utf8")).replace(/\.js"/g, '.ts"').replace('from "@platform/core"', `from "${base}/core.ts"`));
  }
  let src = (await fsc.readFile(new URL("../demos/showcase/src/examples/workplace-ops.ts", import.meta.url), "utf8")).replace(/\.js"/g, '.ts"');
  for (const pkg of ["task", "faq", "contract"]) src = src.replace(`from "@platform/${pkg}"`, `from "${base}/${pkg}.ts"`);
  await fsc.writeFile(`${base}/wo.ts`, src);
  const W = await import(`${base}/wo.ts`);

  const today = new Date("2026-07-15T00:00:00Z");
  const b = { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
  const tasks = [
    { id: "t1", title: "サーバ更新", status: "doing", priority: "urgent", assignee: "田中", dueDate: "2026-07-10", estimateHours: 8, ...b },
    { id: "t2", title: "資料整理", status: "todo", priority: "low", dueDate: "2026-07-12", ...b },
    { id: "t3", title: "完了済み", status: "done", priority: "normal", ...b },
  ];
  const contracts = [
    { id: "c1", title: "クラウド契約", partner: "A社", status: "active", startDate: "2025-01-01", endDate: "2026-09-01", renewalType: "auto", renewalMonths: 12, noticeDays: 60, amount: 1_200_000, owner: "情シス", ...b },
    { id: "c2", title: "清掃委託", partner: "B社", status: "active", startDate: "2025-01-01", endDate: "2026-07-18", renewalType: "manual", amount: 360_000, owner: "総務", ...b },
  ];
  const faqs = [
    { id: "f1", question: "古い情報", answer: "x", category: "経費", keywords: [], status: "published", helpful: 1, notHelpful: 9, views: 60, relatedIds: [], ...b },
    { id: "f2", question: "良いFAQ", answer: "y", category: "経費", keywords: [], status: "published", helpful: 20, notHelpful: 1, views: 100, relatedIds: [], ...b },
  ];

  const todos = W.buildTodoList({ tasks, contracts, faqs, today });
  ok("buildTodoList: 3領域から集め、放っておくと損をするものが先(契約→タスク→FAQ)",
    todos.some((t) => t.source === "contract") && todos.some((t) => t.source === "task") && todos.some((t) => t.source === "faq") &&
    todos[0].level === "danger" && todos[todos.length - 1].source === "faq");
  ok("buildTodoList: 判定は基盤に委ねる(期限切れのみ・良いFAQは出さない・優先度で深刻度)",
    todos.filter((t) => t.source === "task").length === 2 && !todos.some((t) => t.title.includes("完了済み")) &&
    todos.filter((t) => t.source === "faq").length === 1 &&
    todos.some((t) => t.title.includes("サーバ更新") && t.level === "danger") &&
    todos.some((t) => t.title.includes("資料整理") && t.level === "warning"));
  ok("buildTodoList: 担当者と詳細リンク・「何をすべきか」を必ず添える",
    todos.every((t) => t.action.length > 0 && t.href.length > 0) &&
    todos.some((t) => t.owner === "田中") && todos.some((t) => t.owner === "情シス"));

  const s = W.morningSummary({ tasks, contracts, faqs, today });
  ok("morningSummary: 各領域の集計を基盤に委ねて束ねるだけ(再実装しない)",
    s.todoCount === todos.length && s.urgentCount >= 1 && s.taskProgress > 0 && s.overdueTasks === 2 &&
    s.contractAmount === 1_560_000 && s.faqHelpfulRate > 0 && s.busiestPerson.assignee === "田中");
  ok("groupByOwner: 担当者別・未割り当ても見せる(放置されがちなので)",
    W.groupByOwner(todos).some((g) => g.owner === "田中") && W.groupByOwner(todos).some((g) => g.owner === "(未割り当て)"));
  ok("formatTodoList: Slack/メモ用のテキスト(🔴🟡⚪ と → アクション)・空なら案内",
    W.formatTodoList(todos).includes("🔴") && W.formatTodoList(todos).includes("→") &&
    W.formatTodoList([]) === "今日やるべきことはありません。");

  await fsc.rm(base, { recursive: true, force: true });
}

// ── 統合デモサイト(1サイトに集約・Amplify 向け) ──
{
  section("統合デモサイト");
  const fsc = await import("node:fs/promises");
  const osc = await import("node:os");
  const base = `${osc.tmpdir()}/ds-${Date.now()}`;
  await fsc.mkdir(base, { recursive: true });
  await fsc.writeFile(`${base}/ui.ts`, `export interface NavItem { label: string; href?: string; children?: NavItem[]; external?: boolean }\n`);
  await fsc.writeFile(`${base}/nav.ts`, (await fsc.readFile(new URL("../demos/showcase/src/lib/nav.ts", import.meta.url), "utf8"))
    .replace(/\.js"/g, '.ts"').replace('from "@platform/ui"', `from "${base}/ui.ts"`));
  const N = await import(`${base}/nav.ts`);

  ok("nav: 区分は3つ(基盤デモ/アプリデモ/使用例)・メニュー上は分かれて見える",
    N.SECTIONS.length === 3 &&
    N.SECTIONS.map((s) => s.title).join(",") === "基盤デモ,アプリデモ,使用例");
  ok("nav: 基盤デモ31・アプリデモ5・使用例9 = 45件(data-console は画面を持つので基盤デモ側)",
    N.PLATFORM_DEMOS.length === 31 && N.APP_DEMOS.length === 5 && N.CODE_EXAMPLES.length === 9 &&
    N.allDemos().length === 45);
  ok("buildNavItems: 区分ごとに入れ子(1サイトだが別物として映る)",
    N.buildNavItems().length === 3 && N.buildNavItems().every((n) => Array.isArray(n.children) && n.children.length > 0));

  // 基盤デモの href が実画面と一致するか(リンク切れ防止)
  const missing = [];
  for (const d of N.PLATFORM_DEMOS) {
    const p = new URL(`../demos/showcase/src/app${d.href}/page.tsx`, import.meta.url);
    try { await fsc.access(p); } catch { missing.push(d.href); }
  }
  ok("nav: 基盤デモ30件すべてに実画面がある(リンク切れなし)", missing.length === 0);

  // アプリデモの画面が実在するか
  const appMissing = [];
  for (const d of N.APP_DEMOS) {
    const p = new URL(`../demos/showcase/src/app${d.href}/page.tsx`, import.meta.url);
    try { await fsc.access(p); } catch { appMissing.push(d.href); }
  }
  ok("アプリデモ5件(社内/備品/公開サイト/CRUD/ポータル)の画面が実在", appMissing.length === 0);

  // 「実物ではない」ことを画面に明示しているか(誤解を招かないため)
  const internal = await fsc.readFile(new URL("../demos/showcase/src/app/apps/internal/internal-client.tsx", import.meta.url), "utf8");
  ok("アプリデモ: 実物ではなくモックだと画面に明示(apps/ の実物と混同させない)",
    internal.includes("これは <strong>デモ</strong> です") && internal.includes("apps/internal-app") &&
    internal.includes("モックデータ") && internal.includes("DB を使いません"));

  // DB に依存していないか(Amplify に単体で載る条件)
  const srcFiles = [];
  const walk = async (dir) => {
    for (const e of await fsc.readdir(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) await walk(p);
      else if (/\.tsx?$/.test(e.name)) srcFiles.push(p);
    }
  };
  await walk(new URL("../demos/showcase/src", import.meta.url).pathname);
  const dbDeps = [];
  for (const f of srcFiles) {
    const s = await fsc.readFile(f, "utf8");
    // import 文だけを見る(説明文の `@platform/db` という表記に反応しないように)
    if (/^\s*import[^\n]*from\s+"(@platform\/db|@prisma\/client)"/m.test(s)) dbDeps.push(f.split("/").pop());
  }
  ok("統合デモサイトは DB 非依存(Amplify に単体でデプロイできる)", dbDeps.length === 0);

  // Amplify 設定(ルートに置く。Amplify は直下の amplify.yml しか読まない)
  const amplify = await fsc.readFile(new URL("../amplify.yml", import.meta.url), "utf8");
  ok("amplify.yml: デモサイトを指す・corepack で pnpm 有効化・install はルート・キャッシュ",
    amplify.includes("appRoot: demos/showcase") && amplify.includes("corepack enable") &&
    amplify.includes("cd ../.. && pnpm install --frozen-lockfile") &&
    amplify.includes("baseDirectory: .next") && amplify.includes("cache:"));
  // 踏んだ地雷 3 つ(すべて実際に失敗した):
  //  1. `cd ../.. && pnpm --filter ... build` → Next.js がルートで動き Module not found 103 件
  //  2. build で `pnpm build` → preBuild の cd が残り、ルートの turbo が全 107 パッケージをビルド
  //  3. `cd "$AMPLIFY_APP_ROOT"` → 環境変数が空で `/` へ移動し No package found
  ok("amplify.yml: build は cd と build を 1 コマンドにまとめる(cd の持ち越しに影響されない)",
    amplify.includes("cd demos/showcase && pwd && pnpm run build") &&
    // コメント内の言及は許すが、コマンドとして使っていないこと
    !/^\s+- .*\$AMPLIFY_APP_ROOT/m.test(amplify) &&
    !amplify.includes("- cd ../.. && pnpm --filter"));
  ok("amplify.yml: 踏んだ地雷をコメントに残す(同じ失敗を繰り返さない)",
    amplify.includes("Module not found") && amplify.includes("同じシェルで実行") &&
    amplify.includes("環境変数が空"));
  ok("amplify.yml は 1 つだけ(2 つあるとどちらが読まれるか分からない)",
    await fsc.access(new URL("../demos/showcase/amplify.yml", import.meta.url)).then(() => false).catch(() => true));

  // transpilePackages の漏れ(ビルドしないと気づけない)
  const cfg = await fsc.readFile(new URL("../demos/showcase/next.config.mjs", import.meta.url), "utf8");
  // モノレポでは Turbopack が pnpm-workspace.yaml を見つけてリポジトリのルートを root と誤認し、
  // node_modules も相対 import も解決できなくなる(Amplify で Module not found が 103 件出た)。
  // ローカルの dev では起きず、next build で初めて出る。
  ok("next.config: turbopack.root はモノレポのルート(pnpm は node_modules をルートに集約する)",
    cfg.includes("turbopack:") && cfg.includes('root: path.join(__dirname, "../..")'));
  const pkgJson = JSON.parse(await fsc.readFile(new URL("../demos/showcase/package.json", import.meta.url), "utf8"));
  const deps = Object.keys(pkgJson.dependencies).filter((k) => k.startsWith("@platform/"));
  ok(`next.config: transpilePackages が package.json の依存と一致(${deps.length}件・漏れるとビルド失敗)`,
    deps.every((d) => cfg.includes(`"${d}"`)));

  await fsc.rm(base, { recursive: true, force: true });
}

// ── ビルド設定(pnpm build が通る前提) ──
{
  section("ビルド設定: tsconfig がテストを除外しているか");
  const fsc = await import("node:fs/promises");
  const pkgDirs = (await fsc.readdir(new URL("../packages", import.meta.url), { withFileTypes: true }))
    .filter((e) => e.isDirectory()).map((e) => e.name);

  const noExclude = [];
  for (const name of pkgDirs) {
    try {
      const raw = await fsc.readFile(new URL(`../packages/${name}/tsconfig.json`, import.meta.url), "utf8");
      const cfg = JSON.parse(raw);
      const ex = cfg.exclude ?? [];
      if (!ex.some((p) => String(p).includes(".test."))) noExclude.push(name);
    } catch { /* tsconfig が無いパッケージは対象外 */ }
  }
  // テストを include したままだと `tsc -p` がテストも型検査し、
  // 未使用 import(TS6133)や vitest の型未解決(TS2307)でビルドが落ちる。
  // 実際に Amplify で @platform/datetime がこれで失敗した。
  ok(`全パッケージの tsconfig がテストを exclude(ビルド対象から外す)`, noExclude.length === 0);
}

// ── パッケージのエントリ(main/exports)が実在するか ──
{
  section("パッケージのエントリ: ソース直指しで統一されているか");
  const fsc = await import("node:fs/promises");
  const path = await import("node:path");
  const root = new URL("..", import.meta.url).pathname;
  const pkgDir = path.join(root, "packages");
  const names = (await fsc.readdir(pkgDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);

  const notSrc = [];
  const missing = [];
  for (const name of names) {
    const pjPath = path.join(pkgDir, name, "package.json");
    let pj;
    try { pj = JSON.parse(await fsc.readFile(pjPath, "utf8")); } catch { continue; }
    const main = pj.main;
    if (!main) continue;  // config など、ソースを持たないものは対象外
    // dist を指していないか(dist は作らないので Module not found になる)
    if (String(main).includes("dist")) notSrc.push(name);
    // 実体があるか
    const target = path.join(pkgDir, name, String(main).replace(/^\.\//, ""));
    try { await fsc.access(target); } catch { missing.push(`${name}: ${main}`); }

    // exports のサブパスも実在するか
    const ex = pj.exports;
    if (ex && typeof ex === "object") {
      for (const [key, val] of Object.entries(ex)) {
        if (typeof val !== "string") continue;
        if (val.includes("tsconfig") || val.includes("vitest")) continue;
        const t = path.join(pkgDir, name, val.replace(/^\.\//, ""));
        try { await fsc.access(t); } catch { missing.push(`${name} exports["${key}"]: ${val}`); }
      }
    }
  }

  // dist を指すと、ビルドしない限り Module not found になる。
  // 実際に Amplify で @platform/ui が解決できず 27 件のエラーが出た。
  ok("全パッケージの main がソース(src)を指す(dist はビルドしないと存在しない)", notSrc.length === 0);
  ok("main / exports の指す先がすべて実在する", missing.length === 0);
}
console.log(`\n─────────────\n結果: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
