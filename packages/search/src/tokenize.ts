/**
 * 軽量トークナイザ。ASCII は単語単位、CJK(日本語等)は文字バイグラムに分割する。
 * 形態素解析器なしで日本語の部分一致検索を実用的な精度にする(Elasticsearch の CJK bigram 相当)。
 * @packageDocumentation
 */

const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/;

/** 文字列をトークン配列に分割する。 */
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
