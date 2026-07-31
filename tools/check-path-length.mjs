/**
 * **Windows のパス長制限**に引っかからないかを検査する。
 *   node tools/check-path-length.mjs
 *
 * 【なぜ必要か】
 * Windows は既定でパスの上限が **260 文字**(`MAX_PATH`)。
 * pnpm は `node_modules/.pnpm/<パッケージ>@<版>_<依存のハッシュ>/node_modules/...`
 * という**非常に深い階層**を作るため、113 パッケージ規模では簡単に超える。
 *
 * 超えたときの症状が分かりにくい。
 *
 * - `turbo run build` が **`0xC0000409`(スタック破壊)で即クラッシュ**する。
 *   タスクを 1 つも実行せず、ログも 1 行も出さない
 * - `pnpm -r` が「ファイル名、ディレクトリ名、またはボリューム ラベルの構文が
 *   間違っています」で止まる
 * - **単一パッケージのビルドは通る**(浅いので上限に当たらない)ため、
 *   コード側の問題だと誤解する
 *
 * 2026-07 に実際に踏んだ。`C:\\Users\\<user>\\Documents\\platform` (33 文字)から
 * 始めたところ、実測の最大パス長が **265 文字**に達していた。
 *
 * 【対処】
 * 1. リポジトリを浅い場所へ移す(`C:\\dev\\platform` なら 18 文字節約)
 * 2. 長いパスを有効化(管理者権限・要再起動)
 *      Set-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem" `
 *        -Name LongPathsEnabled -Value 1
 * 3. `.npmrc` に `node-linker=hoisted`(`.pnpm` の深い階層を避ける)
 */
import { readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MAX_PATH = 260;
/** リポジトリのパスが長いと、その分だけ余裕が減る。 */
const ROOT_LEN = ROOT.replace(/[\\/]$/, "").length;

const isWindows = process.platform === "win32";

/**
 * Windows で**長いパスが有効化されているか**を調べる。
 *
 * 有効なら 260 文字を超えても動くので、超過は問題ではない。
 * ここを見ないと、対処済みの環境で**警告が鳴り続ける**(直しようがないので無視され、
 * 検査そのものが信用されなくなる)。
 *
 * @returns 有効なら true / 無効なら false / 判定できなければ null
 */
function longPathsEnabled() {
  if (!isWindows) return null;
  try {
    const out = execFileSync(
      "reg",
      ["query", String.raw`HKLM\SYSTEM\CurrentControlSet\Control\FileSystem`, "/v", "LongPathsEnabled"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const m = /LongPathsEnabled\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(out);
    return m ? parseInt(m[1], 16) === 1 : false;
  } catch {
    return null; // reg が無い・読めない
  }
}

/** node_modules 配下の最長パスを測る(読めないものは深すぎる印なので数える)。 */
function measure(dir, depth = 0) {
  let max = dir.length;
  let unreadable = 0;
  if (depth > 30) return { max, unreadable }; // 実用上ここまで潜れば十分
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return { max, unreadable: 1 }; // 深すぎて開けない
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    max = Math.max(max, full.length);
    if (e.isDirectory()) {
      const r = measure(full, depth + 1);
      max = Math.max(max, r.max);
      unreadable += r.unreadable;
    }
  }
  return { max, unreadable };
}

const nm = path.join(ROOT, "node_modules");
if (!existsSync(nm)) {
  console.log("⏭ node_modules がないため測れません(`pnpm install` の後に再実行してください)");
  process.exit(0);
}

const { max, unreadable } = measure(nm);
const margin = MAX_PATH - max;

console.log(`   リポジトリの位置: ${ROOT_LEN} 文字`);
console.log(`   node_modules 内の最長パス: ${max} 文字(上限 ${MAX_PATH})`);
if (unreadable > 0) console.log(`   開けなかったディレクトリ: ${unreadable} 件(深すぎる可能性)`);

const longPaths = longPathsEnabled();
if (longPaths === true) console.log("   長いパス(LongPathsEnabled): 有効");
else if (longPaths === false) console.log("   長いパス(LongPathsEnabled): **無効**");

// 長いパスが有効なら 260 文字超でも動くので、超過を問題としない
if ((max > MAX_PATH || unreadable > 0) && longPaths !== true) {
  const msg =
    `${isWindows ? "❌" : "⚠"} パスが Windows の上限(${MAX_PATH} 文字)を超えています。` +
    "\n   Windows では turbo が **ログも出さずクラッシュ**し、pnpm -r も止まります。" +
    "\n   対処 ①(推奨): **長いパスを有効化**する。管理者権限の PowerShell で実行し、**Windows を再起動**:" +
    '\n     Set-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem" -Name LongPathsEnabled -Value 1' +
    "\n   対処 ②: リポジトリを浅い場所へ移す(例 C:\\dev\\platform)。" +
    "\n     **移動する前に node_modules を消すこと**(深いパスのせいで移動自体が失敗する)";
  if (isWindows) {
    console.error(msg);
    process.exitCode = 1;
  } else {
    // Linux/macOS では実害がないので落とさない。ただし Windows の開発者のために報告する
    console.log(msg);
    console.log("   (この OS では実害はありませんが、Windows で開発する人が踏みます)");
  }
} else if (longPaths === true) {
  console.log("✅ 長いパスが有効なので、260 文字を超えても問題ありません");
} else if (margin < 30) {
  console.log(`⚠ 上限まであと ${margin} 文字です。依存を足すと超える可能性があります`);
} else {
  console.log("✅ パス長は Windows の上限内です");
}
