# @platform/html

HTML/テキストのヘルパー（すべて純関数）。

- **エスケープ**: `escapeHtml` / `unescapeHtml` / `stripTags`
- **空白・改行**: `normalizeNewlines`（CRLF→LF）/ `nl2br`（改行→`<br>`）/ `collapseWhitespace` / `normalizeSpace`（全角空白→半角＋連続空白圧縮＋trim）/ `stripControlChars`
- **全角⇔半角**: `zenkakuToHankaku` / `hankakuToZenkaku` / `zenkakuSpaceToHankaku` / `zenkakuDigitsToHankaku`
- **テキスト→HTML**: `textToHtml`（エスケープ＋`nl2br`＝XSS 安全）/ `truncate`（`…` 付き）/ `linkify`（URL を安全に `<a>` 化）

例:
```ts
import { textToHtml, normalizeSpace, zenkakuToHankaku } from "@platform/html";
textToHtml("行1\n<b>タグ</b>");        // "行1<br>\n&lt;b&gt;タグ&lt;/b&gt;"
normalizeSpace("　 Ａ　　Ｂ ");         // "Ａ Ｂ"
zenkakuToHankaku("０９０１２３４");      // "0901234"
```
