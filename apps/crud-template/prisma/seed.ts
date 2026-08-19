/**
 * 開発用のダミーデータ投入。
 *
 * **本番では流さない**(`isProductionRuntime()` で止める)。
 * **既にデータがあれば何もしない**(重複投入を防ぐ)。
 *
 * 実行: `pnpm --filter crud-template seed`
 * @packageDocumentation
 */
import "dotenv/config";
import { createDb, createSeeder } from "@platform/db";
import { isProductionRuntime, isDevEnv, appEnv } from "@platform/env";
import { setSeed } from "@platform/faker";
// **実行は `tsx`(package.json の seed スクリプト)。**
// `node --experimental-strip-types` だと、拡張子なしの相対 import を解決できず
// ERR_UNSUPPORTED_DIR_IMPORT / ERR_MODULE_NOT_FOUND で落ちる。
// 生成物だけでなく **基盤パッケージの内部(33 か所)まで**同じ問題が起きるため、
// 全部に拡張子を足すのではなく、解決できる実行系に替えた(2026-08)。
import { PrismaClient } from "../src/generated/prisma";

// **2 つの軸で止める。**
//
// `NODE_ENV=production`(実行時の最適化)と `APP_ENV`(どの環境か)は別物で、
// **検証環境も `NODE_ENV=production` で動く**(本番と同じイメージを使うため)。
// つまり `isProductionRuntime()` だけでも staging では止まるが、
// **「なぜ止まるか」が読み取れない**——「本番環境では実行できません」と出るのに
// 実際は検証環境、という分かりにくい形になる。
//
// **`APP_ENV` も見て、環境名をそのまま出す。**
if (isProductionRuntime() || !isDevEnv()) {
  console.error(
    `❌ ${appEnv()} 環境では実行できません(見本データが業務データに混ざります)`,
  );
  console.error("   見本データを入れたいなら APP_ENV=development で実行してください");
  process.exit(1);
}
// 毎回同じデータにする(見た目を比べるときに差分が分かる)
setSeed(20260804);

// **接続の作法は基盤に任せる。**
// `new PrismaClient()` は Prisma 7 では失敗する(ドライバアダプタが必須)。
// ここで組み立て直すと、アプリ本体と設定がずれる余地が生まれる
// **`.env` を読む。** `pnpm seed` は Next を経由しないので、
// 誰も環境変数を読み込んでくれない(アプリ本体は Next が読む)
const databaseUrl = process.env["DATABASE_URL"] ?? "";
if (databaseUrl === "") {
  console.error("❌ DATABASE_URL が設定されていません");
  console.error("   apps/crud-template/.env に設定してください(.env.example をコピー)");
  process.exit(1);
}

// **接続の作法は基盤に任せる。**
// `new PrismaClient()` は Prisma 7 では失敗する(ドライバアダプタが必須)。
// ここで組み立て直すと、アプリ本体と設定がずれる余地が生まれる
const db = createDb((o) => new PrismaClient(o), databaseUrl);

/** 事務用品の見本。**実在しそうで、業務データと取り違えない程度**の中身にする。 */
const ITEMS = [
  { code: "IT-1001", name: "ノート PC(見本)", note: "14インチ / 16GB" },
  { code: "IT-1002", name: "モニタ 24インチ(見本)", note: "" },
  { code: "IT-1003", name: "USB-C ハブ(見本)", note: "HDMI・LAN 付き" },
  { code: "OF-2001", name: "オフィスチェア(見本)", note: "肘掛けあり" },
  { code: "OF-2002", name: "ホワイトボード(見本)", note: "1800×900" },
  { code: "OF-2003", name: "書類キャビネット(見本)", note: "施錠可" },
  { code: "XX-9001", name: "旧型プリンタ(見本)", note: "廃棄予定", active: false },
];

const seeder = createSeeder()
  .step("マスタを作る", async () => {
    // **このステップの対象だけを見る。** 既にあれば飛ばす
    // (全体で止めると、後から足したステップが永久に入らない)
    if (await db.itemRow.count() > 0) { console.log("   既にあるため飛ばします"); return; }
    for (const item of ITEMS) {
      await db.itemRow.create({
        data: { code: item.code, name: item.name, note: item.note || null, active: item.active ?? true },
      });
    }
  });

const result = await seeder.run();
await db.$disconnect();
if (!result.ok) { console.error(result.error.message); process.exit(1); }
console.log(`✅ ダミーデータを投入しました(${ITEMS.length} 件)。すべて架空です。`);
