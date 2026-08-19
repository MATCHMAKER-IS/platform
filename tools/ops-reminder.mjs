/**
 * **放置されがちな運用タスク**をまとめて、Issue の本文にする。
 *   node tools/ops-reminder.mjs
 *
 * 【なぜ必要か】
 * 「やった方がいいが、緊急ではない」ことは必ず後回しになる。
 * preflight の警告は毎日目に入るが、**目に入り続けると見えなくなる**。
 *
 * 月に 1 度 Issue にすれば、担当と期限が付く形になる。
 * `.github/workflows/ops-reminder.yml` から呼ばれる。
 *
 * 【対象】
 *   1. 復元訓練     … 戻せるか試していないバックアップは、無いのとほぼ同じ
 *   2. 契約テスト   … 実 API の記録が無いと「本物では動かない」を検出できない
 *   3. 未実戦の部品 … どこからも使われていない = 動作が未確認
 *
 * 対応が必要なものが無ければ、そう出力する(呼び出し側は Issue を作らない)。
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** 見つかった「やること」。 */
const todos = [];

// ── 1. 復元訓練 ──────────────────────────────
{
  const file = path.join(ROOT, "ops/drills/restore-drill.json");
  let drill = null;
  if (existsSync(file)) {
    try {
      drill = JSON.parse(readFileSync(file, "utf8"));
    } catch { /* 壊れていたら未実施として扱う */ }
  }

  const interval = drill?.intervalDays ?? 180;
  const last = drill?.lastDrillAt ?? null;

  if (last === null) {
    todos.push({
      title: "復元訓練を一度も実施していない",
      why: "バックアップは取れていますが、**戻せるかは試していません**。取得だけして復元を試したことがない状態は、バックアップが無いのとほとんど同じです。",
      how: [
        "手順: `docs/ops/BACKUP_RESTORE.md` の「復元訓練」節（**1 時間で終わります**）",
        "記録: `node tools/record-drill.mjs --minutes <所要分> --from <バックアップ名> --operator <実施者> --issue \"詰まった点\"`",
      ],
    });
  } else {
    const days = Math.floor((Date.now() - Date.parse(`${last}T00:00:00Z`)) / 86_400_000);
    if (days > interval) {
      todos.push({
        title: `復元訓練から ${days} 日経っている（目安 ${interval} 日）`,
        why: "手順は放置すると腐ります。人が変わり、環境が変わり、前回動いた手順が動かなくなります。",
        how: [`前回: ${last}`, "記録: `node tools/record-drill.mjs --minutes <所要分> …`"],
      });
    }
  }
}

// ── 2. 契約テスト（実 API の記録）────────────
{
  const dir = path.join(ROOT, "tests/contracts");
  if (existsSync(dir)) {
    const missing = [];
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".contract.json"))) {
      try {
        const c = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
        if (c.fixture === null || c.fixture === undefined) missing.push(c.connector ?? f);
      } catch { /* 読めないものは飛ばす */ }
    }
    if (missing.length > 0) {
      todos.push({
        title: `外部サービスの応答を記録していない（${missing.length} 件）`,
        why: "実 API の記録が無いと、相手が仕様を変えても気づけません。**モックのテストは通り続けます。**",
        how: [
          `対象: ${missing.join(" / ")}`,
          "認証情報（Secrets）を設定して `node tools/record-contract.mjs` を実行",
          "手順: `docs/ops/TESTING_GUIDE.md`",
        ],
      });
    }
  }
}

// ── 3. 未実戦のパッケージ ────────────────────
{
  const file = path.join(ROOT, "docs/ai/module-list.md");
  if (existsSync(file)) {
    const body = readFileSync(file, "utf8");
    const names = [...body.matchAll(/- \*\*@platform\/([a-z-]+)\*\* \*\*⚠ 未実戦\*\*/g)].map((m) => m[1]);
    // 理由が書いてあるものは「意図して使っていない」ので除く
    const withoutReason = names.filter((n) => {
      const i = body.indexOf(`@platform/${n}** **⚠ 未実戦**`);
      return !body.slice(i, i + 800).includes("未実戦の理由");
    });
    if (withoutReason.length > 0) {
      todos.push({
        title: `使われていないパッケージがある（${withoutReason.length} 件）`,
        why: "どこからも import されていない = **動作が一度も確かめられていません**。最初に使う人がバグを踏みます。",
        how: [
          `対象: ${withoutReason.map((n) => `\`@platform/${n}\``).join(", ")}`,
          "デモを作って実際に動かすか、意図して使っていないなら `tools/gen-module-list.mjs` の `UNUSED_REASONS` に理由を書く",
        ],
      });
    }
  }
}

// ── 出力 ─────────────────────────────────────
if (todos.length === 0) {
  console.log("対応が必要なものはありません。");
  process.exit(0);
}

const lines = [
  "## 運用タスクの確認",
  "",
  "「やった方がいいが、緊急ではない」ことは後回しになります。",
  "毎日 preflight の警告に出ていますが、**出続けると見えなくなる**ため、月に 1 度ここにまとめます。",
  "",
  `対応が要るもの: **${todos.length} 件**`,
  "",
];

for (const [i, t] of todos.entries()) {
  lines.push(`### ${i + 1}. ${t.title}`, "", t.why, "");
  for (const h of t.how) lines.push(`- ${h}`);
  lines.push("");
}

lines.push("---", "");
lines.push("> この Issue は `.github/workflows/ops-reminder.yml` が毎月 1 日に更新します。");
lines.push("> すべて解消すると、翌月からは Issue が作られません（閉じてください）。");

console.log(lines.join("\n"));
