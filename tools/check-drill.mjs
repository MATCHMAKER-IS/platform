/**
 * 復元訓練の鮮度を見張る。
 *
 * バックアップは「取れていること」ではなく「戻せること」で完成する。
 * 訓練は緊急性が無いため後回しにされ続けるので、機械に見張らせる。
 *
 * 検査するもの:
 *  D001 記録ファイルの形式
 *  D002 一度も訓練していない
 *  D003 前回の訓練から intervalDays(既定 180 日)を過ぎている
 *  D004 訓練にかかった時間が RTO 目標を超えている(目標が絵に描いた餅になっている)
 *
 * 実行:
 *   node tools/check-drill.mjs            … 通常(警告どまり。preflight はこちら)
 *   DRILL_STRICT=1 node tools/check-drill.mjs  … 本番稼働後はこちらを CI に入れる
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "ops", "drills", "restore-drill.json");
const STRICT = process.env.DRILL_STRICT === "1";
const REL = "ops/drills/restore-drill.json";

const errors = [];
const warns = [];

if (!fs.existsSync(FILE)) {
  console.log(`❌ [D001] ${REL} がありません(復元訓練の記録先)`);
  process.exit(1);
}

let d;
try {
  d = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch (e) {
  console.log(`❌ [D001] ${REL}: JSON として読めません(${e.message})`);
  process.exit(1);
}

const interval = Number(d.intervalDays ?? 180);
const rto = Number(d.rtoMinutes ?? 0);

if (!d.lastDrillAt) {
  warns.push(`[D002] 復元訓練の記録がありません。バックアップから戻せるかは未検証です → docs/ops/BACKUP_RESTORE.md`);
} else {
  const at = Date.parse(d.lastDrillAt);
  if (Number.isNaN(at)) {
    errors.push(`[D001] lastDrillAt の日付を解釈できません(${d.lastDrillAt})`);
  } else {
    const days = Math.floor((Date.now() - at) / 86_400_000);
    if (days > interval) warns.push(`[D003] 前回の復元訓練から ${days} 日経過(目安 ${interval} 日)。そろそろ実施してください`);
    if (rto > 0 && Number(d.durationMinutes) > rto) {
      warns.push(`[D004] 前回の訓練は ${d.durationMinutes} 分かかり、RTO 目標 ${rto} 分を超えています。目標か手順を見直してください`);
    }
  }
}

for (const e of errors) console.log(`❌ ${e}`);
for (const w of warns) console.log(`⚠ ${w}`);

if (errors.length > 0) process.exit(1);
if (STRICT && warns.length > 0) {
  console.log("❌ [strict] 復元訓練が未実施または期限切れです");
  process.exit(1);
}
if (warns.length === 0) console.log(`✅ 復元訓練は最新です(前回 ${d.lastDrillAt} / ${d.durationMinutes} 分)`);
process.exit(0);
