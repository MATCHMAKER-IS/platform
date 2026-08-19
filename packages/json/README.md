# @platform/json

JSON の安全な扱い（解析・整形・比較）。**壊れた入力で落ちません**。

## これは何のためか

**`JSON.parse` は壊れた入力で例外を投げます。**

外部から来たものを直接渡すと、**画面ごと落ちます**——
**ログを書こうとして落ちる**のが最も困ります。

## 使う前に知っておくこと

| | |
|---|---|
| **壊れていたら `undefined`** | 例外にはなりません——**呼び出し側で確かめて**ください |
| **`BigInt` は `JSON.stringify` で落ちます** | **DB の集計結果に混ざる**ことがあります——`safeStringify` を使ってください |
| **循環参照も落ちます** | オブジェクトが自分を参照すると**無限に辿ります** |
| **`canonicalJson` は鍵を並べ替えます** | 同じ中身なら**同じ文字列**になるので、**比較や署名**に使えます |
| **大きな JSON は上限を** | `parseWithLimit` で、**巨大な入力でメモリを食い潰さない**ようにできます |

## よく使うもの

```ts
import { safeParse, safeStringify, canonicalJson } from "@platform/json";
import { safeParse, safeStringify, canonicalJson, deepMerge, diffJson, redactJson } from "@platform/json";

safeParse<Config>(raw);              // 例外を投げない(壊れていれば undefined)
safeStringify(objWithCircular);      // 循環参照・BigInt でも落ちない
canonicalJson({ b: 1, a: 2 });       // キーを並べ替え(ハッシュ・冪等キー用)
deepMerge(defaults, overrides);      // 入れ子を保ったまま重ねる
diffJson(before, after);             // 変わった場所だけ
redactJson(data, ["password"]);      // ログに出す前に伏せる
```

## 標準の関数はそのままだと落ちる

`JSON.parse` は**不正な入力で必ず例外**を投げます。外部から来る文字列
(API 応答・Webhook・設定ファイル・DB の JSON 列)を扱うたびに
try/catch を書くことになります。

`JSON.stringify` が落ちる代表は 3 つです。

| 原因 | 何が起きるか |
|---|---|
| 循環参照 | `TypeError` で落ちる(**ログ出力で最も多い**) |
| BigInt | `TypeError` で落ちる(DB の集計結果に混ざる) |
| `undefined` | **キーごと消える**(落ちないが項目が黙って欠ける) |

**ログを書こうとして落ちる**のが最悪の形なので、`safeStringify` は必ず文字列を返します。

## 同じ内容なら同じ文字列

`JSON.stringify` はキーの**挿入順**で出すので、同じ内容でも作り方が違えば
別の文字列になります——**ハッシュが変わって「改ざんされた」と誤判定**します。

`canonicalJson` はキーを再帰的に並べ替えるので、ハッシュ・冪等キー・差分の比較に使えます。

## 大きさの制限

外部から来る JSON には上限を設けてください。
**数百 MB の JSON を投げられると、それだけでサービスが止まります**。

```ts
parseWithLimit(body, 1024 * 1024);  // 1MB を超えたら undefined
```

**バイト数で数えます**(文字数ではありません)。日本語は 1 文字 3 バイトなので、
文字数で見ると 3 倍の量を通してしまいます。

## JSON Lines

1 行 1 JSON の形式です。ログ・エクスポート・大きなデータの受け渡しで使います。

```ts
const { rows, invalidLines } = parseJsonLines(text);
if (invalidLines.length > 0) log.warn({ invalidLines }, "壊れた行があります");
```

**壊れた行は飛ばして数えます。** 例外にすると 1 行のせいで全部が失われ、
黙って飛ばすと**欠けたことに気づけません**。
