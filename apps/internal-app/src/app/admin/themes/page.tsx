import { ThemeGalleryClient } from "./theme-gallery-client.js";
import { getCustomThemes } from "../../../server/theme-setting.js";

export const metadata = { title: "テーマギャラリー" };

export default async function Page() {
  // 保存済みのカスタムテーマをサーバで読み、初期表示から一覧に含める
  const custom = await getCustomThemes();
  return <ThemeGalleryClient initialCustom={custom} />;
}
