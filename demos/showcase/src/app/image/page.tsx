"use client";
/** 画像処理デモ(ブラウザ Canvas)。アップロード→リサイズ/モザイク/フィルタ/反転/背景白抜き/形式変換。 */
import { useState } from "react";
import { resizeImage, pixelate, applyFilters, flipImage, convertFormat, removeBackgroundColor, maskImage, downloadBlob, ImageCropper, useImageUpload, Button, Badge } from "@platform/ui";

export default function Page() {
  const [src, setSrc] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string>("");
  const [info, setInfo] = useState<string>("");

  const setResult = (blob: Blob, label: string) => {
    setSrc(blob);
    setUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
    setInfo(`${label} / ${(blob.size / 1024).toFixed(0)}KB / ${blob.type}`);
  };

  const onPick = async (file: File) => {
    // アップロード前に実用サイズへ縮小(webp)
    const resized = await resizeImage(file, { maxWidth: 1200, maxHeight: 1200, format: "webp", quality: 0.85 });
    setResult(resized, "リサイズ(≤1200・webp)");
  };

  const act = (fn: () => Promise<Blob>, label: string) => async () => { if (src) setResult(await fn(), label); };

  return (
    <main style={{ maxWidth: 720, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>画像処理(ブラウザ)</h1>
      <p style={{ color: "var(--color-muted)", margin: ".5rem 0 1rem", fontSize: ".9rem" }}>
        アップロードすると自動で実用サイズに縮小。ボタンで各種加工を適用できます(すべてブラウザ内処理)。
      </p>

      <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />

      <UploadDemo />

      {url && (
        <div style={{ marginTop: "1rem" }}>
          <img src={url} alt="preview" style={{ maxWidth: "100%", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0 / 20px 20px" }} />
          <div style={{ margin: ".5rem 0" }}><Badge variant="secondary">{info}</Badge></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
            <Button variant="secondary" onClick={act(() => resizeImage(src!, { maxWidth: 400, format: "webp" }), "リサイズ400")}>リサイズ400</Button>
            <Button variant="secondary" onClick={act(() => pixelate(src!, 14), "モザイク")}>モザイク</Button>
            <Button variant="secondary" onClick={act(() => applyFilters(src!, { grayscale: 1 }), "グレースケール")}>グレースケール</Button>
            <Button variant="secondary" onClick={act(() => applyFilters(src!, { brightness: 1.15, contrast: 1.2, saturate: 1.3 }), "明度/コントラスト/彩度")}>明るく鮮やか</Button>
            <Button variant="secondary" onClick={act(() => applyFilters(src!, { invert: 1 }), "色反転")}>色反転</Button>
            <Button variant="secondary" onClick={act(() => applyFilters(src!, { sepia: 0.8 }), "セピア")}>セピア</Button>
            <Button variant="secondary" onClick={act(() => flipImage(src!, { horizontal: true }), "左右反転")}>左右反転</Button>
            <Button variant="secondary" onClick={act(() => removeBackgroundColor(src!, { tolerance: 32 }), "背景白抜き")}>背景白抜き</Button>
            <Button variant="secondary" onClick={act(() => maskImage(src!, "circle"), "円マスク")}>円マスク</Button>
            <Button variant="secondary" onClick={act(() => convertFormat(src!, "jpeg", 0.8), "JPEG変換")}>JPEG変換</Button>
            <Button onClick={() => src && downloadBlob(src, "edited.png")}>ダウンロード</Button>
          </div>
        </div>
      )}
      {url && (
        <section style={{ marginTop: "2rem" }}>
          <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>対話トリミング(ドラッグで範囲選択)</h2>
          <ImageCropper src={src!} onCrop={(blob) => setResult(blob, "トリミング")} />
        </section>
      )}
      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </main>
  );
}

/** useImageUpload: 選択→自動縮小→(擬似)アップロード を1フックで。 */
function UploadDemo() {
  const up = useImageUpload<{ size: number }>({
    resize: { maxWidth: 1024, format: "webp", quality: 0.85 },
    upload: async (blob) => { await new Promise((r) => setTimeout(r, 300)); return { size: blob.size }; }, // 実際は fetch("/api/upload", ...)
  });
  return (
    <div style={{ margin: "1rem 0", padding: "1rem", border: "1px dashed var(--color-border)", borderRadius: "var(--radius)" }}>
      <div style={{ fontWeight: 600, marginBottom: ".5rem" }}>useImageUpload(選択→自動縮小→アップロード)</div>
      <input type="file" accept="image/*" onChange={up.onInputChange} />
      <div style={{ marginTop: ".5rem", fontSize: ".9rem" }}>
        {up.uploading ? "アップロード中…" : up.result ? `完了: ${(up.result.size / 1024).toFixed(0)}KB に縮小して送信` : "画像を選ぶと自動で縮小して送信します"}
        {up.error && <span style={{ color: "var(--color-danger)" }}>{up.error}</span>}
      </div>
      {up.preview && <img src={up.preview} alt="preview" style={{ maxWidth: 200, marginTop: ".5rem", borderRadius: "var(--radius)" }} />}
    </div>
  );
}
