"use client";
/**
 * QR コード・バーコード発行のデモ。備品ラベル・社員証・帳票埋め込み・TOTP。
 *
 * UI は **@platform/ui の部品だけ**で組む(CLAUDE.md「UI 部品は @platform/ui を使う」)。
 */
import * as React from "react";
import { Button, Input, Select, Badge, Alert, Separator } from "@platform/ui";
import { qrSvg, qrDataUrl, barcodeSvg, buildAssetUrl, type QrLevel, type BarcodeFormat } from "@platform/barcode";
import { isValidEan13, eanCheckDigit, janCountryPrefix, isJapaneseJan, detectBarcodeKind } from "@platform/mobile";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" };

const LEVEL_NOTE: Record<QrLevel, string> = {
  L: "約 7% 復元 — 画面表示",
  M: "約 15% — 普通の印刷（既定）",
  Q: "約 25% — 屋外・現場の備品ラベル",
  H: "約 30% — 中央にロゴを重ねる場合",
};

const FORMAT_NOTE: Record<BarcodeFormat, string> = {
  ean13: "JAN（日本の商品コード・13 桁）",
  ean8: "短い JAN（8 桁）",
  code128: "英数字が入る（社内の管理番号はこれ）",
  code39: "古い機器でも読める",
  itf14: "段ボール外装（集合包装用）",
};

const SAMPLES: Record<BarcodeFormat, string> = {
  ean13: "4901234567894",
  ean8: "49123456",
  code128: "ASSET-A-0042",
  code39: "IT-2026-001",
  itf14: "14901234567891",
};

/** 用途ごとの例。**QR に何を入れるか**が要点。 */
const USE_CASES = [
  { key: "asset", label: "備品ラベル", kind: "asset", id: "A-0042", level: "Q" as QrLevel, note: "現場に貼るので誤り訂正を高めに" },
  { key: "employee", label: "社員証・入退室", kind: "employee", id: "E-1180", level: "M" as QrLevel, note: "カード印刷" },
  { key: "invoice", label: "見積書・帳票", kind: "invoice", id: "INV-2026-0042", level: "M" as QrLevel, note: "PDF に SVG で埋める" },
];

