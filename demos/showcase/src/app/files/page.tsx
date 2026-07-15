"use client";
/** アップロード/ダウンロードのデモ。選択→進捗付きアップロード→保存キーでダウンロード。 */
import { useState } from "react";
import { FileUploader } from "@platform/ui";

interface Uploaded { key: string; name: string; size: number; type: string }

export default function Page() {
  const [files, setFiles] = useState<Uploaded[]>([]);

  return (
    <main style={{ maxWidth: 560, margin: "3rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>アップロード / ダウンロード</h1>
      <p style={{ color: "var(--color-muted)", marginBottom: "1rem" }}>
        選択すると進捗付きでアップロード(@platform/upload + storage)。保存後のキーでダウンロードできます。
      </p>

      <FileUploader
        url="/api/upload"
        multiple
        accept="image/*,application/pdf,.txt"
        hint="画像 / PDF / テキスト(最大10MB)"
        onUploaded={(data) => setFiles((data as { files: Uploaded[] }).files)}
      />

      {files.length > 0 && (
        <ul style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: ".5rem" }}>
          {files.map((f) => {
            const id = f.key.split("/").pop();
            return (
              <li key={f.key} style={{ display: "flex", justifyContent: "space-between", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: ".5rem .75rem", fontSize: ".9rem" }}>
                <span>{f.name}({Math.round(f.size / 1024)}KB)</span>
                <a href={`/api/download/${id}`} target="_blank" rel="noreferrer">ダウンロード</a>
              </li>
            );
          })}
        </ul>
      )}
      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </main>
  );
}
