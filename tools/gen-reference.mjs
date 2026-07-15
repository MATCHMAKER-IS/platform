/**
 * API Reference(軽量版)を生成する。TypeDoc の完全版は重い(要 install)ため、
 * 各パッケージの src から export と TSDoc を抽出し、機械可読 JSON にする。
 * Portal・リファレンスサイト・AI の文脈に使う。
 *   node tools/gen-reference.mjs   → docs/platform/api-reference.json
 *
 * **index.ts だけでなく src 配下すべて**を見る(`export * from` で再公開する
 * パッケージは index.ts に宣言が無いため、それだけ見ると空になる)。
 * 公開されているかは index.ts の export 名で突き合わせる。
 *
 * 抽出するもの: 説明 / シグネチャ / @param / @returns / @throws / @example
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const pkgDir = path.join(ROOT, "packages");

/**
 * TSDoc ブロックを解析する。
 * @param {string} doc TSDoc(区切り記号込み)
 * @returns {{summary: string, params: {name: string, description: string}[], returns: string, throws: string[], example: string}}
 */
function parseDoc(doc) {
  const lines = doc
    .replace(/^\s*\/\*\*/, "")
    .replace(/\*\/\s*$/, "")
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, ""));

  const summary = [];
  const params = [];
  let returns = "";
  const throwsList = [];
  const example = [];
  let mode = "summary";
  let current = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const tag = line.trim().match(/^@(\w+)\s*(.*)$/);
    if (tag) {
      const name = tag[1];
      const rest = tag[2] ?? "";
      if (name === "param") {
        const m = rest.match(/^(\S+)\s*(.*)$/);
        current = { name: m?.[1] ?? "", description: m?.[2] ?? "" };
        params.push(current);
        mode = "param";
      } else if (name === "returns" || name === "return") {
        returns = rest;
        mode = "returns";
      } else if (name === "throws") {
        throwsList.push(rest);
        mode = "throws";
      } else if (name === "example") {
        mode = "example";
      } else {
        mode = "other";
      }
      continue;
    }
    if (mode === "summary") summary.push(line);
    else if (mode === "param" && current && line.trim()) current.description += ` ${line.trim()}`;
    else if (mode === "returns" && line.trim()) returns += ` ${line.trim()}`;
    else if (mode === "throws" && line.trim() && throwsList.length > 0) throwsList[throwsList.length - 1] += ` ${line.trim()}`;
    else if (mode === "example") example.push(line);
  }

  return {
    summary: summary.join(" ").replace(/\s+/g, " ").trim(),
    params,
    returns: returns.trim(),
    throws: throwsList.map((t) => t.trim()).filter(Boolean),
    example: example.join("\n").replace(/^\s*```\w*\n?/, "").replace(/\n?```\s*$/, "").trim(),
  };
}

/** 1 ファイルから export 宣言と TSDoc を抽出する。 */
function extractFromFile(src) {
  const entries = [];
  const re = /(\/\*\*[\s\S]*?\*\/\s*)?export\s+(?:async\s+)?(function|const|let|class|interface|type|enum)\s+([A-Za-z0-9_$]+)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const doc = m[1] ?? "";
    const kind = m[2];
    const name = m[3];
    const parsed = doc ? parseDoc(doc) : { summary: "", params: [], returns: "", throws: [], example: "" };

    let signature = "";
    if (kind === "function") {
      const sigMatch = src.slice(m.index).match(/export\s+(?:async\s+)?function\s+[A-Za-z0-9_$]+\s*(?:<[^>]*>)?\s*\(([\s\S]*?)\)\s*(?::\s*([^{]+?))?\s*\{/);
      if (sigMatch) {
        const args = (sigMatch[1] ?? "").replace(/\s+/g, " ").trim();
        const ret = (sigMatch[2] ?? "").replace(/\s+/g, " ").trim();
        signature = `${name}(${args.length > 120 ? `${args.slice(0, 120)}…` : args})${ret ? `: ${ret}` : ""}`;
      }
    }

    entries.push({
      name,
      kind,
      summary: parsed.summary,
      ...(signature ? { signature } : {}),
      ...(parsed.params.length > 0 ? { params: parsed.params } : {}),
      ...(parsed.returns ? { returns: parsed.returns } : {}),
      ...(parsed.throws.length > 0 ? { throws: parsed.throws } : {}),
      ...(parsed.example ? { example: parsed.example } : {}),
    });
  }
  return entries;
}

/** index.ts が公開している名前(`export * from` があるなら null = 全部)。 */
function publicNames(indexSrc) {
  const names = new Set();
  const hasStar = /export\s*\*\s*from/.test(indexSrc);
  for (const m of indexSrc.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (m[1] ?? "").split(",")) {
      const token = part.trim().split(/\s+as\s+/).pop()?.replace(/^type\s+/, "").trim();
      if (token) names.add(token);
    }
  }
  for (const m of indexSrc.matchAll(/export\s+(?:async\s+)?(?:function|const|class|interface|type|enum)\s+([A-Za-z0-9_$]+)/g)) {
    if (m[1]) names.add(m[1]);
  }
  return hasStar ? null : names;
}

/** src 配下の .ts(テスト除く)。 */
function listSources(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.ts$/.test(e.name) && !e.name.includes(".test.")) out.push(p);
    }
  };
  walk(dir);
  return out;
}

const names = readdirSync(pkgDir).filter((d) => existsSync(path.join(pkgDir, d, "src", "index.ts"))).sort();
const reference = {};
let total = 0;
let withParams = 0;

for (const name of names) {
  const srcDir = path.join(pkgDir, name, "src");
  const indexSrc = readFileSync(path.join(srcDir, "index.ts"), "utf8");
  const allowed = publicNames(indexSrc);

  const seen = new Map();
  for (const file of listSources(srcDir)) {
    for (const e of extractFromFile(readFileSync(file, "utf8"))) {
      if (allowed !== null && !allowed.has(e.name)) continue;
      // 同名は情報が多い方を採用(index.ts の再 export より実装側の TSDoc を優先)
      const score = (x) => (x.summary ? 1 : 0) + (x.params ? 2 : 0) + (x.returns ? 2 : 0) + (x.example ? 1 : 0) + (x.signature ? 1 : 0);
      const cur = seen.get(e.name);
      if (!cur || score(e) > score(cur)) seen.set(e.name, e);
    }
  }
  const entries = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  if (entries.length > 0) {
    reference[`@platform/${name}`] = entries;
    total += entries.length;
    withParams += entries.filter((e) => e.params || e.returns).length;
  }
}

writeFileSync(path.join(ROOT, "docs/platform/api-reference.json"), JSON.stringify(reference, null, 2) + "\n");
console.log(
  `✅ docs/platform/api-reference.json 生成(${Object.keys(reference).length} パッケージ / ${total} エントリ / 引数or戻り値あり ${withParams})`,
);
