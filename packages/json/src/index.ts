/**
 * `@platform/json` — JSON の安全な読み書きと操作(純関数・依存なし)。
 *
 * 【なぜ要るか】
 * `JSON.parse` は**信頼できない入力で例外を投げる**し、
 * `JSON.stringify` は**循環参照・BigInt・Date で落ちるか、意図と違う形**になる。
 * どちらも「そのまま使うと本番で落ちる」種類の関数で、
 * **各所で try/catch を書き直す**ことになっていた。
 *
 * 【この基盤が引き受けるもの】
 * - **落ちない読み書き**(`safeParse` / `safeStringify`)
 * - **同じ内容なら同じ文字列**(`canonicalJson`。ハッシュ・冪等キーに使う)
 * - **深いマージ・差分・パス指定**(設定の重ね合わせ、監査ログ)
 * - **大きさの制限**(受け取った JSON が巨大でメモリを食うのを防ぐ)
 *
 * @packageDocumentation
 */

/** JSON として表せる値。 */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** JSON のオブジェクト。 */
export type JsonObject = { [key: string]: JsonValue };

/**
 * JSON を読む(**例外を投げない**)。
 *
 * `JSON.parse` は不正な入力で必ず例外を投げる。外部から来た文字列
 * (API 応答・Webhook・設定ファイル・DB の JSON 列)を扱うたびに
 * try/catch を書くことになるので、ここでまとめる。
 *
 * **失敗を握りつぶさない。** `undefined` が返ったら、
 * **呼び出し側で「壊れていた」と分かる形にすること**——
 * 既定値で先に進むと、**設定が読めていないまま動く**。
 *
 * @param text JSON 文字列
 * @returns 読めた値。**読めなければ undefined**
 *
 * @example
 * ```ts
 * const config = safeParse<Config>(raw);
 * if (config === undefined) throw new Error("設定ファイルが壊れています");
 * ```
 */
export function safeParse<T = JsonValue>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

/** {@link safeStringify} の設定。 */
export interface StringifyOptions {
  /** 字下げ(既定なし)。**人が読む用**で、通信には不要。 */
  indent?: number;
  /**
   * 循環参照が見つかったときの表示(既定 `"[Circular]"`)。
   *
   * **例外にしない。** ログを書く目的で呼ぶことが多く、
   * **ログを書こうとして落ちる**のが最悪の形。
   */
  circular?: string;
}

/**
 * JSON を書く(**例外を投げない**)。
 *
 * `JSON.stringify` が落ちる代表が 3 つあり、すべて扱う:
 *
 * - **循環参照** … `TypeError` で落ちる。ログ出力で最も多い
 * - **BigInt** … `TypeError` で落ちる。DB の集計結果に混ざる
 * - **`undefined`** … **キーごと消える**(落ちないが、項目が黙って欠ける)
 *
 * `Date` は ISO 文字列になる(`JSON.stringify` の既定と同じ)。
 *
 * @param value 書き出す値
 * @param options 字下げ・循環参照の表示
 * @returns JSON 文字列(**必ず文字列を返す**)
 *
 * @example
 * ```ts
 * const a = { name: "x" };
 * a.self = a;
 * safeStringify(a);  // '{"name":"x","self":"[Circular]"}'
 * ```
 */
export function safeStringify(value: unknown, options: StringifyOptions = {}): string {
  const circular = options.circular ?? "[Circular]";
  const seen = new WeakSet<object>();
  const replacer = (_key: string, v: unknown): unknown => {
    // **BigInt は文字列に。** そのままだと TypeError で落ちる
    if (typeof v === "bigint") return v.toString();
    if (typeof v === "object" && v !== null) {
      if (seen.has(v)) return circular;
      seen.add(v);
    }
    return v;
  };
  try {
    return JSON.stringify(value, replacer, options.indent) ?? "null";
  } catch {
    // ここに来るのは通常あり得ないが、**ログ出力で落とさない**ための保険
    return "null";
  }
}

/**
 * 決定的な JSON 文字列を作る(**キーを再帰的に並べ替える**)。
 *
 * **同じ内容なら必ず同じ文字列**になる。用途:
 *
 * - **ハッシュの計算**(監査ログのチェーン・電子帳簿保存法の改ざん検知)
 * - **冪等キー**(同じ内容の二重登録を防ぐ)
 * - **差分の比較**(「変わっていない」を正しく判定する)
 *
 * `JSON.stringify` はキーの**挿入順**で出すので、
 * 同じ内容でも作り方が違えば別の文字列になる——
 * **ハッシュが変わって「改ざんされた」と誤判定**する。
 *
 * @param value 対象の値
 * @returns 決定的な JSON 文字列
 *
 * @example
 * ```ts
 * canonicalJson({ b: 1, a: 2 }) === canonicalJson({ a: 2, b: 1 });  // true
 * JSON.stringify({ b: 1, a: 2 }) === JSON.stringify({ a: 2, b: 1 }); // false
 * ```
 */
