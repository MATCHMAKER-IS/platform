#!/usr/bin/env node
/**
 * **メールが迷惑メール扱いされていないか**を、DNS の設定から確かめる。
 *
 * ```bash
 * node tools/check-mail-dns.mjs example.co.jp
 * node tools/check-mail-dns.mjs            # .env の MAIL_FROM から自動で判定
 * ```
 *
 * 【なぜ要るか】
 * **届いていないことに、こちらは気づけません。**
 *
 * 社内システムでも、承認依頼・パスワード再設定・請求書の送付はメールで飛びます。
 * それが迷惑メールフォルダへ入ると:
 *
 * - 承認が止まる(**申請者は「まだ承認されない」としか分からない**)
 * - パスワードを再設定できない(**問い合わせが情シスに来る**)
 * - 取引先へ請求書が届かない(**入金が遅れる**)
 *
 * どれも「システムの障害」として現れないので、**原因にたどり着くのに時間がかかります**。
 *
 * 【3 つの設定】
 *
 * | | 何をするもの | 無いとどうなるか |
 * |---|---|---|
 * | **SPF** | このドメインの差出人は、どのサーバから送ってよいかを宣言する | 受け側が「なりすまし」と判断しうる |
 * | **DKIM** | 送信サーバが電子署名を付け、改ざんが無いことを示す | 同上。SPF だけでは転送に弱い |
 * | **DMARC** | SPF / DKIM に**通らなかったときどう扱うか**を宣言し、**レポートを受け取る** | **失敗していることに気づけない** |
 *
 * **DMARC がいちばん見落とされます。** SPF と DKIM は「設定した」で終わりがちですが、
 * **合っているかを教えてくれるのは DMARC のレポートだけ**です。
 *
 * 【この道具がしないこと】
 * - **実際に送って確かめること**(それは受信側でしか分かりません)
 * - **DKIM の鍵の中身の検証**(セレクタが分からないと引けないため、存在確認のみ)
 *
 * ネットワークが使えない環境では skip します(CI では走らせない想定)。
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as dns } from "node:dns";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** `.env` / `.env.example` から `MAIL_FROM` のドメインを拾う。 */
function domainFromEnv() {
  for (const f of [".env", "apps/internal-app/.env", ".env.example"]) {
    const p = path.join(ROOT, f);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, "utf8").match(/^MAIL_FROM=.*@([^\s>]+)/m);
    if (m !== null) return m[1];
  }
  return undefined;
}

const domain = process.argv.find((a) => !a.startsWith("-") && a.includes(".") && !a.endsWith(".mjs"))
  ?? domainFromEnv();

if (domain === undefined) {
  console.error("使い方: node tools/check-mail-dns.mjs <ドメイン>");
  console.error("  .env の MAIL_FROM からも自動で判定します");
  process.exit(2);
}

/** よく使われる DKIM のセレクタ。**総当たりではなく、代表例の確認**。 */
const SELECTORS = ["default", "google", "selector1", "selector2", "s1", "s2", "mail", "dkim", "k1"];

async function txt(name) {
  try {
    const records = await dns.resolveTxt(name);
    return records.map((chunks) => chunks.join(""));
  } catch (e) {
    if (e && typeof e === "object" && "code" in e) {
      const code = e.code;
      if (code === "ENOTFOUND" || code === "ENODATA") return [];
      // ネットワークが無い環境
      if (code === "EAI_AGAIN" || code === "ECONNREFUSED" || code === "ESERVFAIL") return null;
    }
    return [];
  }
}

console.log(`▶ ${domain} のメール設定を確認します`);
console.log("");

const spf = await txt(domain);
if (spf === null) {
  console.log("⏭  DNS を引けませんでした(ネットワークが無い環境のようです)。");
  console.log("   インターネットにつながる端末で実行してください");
  process.exit(0);
}

const problems = [];
const notes = [];

