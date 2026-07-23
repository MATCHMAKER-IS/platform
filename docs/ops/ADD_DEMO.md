# デモを 1 本足す

統合デモサイト（`demos/showcase`）に画面を追加する手順です。

**5 か所を更新する必要があり、1 つでも忘れると検査が落ちます。**
逆に言えば、忘れても機械が教えてくれます。

## 手順

### 1. 画面を作る

```
demos/showcase/src/app/<名前>/page.tsx
```

- `@platform/ui` の部品を使う（生タグを書くと `check-app-rules` が落ちる）
- タブに分けたいときは `<名前>/xxx-demo.tsx` を作って `page.tsx` から読む

### 2. 一覧に登録する

`demos/showcase/src/lib/nav.ts` の `PLATFORM_DEMOS` に追加します。
**同じ `group` の並びの中に入れる**こと（散らばると一覧が読みにくくなります）。

```ts
{ href: "/<名前>", title: "画面の名前", desc: "何ができるかを一行で",
  packages: ["使っている基盤"], group: "業務ドメイン" },
```

### 3. 概要を書く

`demos/showcase/src/lib/overviews.ts` に、**初めて見る人向け**の説明を足します。
何のための機能で、どこが要点かを 2〜3 文で。

### 4. 件数を更新する

`tools/smoke.mjs` の 2 か所（同じ数字が 4 つ）を +1 します。

```
"loadDemos: 統合デモサイトの nav.ts から{N}デモを読む"
"nav: 基盤デモ{P}・アプリデモ7・使用例9 = {N}件"
```

`docs/APPS_AND_DEMOS.md` の本数も更新します（`check-doc-numbers` が検知します）。

### 5. 確認する

```bash
node tools/preflight.mjs
```

## 忘れやすいところ

| 忘れると | 何が落ちるか |
|---|---|
| nav.ts への登録 | `check-build-ready`（ページがあるのにメニューから辿れない） |
| 件数の更新 | `smoke`（loadDemos の件数が合わない） |
| 資料の本数 | `check-doc-numbers` |
| 新しい基盤パッケージを使った | `check-showcase-deps`（`transpilePackages` の漏れ） |

**どれも preflight が具体的に教えてくれます。** 手順を覚えていなくても、
落ちたメッセージに従えば直せます。

## 既存のデモにタブを足す場合

1〜3 は不要です。`<名前>/新しいタブ-demo.tsx` を作り、`page.tsx` の `TABS` に足すだけ。
件数も変わりません。

## 迷ったら

似たデモのコードを読むのが一番速いです。

| やりたいこと | 参考になるデモ |
|---|---|
| 一覧・登録・編集・削除 | `/master` |
| タブで複数の内容をまとめる | `/device`・`/login` |
| 基盤の関数をその場で動かす | `/net`・`/calendar` |
| サーバ側の処理を呼ぶ | `/connect`・`/assistant` |