export function canonicalJson(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (typeof v === "object" && v !== null) {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        out[k] = sort((v as Record<string, unknown>)[k]);
      }
      return out;
    }
    return v;
  };
  return safeStringify(sort(value));
}

/**
 * 大きさを確かめてから読む。
 *
 * **受け取った JSON が巨大だとメモリを食う。** 外部から来るもの
 * (Webhook・アップロード・API 応答)には上限を設けること——
 * **数百 MB の JSON を投げられると、それだけでサービスが止まる**。
 *
 * バイト数で数える(**文字数ではない**)。日本語は 1 文字 3 バイトなので、
 * 文字数で見ると 3 倍の量を通してしまう。
 *
 * @param text JSON 文字列
 * @param maxBytes 上限(既定 1MB)
 * @returns 読めた値。**大きすぎる・読めない場合は undefined**
 */
export function parseWithLimit<T = JsonValue>(text: string, maxBytes = 1024 * 1024): T | undefined {
  // **バイト数で数える**(日本語は 1 文字 3 バイト)
  if (new TextEncoder().encode(text).length > maxBytes) return undefined;
  return safeParse<T>(text);
}

/**
 * 2 つのオブジェクトを深くマージする。
 *
 * **設定の重ね合わせ**に使う(既定 → 環境ごと → 利用者ごと)。
 * 浅いマージ(`{ ...a, ...b }`)だと、入れ子のオブジェクトが
 * **丸ごと置き換わる**——既定値の一部だけ変えたいのに全部消える。
 *
 * **配列は置き換える**(結合しない)。設定では「この配列にする」という
 * 意味であることが多く、結合すると**既定値が混ざって消せない**。
 *
 * @param base 土台
 * @param override 上書き(**`undefined` の値は無視する**)
 * @returns マージした新しいオブジェクト(元は変更しない)
 *
 * @example
 * ```ts
 * deepMerge({ a: { x: 1, y: 2 } }, { a: { y: 3 } });
 * // => { a: { x: 1, y: 3 } }  (x は残る)
 * ```
 */
export function deepMerge<T extends JsonObject>(base: T, override: Partial<T>): T {
  const out: JsonObject = { ...base };
  for (const [k, v] of Object.entries(override)) {
    // **`undefined` は無視**(「指定なし」を「消す」と解釈しない)
    if (v === undefined) continue;
    const cur = out[k];
    if (
      typeof v === "object" && v !== null && !Array.isArray(v) &&
      typeof cur === "object" && cur !== null && !Array.isArray(cur)
    ) {
      out[k] = deepMerge(cur as JsonObject, v as JsonObject);
    } else {
      out[k] = v as JsonValue;
    }
  }
  return out as T;
}

/**
 * JSON Pointer(RFC 6901)で値を取り出す。
 *
 * **深い階層から 1 つの値を取る**のに使う。途中が欠けていれば
 * `undefined` を返す——`a.b.c.d` と書くと、**途中で欠けたときに例外**になる。
 *
 * `/` 区切りで、`~1` が `/`、`~0` が `~` を表す(仕様)。
 *
 * @param value 対象のオブジェクト
 * @param pointer `"/a/b/0/c"` の形
 * @returns 見つかった値。**無ければ undefined**
 *
 * @example
 * ```ts
 * getPointer(data, "/items/0/name");
 * ```
 */
