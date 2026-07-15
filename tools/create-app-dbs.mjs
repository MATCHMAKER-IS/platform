/**
 * アプリ別 DB(app / app_crud / app_equipment)を冪等に作成する。
 * psql が使えない環境(devcontainer 等)向け。pg は pnpm install 後に利用可能(@platform/db 依存)。
 * 接続先: PGHOST/PGPORT/PGUSER/PGPASSWORD(既定 localhost/5432/app/app)。
 */
const DBS = ["app", "app_crud", "app_equipment"];
let pg;
try {
  pg = (await import("pg")).default;
} catch {
  console.error("❌ 'pg' が見つかりません。先に pnpm install を実行してください(setup.sh は psql 経由で作成するためこのツール不要)。");
  process.exit(1);
}
const client = new pg.Client({
  host: process.env.PGHOST ?? "localhost",
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? "app",
  password: process.env.PGPASSWORD ?? "app",
  database: "postgres",
});
await client.connect();
for (const db of DBS) {
  const r = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [db]);
  if (r.rowCount > 0) {
    console.log(`✓ ${db}(既存)`);
  } else {
    await client.query(`CREATE DATABASE ${db}`);
    console.log(`✓ ${db} を作成`);
  }
}
await client.end();
