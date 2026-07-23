"use client";
/** 変換ユーティリティのデモ: 電話番号(E.164)・通貨・単位。小粒な部品を 1 枚にまとめたもの。 */
import * as React from "react";
import { Button, Input, Select } from "@platform/ui";
import { toE164, fromE164, formatJpPhone, isValidJpPhone, phoneType, maskPhone, normalizePhone, detectCountry } from "@platform/phone";
import { money, formatMoney, convert, addMoney, sumMoney, totalInBaseCurrency, currencyMeta, type Money } from "@platform/currency";
import {
  convertLength,
  convertWeight,
  convertArea,
  convertVolume,
  convertTemperature,
  round,
  type LengthUnit,
  type AreaUnit,
  type TempUnit,
} from "@platform/units";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const field: React.CSSProperties = {
  height: 36,
  padding: "0 10px",
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-fg)",
  fontSize: 13,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 13 };

const PHONE_TYPE_LABEL: Record<string, string> = {
  mobile: "携帯",
  landline: "固定",
  "toll-free": "フリーダイヤル", // ハイフン。toll_free ではラベルが引けず空欄になる
  ip: "IP電話",
  unknown: "不明",
};

const PHONE_SAMPLES = ["03-1234-5678", "090-1234-5678", "0120-123-456", "050-1234-5678", "０９０－１２３４－５６７８", "12345"];

const RATES: Record<string, number> = { JPY: 1, USD: 157.2, EUR: 170.4 };

