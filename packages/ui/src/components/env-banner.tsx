/**
 * **いまどの環境を見ているか**を、画面の一番上に出す。
 *
 * 【なぜ要るか】
 * **検証環境と本番は、見た目が同じです。**
 * 同じ画面を 2 つのタブで開いていると、**どちらで操作しているか分かりません**——
 *
 * > 「検証で試したつもりが本番だった」
 *
 * これは実際に起きます。しかも**気づくのは、たいてい後から**です
 * （本物の取引先にメールが飛んだ、本番の請求書を消した、など）。
 *
 * 【本番では何も出しません】
 * `appEnvLabel()` は本番で `null` を返します。
 * **常に帯が出ていると、利用者は読まなくなります**——
 * 「いつも出ているもの」は視界に入らなくなり、
 * **本当に警告したいときに効かなくなります**。
 *
 * 【サーバ側で判定します】
 * `APP_ENV` はサーバの環境変数なので、**クライアントには渡していません**。
 * この部品はサーバコンポーネントとして使ってください
 * （`layout.tsx` に置くのが自然です）。
 *
 * @packageDocumentation
 */
import { appEnvLabel } from "@platform/env";

import { cn } from "../lib/cn";

/** {@link EnvBanner} の props。 */
export interface EnvBannerProps {
  /**
   * 表示する内容を上書きする（試験用）。
   *
   * **通常は渡さないでください。** 渡さなければ `APP_ENV` から判定します。
   */
  label?: { label: string; tone: "warning" | "info" } | null;
  className?: string;
}

/**
 * 環境を示す帯（本番では何も描かない）。
 *
 * @param props 表示の上書き（通常は不要）
 * @returns 帯。**本番なら null**
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * <body>
 *   <EnvBanner />
 *   {children}
 * </body>
 * ```
 */
export function EnvBanner({ label, className }: EnvBannerProps = {}) {
  const env = label === undefined ? appEnvLabel() : label;
  // **本番では出さない。** 常時表示は読まれなくなる
  if (env === null) return null;

  return (
    <div
      // **読み上げにも伝える。** 目で見て気づけない人にも、
      // 「本番ではない」ことは同じように重要
      role="status"
      className={cn(
        "w-full px-4 py-1 text-center text-xs font-medium",
        env.tone === "warning"
          // **検証環境は目立たせる。** 本番と間違えると実害が出る
          ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
          // **開発環境は控えめに。** 毎日見るものなので、
          // 強い色だと画面全体が読みにくくなる
          : "bg-[var(--color-subtle)] text-[var(--color-muted)]",
        className,
      )}
    >
      {env.label}
    </div>
  );
}
