/**
 * **復元訓練の結果を記録する**。
 *   node tools/record-drill.mjs --minutes 95 --from backup-20260801.dump --operator 山田
 *
 * 【なぜ必要か】
 * `tools/check-drill.mjs` は訓練の鮮度を見張るが、**記録が無ければ何も守れない**。
 * 記録の形式(`ops/drills/restore-drill.json`)を手で書くのは間違えやすく、
 * 「あとで書く」が積み重なって未記録のままになる。
 *
 * **訓練そのものは人がやる。** 手順は `docs/ops/BACKUP_RESTORE.md` の
 * 「復元訓練」節にある。このツールは記録の部分だけを引き受ける。
 *
 * 【使い方】
 * ```bash
 * node tools/record-drill.mjs \
 *   --minutes 95 \
 *   --from backup-20260801.dump \
 *   --operator "山田" \
 *   --issue "秘密鍵の場所が手順に書かれておらず10分探した" \
 *   --next "鍵の保管場所を BACKUP_RESTORE.md に追記した"
 * ```
 *
 * `--issue` と `--next` は繰り返し指定できる。
 * **詰まった箇所を書き残すことが訓練の主目的**なので、空でも警告する。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FILE = path.join(ROOT, "ops", "drills", "restore-drill.json");

/** `--key value` を集める(同じキーは配列にする)。 */
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) continue;
    if (out[key] === undefined) out[key] = value;
    else if (Array.isArray(out[key])) out[key].push(value);
    else out[key] = [out[key], value];
    i += 1;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const minutes = Number(args.minutes);

if (!Number.isFinite(minutes) || minutes <= 0) {
  console.error("使い方: node tools/record-drill.mjs --minutes <所要分> --from <バックアップ名> --operator <実施者>");
  console.error("  任意: --issue <詰まった点> --next <次にやること>(それぞれ繰り返し可)");
  console.error("\n  手順は docs/ops/BACKUP_RESTORE.md の「復元訓練」節にあります。");
  process.exit(1);
}

const toArray = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

const record = {
  lastDrillAt: new Date().toISOString().slice(0, 10),
  durationMinutes: minutes,
  restoredFrom: args.from ?? "(未記入)",
  operator: args.operator ?? "(未記入)",
  issues: toArray(args.issue),
  nextActions: toArray(args.next),
};

mkdirSync(path.dirname(FILE), { recursive: true });

// **既存の設定を消さない。** `intervalDays` / `rtoMinutes` / `_comment` は
// このファイルで定義されており、丸ごと書き換えると検査の前提が失われる。
let existing = {};
let history = [];
if (existsSync(FILE)) {
  try {
    const prev = JSON.parse(readFileSync(FILE, "utf8"));
    history = Array.isArray(prev.history) ? prev.history : [];
    // 過去の記録も残す(前回からの変化を見るため)
    if (prev.lastDrillAt) {
      const { history: _drop, _comment: _c, intervalDays: _i, rtoMinutes: _r, ...rest } = prev;
      history = [rest, ...history].slice(0, 10);
    }
    existing = prev;
  } catch {
    // 読めない記録は無視する(上書きはするが、落とさない)
  }
}
writeFileSync(FILE, `${JSON.stringify({ ...existing, ...record, history }, null, 2)}\n`);

console.log(`✅ 記録しました: ops/drills/restore-drill.json`);
console.log(`   実施日: ${record.lastDrillAt} / 所要 ${minutes} 分 / 実施者 ${record.operator}`);

// RTO を超えていたら、それは**目標が絵に描いた餅**という発見なので強く伝える
// **RTO は設定ファイルから読む**(決め打ちすると、目標を変えたときに食い違う)
const RTO_MINUTES = Number(existing.rtoMinutes) || 4 * 60;
if (minutes > RTO_MINUTES) {
  console.error(`\n❌ RTO 目標(${RTO_MINUTES} 分)を超えています。`);
  console.error("   **目標が守れていません。** 手順を短縮するか、目標を実態に合わせて見直してください。");
  console.error("   どちらにせよ docs/ops/BACKUP_RESTORE.md の更新が要ります。");
}
if (record.issues.length === 0) {
  console.log("\n⚠ 詰まった箇所が記録されていません。");
  console.log("  **訓練の主目的は手順の穴を見つけること**です。何も無かったなら --issue \"特になし\" と明記してください。");
}
console.log("\n`node tools/check-drill.mjs` で確認してコミットしてください。");
