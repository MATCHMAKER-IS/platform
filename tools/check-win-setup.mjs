/**
 * Windows セットアップスクリプト(setup.ps1 / setup.bat)の静的検査。
 * 実環境に pwsh が無くても回せる軽量チェック: 括弧・引用符の均衡、必須要素の存在、
 * setup.sh との手順対応(全7ステップ・3アプリ・DB名)を確認する。
 *   node tools/check-win-setup.mjs
 */
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const ps1 = readFileSync(`${root}scripts/setup.ps1`, "utf8");
const bat = readFileSync(`${root}scripts/setup.bat`, "utf8");
let pssa = "";
try { pssa = readFileSync(`${root}scripts/PSScriptAnalyzerSettings.psd1`, "utf8"); } catch { pssa = ""; }

let ng = 0;
const check = (name, cond) => { console.log((cond ? "✅" : "❌") + " " + name); if (!cond) ng += 1; };

// PowerShell: 括弧均衡(文字列内は概算だが、明らかな不整合を検出)
const balanced = (s, open, close) => {
  let d = 0;
  for (const c of s) { if (c === open) d += 1; else if (c === close) d -= 1; if (d < 0) return false; }
  return d === 0;
};
check("ps1: 波括弧 { } 均衡", balanced(ps1, "{", "}"));
check("ps1: 丸括弧 ( ) 均衡", balanced(ps1, "(", ")"));
check("ps1: param ブロック(Check/SkipDocker/SkipDb)", /param\(/.test(ps1) && ["Check", "SkipDocker", "SkipDb"].every((x) => new RegExp(`\\[switch\\]\\$${x}`).test(ps1)));
check("ps1: ヘルパ関数 Step/OK/Warn/Fail 定義", ["Step", "OK", "Warn", "Fail"].every((n) => ps1.includes(`function ${n}(`)));
check("ps1: 全7ステップ(Step 呼び出し>=7)", (ps1.match(/^\s*Step\s+"/gm) ?? []).length >= 7);
check("ps1: 3アプリ(internal-app/crud-template/equipment-app)", ["internal-app", "crud-template", "equipment-app"].every((a) => ps1.includes(a)));
check("ps1: DB名マッピング(app/app_crud/app_equipment)", ["app_crud", "app_equipment"].every((d) => ps1.includes(d)));
check("ps1: prisma generate + db push", ps1.includes("prisma generate") && ps1.includes("prisma db push"));
check("ps1: スモーク検証(pnpm smoke)", ps1.includes("pnpm smoke"));
check("ps1: Docker 起動待ちループ", /-le 30/.test(ps1) && ps1.includes("pg_isready"));
check("ps1: .env は既存を上書きしない", ps1.includes("Test-Path $dst") && ps1.includes("既存を維持"));
// 危険パターン(未定義変数の自動作成を招く典型ミスなど)
check("ps1: ExecutionPolicy を破壊的に変更していない", !/Set-ExecutionPolicy\s+(Unrestricted|Bypass)\s+-Scope\s+(LocalMachine|Process)/.test(ps1));

// バッチ
check("bat: @echo off で開始", bat.startsWith("@echo off"));
check("bat: pwsh 優先→powershell フォールバック", bat.includes("where pwsh") && bat.includes("powershell -NoProfile"));
check("bat: ExecutionPolicy Bypass で ps1 実行", bat.includes("ExecutionPolicy Bypass") && bat.includes("setup.ps1"));
check("bat: 引数(--check/--skip-docker/--skip-db)を変換", ["--check", "--skip-docker", "--skip-db"].every((x) => bat.includes(x)));
check("bat: スクリプト位置 %~dp0 を使用", bat.includes("%~dp0"));
check("bat: goto ラベルが全て存在する", [...bat.matchAll(/goto\s+(\w+)/gi)].every((m) => m[1].toLowerCase() === "eof" || new RegExp(`^:${m[1]}`, "mi").test(bat)));

// PSScriptAnalyzer 設定(CI の windows-scripts ジョブが使用)
check("pssa: 設定ファイル PSScriptAnalyzerSettings.psd1 が存在", pssa.length > 0);
check("pssa: psd1 ハッシュテーブル形式(@{ ... })", /^\s*@\{/.test(pssa) && pssa.trimEnd().endsWith("}"));
check("pssa: 波括弧 { } 均衡", balanced(pssa, "{", "}"));
check("pssa: Severity に Error を含む", /Severity\s*=/.test(pssa) && /'Error'/.test(pssa));
check("pssa: ExcludeRules に実用的な除外(WriteHost/ApprovedVerbs)", /ExcludeRules\s*=/.test(pssa) && pssa.includes("PSAvoidUsingWriteHost") && pssa.includes("PSUseApprovedVerbs"));
check("pssa: 危険ルールは除外していない(PlainTextPassword/InvokeExpression を残す)", (() => {
  const m = pssa.match(/ExcludeRules\s*=\s*@\(([\s\S]*?)\)/);
  const block = m ? m[1] : pssa;
  return !block.includes("PSAvoidUsingPlainTextForPassword") && !block.includes("PSAvoidUsingInvokeExpression");
})());
check("ci.yml: windows-scripts ジョブが設定ファイルを参照", (() => { try { return readFileSync(`${root}.github/workflows/ci.yml`, "utf8").includes("PSScriptAnalyzerSettings.psd1"); } catch { return false; } })());

if (ng > 0) { console.log(`\n❌ ${ng} 件の問題`); process.exitCode = 1; }
else console.log("\n✅ Windows セットアップスクリプト 静的検査 OK");
