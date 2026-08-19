# apps側の型エラー、直すのはどっち?

**このアプリ(apps/)を開発中に `pnpm typecheck` が失敗したとき、
「自分のコードが間違っているのか、基盤(packages/)側の型が足りない
のか」が分からないことがある。** `tools/triage-boundary.mjs` はその
判断材料を出す。

## 使い方

```bash
# アプリのビルド/型検査を実行し、その出力をパイプで渡す
pnpm --filter internal-app typecheck 2>&1 | node tools/triage-boundary.mjs

# または、出力をファイルに保存してから渡す
pnpm --filter internal-app typecheck 2>&1 > /tmp/errors.txt
node tools/triage-boundary.mjs /tmp/errors.txt
```

## 何をしてくれるか

エラーを3つに分ける。

1. **基盤(packages/)側で発生** — エラーの発生行そのものが
   `packages/` 内。ここは基盤側の修正が要る。
2. **apps/ 側で発生・原因は基盤の型かもしれない** — エラー行は
   `apps/` にあるが、メッセージに出てくる型名が `packages/` で
   宣言されている。**その型の宣言元ファイルを表示する**ので、
   そこを見て「型が実態と合っているか」を確認できる。
3. **apps/ 側の問題** — 基盤の型は絡んでいない。アプリ側のコードで
   直す。

## 具体例(実際にこのセッションで見つかったもの)

`line-console` が `ai.complete({ ... })` を呼んでいたが、
`AiGateway`(`packages/ai/src/gateway.ts` で宣言)には `complete` と
いうメソッドが無く、正しくは `chat` だった。このツールに掛けると

```
━━━ apps/ 側で発生・原因は基盤の型かもしれない: 1 件 ━━━
  apps/line-console/.../route.ts:35 [TS2339] Property 'complete' does not exist on type 'AiGateway'.
    → 型 'AiGateway' の宣言元:
       packages/ai/src/gateway.ts
```

と出る。`packages/ai/src/gateway.ts` を開けば、`chat` という正しい
メソッド名にすぐ気づける。

## 限界(必ず読むこと)

**これは判断材料を出すだけで、自動判定ではない。** 「型が
packages/ にある」からといって、必ず基盤のバグとは限らない
——アプリ側の使い方が誤っているだけのことも多い(上の例も、実際は
`packages/ai` 側は正しく、`line-console` 側の呼び出し方が誤ってい
た)。**最終判断は人が行うこと。**

また、型名の抽出はエラーメッセージの単引用符(`'Xxx'`)を拾う簡易な
方法のため、複雑なジェネリック型やユニオン型では正しく拾えないこと
がある。

## 関連

- 基盤側だけの検査を飛ばして preflight を軽く回すには
  `node tools/preflight.mjs --apps-only` を使う
  (`docs/ops/CHECKS.md` 参照)。
