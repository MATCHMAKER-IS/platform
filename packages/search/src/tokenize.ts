/**
 * 軽量トークナイザ。ASCII は単語単位、CJK(日本語等)は文字バイグラムに分割する。
 * 形態素解析器なしで日本語の部分一致検索を実用的な精度にする(Elasticsearch の CJK bigram 相当)。
 *
 * 【この方式で起きること】
 * 2 文字ずつに切るので、**語の途中で一致しても当たります**:
 *
 * - 「**京都**」で検索すると「**東**京都」が出る（「京都」が含まれるため）
 * - 「**社員**」で検索すると「会**社員**」が出る
 *
 * **誤りではなく、この方式の性質**です。利用者から「なぜこれが出るのか」と
 * 聞かれたら、そう説明してください。
 *
 * **困るほど誤ヒットが増えたら**、DB の全文検索
 * （`@platform/db` の `fullTextSearch`。PostgreSQL の `pg_bigm` や
 * 形態素解析）へ移してください——**ここを賢くしようとすると、
 * 辞書の更新という新しい仕事が増えます**。
 * @packageDocumentation
 */

const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/;

/**
 * 文字列をトークン配列に分割する。
 *
 *
 * @param input 対象の文字列
 * @returns トークンの配列(**日本語は 2-gram**。形態素解析が無くても、それなりに検索できる)
 */
export function tokenize(input: string): string[] {
  const text = input.toLowerCase();
  const tokens: string[] = [];
  let asciiRun = "";
  let cjkRun = "";
  const flushAscii = () => { if (asciiRun) { tokens.push(asciiRun); asciiRun = ""; } };
  const flushCjk = () => {
    if (cjkRun.length === 1) tokens.push(cjkRun);
    else for (let i = 0; i < cjkRun.length - 1; i++) tokens.push(cjkRun.slice(i, i + 2)); // バイグラム
    cjkRun = "";
  };
  for (const ch of text) {
    if (CJK.test(ch)) { flushAscii(); cjkRun += ch; }
    else if (/[a-z0-9]/.test(ch)) { flushCjk(); asciiRun += ch; }
    else { flushAscii(); flushCjk(); } // 区切り
  }
  flushAscii(); flushCjk();
  return tokens;
}
