# @platform/html

HTML の無害化と組み立て。**利用者の入力をそのまま出さない**ためのものです。

## これは何のためか

**利用者が書いた文字に `<script>` が入っていたら、それが動きます。**

掲示板の投稿、お知らせの本文、コメント——
**どこから来た文字か分からないものは、必ず通してください**。

## 使う前に知っておくこと

| | |
|---|---|
| **場所によって変換するものが違います** | 要素の中身では `>` も変換します（**`>` がタグを閉じるため**）。属性の中では `"` も——**用途に合った関数**を選んでください |
| **URL は信頼できるものだけ** | `javascript:` で始まる URL は**リンクを押しただけで動きます** |
| **消すのは表示前に** | 保存時に消すと、**元が何だったか分からなくなります** |
| **自分で正規表現を書かない** | 「`<script>` を消せばよい」では**足りません**——`<img onerror=...>` でも動きます |

## よく使うもの

```ts
import { escapeAttribute, embedScript, inlineScript } from "@platform/html";
import { textToHtml, normalizeSpace, zenkakuToHankaku } from "@platform/html";
textToHtml("行1\n<b>タグ</b>");        // "行1<br>\n&lt;b&gt;タグ&lt;/b&gt;"
normalizeSpace("　 Ａ　　Ｂ ");         // "Ａ Ｂ"
zenkakuToHankaku("０９０１２３４");      // "0901234"
```
