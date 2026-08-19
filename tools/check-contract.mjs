/**
 * 外部SaaSとの「契約」検査。
 *
 * 外部 API はこちらの都合と関係なく変わる。モックのテストは通り続けるので、
 * 壊れたことに気づくのは利用者からの連絡になりがち。これを防ぐために
 * 「うちのコードが相手の応答の“どのフィールド”に依存しているか」を契約として明文化し、
 * 実際に記録した応答(フィクスチャ)と突き合わせる。
 *
 * 検査するもの:
 *  C001 契約ファイルの形式が正しいか
 *  C002 契約が指す実装ファイルが存在するか
 *  C003 契約に書いた必須フィールドを、実装が本当に参照しているか(契約と実装のズレ検知)
 *  C004 記録済みフィクスチャに、必須フィールドが揃っているか(相手のAPI変更を検知)
 *  C005 フィクスチャが古すぎないか(既定 90 日。契約は放置すると腐る)
 *  C006 契約に**記録手段があるか**(record-contract.mjs の RECORDERS に居るか)
 *  C007 外部 API を叩くパッケージに**契約があるか**(網羅の漏れ)
 *  C008 記録に要る鍵が **CI の Secrets に載っているか**(鍵を用意しても CI で読めない)
 *
 * C006 を足した理由(2026-08): 契約が 5 件あるのに RECORDERS は 3 件しかなく、
 * **zoho / line は鍵を用意しても永久に記録されない**状態だった。
 * C004 は「未記録」と警告し続けるが、それが「鍵待ち」なのか
 * 「そもそも記録できない」のかを区別できず、待っていても一生埋まらない。
 *
 * 実行:
 *   node tools/check-contract.mjs           … 通常(未記録は警告どまり)
 *   CONTRACT_STRICT=1 node tools/check-contract.mjs
 *                                           … 本番前/定期CI用(未記録・期限切れも失敗)
 *
 * フィクスチャの記録方法は docs/ops/TESTING_GUIDE.md を参照。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments, methodCallRe } from "./lib/source-text.mjs";

/**
 * 外部 API の応答を読んでいる形。
 *
 * **受信側(`req` / `request`)は除く**——こちらが受け取るリクエストであって、
 * 契約の対象「相手が返すもの」ではない。
 */
const READS_EXTERNAL_JSON = methodCallRe("json", { awaited: true, exclude: ["req", "request"] });

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "tests", "contracts");
const STRICT = process.env.CONTRACT_STRICT === "1";
const MAX_AGE_DAYS = Number(process.env.CONTRACT_MAX_AGE_DAYS ?? 90);

const errors = [];
const warns = [];

/** オブジェクトから dot 記法でフィールドを取り出す(存在確認用)。 */
function hasField(obj, dotPath) {
  let cur = obj;
  for (const key of dotPath.split(".")) {
    if (cur === null || typeof cur !== "object" || !(key in cur)) return false;
    cur = cur[key];
  }
  return true;
}

if (!fs.existsSync(DIR)) {
  console.log("⚠ tests/contracts がありません(契約テスト未整備)");
  process.exit(STRICT ? 1 : 0);
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".contract.json")).sort();
const covered = new Set();
let recorded = 0;

/**
 * `record-contract.mjs` が記録できる契約名の一覧。
 *
 * **ツールを import せず本文から読む。** import すると記録処理が走りうるうえ、
 * 検査の副作用で外部へ通信することになる。
 */
/**
 * 外部 API の応答を読んでいるパッケージ。
 *
 * **契約が無ければ、相手の変更を検知できない。** 2026-08 に測ったところ、
 * `res.json()` を扱うのは 10 パッケージなのに契約は 5 件しか無く、
 * `ai` / `microsoft` / `notion` / `ocr` / `slack` が**素通り**していた
 * (いずれもアプリで実際に使われている)。
 *
 * **`fetch` を持つだけでは対象にしない。** 応答の中身を読んで
 * フィールドに依存しているものだけが、相手の変更で壊れる。
 */
function packagesReadingExternalApi() {
  const found = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === "generated") continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.ts$/.test(p) && !/\.test\./.test(p)) {
        // **変数名を決め打ちしない。** `res` `response` `r` など呼び方は揃っていない。
        // 実際 2026-08 に `await res.json()` だけで測って `paypal`(`r.json()`)を
        // 数え落とした。**同じ誤りを 3 回繰り返している**ので、識別子は任意にする。
        // **共通処理を使う**(`tools/lib/source-text.mjs`)。
        // コメント除去・識別子を決め打ちしない・受信側を除く、の 3 点は
        // 検査を書くたびに同じ誤りを繰り返した箇所なので関数にまとめてある
        const code = stripComments(fs.readFileSync(p, "utf8"));
        if (READS_EXTERNAL_JSON.test(code)) {
          found.add(path.relative(path.join(ROOT, "packages"), p).split(path.sep)[0]);
        }
      }
    }
  };
  walk(path.join(ROOT, "packages"));
  return found;
}

/**
 * 契約が無くてよいパッケージ。**理由を必ず添える。**
 */
const NO_CONTRACT_NEEDED = [
  { re: /^ui$/, why: "自前の API を叩く(外部 SaaS ではない)" },
  { re: /^integrations$/, why: "他のコネクタを束ねる層。個々の契約は各パッケージが持つ" },
  // **宛先が利用側の設定で決まるもの。** 契約は「相手の応答の形」を固定するが、
  // 相手が実行時に決まるなら固定しようがない。
  { re: /^ai$/, why: "複数のプロバイダ(anthropic / openai 等)を差し替える。応答の形は利用側が選ぶ" },
  { re: /^ocr$/, why: "エンジンを注入する方式(Tesseract / 任意の HTTP)。宛先が固定でない" },
];

