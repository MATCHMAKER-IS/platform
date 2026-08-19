"use client";
/**
 * 公開サイトのページビュー計測。
 *
 * **中身は `@platform/ui` の `usePageview` に移した**(2026-08)。
 * `internal-app` にも同じ形のラッパーがあり、セッション ID の採番と保存を
 * 別々に書いていた——書き直すたびに「タブを閉じたら消す」
 * 「保存に失敗しても計測は続ける」が抜ける。
 */
import { usePageview } from "@platform/ui";

/** {@link BeaconClient} の設定。 */
export interface BeaconClientProps {
  /** 計測するパス。 */
  path: string;
}

/**
 * ページビューを送る(表示は無い)。
 *
 * **利用者は渡さない。** 公開サイトは匿名で計測する。
 */
export function BeaconClient({ path }: BeaconClientProps) {
  usePageview({ path, namespace: "public-site" });
  return null;
}
