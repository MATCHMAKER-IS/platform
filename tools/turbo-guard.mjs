#!/usr/bin/env node
/**
 * turbo を起動する前に、**動かない環境で止める**。
 *
 * 【なぜ要るか】
 * Windows で `turbo run` が `0xC0000409`(スタック破壊)で落ちる。
 * 厄介なのは落ち方で、**タスクを 1 つも実行せず、ログも出さずに終わる**。
 * 画面には何も出ないので、初めて触る人には
 * 「自分の環境が壊れている」「設定を間違えた」としか見えない。
 *
 * `ui: stream` ・ `--concurrency=1` ・ `LongPathsEnabled=1` ・
 * turbo 2.10.7 への更新のいずれでも変わらなかった(パス長が原因ではない)。
 * **未解決**のため、既定のコマンドは turbo を使わない形にしてある。
 *
 * それでも `pnpm dev:turbo` のような turbo 版のスクリプトは残っている
 * (Linux の CI では速いため)。残っている以上、誰かが必ず踏む。
 * 踏んだときに**理由と代替が出る**ようにするのがこのファイルの役目。
 *
 * 使い方: node tools/turbo-guard.mjs <turbo に渡す引数...>
 *   例: node tools/turbo-guard.mjs run build
 */
import { spawn } from "node:child_process";

/** turbo が動かないことが分かっているプラットフォーム。 */
// テスト用の指定は**足すだけ**にする。置き換えにすると、
// 環境変数を設定した人の Windows でガードが外れる
const BROKEN = new Set(["win32", process.env["TURBO_GUARD_TEST_PLATFORM"]].filter(Boolean));

if (BROKEN.has(process.platform)) {
  const args = process.argv.slice(2);
  // `run build` → `build`。代替コマンドの案内に使う
  const task = args[0] === "run" ? args[1] : args[0];
  const alt = task === undefined ? "pnpm dev" : `pnpm ${task}`;

  console.error("❌ Windows では turbo が動きません(既知・未解決)。");
  console.error("");
  console.error("   turbo run は 0xC0000409 で落ちます。**タスクを 1 つも実行せず、");
  console.error("   ログも出さずに終わる**ため、原因に辿り着けません。");
  console.error("   あなたの環境の問題ではありません。");
  console.error("");
  console.error(`   代わりにこちらを使ってください: ${alt}`);
  console.error("   (turbo を使わない既定のコマンドです。同じことをします)");
  console.error("");
  console.error("   詳細: docs/ops/HANDOVER.md の「turbo が Windows で動かない」");
  process.exit(1);
}

const child = spawn("turbo", process.argv.slice(2), { stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 1));