const recorderNames = (() => {
  const p = path.join(ROOT, "tools", "record-contract.mjs");
  if (!fs.existsSync(p)) return null;
  const src = fs.readFileSync(p, "utf8");
  const i = src.indexOf("const RECORDERS");
  if (i < 0) return null;
  return new Set([...src.slice(i).matchAll(/^  "([\w-]+)": \{/gm)].map((m) => m[1]));
})();

for (const f of files) {
  const rel = path.join("tests/contracts", f);
  let c;
  try {
    c = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
  } catch (e) {
    errors.push(`[C001] ${rel}: JSON として読めません(${e.message})`);
    continue;
  }

  for (const key of ["connector", "endpoint", "sourceFile", "requiredFields"]) {
    if (!c[key]) errors.push(`[C001] ${rel}: 必須項目 ${key} がありません`);
  }
  if (!Array.isArray(c.requiredFields) || c.requiredFields.length === 0) {
    errors.push(`[C001] ${rel}: requiredFields が空です(依存フィールドを1つ以上書く)`);
    continue;
  }
  covered.add(c.connector);

  // C002/C003: 契約と実装のズレ
  const srcPath = path.join(ROOT, c.sourceFile ?? "");
  if (!c.sourceFile || !fs.existsSync(srcPath)) {
    errors.push(`[C002] ${rel}: sourceFile が見つかりません(${c.sourceFile})`);
  } else {
    const src = fs.readFileSync(srcPath, "utf8");
    for (const field of c.requiredFields) {
      const leaf = field.split(".").pop();
      if (!src.includes(leaf)) {
        errors.push(`[C003] ${rel}: 実装(${c.sourceFile})が "${field}" を参照していません(契約が古い可能性)`);
      }
    }
  }

  // C006: 記録手段があるか(無ければ、待っていても未記録のまま埋まらない)
  const name = f.replace(/\.contract\.json$/, "");
  if (recorderNames !== null && !recorderNames.has(name)) {
    errors.push(`[C006] ${rel}: tools/record-contract.mjs に "${name}" の記録手段がありません`
      + "(鍵を用意しても記録されません。RECORDERS に足してください)");
  }

  // C004/C005: 記録済み応答との突き合わせ
  if (c.fixture === null || c.fixture === undefined) {
    warns.push(`[C004] ${rel}: 実応答が未記録です(${c.connector} の変更を検知できません)`);
    continue;
  }
  recorded++;
  for (const field of c.requiredFields) {
    if (!hasField(c.fixture, field)) {
      errors.push(`[C004] ${rel}: 記録した応答に "${field}" がありません → ${c.connector} の API が変わった可能性`);
    }
  }
  if (!c.capturedAt) {
    warns.push(`[C005] ${rel}: capturedAt がありません(いつ記録したか不明)`);
  } else {
    const days = (Date.now() - Date.parse(c.capturedAt)) / 86_400_000;
    if (Number.isNaN(days)) warns.push(`[C005] ${rel}: capturedAt の日付を解釈できません(${c.capturedAt})`);
    else if (days > MAX_AGE_DAYS) warns.push(`[C005] ${rel}: 記録から ${Math.floor(days)} 日経過(${MAX_AGE_DAYS}日超) → 取り直してください`);
  }
}

// C007: 外部 API を読むのに契約が無いパッケージ
{
  const reading = packagesReadingExternalApi();
  const missing = [...reading]
    .filter((pkg) => !covered.has(pkg))
    .filter((pkg) => !NO_CONTRACT_NEEDED.some((a) => a.re.test(pkg)))
    .sort();
  for (const pkg of missing) {
    warns.push(`[C007] packages/${pkg}: 外部 API の応答を読んでいますが契約がありません`
      + "(相手が変えても気づけません。tests/contracts/ に足してください)");
  }
}

// C008: 記録に要る環境変数が CI のワークフローに載っているか
{
  const recorderSrc = fs.readFileSync(path.join(ROOT, "tools/record-contract.mjs"), "utf8");
  const wfPath = path.join(ROOT, ".github/workflows/contract.yml");
  if (fs.existsSync(wfPath)) {
    const wf = fs.readFileSync(wfPath, "utf8");
    const needs = [...recorderSrc.matchAll(/needs: \[([^\]]+)\]/g)]
      .flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
    for (const key of [...new Set(needs)]) {
      if (!wf.includes(key)) {
        errors.push(`[C008] ${key} が .github/workflows/contract.yml にありません`
          + "(鍵を Secrets に入れても CI が読めず、記録が始まりません)");
      }
    }
  }
}

for (const e of errors) console.log(`❌ ${e}`);
for (const w of warns) console.log(`⚠ ${w}`);

const summary = `契約 ${files.length} 件 / 実応答を記録済み ${recorded} 件 / 対象コネクタ ${[...covered].join(", ") || "なし"}`;

if (errors.length > 0) {
  console.log(`❌ 契約検査に ${errors.length} 件の不一致。${summary}`);
  process.exit(1);
}
if (STRICT && warns.length > 0) {
  console.log(`❌ [strict] 未記録・期限切れが ${warns.length} 件。${summary}`);
  process.exit(1);
}
console.log(`✅ 契約と実装は一致しています(${summary})`);
process.exit(0);
