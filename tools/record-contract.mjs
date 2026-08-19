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
  // **2026-08 追加。** 契約は 5 件あるのに記録できるのは 3 件だけで、
  // zoho / line は**鍵を用意しても永久に記録されない**状態だった
  // (実地課題の副産物として発見)。契約を足したらここにも足すこと。
  // `check-contract` の C006 が対応漏れを検出する。
  "zoho-token": {
    // **DC は既定を持たない。** `com` と `jp` でホストが違い、
    // 取り違えると「認証情報が誤っている」ようにしか見えない応答が返る。
    needs: ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN", "ZOHO_DATA_CENTER"],
    async run() {
      const dc = env("ZOHO_DATA_CENTER");
      const res = await fetch(`https://accounts.zoho.${dc}/oauth/v2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: env("ZOHO_CLIENT_ID"),
          client_secret: env("ZOHO_CLIENT_SECRET"),
          refresh_token: env("ZOHO_REFRESH_TOKEN"),
        }),
      });
      return { status: res.status, body: await res.json() };
    },
  },
  "slack-api": {
    // **`auth.test` を使う。** 副作用が無く、鍵の有効性も同時に分かる
    needs: ["SLACK_BOT_TOKEN"],
    async run() {
      const res = await fetch("https://slack.com/api/auth.test", {
        method: "POST",
        headers: { Authorization: `Bearer ${env("SLACK_BOT_TOKEN")}` },
      });
      return { status: res.status, body: await res.json() };
    },
  },
  "microsoft-token": {
    needs: ["MICROSOFT_TENANT_ID", "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_REFRESH_TOKEN"],
    async run() {
      const tenant = encodeURIComponent(env("MICROSOFT_TENANT_ID"));
      const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: env("MICROSOFT_CLIENT_ID"),
          client_secret: env("MICROSOFT_CLIENT_SECRET"),
          refresh_token: env("MICROSOFT_REFRESH_TOKEN"),
        }),
      });
      return { status: res.status, body: await res.json() };
    },
  },
  "notion-page": {
    // **ページ ID が要る。** 連携先のページをインテグレーションに共有しておくこと
    needs: ["NOTION_TOKEN", "NOTION_TEST_PAGE_ID"],
    async run() {
      const res = await fetch(`https://api.notion.com/v1/pages/${encodeURIComponent(env("NOTION_TEST_PAGE_ID"))}`, {
        headers: {
          Authorization: `Bearer ${env("NOTION_TOKEN")}`,
          // **API バージョンは必須。** 省くと最古の形で返り、契約が意味を失う
          "Notion-Version": "2022-06-28",
        },
      });
      return { status: res.status, body: await res.json() };
    },
  },
  "line-profile": {
    // **プロフィール取得には実在の userId が要る**(Bot と友だちになっている人)。
    // トークンだけでは呼べないため、記録用の ID を別に渡す。
    // 値は保存しない(`redact` が伏せる)ので、記録から個人は辿れない。
    needs: ["LINE_CHANNEL_ACCESS_TOKEN", "LINE_TEST_USER_ID"],
    async run() {
      const res = await fetch(
        `https://api.line.me/v2/bot/profile/${encodeURIComponent(env("LINE_TEST_USER_ID"))}`,
        { headers: { Authorization: `Bearer ${env("LINE_CHANNEL_ACCESS_TOKEN")}` } },
      );
      return { status: res.status, body: await res.json() };
    },
  },
};

let updated = 0, skipped = 0, failed = 0;

/**
 * `--list` … どのコネクタに何の鍵が要るか、いま何が揃っているかを出す。
 *
 * **鍵を用意するのは人の仕事**なので、「何を GitHub Secrets に入れればよいか」が
 * 一覧で見えないと着手できない。実際 HANDOVER には「契約は 5 件」と書かれたまま
 * **実際は 8 件**になっており、準備の対象数がずれていた(2026-08)。
 */
if (process.argv.includes("--list")) {
  console.log("契約テストに必要な鍵(環境変数)\n");
  let ready = 0;
  for (const [name, rec] of Object.entries(RECORDERS)) {
    const missing = rec.needs.filter((k) => !process.env[k]);
    const mark = missing.length === 0 ? "✅ 揃っている" : `⏳ 不足 ${missing.length}`;
    if (missing.length === 0) ready += 1;
    console.log(`  ${mark.padEnd(14)} ${name}`);
    for (const k of rec.needs) {
      console.log(`      ${process.env[k] ? "✓" : "・"} ${k}`);
    }
  }
  console.log(`\n${ready} / ${Object.keys(RECORDERS).length} コネクタが記録可能です。`);
  console.log("**1 件でも揃えば、そのコネクタだけ記録が始まります**(残りは黙ってスキップ)。");
  console.log("鍵は GitHub Secrets に入れてください(.github/workflows/contract.yml が読みます)。");
  process.exit(0);
}

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
