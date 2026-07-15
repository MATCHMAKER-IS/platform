# @platform/color

色ユーティリティ(純関数)。hex⇔rgb⇔hsl 変換・WCAG コントラスト比・明暗調整・混色。
テーマ生成やアクセシビリティ検証に使います。

```ts
import { contrastRatio, wcagLevel, lighten, mix } from "@platform/color";

contrastRatio("#111111", "#ffffff"); // 18.9(背景と文字色の可読性チェック)
wcagLevel("#767676", "#ffffff");     // "AA"
lighten("#2563eb", 0.2);             // 明るくした色
mix("#ff0000", "#0000ff", 0.5);      // 紫
```

外部依存なし。UI テーマ色の自動生成や、フォーム文字色のコントラスト検証に。
