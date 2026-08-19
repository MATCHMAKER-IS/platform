import { PageShell } from "@platform/ui";

import { ToolboxDemo } from "./toolbox-demo";

/**
 * **小さな道具**（`bytes` / `color` / `json` / `web-storage`）の紹介。
 *
 * 【なぜ 1 画面にまとめたか】
 * どれも**数行で使えるもの**で、**それぞれに画面を作ると探しにくくなります**。
 * 「こういう道具がある」と知ってもらうのが目的なので、
 * **一覧で見える方が役に立ちます**。
 */
export default function ToolboxPage() {
  return (
    <PageShell
      title="小さな道具"
      description="バイト列・色・JSON・ブラウザ保存。どれも数行で使えます。"
    >
      <ToolboxDemo />
    </PageShell>
  );
}
