import type { MetadataRoute } from "next";

/**
 * 社内アプリの robots.txt。全クローラーを全パス拒否する。
 *
 * **`default` export にすること。** Next.js は `app/robots.ts` を
 * **メタデータファイル**として特別扱いし、`default` を要求する
 * (`GET` を書くと `Export default doesn't exist in target module` で
 * ビルドが落ちる。型検査は通るので気づきにくい)。
 *
 * 公開サイト(ブログ/LP/EC/予約)では全許可 + サイトマップを返す。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
