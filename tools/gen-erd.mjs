/**
 * Prisma スキーマから Mermaid ER 図を生成する(人向けドキュメント)。
 *   node tools/gen-erd.mjs                 # 全アプリの schema を docs/platform/erd/<app>.md に出力
 *   node tools/gen-erd.mjs internal-app    # 指定アプリのみ
 * model / フィールド / @relation を抽出し、Mermaid erDiagram に変換する。
 * リレーションは外部キー(fields/references)から推定し、? 有無で任意/必須を表す。
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

/** schema テキストを { models: [{ name, fields:[{name,type,optional,isRelation,relationModel}] }], relations } に解析。 */
function parseSchema(src) {
  const models = [];
  const modelRe = /model\s+(\w+)\s*\{([^}]*)\}/g;
  let m;
  while ((m = modelRe.exec(src)) !== null) {
    const name = m[1];
    const bodyLines = m[2].split("\n").map((l) => l.trim()).filter(Boolean);
    const fields = [];
    for (const line of bodyLines) {
      if (line.startsWith("@@") || line.startsWith("//")) continue;
      const fm = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?(.*)$/);
      if (!fm) continue;
      const [, fname, ftype, isArray, optional, rest] = fm;
      const relationMatch = rest.match(/@relation\(([^)]*)\)/);
      const isScalar = ["String", "Int", "Float", "Boolean", "DateTime", "Json", "Bytes", "Decimal", "BigInt"].includes(ftype);
      fields.push({
        name: fname,
        type: ftype + (isArray ? "[]" : ""),
        optional: Boolean(optional),
        isRelation: !isScalar,
        relationModel: !isScalar ? ftype : undefined,
        hasFk: Boolean(relationMatch && /fields:/.test(relationMatch[1])),
        isId: /@id/.test(rest),
      });
    }
    models.push({ name, fields });
  }
  return models;
}

/** Mermaid erDiagram に変換。 */
function toMermaid(models) {
  const modelNames = new Set(models.map((m) => m.name));
  const lines = ["erDiagram"];
  // エンティティ(スカラーのみ表示・型を保持)
  for (const model of models) {
    lines.push(`  ${model.name} {`);
    for (const f of model.fields) {
      if (f.isRelation) continue;
      const attr = f.isId ? "PK" : "";
      lines.push(`    ${f.type.replace("[]", "_arr")} ${f.name}${attr ? ` ${attr}` : ""}`);
    }
    lines.push("  }");
  }
  // リレーション(FK を持つ側から。任意は }o..||、必須は ||..||)
  const seen = new Set();
  for (const model of models) {
    for (const f of model.fields) {
      if (!f.isRelation || !f.relationModel || !modelNames.has(f.relationModel)) continue;
      if (!f.hasFk) continue; // FK 保持側だけで1本に
      const key = `${model.name}->${f.relationModel}:${f.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const card = f.optional ? "}o--||" : "}|--||";
      lines.push(`  ${model.name} ${card} ${f.relationModel} : "${f.name}"`);
    }
  }
  return lines.join("\n");
}

function generate(app) {
  const schemaPath = path.join(ROOT, "apps", app, "prisma", "schema.prisma");
  if (!existsSync(schemaPath)) return null;
  const models = parseSchema(readFileSync(schemaPath, "utf8"));
  if (models.length === 0) return null;
  const mermaid = toMermaid(models);
  const relCount = (mermaid.match(/--\|\||--\|\|/g) ?? []).length;
  const md = `# ${app} ER 図(自動生成）

> 再生成: \`node tools/gen-erd.mjs ${app}\`。model ${models.length} / リレーション ${relCount}。手で編集しない。

\`\`\`mermaid
${mermaid}
\`\`\`
`;
  const outDir = path.join(ROOT, "docs/platform/erd");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, `${app}.md`), md);
  return { app, models: models.length, relations: relCount };
}

import { fileURLToPath } from "node:url";
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  const apps = target ? [target] : readdirSync(path.join(ROOT, "apps")).filter((a) => existsSync(path.join(ROOT, "apps", a, "prisma", "schema.prisma")));
  const results = [];
  for (const app of apps) {
    const r = generate(app);
    if (r) { results.push(r); console.log(`✅ docs/platform/erd/${r.app}.md 生成(model ${r.models} / リレーション ${r.relations})`); }
  }
  if (results.length === 0) console.log("ER 図の対象(prisma schema)が見つかりませんでした");
}

export { parseSchema, toMermaid };