export function getPointer(value: unknown, pointer: string): JsonValue | undefined {
  if (pointer === "") return value as JsonValue;
  let cur: unknown = value;
  for (const raw of pointer.split("/").slice(1)) {
    // **`~1` → `/`、`~0` → `~`**(仕様。順序を逆にすると壊れる)
    const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (Array.isArray(cur)) {
      const i = Number(key);
      if (!Number.isInteger(i) || i < 0 || i >= cur.length) return undefined;
      cur = cur[i];
    } else if (typeof cur === "object" && cur !== null) {
      if (!Object.prototype.hasOwnProperty.call(cur, key)) return undefined;
      cur = (cur as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return cur as JsonValue;
}

/** 差分の 1 件。 */
export interface JsonDiff {
  /** どこが変わったか(JSON Pointer)。 */
  path: string;
  /** 変更前(**追加なら undefined**)。 */
  before?: JsonValue;
  /** 変更後(**削除なら undefined**)。 */
  after?: JsonValue;
}

/**
 * 2 つの JSON を比べ、**変わった場所だけ**返す。
 *
 * **監査ログ・設定の変更履歴**に使う。オブジェクト全体を before/after で
 * 残すと、**ログが肥大化して差分も読めない**。
 *
 * 配列は**丸ごと 1 つの値**として比べる(要素ごとの差分は取らない)。
 * 順序の入れ替えを「全要素が変わった」と出すより、
 * 「この配列が変わった」の方が読みやすい。
 *
 * @param before 変更前
 * @param after 変更後
 * @param basePath 起点のパス(再帰用。通常は省略)
 * @returns 変わった場所(**変わっていなければ空配列**)
 *
 * @example
 * ```ts
 * diffJson({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 3 } });
 * // => [{ path: "/b/c", before: 2, after: 3 }]
 * ```
 */
export function diffJson(before: unknown, after: unknown, basePath = ""): JsonDiff[] {
  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);

  if (!isObj(before) || !isObj(after)) {
    // **正規化して比べる**(キーの順序で「変わった」と誤判定しない)
    if (canonicalJson(before) === canonicalJson(after)) return [];
    return [{ path: basePath, before: before as JsonValue, after: after as JsonValue }];
  }

  const out: JsonDiff[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of [...keys].sort()) {
    // **`~` と `/` を含むキーは変換する**(JSON Pointer の仕様)
    const path = `${basePath}/${k.replace(/~/g, "~0").replace(/\//g, "~1")}`;
    const b = before[k];
    const a = after[k];
    if (!(k in after)) {
      out.push({ path, before: b as JsonValue });
    } else if (!(k in before)) {
      out.push({ path, after: a as JsonValue });
    } else {
      out.push(...diffJson(b, a, path));
    }
  }
  return out;
}

/**
 * 指定したキーを伏せる(**再帰的**)。
 *
 * **ログや監査に出す前に通す。** パスワード・トークン・カード番号が
 * そのまま記録されると、**ログの閲覧権限がある全員に漏れる**。
 *
 * **キー名で判定する**(値は見ない)。`password` `token` `secret` のような
 * 名前を渡す想定。**部分一致**なので `passwordHash` も伏せられる。
 *
 * @param value 対象の値
 * @param keys 伏せるキー(**部分一致・大文字小文字を区別しない**)
 * @param mask 伏せ字(既定 `"***"`)
 * @returns 伏せた新しい値(元は変更しない)
 *
 * @example
 * ```ts
 * redactJson({ user: { name: "山田", passwordHash: "x" } }, ["password"]);
 * // => { user: { name: "山田", passwordHash: "***" } }
 * ```
 */
export function redactJson(value: unknown, keys: readonly string[], mask = "***"): JsonValue {
  const lower = keys.map((k) => k.toLowerCase());
  const walk = (v: unknown): JsonValue => {
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v === "object" && v !== null) {
      const out: JsonObject = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        // **部分一致**(`passwordHash` も `password` で伏せられる)
        out[k] = lower.some((x) => k.toLowerCase().includes(x)) ? mask : walk(val);
      }
      return out;
    }
    return v as JsonValue;
  };
  return walk(value);
}

/**
 * JSON Lines(1 行 1 JSON)を読む。
 *
 * **ログ・エクスポート・大きなデータの受け渡し**で使う形式。
 * 1 行ずつ独立しているので、**途中が壊れていても残りは読める**。
 *
 * **壊れた行は飛ばして数える。** 例外にすると 1 行のせいで全部が失われ、
 * 黙って飛ばすと**欠けたことに気づけない**。
 *
 * @param text JSON Lines の文字列
 * @returns 読めた行と、**壊れていた行の番号**(1 始まり)
 *
 * @example
 * ```ts
 * const { rows, invalidLines } = parseJsonLines(text);
 * if (invalidLines.length > 0) log.warn({ invalidLines }, "壊れた行があります");
 * ```
 */
export function parseJsonLines<T = JsonValue>(text: string): { rows: T[]; invalidLines: number[] } {
  const rows: T[] = [];
  const invalidLines: number[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = (lines[i] ?? "").trim();
    if (line === "") continue;
    const v = safeParse<T>(line);
    if (v === undefined) invalidLines.push(i + 1);
    else rows.push(v);
  }
  return { rows, invalidLines };
}

/**
 * JSON Lines を書き出す。
 *
 * **1 行ずつ独立させる**ので、追記できるし、途中で失敗しても
 * それまでの行は有効。大きな配列を 1 つの JSON にするより扱いやすい。
 *
 * @param rows 書き出す行
 * @returns JSON Lines の文字列(**末尾に改行を付ける**。追記しやすい)
 */
export function toJsonLines(rows: readonly unknown[]): string {
  if (rows.length === 0) return "";
  return rows.map((r) => safeStringify(r)).join("\n") + "\n";
}
