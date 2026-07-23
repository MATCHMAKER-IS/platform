/**
 * 外部SaaSの実応答を記録し、契約フィクスチャを更新する。
 *
 * 検査しているのは「フィールドの有無」であって値ではないため、
 * **値はすべて伏せて（redact）から保存する**。トークンや個人情報をリポジトリに残さない。
 *
 * 認証情報（環境変数）が無いコネクタは黙ってスキップする。
 * これにより、Secrets を1つずつ整えながら段階的に運用へ載せられる。
 *
 * 実行: node tools/record-contract.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "tests", "contracts");

/** 値を伏せる。構造（キーの有無・型）だけを残す。 */
function redact(value) {
  if (Array.isArray(value)) return value.slice(0, 1).map(redact);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redact(v);
    return out;
  }
  if (typeof value === "number") return 0;
  if (typeof value === "boolean") return false;
  if (value === null) return null;
  return "<redacted>";
}

const env = (k) => process.env[k]?.trim() || null;

/**
 * 記録対象。必要な環境変数が揃っているものだけ実行する。
 * それぞれ「トークンを1回取り直す」だけの最小の呼び出しにとどめる。
 */
const RECORDERS = {
  "freee-token": {
    needs: ["FREEE_CLIENT_ID", "FREEE_CLIENT_SECRET", "FREEE_REFRESH_TOKEN"],
    async run() {
      const res = await fetch("https://accounts.secure.freee.co.jp/public_api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: env("FREEE_CLIENT_ID"),
          client_secret: env("FREEE_CLIENT_SECRET"),
          refresh_token: env("FREEE_REFRESH_TOKEN"),
        }),
      });
      return { status: res.status, body: await res.json() };
    },
  },
  "google-token": {
    needs: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"],
    async run() {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: env("GOOGLE_CLIENT_ID"),
          client_secret: env("GOOGLE_CLIENT_SECRET"),
          refresh_token: env("GOOGLE_REFRESH_TOKEN"),
        }),
      });
      return { status: res.status, body: await res.json() };
    },
  },
  "paypal-token": {
    needs: ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"],
    async run() {
      const basic = Buffer.from(`${env("PAYPAL_CLIENT_ID")}:${env("PAYPAL_CLIENT_SECRET")}`).toString("base64");
      const res = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
        method: "POST",
        headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials",
      });
      return { status: res.status, body: await res.json() };
    },
  },
};

let updated = 0, skipped = 0, failed = 0;

for (const [name, rec] of Object.entries(RECORDERS)) {
  const file = path.join(DIR, `${name}.contract.json`);
  if (!fs.existsSync(file)) {
    console.log(`⚠ ${name}: 契約ファイルがありません(スキップ)`);
    skipped++;
    continue;
  }
  const missing = rec.needs.filter((k) => !env(k));
  if (missing.length > 0) {
    console.log(`… ${name}: 認証情報が未設定のためスキップ(${missing.join(", ")})`);
    skipped++;
    continue;
  }

  try {
    const { status, body } = await rec.run();
    if (status < 200 || status >= 300) {
      console.log(`❌ ${name}: HTTP ${status} が返りました。応答: ${JSON.stringify(redact(body))}`);
      failed++;
      continue;
    }
    const contract = JSON.parse(fs.readFileSync(file, "utf8"));
    contract.fixture = redact(body);
    contract.capturedAt = new Date().toISOString();
    fs.writeFileSync(file, `${JSON.stringify(contract, null, 2)}\n`);
    console.log(`✅ ${name}: 記録しました(フィールド: ${Object.keys(body).join(", ")})`);
    updated++;
  } catch (e) {
    console.log(`❌ ${name}: 記録に失敗しました(${e.message})`);
    failed++;
  }
}

console.log(`\n記録 ${updated} 件 / スキップ ${skipped} 件 / 失敗 ${failed} 件`);
process.exit(failed > 0 ? 1 : 0);
