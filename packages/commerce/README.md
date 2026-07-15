# @platform/commerce

EC サイトの基盤処理。カート・お気に入り・クーポン割引・注文サマリ(消費税/送料)・在庫引当の
純ロジック部品。保存や画面はアプリ側、決済は `@platform/stripe`/`@platform/paypal`、
消費税は `@platform/tax`、注文番号は `@platform/sequence`、注文ステータスは `@platform/fsm` と組み合わせます。

## カート
```ts
import { emptyCart, addToCart, setQuantity, cartSubtotal, cartItemCount, mergeCarts } from "@platform/commerce";

let cart = addToCart(emptyCart(), { productId: "A", name: "商品A", unitPrice: 1000, sku: "SKU-A" });
cart = addToCart(cart, { productId: "B", name: "商品B", unitPrice: 500, quantity: 2 });
cartItemCount(cart);   // 3(総点数)
cartSubtotal(cart);    // 2000
cart = mergeCarts(userCart, guestCart);   // ログイン時にゲストカートを統合(同一商品は加算)
```
不変操作(新しいカートを返す)なので React state とそのまま相性が良いです。任意フィールド(SKU/オプション)も保持されます。

## お気に入り・最近見た商品
```ts
import { toggleFavorite, isFavorite, pushRecentlyViewed } from "@platform/commerce";
favorites = toggleFavorite(favorites, productId);
const recent = pushRecentlyViewed(recent, productId, 20);   // 重複除去・新しい順・最大20件
```

## クーポン・割引
```ts
import { computeDiscount, applyDiscount } from "@platform/commerce";
computeDiscount({ code: "SPRING", type: "percentage", value: 10, maxDiscount: 1000 }, 3000);  // 300(上限考慮)
computeDiscount({ code: "OFF500", type: "fixed", value: 500, minPurchase: 5000 }, 3000);       // 0(最低購入額未満)
```
定率/定額、最低購入額、割引上限に対応。小計を超える割引はしません。

## 注文サマリ(消費税・送料)
```ts
import { buildOrderSummary, resolveShippingFee } from "@platform/commerce";
const shipping = resolveShippingFee(subtotal, 5000, 550);   // 5000円以上で送料無料
const summary = buildOrderSummary({ subtotal, discount, shippingFee: shipping, taxRate: 10, taxMode: "exclusive" });
// summary.discountedSubtotal / tax / shippingFee / total
```
外税/内税、軽減税率(8%)に対応。消費税計算は `@platform/tax` に委ねています。

## 在庫引当
```ts
import { reserveStock, commitStock, releaseStock, canFulfill } from "@platform/commerce";
const { ok, shortages } = canFulfill(stockMap, orderLines);   // カート全体の在庫判定
const r = reserveStock(level, qty);      // 決済前に引当(available減・reserved増)
commitStock(r.level, qty);               // 出荷/決済完了で確定
releaseStock(r.level, qty);              // キャンセルで解放
```
すべて純ロジックで検証済み。

## 商品バリエーション(サイズ・色など)
```ts
import { findVariant, availableValues, priceRange } from "@platform/commerce";
findVariant(variants, { サイズ: "M", 色: "青" });          // 選択に一致する SKU
availableValues(variants, "サイズ", { 色: "青" });          // 色=青で在庫のあるサイズ(売切れは除外)
priceRange(variants);                                       // { min, max } 価格帯表示
```

## レビュー・評価
```ts
import { ratingSummary } from "@platform/commerce";
const s = ratingSummary([5, 5, 4, 3, 1]);   // { average, count, distribution, percentages } 星の分布バー用
```

## 注文ステータス
```ts
import { canTransition, nextStatuses, isCancellable, ORDER_STATUS_LABELS } from "@platform/commerce";
canTransition("paid", "shipped");     // 未払い→支払い→処理中→発送→配達完了 / キャンセル・返金
nextStatuses("paid");                 // 次に選べるステータス(管理画面のボタン)
```

## ポイント(ロイヤルティ)
```ts
import { earnPoints, pointsBalance, redeemPoints } from "@platform/commerce";
earnPoints(1980);                          // 19pt(1%・端数切捨)
pointsBalance(transactions);               // 失効を考慮した残高
redeemPoints(balance, 300, orderAmount);   // 注文額を上限に利用
```

## 送料計算(地域別・重量別)
```ts
import { shippingFeeForRegion, weightBasedFee } from "@platform/commerce";
shippingFeeForRegion(zones, "北海道", subtotal);   // エリア別送料 + エリア別無料閾値
weightBasedFee(totalWeight(items), tiers);         // 重量段階の送料
```

