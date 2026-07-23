/**
 * PWA(ホーム画面に置けるアプリ)の設定が揃っているか検査する。
 *
 * PWA は**壊れても気づきにくい**。アイコンを消してもアプリは動くし、
 * manifest の参照を外しても画面は出る。気づくのは
 * 「ホーム画面に追加できなくなった」と現場から言われたときになる。
 *
 * ここでは「PWA を有効にしているアプリ」だけを対象に、必要な部品が
 * 揃っているかを見る。PWA にしていないアプリは対象外(全部に強制しない)。
 *
 * 検査するもの:
 *   P001 manifest を返すルートがあるか
 *   P002 layout から manifest を参照しているか
 *   P003 アイコン(192/512)が実在するか
 *   P004 Service Worker を返すルートがあるか
 *   P005 Service Worker を登録しているか
 *   P006 オフライン時に出す画面があるか
 *   P007 Service Worker の版が固定値のまま放置されていないか
 *
 * 実行: node tools/check-pwa.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** そのアプリが PWA を有効にしているか(manifest を返すルートがあるか)。 */
function isPwaApp(appDir) {
  return existsSync(path.join(appDir, "src/app/manifest.json/route.ts")) ||
         existsSync(path.join(appDir, "src/app/manifest.webmanifest/route.ts")) ||
         existsSync(path.join(appDir, "public/manifest.json"));
}

/** ディレクトリ配下のファイルを集める。 */
function collect(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", "dist"].includes(e.name)) continue;
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) collect(fp, out);
    else out.push(fp);
  }
  return out;
}

const issues = [];
let checked = 0;

const appsDir = path.join(ROOT, "apps");
const apps = existsSync(appsDir)
  ? readdirSync(appsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  : [];

for (const app of apps) {
  const appDir = path.join(appsDir, app);
  if (!isPwaApp(appDir)) continue;
  checked += 1;

  const files = collect(path.join(appDir, "src"));
  const bodyOf = (p) => readFileSync(p, "utf8");
  const all = files.map(bodyOf).join("\n");

  // P002: layout から manifest を参照しているか
  const layout = files.find((f) => /src[\\/]app[\\/]layout\.tsx?$/.test(f));
  if (!layout) {
    issues.push(`${app}: layout が見つかりません`);
  } else {
    const body = bodyOf(layout);
    if (!/manifest\s*:/.test(body)) {
      issues.push(`${app}: layout から manifest を参照していません(metadata.manifest を設定してください。ホーム画面に追加できません)`);
    }
    if (!/themeColor/.test(body)) {
      issues.push(`${app}: viewport.themeColor がありません(端末の色が既定のままになります)`);
    }
  }

  // P003: アイコンの実在
  for (const size of ["192", "512"]) {
    const icon = path.join(appDir, "public", `icon-${size}.png`);
    if (!existsSync(icon)) {
      issues.push(`${app}: public/icon-${size}.png がありません(インストールに必要です)`);
    }
  }

  // P004/P005: Service Worker
  const hasSwRoute = existsSync(path.join(appDir, "src/app/sw.js/route.ts")) ||
                     existsSync(path.join(appDir, "public/sw.js"));
  if (!hasSwRoute) {
    issues.push(`${app}: Service Worker を返すルートがありません(オフラインで真っ白になります)`);
  } else if (!/serviceWorker\.register/.test(all)) {
    issues.push(`${app}: Service Worker を登録していません(ファイルはあるが誰も読み込んでいません)`);
  }

  // P006: オフライン画面
  const swSrc = existsSync(path.join(appDir, "src/app/sw.js/route.ts"))
    ? bodyOf(path.join(appDir, "src/app/sw.js/route.ts"))
    : "";
  const fallback = /offlineFallback:\s*["']([^"']+)["']/.exec(swSrc)?.[1];
  if (fallback) {
    const routePath = path.join(appDir, "src/app", fallback.replace(/^\//, ""), "page.tsx");
    if (!existsSync(routePath)) {
      issues.push(`${app}: オフライン時に出す画面(${fallback})がありません`);
    }
  }

  // P007: 版が更新されているか(生成物の中身が変わったのに版が同じ、は検知できないが
  //       「差し替え忘れ」の目印として明らかな固定値だけ拾う)
  const version = /version:\s*["']([^"']+)["']/.exec(swSrc)?.[1];
  if (version && /^(v?1|test|dev|todo|xxx)$/i.test(version)) {
    issues.push(`${app}: Service Worker の版が "${version}" のままです(更新しても古い画面が出続けます。日付にしてください)`);
  }
}

if (checked === 0) {
  console.log("✅ PWA を有効にしているアプリはありません(対象外)");
  process.exit(0);
}

if (issues.length === 0) {
  console.log(`✅ PWA の設定は揃っています(${checked} アプリ検査)`);
  process.exit(0);
}

for (const i of issues) console.log(`❌ ${i}`);
console.log(`❌ PWA の設定に ${issues.length} 件の不足。ホーム画面への追加やオフライン表示が動きません。`);
process.exit(1);
