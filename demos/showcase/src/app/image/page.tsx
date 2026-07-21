"use client";
/**
 * 画像処理のデモ(ブラウザ Canvas)。**アップロードせずに完結**するので機密画像も扱える。
 * ズーム表示・リサイズ・加工・トリミング。
 *
 * UI は **@platform/ui の部品だけ**で組む(CLAUDE.md「UI 部品は @platform/ui を使う」)。
 * ただし `<input type="file">` は基盤に受け皿が無いため生タグ(CLAUDE.md に既知の穴として記録)。
 */
import * as React from "react";
import {
  resizeImage,
  pixelate,
  applyFilters,
  flipImage,
  convertFormat,
  removeBackgroundColor,
  maskImage,
  downloadBlob,
  ImageCropper,
  ImageZoom,
  useImageUpload,
  fitScale,
  formatScale,
  Button,
  Badge,
  Alert,
  Separator,
  Slider,
} from "@platform/ui";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

/** `<input type="file">` は基盤に部品が無いので、ここでスタイルを揃える。 */
const fileInput: React.CSSProperties = {
  fontSize: 13,
  color: "var(--color-fg)",
};

export default function Page() {
  const [src, setSrc] = React.useState<Blob | null>(null);
  const [url, setUrl] = React.useState("");
  const [info, setInfo] = React.useState("");
  const [natural, setNatural] = React.useState<{ width: number; height: number } | null>(null);
  const [scale, setScale] = React.useState(1);
  const [maxWidth, setMaxWidth] = React.useState(1200);

  const setResult = (blob: Blob, label: string) => {
    setSrc(blob);
    setUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
    setInfo(`${label} / ${(blob.size / 1024).toFixed(0)}KB / ${blob.type}`);
  };

  const onPick = async (file: File) => {
    // 元の実寸を覚えておく(縮小率の説明に使う)
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      setNatural({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(objUrl);
    };
    img.src = objUrl;

    const resized = await resizeImage(file, { maxWidth: 1200, maxHeight: 1200, format: "webp", quality: 0.85 });
    setResult(resized, "リサイズ(≤1200・webp)");
  };

  const act = (fn: () => Promise<Blob>, label: string) => async () => {
    if (src) setResult(await fn(), label);
  };

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>画像処理（ブラウザ）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        <strong>すべてブラウザ内で完結します。サーバへ送りません。</strong>
        身分証・図面・現場写真のような<strong>外に出したくない画像</strong>を、そのまま扱えます。
        アップロード前に縮小するので、通信量も抑えられます。
      </p>

      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>画像を選ぶ</div>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && void onPick(e.target.files[0])}
          style={fileInput}
        />
        {natural !== null && (
          <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 8 }}>
            元の実寸: {natural.width} × {natural.height} px
          </div>
        )}
      </div>

      {url !== "" && src !== null && (
        <>
          <div style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>ズーム表示</h2>
              <Badge variant="secondary">{formatScale(scale)}</Badge>
            </div>

            <ImageZoom src={src} alt="プレビュー" height={380} onScaleChange={setScale} />

            <Alert variant="info" title="ホイールで拡大、ドラッグで移動、ダブルクリックで等倍" style={{ marginTop: 12 }}>
              <span style={{ fontSize: 12, lineHeight: 1.8 }}>
                <strong>ホイールはカーソル位置を中心に寄ります。</strong>
                枠の中心を基準にすると、見たい箇所が画面外へ逃げていきます——
                領収書の但し書きや図面の寸法を確認するとき、これが効きます。
                <br />
                <strong>等倍では動きません。</strong>拡大していないのにドラッグできると、
                「画像が消えた」と言われます。
                {natural !== null && (
                  <>
                    <br />
                    この画像を枠に収める率: <b>{formatScale(fitScale(natural, { width: 860, height: 380 }))}</b>
                    （<code>fitScale()</code>。<strong>枠より小さい画像は 1 のまま</strong>——勝手に引き伸ばしません）
                  </>
                )}
              </span>
            </Alert>
          </div>

          <div style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>保存サイズを変える</h2>
              <Badge variant="secondary">{info}</Badge>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: "var(--color-muted)", width: 60 }}>最大幅</span>
              <Slider value={[maxWidth]} min={100} max={2000} step={100} onValueChange={([v]) => setMaxWidth(v ?? 100)} style={{ flex: 1, maxWidth: 260 }} />
              <span style={{ fontFamily: "monospace", fontSize: 13, width: 60 }}>{maxWidth}px</span>
              <Button size="sm" onClick={act(() => resizeImage(src, { maxWidth, format: "webp", quality: 0.85 }), `リサイズ${maxWidth}`)}>
                この幅にする
              </Button>
            </div>

            <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.8 }}>
              <strong>縦横比は保たれます</strong>（<code>fit: &quot;contain&quot;</code> が既定）。
              <strong>元より大きくはしません</strong>（<code>withoutEnlargement</code> が既定 true）——
              小さい画像を引き伸ばしてぼやけさせないためです。
              <br />
              「拡大したい」場合は表示側（上のズーム）でやるのが正解で、
              <strong>ファイル自体を引き伸ばしても情報は増えません</strong>。
            </p>
          </div>

          <div style={box}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>加工</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <Button size="sm" variant="secondary" onClick={act(() => pixelate(src, 14), "モザイク")}>
                モザイク
              </Button>
              <Button size="sm" variant="secondary" onClick={act(() => applyFilters(src, { grayscale: 1 }), "グレースケール")}>
                グレースケール
              </Button>
              <Button size="sm" variant="secondary" onClick={act(() => applyFilters(src, { brightness: 1.15, contrast: 1.2, saturate: 1.3 }), "明るく鮮やか")}>
                明るく鮮やか
              </Button>
              <Button size="sm" variant="secondary" onClick={act(() => applyFilters(src, { invert: 1 }), "色反転")}>
                色反転
              </Button>
              <Button size="sm" variant="secondary" onClick={act(() => applyFilters(src, { sepia: 0.8 }), "セピア")}>
                セピア
              </Button>
              <Button size="sm" variant="secondary" onClick={act(() => flipImage(src, { horizontal: true }), "左右反転")}>
                左右反転
              </Button>
              <Button size="sm" variant="secondary" onClick={act(() => removeBackgroundColor(src, { tolerance: 32 }), "背景白抜き")}>
                背景白抜き
              </Button>
              <Button size="sm" variant="secondary" onClick={act(() => maskImage(src, "circle"), "円マスク")}>
                円マスク
              </Button>
              <Button size="sm" variant="secondary" onClick={act(() => convertFormat(src, "jpeg", 0.8), "JPEG変換")}>
                JPEG変換
              </Button>
              <Button size="sm" onClick={() => downloadBlob(src, "edited.webp")}>
                ダウンロード
              </Button>
            </div>
            <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
              <strong>「モザイク」は個人情報の含まれる画像で使います</strong>——
              現場写真に写り込んだ人の顔、書類の氏名欄。<code>/pii</code> のマスキングの画像版です。
              <br />
              加工後に上のズームで拡大すると、<strong>モザイクがきちんと効いているか確認できます</strong>。
              荒い加工だと拡大で読めてしまうので、これが要ります。
            </p>
          </div>

          <div style={box}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>トリミング（ドラッグで範囲選択）</h2>
            <ImageCropper src={src} onCrop={(blob) => setResult(blob, "トリミング")} />
          </div>
        </>
      )}

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>useImageUpload（選択 → 自動縮小 → 送信）</h2>
        <UploadDemo />
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>設計について</h2>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            {[
              { k: "lib/zoom.ts", v: "純ロジック", note: "clampScale / clampPan / zoomAt / fitScale。**描画を含まない**" },
              { k: "ImageZoom", v: "描画", note: "ホイール・ドラッグ・ボタン。ロジックは lib に任せる" },
              { k: "lib/image.ts", v: "Canvas 処理", note: "resizeImage / pixelate / applyFilters ほか" },
              { k: "@platform/image", v: "サーバ側", note: "sharp を使う。ブラウザとは別実装だが `FitOptions` は共通" },
            ].map((r) => (
              <tr key={r.k} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5, fontFamily: "monospace", fontSize: 12, width: 130 }}>{r.k}</td>
                <td style={{ padding: 5, width: 90 }}>
                  <Badge variant="outline">{r.v}</Badge>
                </td>
                <td style={{ padding: 5, fontSize: 11, color: "var(--color-muted)" }}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Separator style={{ margin: "12px 0" }} />
        <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.8, margin: 0 }}>
          <strong>ズームのロジックを純関数に切り出しているのが要点です。</strong>
          「等倍では動かさない」「カーソル位置を中心に寄る」は<strong>目で見ないと分からないバグ</strong>になりがちですが、
          純関数にすればテストで固定できます（<code>pnpm smoke</code> の <code>zoom</code> 節で 9 件検査しています）。
        </p>
      </div>
    </main>
  );
}

