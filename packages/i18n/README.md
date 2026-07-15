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
