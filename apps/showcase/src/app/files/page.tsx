"use client";
/** ファイル・画像の統合デモ（アップロード/DL・画像編集をタブでまとめたもの）。 */
import * as React from "react";
import { UsesPackages } from "../../components/uses-packages";
import { Button } from "@platform/ui";
import { FilesDemo } from "./files-demo";
import { ImageDemo } from "./image-demo";
import { FileTypeDemo } from "./filetype-demo";

const TABS = [
  { id: "files", label: "ファイル入出力", Comp: FilesDemo },
  { id: "image", label: "画像編集", Comp: ImageDemo },
  { id: "filetype", label: "種別の判定", Comp: FileTypeDemo },
] as const;

export default function Page() {
  const [tab, setTab] = React.useState<string>("files");
  const Active = (TABS.find((t) => t.id === tab) ?? TABS[0]).Comp;
  return (
    <main style={{ maxWidth: 1000, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 12 }}>ファイル・画像</h1>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, borderBottom: "1px solid var(--color-border)", paddingBottom: 10 }}>
        {TABS.map((t) => (<Button key={t.id} type="button" onClick={() => setTab(t.id)}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--color-border)", background: tab === t.id ? "var(--color-primary)" : "var(--color-bg)", color: tab === t.id ? "var(--color-primary-fg)" : "var(--color-fg)" }}>{t.label}</Button>))}
      </div>
      <Active />
          <UsesPackages
        packages={["storage", "upload", "image"]}
        imports={{ upload: ["validateUpload"] }}
        snippet={`// 受け取る形式と上限を先に決める(選んでから断るのが最も不親切)
const check = validateUpload(file, {
  maxBytes: 10 * 1024 * 1024,
  accept: ["image/png", "image/jpeg", "application/pdf"],
});
if (!check.ok) return showError(check.reason);`}
      />
    </main>
  );
}
