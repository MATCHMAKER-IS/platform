// public-api: 基盤の構成(フォルダ名と役割)の公開参照。ファイルの中身は返さない
/**
 * リポジトリ構成のツリーを返す。
 *
 * カタログとは**別の口**にしてある。ツリーは 1,700 件ほどあり、
 * 「構成」タブを開いた人だけが必要とするため。カタログに混ぜると
 * ポータルを開くたびに全員が読み込むことになる。
 */
import { buildRepoTree } from "../../../server/tree";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  try {
    const raw = new URL(req.url).searchParams.get("depth");
    const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
    // 深すぎる指定は受けない(件数が跳ね上がり、画面も応答も重くなる)
    const depth = Number.isInteger(parsed) && parsed >= 1 && parsed <= 6 ? parsed : undefined;
    return Response.json({ nodes: buildRepoTree(depth) });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "構成の取得に失敗しました" },
      { status: 500 },
    );
  }
}
