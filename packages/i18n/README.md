# @platform/i18n

多言語（ja / en / ko / zh）。**外国籍の従業員がいる会社**向けです。

## これは何のためか

**日本語しか出ない画面は、読めない人には使えません。**

技能実習生・外国籍の社員がいる会社では、
**勤怠や経費の画面が読めないと、業務が止まります**。

## 使う前に知っておくこと

| | |
|---|---|
| **辞書はドメインごとに分ける** | 1 つにまとめると、**誰がどこを直してよいか分からなくなります** |
| **同じキーは後勝ち** | 読み込む順で結果が変わります——**上書きするつもりで並べて**ください |
| **訳の抜けは検査で見つかります** | `pnpm i18n:check` を回してください |
| **日付と金額は言語で形が変わる** | `formatDateJst` / `formatYen` はロケールを受け取れます——**手で組まないでください** |
| **機械翻訳をそのまま使わない** | 「承認」が「許可」になるなど、**業務の言葉がずれます** |

## よく使うもの

```ts
import { createI18n, mergeCatalogs, namespaced } from "@platform/i18n";
import { createI18n } from "@platform/i18n";

const i18n = createI18n({
  locale: "ja",
  catalogs: { ja: { greeting: "こんにちは、{name}さん" }, en: { greeting: "Hello, {name}" } },
});

i18n.t("greeting", { name: "山田" }); // "こんにちは、山田さん"
i18n.formatCurrency(1980, "JPY");     // "￥1,980"
i18n.formatRelativeTime(-3, "day");   // "3 日前"
```

キー欠落は既定ロケールへフォールバック。CI の i18n-check で未翻訳キーを検出します。

## 基盤 UI の共通文言(`@platform/i18n/catalogs`)

`@platform/ui` などの基盤部品が使う文言(日英中韓)を束ねたカタログです。
アプリ固有の文言は、これに `mergeCatalogs` で重ねるか名前空間を切って足します。

```ts
import { uiCatalogs } from "@platform/i18n/catalogs";
import { createI18n, mergeCatalogs } from "@platform/i18n";

const i18n = createI18n({ locale: "ja", catalogs: mergeCatalogs(uiCatalogs, appCatalogs) });
```

バレルから出していないのは、**アプリ側の文言と混ざらないようにする**ためです
(基盤の文言はアプリが上書きしうるので、重ねる順序を呼び出し側に決めさせます)。
