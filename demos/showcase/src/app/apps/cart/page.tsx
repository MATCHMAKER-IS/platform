"use client";
/**
 * EC カートのデモ。自社サイトで商品を売るときの計算を @platform/commerce に任せる。
 *
 * UI は **@platform/ui の部品だけ**で組む(CLAUDE.md「UI 部品は @platform/ui を使う」)。
 */
import * as React from "react";
import { Button, Input, Select, Badge, Alert, Separator } from "@platform/ui";
import {
  emptyCart,
  addToCart,
  setQuantity,
  removeFromCart,
  clearCart,
  lineTotal,
  cartSubtotal,
  cartItemCount,
  cartUniqueCount,
  isCartEmpty,
  isCouponApplicable,
  computeDiscount,
  buildOrderSummary,
  resolveZone,
  shippingFeeForRegion,
  qualifiesForFreeShipping,
  amountUntilFreeShipping,
  earnPoints,
  type Cart,
  type Coupon,
  type ShippingZone,
  type OrderSummary,
  type TaxMode,
} from "@platform/commerce";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const yen = (n: number) => `¥${n.toLocaleString()}`;

/** 商品カタログ（自社サイトの商品）。 */
const PRODUCTS = [
  { productId: "nb-a5", name: "オリジナルノート A5", unitPrice: 480, taxRate: 10 },
  { productId: "pen-3", name: "3色ボールペン", unitPrice: 220, taxRate: 10 },
  { productId: "mug", name: "ロゴマグカップ", unitPrice: 1800, taxRate: 10 },
  { productId: "book", name: "技術書（軽減税率対象外）", unitPrice: 2800, taxRate: 10 },
  { productId: "tote", name: "キャンバストート", unitPrice: 2400, taxRate: 10 },
];

/**
 * 送料は**エリア単位**。都道府県ごとに持たない。
 * 北海道・沖縄が高いのは現実で、基盤の `ShippingZone` はそれを前提にしている。
 */
const ZONES: ShippingZone[] = [
  { name: "本州・四国・九州", regions: ["東京", "大阪", "愛知", "福岡", "広島"], fee: 500, freeThreshold: 5000 },
  { name: "北海道・沖縄", regions: ["北海道", "沖縄"], fee: 1200, freeThreshold: 10000 },
];
const REGIONS = [...ZONES.flatMap((z) => z.regions), "福井"]; // 福井 = 送料表に無い県

const COUPONS: Coupon[] = [
  { code: "SAVE10", type: "percentage", value: 10, minPurchase: 3000, maxDiscount: 1000 },
  { code: "OFF500", type: "fixed", value: 500, minPurchase: 2000 },
];

