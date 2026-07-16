/**
 * 使用例のソースコードを取り出す。
 *
 * **実行時にファイルを読まない**。`process.cwd()` は Amplify の SSR で想定と違う場所を
 * 指すため、ファイル I/O に頼ると画面が壊れる。ビルド時に固めた生成物から取る。
 *
 * 生成: `node tools/gen-example-sources.mjs`(`pnpm gen:all` に含まれる)
 *
 * @packageDocumentation
 */
import { EXAMPLE_SOURCES } from "./example-sources.generated.js";

/**
 * 使用例のソースを取り出す。
 *
 * @param name 使用例の名前(`src/examples/<name>.ts` に対応)
 * @returns ソースコード。**無ければ案内文**(ビルドを落とさない)
 */
export function readExampleSource(name: string): string {
  return EXAMPLE_SOURCES[name] ?? `// ソースが見つかりません: ${name}\n// (pnpm gen:all で再生成してください)`;
}

/**
 * 長いソースを抜粋する。
 *
 * **画面には要点だけ出す**(ファイル全体を貼ると長すぎて誰も読まない)。
 *
 * @param source ソースコード
 * @param maxLines 最大行数(既定 60)
 * @returns 抜粋したコード
 */
export function excerptSource(source: string, maxLines = 60): string {
  const lines = source.split("\n");
  if (lines.length <= maxLines) return source;
  return lines.slice(0, maxLines).join("\n") + `\n\n// …(全 ${lines.length} 行)`;
}

/**
 * 取り込んである使用例の名前を返す。
 *
 * @returns 名前の配列(**リンク切れの検査に使う**)
 */
export function availableExamples(): string[] {
  return Object.keys(EXAMPLE_SOURCES).sort();
}
