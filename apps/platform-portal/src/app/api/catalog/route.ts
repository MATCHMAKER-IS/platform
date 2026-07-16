/** 基盤カタログ(パッケージ/カテゴリ/ADR/ヘルス)を返す。ビルド時ではなくリクエスト時にリポジトリを読む。 */
import { buildCatalog } from "../../../server/catalog";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    return Response.json(buildCatalog());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "カタログ生成に失敗しました" }, { status: 500 });
  }
}
