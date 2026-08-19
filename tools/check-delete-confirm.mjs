/**
 * **画面からの削除に確認があるかを確かめる。**
 *
 * 【なぜ見張るか】
 * 一覧に並んだ「削除」ボタンは、**隣の行を消すつもりで押し間違える**。
 * 業務データは元に戻せないことが多く、後から次の形で分かる:
 *
 * - お知らせを消した → **誰も気づかないまま公開が止まっていた**
 * - 予約を消した → **来店した人が現れた**
 * - 添付を消した → **証憑が無くなり経費が通らない**
 *
 * 2026-08 に、画面からの削除 13 箇所のうち **11 箇所が確認なし**だった。
 *
 * 【なぜ `useConfirm` を使うか】
 * 個別に `ConfirmDialog` を書くと**書き忘れる**——書き忘れても動くので、
 * レビューでも気づきにくい。`@platform/ui` の `useConfirm` は
 * **1 行で使える**形にしてある。
 *
 * 【`window.confirm` を認めない理由】
 * 見た目がブラウザ任せで**アプリの外に見える**うえ、**タブ全体が固まる**。
 * 文面も 1 行しか出せないので、「何が起きるか」を書けない。
 *
 * 【上限方式にする理由】
 * 開発用の画面(`debug`)や、**再取り込みできるもの**(用語集・テーマ)は
 * 確認が無くても実害が小さい。一律に禁じると不自然な確認が増えるので、
 * **増やさないことだけ**を守る。
 *
 * 使い方:
 * ```
 * node tools/check-delete-confirm.mjs
 * node tools/check-delete-confirm.mjs --list
 * node tools/check-delete-confirm.mjs --set-limit
 * ```
 *
 * @packageDocumentation
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT_FILE = path.join(ROOT, "tools", "delete-confirm-limit.json");

/** 上限を読む。 */
function readLimit() {
  try {
    const j = JSON.parse(fs.readFileSync(LIMIT_FILE, "utf8"));
    return typeof j.limit === "number" ? j.limit : 0;
  } catch {
    return 0;
  }
}

/** 確認なしで削除している画面を探す。 */
function findUnconfirmed() {
  const hits = [];
  for (const rel of collectFiles(["apps"], ROOT, { extensions: [".tsx"] })) {
    const norm = rel.replace(/\\/g, "/");
    // **`showcase` は見本**(業務データを扱わない)
    if (norm.startsWith("apps/showcase/")) continue;
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    if (!/method:\s*"DELETE"/.test(src)) continue;
    // **確認の仕組みがあるか。** `useConfirm` / `ConfirmDialog` のどちらでもよい
    if (/useConfirm|ConfirmDialog/.test(src)) continue;
    hits.push({ file: norm });
  }
  return hits;
}

const hits = findUnconfirmed();
const limit = readLimit();

if (process.argv.includes("--set-limit")) {
  fs.writeFileSync(
    LIMIT_FILE,
    `${JSON.stringify({
      _comment: "確認なしで削除している画面の上限。増やさないための歯止め。減らしたら --set-limit で下げる。",
      limit: hits.length,
    }, null, 2)}\n`,
  );
  console.log(`✅ 上限を更新しました(${hits.length} 件)`);
  process.exit(0);
}

if (process.argv.includes("--list")) {
  for (const h of hits) console.log(`   ${h.file}`);
}

if (hits.length > limit) {
  console.error(`❌ 確認なしで削除している画面が ${hits.length} 件に増えました(上限 ${limit})`);
  for (const h of hits.slice(0, 10)) console.error(`   ${h.file}`);
  console.error("");
  console.error("**一覧の「削除」は押し間違えます**(隣の行を消すつもりで押す)。");
  console.error("`@platform/ui` の `useConfirm` を使ってください:");
  console.error('  const { confirm, dialog } = useConfirm();');
  console.error('  <Button onClick={() => confirm({ title: "…", onConfirm: () => void remove(id) })}>削除</Button>');
  console.error("  {dialog}   ← **置き忘れると確認が出ないまま消えます**");
  process.exit(1);
}

console.log(`✅ 確認なしの削除は上限内です(${hits.length} 件 / 上限 ${limit})`);