/** 選択 → 自動縮小 → (擬似)アップロード を 1 フックで。 */
function UploadDemo() {
  const up = useImageUpload<{ size: number }>({
    resize: { maxWidth: 1024, format: "webp", quality: 0.85 },
    upload: async (blob) => {
      await new Promise((r) => setTimeout(r, 300));
      return { size: blob.size };
    },
  });
  return (
    <div>
      <input type="file" accept="image/*" onChange={up.onInputChange} style={fileInput} />
      <div style={{ marginTop: 8, fontSize: 13 }}>
        {up.uploading ? "アップロード中…" : up.result ? `完了: ${(up.result.size / 1024).toFixed(0)}KB に縮小して送信` : "画像を選ぶと自動で縮小して送信します"}
        {up.error !== undefined && <span style={{ color: "var(--color-danger)" }}>{up.error}</span>}
      </div>
      {up.preview != null && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={up.preview} alt="プレビュー" style={{ maxWidth: 200, marginTop: 8, borderRadius: "var(--radius)" }} />
      )}
      <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
        <strong>アップロード前に縮小するので、5MB の写真が 200KB 程度で送られます。</strong>
        スマホで撮った写真をそのまま送らせると、通信量もサーバの負荷も無駄になります。
      </p>
    </div>
  );
}
