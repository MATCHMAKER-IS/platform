#!/usr/bin/env node
/**
 * **1 台の VPS で運用するときに、静かに壊れるもの**を見る。
 *
 * どれも「動かなくなる」のではなく、**気づかないまま悪化する**種類のものです。
 *
 * | 見るもの | 気づいたときには |
 * |---|---|
 * | **Docker のログの上限** | **ディスクが一杯**で DB が書けず、全部止まっている |
 * | **バックアップの自動実行** | 「取っているはず」だったが、**一度も取れていない** |
 * | **コンテナの時刻** | ログの時刻が 9 時間ずれ、**障害の前後関係が追えない** |
 * | **再起動の設定** | サーバ再起動後、**アプリだけ上がっていない** |
 *
 * 【なぜ検査にするか】
 * どれも**手順書には書いてありました**。書いてあるだけでは、
 * **設定されているかどうかは分かりません**——
 * このリポジトリが繰り返し記録してきたとおりです(ADR 0024)。
 *
 * 実行: node tools/check-ops-hygiene.mjs
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const problems = [];
let scanned = 0;

// ---- 1. Docker のログが無制限になっていないか ----
const composes = readdirSync(ROOT).filter((f) => /^docker-compose.*\.yml$/.test(f));
for (const file of composes) {
  const body = readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n");
  // 本番相当(ghcr のイメージを使う)だけを見る。ローカル開発は対象外
  if (!body.includes("ghcr.io/")) continue;
  scanned += 1;

  // サービスごとに logging があるか
  // **`volumes:` 直下の名前も同じ形で並ぶ。** `services:` の中だけを見る
  const servicesAt = body.indexOf("\nservices:");
  const volumesAt = body.indexOf("\nvolumes:");
  const region = body.slice(
    servicesAt < 0 ? 0 : servicesAt,
    volumesAt > servicesAt ? volumesAt : body.length,
  );
  const offset = servicesAt < 0 ? 0 : servicesAt;
  const services = [...region.matchAll(/^ {2}(\w[\w-]*):$/gm)]
    .map((m) => ({ name: m[1], at: offset + (m.index ?? 0) }));
  for (const [i, svc] of services.entries()) {
    const end = services[i + 1]?.at ?? body.length;
    const block = body.slice(svc.at, end);
    // イメージを持つ = コンテナが動く = ログが出る
    if (!/^\s+image:/m.test(block)) continue;
    if (/max-size:/.test(block)) continue;
    problems.push({
      where: `${file} の ${svc.name}`,
      what: "ログの上限が設定されていません",
      why: "Docker の既定(json-file)は**上限なし**。1 台の VPS では**ディスクを食い潰して全部止まります**",
      how: '`logging: { driver: json-file, options: { max-size: "100m", max-file: "3" } }` を足してください',
    });
  }

  // ---- 4. 再起動の設定 ----
  for (const [i, svc] of services.entries()) {
    const end = services[i + 1]?.at ?? body.length;
    const block = body.slice(svc.at, end);
    if (!/^\s+image:/m.test(block)) continue;
    if (/restart:/.test(block)) continue;
    problems.push({
      where: `${file} の ${svc.name}`,
      what: "`restart` が設定されていません",
      why: "**サーバを再起動すると、上がってきません**。気づくのは誰かが使おうとしたとき",
      how: '`restart: always`（一度だけ動かすものは `restart: "no"`）',
    });
  }
}

// ---- 2. バックアップを自動で回す仕組みがあるか ----
const backupScript = path.join(ROOT, "scripts", "backup.sh");
scanned += 1;
if (!existsSync(backupScript)) {
  problems.push({
    where: "scripts/backup.sh",
    what: "バックアップを自動で回す仕組みがありません",
    why: "手順書があっても、**回っていなければ取れていません**。気づくのは戻したいとき",
    how: "`scripts/backup.sh` を用意し、cron に登録してください",
  });
} else {
  const body = readFileSync(backupScript, "utf8");
  // **失敗を知らせない自動実行は、無いのと同じ**
  if (!/notify|curl/.test(body)) {
    problems.push({
      where: "scripts/backup.sh",
      what: "失敗を知らせる仕組みがありません",
      why: "cron は**黙って失敗します**。静かに失敗し続けるのが最悪の状態です",
      how: "失敗時に通知する処理を入れてください",
    });
  }
  // 世代を持たないバックアップは、壊れたデータで上書きしたときに戻せない
  if (!/KEEP_DAYS|mtime/.test(body)) {
    problems.push({
      where: "scripts/backup.sh",
      what: "世代の管理がありません",
      why: "上書き 1 世代だと、**壊れたデータを含んだバックアップ**で上書きしたときに戻せません",
      how: "日付つきのファイル名にし、古いものを消す処理を入れてください",
    });
  }
}

// ---- 3. コンテナの時刻 ----
const dockerfiles = [];
const appsDir = path.join(ROOT, "apps");
if (existsSync(appsDir)) {
  for (const a of readdirSync(appsDir, { withFileTypes: true })) {
    if (!a.isDirectory()) continue;
    const f = path.join(appsDir, a.name, "Dockerfile");
    if (existsSync(f)) dockerfiles.push({ app: a.name, path: f });
  }
}
for (const d of dockerfiles) {
  scanned += 1;
  const body = readFileSync(d.path, "utf8");
  if (/ENV TZ=/.test(body)) continue;
  problems.push({
    where: `apps/${d.app}/Dockerfile`,
    what: "`TZ` が設定されていません",
    why: "コンテナの既定は **UTC**。ログの時刻が 9 時間ずれ、**障害の前後関係が追えなくなります**",
    how: "`ENV TZ=Asia/Tokyo`（`tzdata` も入れること。無いと効きません）",
  });
}

if (problems.length === 0) {
  console.log(`✅ 運用の設定は揃っています(${scanned} 項目を検査 / compose ${composes.length} 件)`);
  process.exit(0);
}

console.error(`❌ 静かに壊れる設定が ${problems.length} 件あります(${scanned} 項目を検査):`);
for (const p of problems) {
  console.error(`\n   ${p.where}: ${p.what}`);
  console.error(`     なぜ: ${p.why}`);
  console.error(`     直し方: ${p.how}`);
}
console.error("");
console.error("   **どれも「動かなくなる」のではなく、気づかないまま悪化します。**");
process.exit(1);
