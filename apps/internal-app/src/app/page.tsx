/**
 * トップページ。基盤の共通 UI 部品(@platform/ui)を呼び出す例。
 * ロジックはアプリ側、見た目の部品は基盤側、という分担を示す。
 */
import { Button, Select } from "@platform/ui";
import "@platform/ui/tokens.css";

export default function Page() {
  return (
    <main style={{ maxWidth: 640, margin: "3rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-fg)" }}>
        社内アプリ 基盤サンプル
      </h1>
      <p style={{ color: "var(--color-muted)", marginTop: ".5rem" }}>
        共通 UI 部品を基盤から読み込んで表示しています。
      </p>
      <div style={{ display: "flex", gap: ".75rem", marginTop: "1.5rem", alignItems: "center" }}>
        <Select
          placeholder="部署を選択"
          options={[
            { label: "営業部", value: "sales" },
            { label: "開発部", value: "dev" },
          ]}
        />
        <Button variant="primary">保存する</Button>
        <Button variant="secondary">キャンセル</Button>
      </div>
    </main>
  );
}
