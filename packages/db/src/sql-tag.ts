/**
 * SQL タグ(`sql\`...\``)。**値は必ずプレースホルダで束縛する。**
 *
 * 【なぜ `@prisma/client` の `Prisma.sql` を使わないか】
 *
 * `Prisma`(値)は **`prisma generate` の生成物**であり、`@prisma/client` の
 * 素の状態には存在しない。Prisma 7 では生成先をアプリごとに分けている
 * (ADR 0006・`client-types.ts` に詳述)ため、**基盤が `Prisma` を import すると
 * 「最後に generate したアプリ」の生成物に縛られる**。
 * 実際 2026-08 の `pnpm typecheck` で
 * `TS2305: Module '"@prisma/client"' has no exported member 'Prisma'` が出た
 * ——`typecheck` は `prisma generate` を走らせないので、**生成物が無ければ必ず落ちる**。
 *
 * `client-types.ts` が「生成物に依存しない構造的な型だけを要求する」方針を採っている
 * のに、ここだけ生成物の**値**に依存していたのが原因。**この 1 ファイルで最後の依存を切る。**
 *
 * 【安全性について】
 *
 * このタグは **値を文字列に埋め込まない**。テンプレートに差し込まれた値は
 * すべて `$1, $2, …` のプレースホルダになり、`$queryRawUnsafe` の
 * **第 2 引数以降**としてドライバに渡る(= サーバ側でパラメータとして束縛される)。
 * 文字列連結は一切しないので、**SQL インジェクションの経路が構造的に存在しない**。
 *
 * 識別子(テーブル名・カラム名)はプレースホルダで渡せないため、
 * どうしても文字列として埋め込む必要がある。その用途にだけ {@link raw} を用意しているが、
 * **利用者の入力を `raw` に渡してはいけない**。渡す前に必ず
 * {@link isSafeIdentifier} で検証すること(`search.ts` はそうしている)。
 *
 * @packageDocumentation
 */

const SQL_QUERY = Symbol.for("@platform/db.SqlQuery");
const RAW_FRAGMENT = Symbol.for("@platform/db.RawFragment");

/** 組み立ての最小単位。`text` はそのまま SQL に出る / `param` はプレースホルダになる。 */
type SqlNode = { readonly kind: "text"; readonly text: string } | { readonly kind: "param"; readonly value: unknown };

/**
 * 検証済みの識別子など、**そのまま SQL に埋め込む断片**。
 *
 * **利用者の入力を入れないこと。** ここに入った文字列は一切エスケープされない。
 */
export interface RawFragment {
  readonly [RAW_FRAGMENT]: true;
  readonly text: string;
}

/**
 * `sql\`...\`` が返すクエリ。**そのままでは実行できない**({@link compileSql} で SQL 文字列にする)。
 *
 * `@platform/db` の `queryRaw` / `executeRaw` などが内部で展開するので、
 * 呼び出し側はこの中身を触らなくてよい。
 */
export interface SqlQuery {
  readonly [SQL_QUERY]: true;
  readonly nodes: readonly SqlNode[];
}

/**
 * SQL に**そのまま**埋め込む断片を作る(識別子など、プレースホルダで渡せないもの)。
 *
 * @param text 埋め込む文字列(**呼び出し側で検証済みであること**)
 * @returns 生の断片
 *
 * @example
 * ```ts
 * if (!isSafeIdentifier(table)) return err(...);   // ← 必ず先に検証する
 * const stmt = sql`SELECT * FROM ${raw(`"${table}"`)} WHERE id = ${id}`;
 * ```
 */
export function raw(text: string): RawFragment {
  return { [RAW_FRAGMENT]: true, text };
}

function isRawFragment(value: unknown): value is RawFragment {
  return typeof value === "object" && value !== null && RAW_FRAGMENT in value;
}

/**
 * {@link SqlQuery} かどうかを判定する。
 *
 * @param value 判定する値
 * @returns `sql\`...\`` で作ったクエリなら true
 */
export function isSqlQuery(value: unknown): value is SqlQuery {
  return typeof value === "object" && value !== null && SQL_QUERY in value;
}

/**
 * SQL タグ。**差し込んだ値はすべてプレースホルダになる**(文字列に連結されない)。
 *
 * `sql\`...\`` を入れ子にできる(部分クエリを組み立ててから合成できる)。
 * 識別子を入れたいときだけ {@link raw} を使う。
 *
 * @param strings テンプレートの文字列部分
 * @param ...values 差し込む値(**そのまま SQL に出ることはない**)
 * @returns 組み立てたクエリ
 *
 * @example
 * ```ts
 * const cond = sql`age > ${20}`;
 * const stmt = sql`SELECT * FROM users WHERE ${cond} AND active = ${true}`;
 * // → SELECT * FROM users WHERE age > $1 AND active = $2  /  values: [20, true]
 * ```
 */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): SqlQuery {
  const nodes: SqlNode[] = [];
  for (let i = 0; i < strings.length; i += 1) {
    nodes.push({ kind: "text", text: strings[i] ?? "" });
    if (i < values.length) {
      const value = values[i];
      if (isSqlQuery(value)) {
        nodes.push(...value.nodes);
      } else if (isRawFragment(value)) {
        nodes.push({ kind: "text", text: value.text });
      } else {
        nodes.push({ kind: "param", value });
      }
    }
  }
  return { [SQL_QUERY]: true, nodes };
}

/**
 * {@link SqlQuery} を、実行できる SQL 文字列とパラメータに展開する。
 *
 * **番号はここで初めて決まる。** 入れ子で合成しても `$1` から順に振り直されるので、
 * 部分クエリを使い回しても番号がずれない。
 *
 * @param query `sql\`...\`` で作ったクエリ
 * @returns SQL 文字列(`$1, $2, …` 付き)と、その順のパラメータ
 */
export function compileSql(query: SqlQuery): { text: string; values: unknown[] } {
  let text = "";
  const values: unknown[] = [];
  for (const node of query.nodes) {
    if (node.kind === "text") {
      text += node.text;
    } else {
      values.push(node.value);
      text += `$${values.length}`;
    }
  }
  return { text, values };
}
