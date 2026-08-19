"use client";
/**
 * 日本語の申込フォーム(ふりがな自動入力・和暦・郵便番号)。
 *
 * **日本の業務システムでしか要らない部品**をまとめた実例。
 * どれも「無いと自分で書くことになり、書くと必ず穴が空く」ものばかり。
 */
import * as React from "react";
import { Button, DatePicker, Input, useFurigana } from "@platform/ui";
import { formatWarekiDate } from "@platform/datetime";
import { isValidZipcode, normalizeZipcode } from "@platform/address";
import { toKatakana } from "@platform/utils";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const labelStyle: React.CSSProperties = { fontSize: 12, color: "var(--color-muted)" };
const field: React.CSSProperties = { display: "grid", gap: 4, flex: "1 1 220px" };

export default function Page() {
  // **氏名を打つと、ふりがなが自動で埋まる。**
  // 変換前の読みを `compositionupdate` から拾うので、外部の辞書は要らない。
  const { nameHandlers, kana, setKana } = useFurigana();
  const [name, setName] = React.useState("");
  const [birth, setBirth] = React.useState("");
  const [zip, setZip] = React.useState("");

  const zipOk = zip === "" || isValidZipcode(zip);
  const birthDate = birth === "" ? null : new Date(`${birth}T00:00:00Z`);

  return (
    <div style={{ maxWidth: 860, margin: "16px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>日本語の申込フォーム</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        ふりがなの自動入力・和暦の併記・郵便番号の桁検証。どれも日本の業務でしか要りません。
      </p>

      <div style={box}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label style={field}>
            <span style={labelStyle}>氏名</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              {...nameHandlers}
              placeholder="山田 太郎"
            />
          </label>
          <label style={field}>
            <span style={labelStyle}>ふりがな(自動。直せます)</span>
            <Input value={kana} onChange={(e) => setKana(e.target.value)} placeholder="ヤマダ タロウ" />
          </label>
        </div>
        <p style={{ marginTop: 8, fontSize: 12, color: "var(--color-muted)" }}>
          漢字を変換すると、その読みがふりがな欄に入ります。
          <strong>IME が出した読みをそのまま使う</strong>ので、人名では外れることがあります
          (「日下部」を「ひのしたぶ」と打てばそう入る)。だから<strong>編集できる</strong>ようにしています。
        </p>
      </div>

      <div style={box}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ ...field, flex: "0 1 180px" }}>
            <span style={labelStyle}>生年月日</span>
            <DatePicker value={birth} onChange={(e) => setBirth(e.target.value)} />
          </label>
          <label style={{ ...field, flex: "0 1 160px" }}>
            <span style={labelStyle}>郵便番号</span>
            <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="100-0001" />
          </label>
        </div>
        {birthDate !== null && (
          <p style={{ marginTop: 8, fontSize: 14 }}>
            和暦: <strong>{formatWarekiDate(birthDate)}</strong>
            <span style={{ marginLeft: 8, fontSize: 12, color: "var(--color-muted)" }}>
              元年は「令和元年」と書きます(「令和1年」ではない)
            </span>
          </p>
        )}
        {zip !== "" && (
          <p style={{ marginTop: 8, fontSize: 14, color: zipOk ? "var(--color-fg)" : "var(--color-danger)" }}>
            {zipOk
              ? `正規化: ${normalizeZipcode(zip)}(7 桁)`
              : "数字 7 桁で入力してください。この形式のまま外部 API を叩くと、返る「該当なし」が入力の誤りか実在しない番号か区別できません"}
          </p>
        )}
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>かなの相互変換</h2>
        <p style={{ fontSize: 13, marginBottom: 8 }}>
          ふりがな欄は<strong>カタカナが慣行</strong>です(帳票・銀行口座・保険の書式)。
          IME が返す読みはひらがななので、変換して入れます。
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Button size="sm" variant="secondary" onClick={() => setKana(toKatakana(kana))}>
            ふりがなをカタカナに揃える
          </Button>
          <span style={{ fontSize: 13, color: "var(--color-muted)" }}>
            現在: {kana === "" ? "(未入力)" : kana}
          </span>
        </div>
      </div>
    </div>
  );
}