// ---- SPF ----
const spfRecord = spf.find((r) => r.toLowerCase().startsWith("v=spf1"));
if (spfRecord === undefined) {
  problems.push({
    what: "SPF が設定されていません",
    why: "受け側が「なりすまし」と判断しうる。迷惑メールフォルダ行きの最大の原因",
    how: `DNS に TXT を追加: ${domain}  "v=spf1 include:<送信サービス> ~all"`,
  });
} else {
  console.log(`  SPF    ✅ ${spfRecord.slice(0, 90)}`);
  // **`+all` は「誰が送ってもよい」。** SPF の意味が無くなる
  if (/[\s+]all/.test(spfRecord) && !/[~-]all/.test(spfRecord)) {
    problems.push({
      what: "SPF が `+all`(誰が送ってもよい)になっています",
      why: "**設定してあるのに、何も守っていません**。なりすましを全部通します",
      how: "`~all`(ソフトフェイル)か `-all`(ハードフェイル)に変えてください",
    });
  }
  const lookups = (spfRecord.match(/\b(include|a|mx|ptr|exists|redirect):?/g) ?? []).length;
  if (lookups > 10) {
    problems.push({
      what: `SPF の参照が多すぎます(${lookups} 件。上限は 10)`,
      why: "**上限を超えると、受け側は SPF を「不明」として扱います**——設定が無いのと同じ",
      how: "`include:` を減らすか、統合してください",
    });
  }
}

// ---- DMARC ----
const dmarc = await txt(`_dmarc.${domain}`);
const dmarcRecord = (dmarc ?? []).find((r) => r.toLowerCase().startsWith("v=dmarc1"));
if (dmarcRecord === undefined) {
  problems.push({
    what: "DMARC が設定されていません",
    why: "**SPF / DKIM が失敗していることに気づけません**。レポートを受け取る唯一の手段です",
    how: `DNS に TXT を追加: _dmarc.${domain}  "v=DMARC1; p=none; rua=mailto:dmarc@${domain}"`
      + "（まず `p=none` で様子を見る。いきなり `reject` にすると、正当なメールも止まります）",
  });
} else {
  console.log(`  DMARC  ✅ ${dmarcRecord.slice(0, 90)}`);
  if (!/rua=/.test(dmarcRecord)) {
    problems.push({
      what: "DMARC にレポートの宛先(`rua=`)がありません",
      why: "**設定しただけで、結果を誰も見ていない**状態です。気づける仕組みになりません",
      how: `\`rua=mailto:dmarc@${domain}\` を足してください`,
    });
  }
  if (/p=none/.test(dmarcRecord)) {
    notes.push(
      "DMARC が `p=none`(様子見)です。**しばらくレポートを見て、正当なメールが全部通ることを確かめてから** "
        + "`p=quarantine` → `p=reject` と上げてください（急ぐと自社のメールが止まります）",
    );
  }
}

// ---- DKIM ----
const found = [];
for (const sel of SELECTORS) {
  const r = await txt(`${sel}._domainkey.${domain}`);
  if ((r ?? []).some((v) => v.includes("p="))) found.push(sel);
}
if (found.length === 0) {
  problems.push({
    what: "DKIM が見つかりません(代表的なセレクタで確認)",
    why: "SPF だけだと、**転送されたときに失敗します**(転送元が変わるため)",
    how: "送信サービス(Google Workspace / SendGrid 等)の管理画面で DKIM を有効にし、"
      + "示された TXT を DNS に登録してください",
  });
  notes.push(`DKIM は独自のセレクタを使うこともあります。確認したのは: ${SELECTORS.join(", ")}`);
} else {
  console.log(`  DKIM   ✅ セレクタ: ${found.join(", ")}`);
}

console.log("");

if (problems.length === 0) {
  console.log("✅ SPF / DKIM / DMARC はすべて設定されています");
  for (const n of notes) console.log(`   ※ ${n}`);
  console.log("");
  console.log("   **設定が正しくても、届くとは限りません。** 実際に主要な宛先");
  console.log("   (Gmail / Outlook / 取引先のドメイン)へ送って、受信箱に入ることを確かめてください");
  process.exit(0);
}

console.error(`❌ メールが迷惑メール扱いされる設定です(${problems.length} 件):`);
for (const p of problems) {
  console.error(`\n   ・${p.what}`);
  console.error(`     なぜ: ${p.why}`);
  console.error(`     直し方: ${p.how}`);
}
for (const n of notes) console.error(`\n   ※ ${n}`);
console.error("");
console.error("   手順は docs/ops/MAIL_DELIVERABILITY.md にあります。");
process.exit(1);
