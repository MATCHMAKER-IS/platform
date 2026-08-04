# @platform/i18n

軽量 i18n。翻訳カタログ + 補間 + フォールバック + Intl 整形(数値/通貨/日付/相対時間/複数形)。
日本語(ja)を既定に、多言語 UI を最小構成で実現します。

```ts
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