export default function Page() {
  const [cart, setCart] = React.useState<Cart>(() => {
    let c = emptyCart();
    c = addToCart(c, { productId: "nb-a5", name: "オリジナルノート A5", unitPrice: 480, quantity: 3 });
    c = addToCart(c, { productId: "mug", name: "ロゴマグカップ", unitPrice: 1800, quantity: 1 });
    return c;
  });
  const [region, setRegion] = React.useState("東京");
  const [couponCode, setCouponCode] = React.useState("SAVE10");
  const [taxMode, setTaxMode] = React.useState<TaxMode>("exclusive");

  const subtotal = cartSubtotal(cart);
  const zone = resolveZone(ZONES, region);
  const coupon = COUPONS.find((c) => c.code === couponCode);
  const applicable = coupon ? isCouponApplicable(coupon, subtotal) : false;
  const discount = coupon && applicable ? computeDiscount(coupon, subtotal) : 0;

  // 送料表に無い県は fallback。**注文を止めない**のが基盤の判断。
  const shippingFee = shippingFeeForRegion(ZONES, region, subtotal, 800);
  const threshold = zone?.freeThreshold ?? 0;
  const isFree = threshold > 0 && qualifiesForFreeShipping(subtotal, threshold);
  const until = threshold > 0 ? amountUntilFreeShipping(subtotal, threshold) : 0;

  const summary: OrderSummary = buildOrderSummary({ subtotal, discount, shippingFee, taxRate: 10, taxMode });
  const points = earnPoints(summary.total, 0.01);

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>EC カート</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        自社サイトで商品を売るときの計算です。<strong>金額の計算をアプリで書くと必ずずれます</strong>
        （割引を送料の後に引く、税を二重に掛ける、など）。
        <code>@platform/commerce</code> は<strong>小計 → 割引 → 送料 → 税</strong>の順を守ります。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>商品</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
          {PRODUCTS.map((p) => (
            <div key={p.productId} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 10, background: "var(--color-bg)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: "var(--color-muted)", margin: "4px 0 8px" }}>{yen(p.unitPrice)}</div>
              <Button size="sm" onClick={() => setCart((c) => addToCart(c, { productId: p.productId, name: p.name, unitPrice: p.unitPrice, quantity: 1 }))}>
                カートに入れる
              </Button>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 10 }}>
          <strong>同じ商品を 2 回入れると数量が増えます</strong>（`addToCart` が `productId` で同一判定するため）。
          行が 2 つに増えることはありません。
        </p>
      </div>

      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
            カート
            <Badge variant="secondary" style={{ marginLeft: 8 }}>
              {cartItemCount(cart)} 点 / {cartUniqueCount(cart)} 商品
            </Badge>
          </h2>
          <Button size="sm" variant="secondary" onClick={() => setCart(clearCart())} disabled={isCartEmpty(cart)}>
            空にする
          </Button>
        </div>

        {isCartEmpty(cart) ? (
          <Alert variant="info" title="カートは空です">
            上の商品を入れてください。
          </Alert>
        ) : (
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
                <th style={{ padding: 5 }}>商品</th>
                <th style={{ padding: 5, textAlign: "right" }}>単価</th>
                <th style={{ padding: 5 }}>数量</th>
                <th style={{ padding: 5, textAlign: "right" }}>小計</th>
                <th style={{ padding: 5 }}></th>
              </tr>
            </thead>
            <tbody>
              {cart.items.map((i) => (
                <tr key={i.productId} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 5 }}>{i.name}</td>
                  <td style={{ padding: 5, textAlign: "right" }}>{yen(i.unitPrice)}</td>
                  <td style={{ padding: 5, width: 90 }}>
                    <Input
                      type="number"
                      value={String(i.quantity)}
                      onChange={(e) => setCart((c) => setQuantity(c, i.productId, Number(e.target.value)))}
                      style={{ width: 76, textAlign: "right" }}
                    />
                  </td>
                  <td style={{ padding: 5, textAlign: "right", fontWeight: 700 }}>{yen(lineTotal(i))}</td>
                  <td style={{ padding: 5 }}>
                    <Button size="sm" variant="ghost" onClick={() => setCart((c) => removeFromCart(c, i.productId))}>
                      削除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 10 }}>
          <strong>数量を 0 にすると行ごと消えます</strong>（`setQuantity` が 0 以下を削除として扱う）。
          「0 個の商品がカートに残る」を防ぐためです。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>配送とクーポン</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>お届け先</div>
            <Select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              options={REGIONS.map((r) => ({ label: r, value: r }))}
              style={{ width: 120 }}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>クーポン</div>
            <Select
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              options={[{ label: "使わない", value: "" }, ...COUPONS.map((c) => ({ label: `${c.code}（${c.type === "percentage" ? `${c.value}%` : yen(c.value)}）`, value: c.code }))]}
              style={{ width: 190 }}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>税の扱い</div>
            <Select
              value={taxMode}
              onChange={(e) => setTaxMode(e.target.value === "inclusive" ? "inclusive" : "exclusive")}
              options={[{ label: "外税", value: "exclusive" }, { label: "内税", value: "inclusive" }]}
              style={{ width: 100 }}
            />
          </label>
        </div>

        <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.9 }}>
          エリア: <b style={{ color: "var(--color-fg)" }}>{zone?.name ?? "送料表に無い地域"}</b>
          {zone === undefined && <>（<b>{yen(800)}</b> の既定送料を使います）</>}
          <br />
          {threshold > 0 &&
            (isFree ? (
              <span style={{ color: "var(--color-success)" }}>
                <b>送料無料です</b>（{yen(threshold)} 以上）
              </span>
            ) : (
              <>
                あと <b style={{ color: "var(--color-warning)" }}>{yen(until)}</b> で送料無料（{yen(threshold)} 以上）
              </>
            ))}
        </div>

        {coupon !== undefined && !applicable && (
          <Alert variant="warning" title={`${coupon.code} は使えません`} style={{ marginTop: 10 }}>
            <span style={{ fontSize: 12 }}>
              最低購入額 {yen(coupon.minPurchase ?? 0)} に対して、小計が {yen(subtotal)} です。
              <strong>`isCouponApplicable()` が false を返すので、割引は 0 になります。</strong>
            </span>
          </Alert>
        )}
      </div>

      <div style={{ ...box, borderColor: "var(--color-primary)" }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>ご注文内容</h2>
        <div style={{ maxWidth: 380, marginLeft: "auto", fontSize: 13 }}>
          {[
            { label: "小計", value: summary.subtotal },
            ...(summary.discount > 0 ? [{ label: `割引（${couponCode}）`, value: -summary.discount }] : []),
            { label: "割引後小計", value: summary.discountedSubtotal, muted: true },
            { label: `送料（${zone?.name ?? "既定"}）`, value: summary.shippingFee },
            { label: `消費税 10%（${taxMode === "exclusive" ? "外税" : "内税"}）`, value: summary.tax },
          ].map((r) => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: r.muted === true ? "var(--color-muted)" : undefined }}>
              <span>{r.label}</span>
              <span>{r.value < 0 ? `-${yen(-r.value)}` : yen(r.value)}</span>
            </div>
          ))}
          <Separator style={{ margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700 }}>
            <span>合計</span>
            <span>{yen(summary.total)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-success)", marginTop: 4 }}>
            <span>獲得ポイント（1%）</span>
            <span>{points} pt</span>
          </div>
        </div>

        <Alert variant="info" title="計算の順序が固定されています" style={{ marginTop: 14 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            <strong>小計 → 割引 → 送料 → 税</strong>。この順序を変えると金額が変わります。
            割引を送料の後に引けば送料にも割引がかかり、税を先に計算すれば二重になります。
            <br />
            <code>buildOrderSummary()</code> の TSDoc にも
            <strong>「順序を変えると金額が変わる」</strong>と明記されています。
            <strong>各アプリで書くと、店舗ごとに合計額が違う</strong>という事故になります。
          </span>
        </Alert>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>試してみてください</h2>
        <ul style={{ fontSize: 13, lineHeight: 2, margin: 0, paddingLeft: "1.2em", color: "var(--color-muted)" }}>
          <li>
            <strong>お届け先を「北海道」に</strong> → 送料 {yen(500)} → {yen(1200)}。
            <strong>送料無料の閾値も {yen(5000)} → {yen(10000)} に変わります</strong>（エリアごとに持つため）
          </li>
          <li>
            <strong>「福井」に</strong> → 送料表に無いので既定の {yen(800)}。
            <strong>注文を止めません</strong>（`shippingFeeForRegion` の TSDoc:「未知の都道府県なら既定の送料」）
          </li>
          <li>
            <strong>カートを空に近づける</strong> → クーポンの最低購入額を割ると <b>割引が 0</b> になります
          </li>
          <li>
            <strong>SAVE10（10%・上限 {yen(1000)}）で {yen(20000)} 買う</strong> → 割引は {yen(2000)} ではなく
            <b>{yen(1000)}</b>（`maxDiscount` が効く）
          </li>
          <li>
            <strong>税の扱いを「内税」に</strong> → 合計は変わらず、<b>税額の内訳だけ変わります</b>
          </li>
        </ul>
      </div>
    </main>
  );
}
