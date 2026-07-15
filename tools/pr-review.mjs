/**
 * PR 向けの自動レビューサマリを生成する(決定的・ネットワーク不要)。
 * CI の pull_request で実行し、結果を PR コメントに投稿する想定(pr-review.yml)。
 *   node tools/pr-review.mjs > review.md
 * 内容: preflight の要点(smoke 数・依存健全性)+ advisor の重複サマリ + 生成物 drift の有無。
 * 「AI レビュー」の土台: ここで集めた事実を LLM に渡せば講評まで自動化できる(@platform/ai 経由・任意)。
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const tryRun = (cmd, args) => {
  try { return { ok: true, out: execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8" }) }; }
  catch (e) { return { ok: false, out: (e.stdout ?? "") + (e.stderr ?? "") }; }
};

const lines = ["## 🤖 自動レビュー サマリ", ""];

// smoke 数
const smoke = tryRun("node", ["--experimental-strip-types", "tools/smoke.mjs"]);
const smokeMatch = smoke.out.match(/(\d+) passed, (\d+) failed/);
lines.push(`- **スモーク**: ${smokeMatch ? `${smokeMatch[1]} passed / ${smokeMatch[2]} failed` : "取得失敗"} ${smokeMatch && smokeMatch[2] === "0" ? "✅" : "❌"}`);

// 依存境界
const deps = tryRun("node", ["tools/check-deps.mjs"]);
lines.push(`- **依存境界**: ${deps.ok ? "循環・層破りなし ✅" : "違反あり ❌"}`);

// API サーフェス
const api = tryRun("node", ["tools/api-surface.mjs"]);
lines.push(`- **公開 API**: ${api.ok ? "破壊的変更なし ✅" : "破壊的変更あり ⚠️（意図的なら --update）"}`);

// 生成物 drift
const gen = tryRun("node", ["tools/check-generated.mjs"]);
lines.push(`- **生成物**: ${gen.ok ? "最新 ✅" : "古い（要再生成）❌"}`);

// env ドキュメント
const env = tryRun("node", ["tools/check-env-example.mjs"]);
lines.push(`- **.env.example 整合**: ${env.ok ? "OK ✅" : "未記載あり ❌"}`);

// advisor 重複
const dup = tryRun("node", ["tools/advisor.mjs", "json"]);
if (dup.ok) {
  try {
    const d = JSON.parse(dup.out);
    lines.push(`- **重複の目安（Advisor）**: 同名 export ${d.sameName.length} 組 / 似た概念 ${d.similar.length} 組 / 孤立 ${d.isolated.length}`);
    if (d.isolated.length > 0) lines.push(`  - 孤立: ${d.isolated.map((i) => `\`@platform/${i.name}\`(${i.reason})`).join(", ")}`);
  } catch { /* ignore */ }
}

lines.push("");
lines.push("> このサマリは `node tools/pr-review.mjs` による決定的チェックです。新規パッケージを追加した場合は、重複がないか Advisor の数値を確認してください。");
lines.push("> 詳細な講評が必要なら、この事実を `@platform/ai`(AI Gateway)に渡して LLM レビューを追加できます（APIキー設定時）。");

process.stdout.write(lines.join("\n") + "\n");