export function ConvertersDemo() {
  // ── 電話番号 ──
  const [phone, setPhone] = React.useState("03-1234-5678");
  const normalized = normalizePhone(phone);
  const valid = isValidJpPhone(phone);
  const e164 = valid ? toE164(phone) : null;
  const kind = phoneType(phone);

  // ── 通貨 ──
  const [amount, setAmount] = React.useState(100);
  const [from, setFrom] = React.useState<"JPY" | "USD" | "EUR">("USD");
  const src: Money = money(amount, from);
  const converted = convert(src, "JPY", RATES[from] ?? 1);
  const basket: Money[] = [money(1200, "JPY"), money(35.5, "USD"), money(20, "EUR")];
  const basketTotal = totalInBaseCurrency(basket, "JPY", RATES);
  // 同一通貨なら足せる。**通貨が混ざると null**(型が Money | null なので握り潰せない)
  const jpyOnly = sumMoney([money(1200, "JPY"), money(800, "JPY")]);
  const mixed = sumMoney([money(1200, "JPY"), money(10, "USD")]);
  const addOk = addMoney(money(1200, "JPY"), money(800, "JPY"));
  const addNg = addMoney(money(1200, "JPY"), money(10, "USD"));

  // ── 単位 ──
  const [len, setLen] = React.useState(1);
  const [lenFrom, setLenFrom] = React.useState<LengthUnit>("m");
  const [lenTo, setLenTo] = React.useState<LengthUnit>("ft");
  const [area, setArea] = React.useState(100);
  const [areaFrom, setAreaFrom] = React.useState<AreaUnit>("m2");
  const [areaTo, setAreaTo] = React.useState<AreaUnit>("tsubo");
  const [temp, setTemp] = React.useState(25);
  const [tempFrom, setTempFrom] = React.useState<TempUnit>("C");
  const [tempTo, setTempTo] = React.useState<TempUnit>("F");

  const LENGTHS: LengthUnit[] = ["mm", "cm", "m", "km", "in", "ft", "yd", "mi"];
  const AREAS: AreaUnit[] = ["cm2", "m2", "km2", "ha", "tsubo", "jo", "acre"];
  const TEMPS: TempUnit[] = ["C", "F", "K"];

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>変換ユーティリティ</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        電話番号・通貨・単位。<strong>どれも「自分で書けそう」に見えて、必ず端で間違える</strong>ものです。
        全角の混入、通貨ごとの小数桁、坪の換算。基盤に置いて 1 箇所で直せるようにしています。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>電話番号（E.164）</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} style={{ ...field, minWidth: 200 }} />
          {PHONE_SAMPLES.map((s) => (
            <Button
              key={s}
              onClick={() => setPhone(s)}
              style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-muted)", cursor: "pointer" }}
            >
              {s}
            </Button>
          ))}
        </div>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            {[
              { k: "正規化", v: normalized, note: "全角・記号を吸収" },
              { k: "妥当性", v: valid ? "○ 有効" : "× 無効", note: "桁数と先頭番号で判定" },
              { k: "種別", v: PHONE_TYPE_LABEL[kind] ?? kind, note: "携帯/固定/フリーダイヤル/IP" },
              { k: "表示用", v: valid ? formatJpPhone(phone) : "—", note: "ハイフンを正しい位置に" },
              { k: "E.164", v: e164 ?? "—", note: "国際標準。DB にはこの形で保存する" },
              { k: "E.164 → 国内", v: e164 !== null ? fromE164(e164) : "—", note: "戻せる" },
              { k: "国番号", v: e164 !== null ? (detectCountry(e164) ?? "—") : "—", note: "" },
              { k: "マスク", v: maskPhone(phone), note: "画面・ログ用" },
            ].map((r) => (
              <tr key={r.k} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5, width: 110, color: "var(--color-muted)" }}>{r.k}</td>
                <td style={{ padding: 5, ...mono, fontWeight: 700 }}>{r.v}</td>
                <td style={{ padding: 5, fontSize: 11, color: "var(--color-muted)" }}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>全角の <code>０９０－１２３４－５６７８</code> を押してみてください。</strong>
          利用者は普通に全角で入力してきます。これを各アプリで弾くと「なぜか登録できない」問い合わせになります。
          <br />
          <strong>DB には E.164 で保存する</strong>のが要点です。表示形式で保存すると、
          <code>03-1234-5678</code> と <code>0312345678</code> が別レコードになって名寄せできません。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>通貨</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} style={{ ...field, width: 120, textAlign: "right" }} />
          <select value={from} onChange={(e) => setFrom(e.target.value as "JPY" | "USD" | "EUR")} style={{ ...field, width: 90 }}>
            {["JPY", "USD", "EUR"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span style={{ color: "var(--color-muted)" }}>→</span>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{formatMoney(converted)}</span>
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>（レート {RATES[from]}）</span>
        </div>

        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            <tr style={{ borderTop: "1px solid var(--color-border)" }}>
              <td style={{ padding: 5, width: 150, color: "var(--color-muted)" }}>元の表示</td>
              <td style={{ padding: 5, ...mono, fontWeight: 700 }}>{formatMoney(src)}</td>
              <td style={{ padding: 5, fontSize: 11, color: "var(--color-muted)" }}>
                {from} の小数桁は {currencyMeta(from).decimals}（JPY は 0、USD/EUR は 2）
              </td>
            </tr>
            <tr style={{ borderTop: "1px solid var(--color-border)" }}>
              <td style={{ padding: 5, color: "var(--color-muted)" }}>同一通貨の合算</td>
              <td style={{ padding: 5, ...mono, fontWeight: 700 }}>{jpyOnly !== null ? formatMoney(jpyOnly) : "null"}</td>
              <td style={{ padding: 5, fontSize: 11, color: "var(--color-muted)" }}>
                <code>sumMoney([¥1,200, ¥800])</code>
              </td>
            </tr>
            <tr style={{ borderTop: "1px solid var(--color-border)" }}>
              <td style={{ padding: 5, color: "var(--color-muted)" }}>通貨が混ざった合算</td>
              <td style={{ padding: 5, ...mono, fontWeight: 700, color: mixed === null ? "var(--color-danger)" : undefined }}>
                {mixed !== null ? formatMoney(mixed) : "null"}
              </td>
              <td style={{ padding: 5, fontSize: 11, color: "var(--color-muted)" }}>
                <code>sumMoney([¥1,200, $10])</code> → <b>足せないので null</b>
              </td>
            </tr>
            <tr style={{ borderTop: "1px solid var(--color-border)" }}>
              <td style={{ padding: 5, color: "var(--color-muted)" }}>addMoney（同一 / 混在）</td>
              <td style={{ padding: 5, ...mono, fontWeight: 700 }}>
                {addOk !== null ? formatMoney(addOk) : "null"} /{" "}
                <span style={{ color: addNg === null ? "var(--color-danger)" : undefined }}>{addNg !== null ? formatMoney(addNg) : "null"}</span>
              </td>
              <td style={{ padding: 5, fontSize: 11, color: "var(--color-muted)" }}>2 つ足すときも同じ</td>
            </tr>
            <tr style={{ borderTop: "1px solid var(--color-border)" }}>
              <td style={{ padding: 5, color: "var(--color-muted)" }}>混在カゴの合計</td>
              <td style={{ padding: 5, ...mono, fontWeight: 700 }}>{formatMoney(basketTotal)}</td>
              <td style={{ padding: 5, fontSize: 11, color: "var(--color-muted)" }}>¥1,200 + $35.50 + €20 を JPY 換算</td>
            </tr>
          </tbody>
        </table>

        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>通貨ごとに小数桁が違います。</strong>JPY は 0 桁、USD/EUR は 2 桁。
          「金額 × レート」を素直に書くと <code>¥1572.0000000002</code> のような値が出ます。
          <code>currencyMeta()</code> が桁数を知っているので、<code>convert()</code> が通貨に応じて丸めます。
          <br />
          <strong><code>addMoney()</code> と <code>sumMoney()</code> の戻り値は <code>Money | null</code> です。</strong>
          通貨が混ざると <code>null</code> が返り、<strong>型が null チェックを強制する</strong>ので握り潰せません。
          「うっかり USD と JPY を足して意味のない数字を出す」が、コンパイル時に止まります。
          <br />
          混在を合算したいなら <code>totalInBaseCurrency()</code> で<strong>レートを明示</strong>します。
          こちらは <code>Money</code> を返します（レートを渡した＝換算の責任を取ったので、必ず値が出る）。
          <strong>型の違いが、そのまま設計の主張になっています。</strong>
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>単位</h2>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: "var(--color-muted)", width: 40 }}>長さ</span>
          <Input type="number" value={len} onChange={(e) => setLen(Number(e.target.value))} style={{ ...field, width: 90, textAlign: "right" }} />
          <Select value={lenFrom} onChange={(e) => setLenFrom(e.target.value as LengthUnit)} style={{ ...field, width: 80 }} options={[...LENGTHS.map((u) => ({ label: u, value: String(u) }))]} />
          <span style={{ color: "var(--color-muted)" }}>→</span>
          <Select value={lenTo} onChange={(e) => setLenTo(e.target.value as LengthUnit)} style={{ ...field, width: 80 }} options={[...LENGTHS.map((u) => ({ label: u, value: String(u) }))]} />
          <b style={{ ...mono, fontSize: 15 }}>{round(convertLength(len, lenFrom, lenTo), 4)}</b>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: "var(--color-muted)", width: 40 }}>面積</span>
          <Input type="number" value={area} onChange={(e) => setArea(Number(e.target.value))} style={{ ...field, width: 90, textAlign: "right" }} />
          <Select value={areaFrom} onChange={(e) => setAreaFrom(e.target.value as AreaUnit)} style={{ ...field, width: 80 }} options={[...AREAS.map((u) => ({ label: u, value: String(u) }))]} />
          <span style={{ color: "var(--color-muted)" }}>→</span>
          <Select value={areaTo} onChange={(e) => setAreaTo(e.target.value as AreaUnit)} style={{ ...field, width: 80 }} options={[...AREAS.map((u) => ({ label: u, value: String(u) }))]} />
          <b style={{ ...mono, fontSize: 15 }}>{round(convertArea(area, areaFrom, areaTo), 4)}</b>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: "var(--color-muted)", width: 40 }}>温度</span>
          <Input type="number" value={temp} onChange={(e) => setTemp(Number(e.target.value))} style={{ ...field, width: 90, textAlign: "right" }} />
          <Select value={tempFrom} onChange={(e) => setTempFrom(e.target.value as TempUnit)} style={{ ...field, width: 80 }} options={[...TEMPS.map((u) => ({ label: u, value: String(u) }))]} />
          <span style={{ color: "var(--color-muted)" }}>→</span>
          <Select value={tempTo} onChange={(e) => setTempTo(e.target.value as TempUnit)} style={{ ...field, width: 80 }} options={[...TEMPS.map((u) => ({ label: u, value: String(u) }))]} />
          <b style={{ ...mono, fontSize: 15 }}>{round(convertTemperature(temp, tempFrom, tempTo), 2)}</b>
        </div>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12, color: "var(--color-muted)", marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--color-border)" }}>
          <span>1 kg = <b style={{ color: "var(--color-fg)" }}>{round(convertWeight(1, "kg", "lb"), 4)}</b> lb</span>
          <span>1 L = <b style={{ color: "var(--color-fg)" }}>{round(convertVolume(1, "l", "gal_us"), 4)}</b> gal(US)</span>
          <span>1 L = <b style={{ color: "var(--color-fg)" }}>{round(convertVolume(1, "l", "sho"), 4)}</b> 升</span>
        </div>

        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>面積で <code>m2</code> → <code>tsubo</code>（坪）を試してください。</strong>
          不動産や設備の資料は坪で来るのに、図面は m² です。100 m² が何坪か、毎回電卓を叩くことになります。
          <br />
          <strong>温度だけは「比率」ではありません</strong>（0°C = 0°F ではない）。
          長さや重さと同じ感覚で係数を掛けると間違えます。<code>convertTemperature()</code> が別関数なのはそのためです。
          <br />
          ガロンも <code>gal_us</code> と <code>gal_uk</code> で違います（約 20% 差）。「ガロン」と一括りにすると事故ります。
        </p>
      </div>
    </>
  );
}