export function BarcodeDemo() {
  const [useCase, setUseCase] = React.useState(USE_CASES[0]!);
  const [baseUrl, setBaseUrl] = React.useState("https://portal.example.co.jp");
  const [level, setLevel] = React.useState<QrLevel>("Q");
  const [qr, setQr] = React.useState("");
  const [qrErr, setQrErr] = React.useState("");

  const [format, setFormat] = React.useState<BarcodeFormat>("ean13");
  const [barValue, setBarValue] = React.useState(SAMPLES.ean13);
  const [bar, setBar] = React.useState("");
  const [barErr, setBarErr] = React.useState("");

  const [totp, setTotp] = React.useState("");
  const [totpErr, setTotpErr] = React.useState("");

  const url = buildAssetUrl({ baseUrl, kind: useCase.kind, id: useCase.id });
  const otpauth = "otpauth://totp/社内ポータル:yamada@example.co.jp?secret=JBSWY3DPEHPK3PXP&issuer=社内ポータル&digits=6&period=30";

  // JAN の検証は @platform/mobile（発行前に確かめる）
  const janValid = format === "ean13" ? isValidEan13(barValue) : null;
  const janCountry = format === "ean13" && janValid === true ? janCountryPrefix(barValue) : null;

  async function makeQr() {
    setQrErr("");
    const r = await qrSvg(url, { level });
    if (r.ok) setQr(r.value);
    else {
      setQr("");
      setQrErr(r.error.message);
    }
  }

  async function makeBar() {
    setBarErr("");
    const r = await barcodeSvg(barValue, { format });
    if (r.ok) setBar(r.value);
    else {
      setBar("");
      setBarErr(r.error.message);
    }
  }

  async function makeTotp() {
    setTotpErr("");
    const r = await qrDataUrl(otpauth, { level: "M", width: 200 });
    if (r.ok) setTotp(r.value);
    else {
      setTotp("");
      setTotpErr(r.error.message);
    }
  }

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>QR コード・バーコードの発行</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        <code>@platform/barcode</code> は<strong>サーバでもブラウザでも同じ関数で SVG を返します</strong>——
        画面表示も帳票 PDF も同じコードです。
        <strong>読み取りは <code>@platform/mobile</code></strong>（「読む」と「出す」で関心が違うので分けています）。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>① 備品ラベル・社員証・帳票（QR）</h2>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {USE_CASES.map((u) => (
            <Button
              key={u.key}
              size="sm"
              variant={useCase.key === u.key ? "primary" : "secondary"}
              onClick={() => {
                setUseCase(u);
                setLevel(u.level);
                setQr("");
              }}
            >
              {u.label}
            </Button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
          <label style={{ fontSize: 12, flex: 1, minWidth: 220 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>社内のベース URL</div>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>誤り訂正</div>
            <Select
              value={level}
              onChange={(e) => setLevel(e.target.value as QrLevel)}
              options={(Object.keys(LEVEL_NOTE) as QrLevel[]).map((l) => ({ label: `${l} — ${LEVEL_NOTE[l]}`, value: l }))}
              style={{ width: 250 }}
            />
          </label>
          <Button onClick={() => void makeQr()}>QR を作る</Button>
        </div>

        <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 6 }}>
          QR に入る文字列（<code>buildAssetUrl()</code>）
        </div>
        <span style={{ ...mono, display: "block", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4, padding: "6px 8px" }}>{url}</span>

        {qrErr !== "" && (
          <Alert variant="danger" title="生成できません" style={{ marginTop: 10 }}>
            <span style={{ fontSize: 12 }}>{qrErr}</span>
          </Alert>
        )}

        {qr !== "" && (
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginTop: 12 }}>
            <div
              style={{ width: 180, height: 180, background: "#fff", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 8 }}
              // 生成した SVG を表示する。**外部入力ではなく基盤が生成した文字列**なので安全。
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 4 }}>
                誤り訂正 <b>{level}</b>（{LEVEL_NOTE[level]}）・SVG {qr.length} 文字
              </div>
              <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.8 }}>
                {useCase.note}
                <br />
                <strong>SVG なので拡大しても粗くなりません。</strong>帳票 PDF にそのまま埋められます。
              </p>
            </div>
          </div>
        )}

        <Alert variant="info" title="QR に ID だけを入れてはいけません" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            <code>A-0042</code> だけを入れると、<strong>読み取った人がどこへ行けばよいか分かりません</strong>。
            <strong>URL を入れれば、標準のカメラアプリで開けます</strong>——専用アプリを配らなくて済みます。
            <br />
            <code>buildAssetUrl()</code> は<strong>ID をエスケープ</strong>します。
            <code>A/42</code> のような ID をそのまま繋ぐと、URL のパスが壊れます。
          </span>
        </Alert>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>② バーコード（1 次元）</h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>種類</div>
            <Select
              value={format}
              onChange={(e) => {
                const f = e.target.value as BarcodeFormat;
                setFormat(f);
                setBarValue(SAMPLES[f]);
                setBar("");
              }}
              options={(Object.keys(FORMAT_NOTE) as BarcodeFormat[]).map((f) => ({ label: `${f} — ${FORMAT_NOTE[f]}`, value: f }))}
              style={{ width: 300 }}
            />
          </label>
          <label style={{ fontSize: 12, flex: 1, minWidth: 180 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>値</div>
            <Input value={barValue} onChange={(e) => setBarValue(e.target.value)} />
          </label>
          <Button onClick={() => void makeBar()}>バーコードを作る</Button>
        </div>

        {format === "ean13" && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, marginBottom: 10, alignItems: "center" }}>
            <Badge variant={janValid === true ? "success" : "danger"}>{janValid === true ? "JAN として正しい" : "チェックディジットが誤り"}</Badge>
            {janValid !== true && barValue.length >= 12 && (
              <span style={{ color: "var(--color-muted)" }}>
                正しい末尾は <b>{eanCheckDigit(barValue.slice(0, 12))}</b>
              </span>
            )}
            {janCountry !== null && (
              <span style={{ color: "var(--color-muted)" }}>
                国コード <b>{janCountry}</b>
                {isJapaneseJan(barValue) && "（日本）"}
              </span>
            )}
            <span style={{ color: "var(--color-muted)" }}>
              判定: <code>{detectBarcodeKind(barValue)}</code>
            </span>
          </div>
        )}

        {barErr !== "" && (
          <Alert variant="danger" title="生成できません" style={{ marginTop: 10 }}>
            <span style={{ fontSize: 12, lineHeight: 1.8 }}>
              {barErr}
              <br />
              <strong>規格違反は例外ではなく <code>Result</code> のエラーで返ります。</strong>
              桁数が違う・使えない文字が入っている、が典型です。
            </span>
          </Alert>
        )}

        {bar !== "" && (
          <div style={{ marginTop: 12, background: "#fff", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 12, overflowX: "auto" }}>
            <div dangerouslySetInnerHTML={{ __html: bar }} />
          </div>
        )}

        <Alert variant="warning" title="発行する前に検証してください" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            <strong>末尾の 1 桁を変えてみてください</strong>——<code>4901234567890</code> は
            チェックディジットが合わないので JAN として不正です。
            <br />
            <strong>この検証は <code>@platform/mobile</code> の <code>isValidEan13()</code> が持っています</strong>
            （読み取り側と同じ関数）。「印刷してから読めないと分かる」を防げます。
            <br />
            <strong>社内の管理番号には <code>code128</code> を使ってください。</strong>JAN は{" "}
            <strong>商品識別のための国際規格</strong>で、社内で勝手に採番するものではありません。
          </span>
        </Alert>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>③ TOTP（認証アプリの登録）</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10, lineHeight: 1.8 }}>
          <code>@platform/auth</code> が <code>otpauth://</code> URI を作り、
          <strong>この基盤が QR にします</strong>。利用者は Google Authenticator 等で読み取って登録します。
        </p>
        <span style={{ ...mono, display: "block", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4, padding: "6px 8px", marginBottom: 10 }}>
          {otpauth}
        </span>
        <Button onClick={() => void makeTotp()}>登録用 QR を作る</Button>

        {totpErr !== "" && (
          <Alert variant="danger" title="生成できません" style={{ marginTop: 10 }}>
            <span style={{ fontSize: 12 }}>{totpErr}</span>
          </Alert>
        )}

        {totp !== "" && (
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginTop: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={totp} alt="TOTP 登録用 QR" style={{ width: 180, height: 180, border: "1px solid var(--color-border)", borderRadius: "var(--radius)" }} />
            <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.8, flex: 1, minWidth: 240 }}>
              <strong>ここは PNG（<code>qrDataUrl()</code>）です。</strong>
              <code>&lt;img src&gt;</code> にそのまま渡せます。
              <br />
              画面に出すだけなら PNG、<strong>印刷・PDF なら SVG</strong>（上の①）と使い分けます。
              <br />
              <strong>この QR にはシークレットが入っています。</strong>スクリーンショットを撮らせない、
              画面共有中に出さない、といった運用が要ります。
            </p>
          </div>
        )}
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>なぜ自作しないか</h2>
        <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.9, margin: 0 }}>
          QR は<strong>誤り訂正にリードソロモン符号を使います</strong>。バーコードは
          <strong>種類ごとに桁数・チェックディジット・使える文字が違います</strong>。
          自作すると「<strong>画面では QR に見えるのに、読み取り機で読めない</strong>」が起きます。
          <br />
          <br />
          この基盤は <code>qrcode</code> と <code>bwip-js</code> をラップしているだけです。
          <strong>ラップする意味は「差し替えられること」</strong>——
          ライブラリを変えるとき、直すのは <code>packages/barcode</code> の中だけで、
          アプリは 1 行も変わりません（CLAUDE.md 大原則 3）。
        </p>
        <Separator style={{ margin: "12px 0" }} />
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <tbody>
            {[
              { k: "@platform/barcode", v: "発行", note: "qrSvg / qrDataUrl / barcodeSvg / buildAssetUrl" },
              { k: "@platform/mobile", v: "読み取り", note: "BarcodeDetector・JAN/EAN のチェックディジット検証" },
              { k: "@platform/auth", v: "TOTP", note: "otpauth URI を作る（QR 化はこの基盤）" },
            ].map((r) => (
              <tr key={r.k} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5, ...mono, width: 150 }}>{r.k}</td>
                <td style={{ padding: 5, width: 70 }}>
                  <Badge variant="outline">{r.v}</Badge>
                </td>
                <td style={{ padding: 5, color: "var(--color-muted)" }}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
