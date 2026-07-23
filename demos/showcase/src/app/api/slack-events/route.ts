// public-api: Slack からの受信口。認可ではなく**署名**で本物か確かめる
/**
 * Slack からの受信（イベント・スラッシュコマンド）の受け口。
 *
 * ここは Slack のサーバから呼ばれるため、社内の認可（セッション）は通らない。
 * 代わりに **Signing Secret による署名**で本物かを確かめる。
 * 検証していない受信口は「URL を知っていれば誰でも社内システムを操作できる穴」になる。
 *
 * 押さえている点:
 *   1. **生ボディで検証する** … パースして戻すと空白や順序が変わり、一致しなくなる
 *   2. **時刻も見る**         … 過去の通信を使い回す攻撃（リプレイ）を弾く
 *   3. **即座に応答する**     … Slack は 3 秒で切る。重い処理は裏側へ回す
 */
import { NextResponse } from "next/server";
import { verifySlackSignature, parseSlashCommand } from "@platform/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.SLACK_SIGNING_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({
      ok: false,
      message: "SLACK_SIGNING_SECRET が設定されていないため、受信を検証できません。",
      hint: "設定するまでは、この受け口は何も受け付けません（検証なしで受け付けると危険なため）。",
    }, { status: 503 });
  }

  // 1. 生ボディのまま読む（パースはこの後）
  const body = await req.text();
  const signature = req.headers.get("x-slack-signature") ?? "";
  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";

  // 2. 署名の検証（失敗の理由は返さない。探る手がかりを与えないため）
  if (!verifySlackSignature({ body, signature, timestamp, signingSecret: secret })) {
    return NextResponse.json({ ok: false, message: "検証に失敗しました" }, { status: 401 });
  }

  // 3. Slack のエンドポイント登録時に来る確認要求（JSON）
  if (body.startsWith("{")) {
    const json = JSON.parse(body) as { type?: string; challenge?: string; event?: { type?: string; text?: string } };
    if (json.type === "url_verification") {
      return NextResponse.json({ challenge: json.challenge });
    }
    // イベント本体。**重い処理はここで行わない**（3 秒で切られる）
    // 実運用では @platform/jobs のキューへ積み、すぐ 200 を返す
    return NextResponse.json({ ok: true, received: json.event?.type ?? "unknown" });
  }

  // 4. スラッシュコマンド（フォーム形式）
  const cmd = parseSlashCommand(body);
  return NextResponse.json({
    response_type: "ephemeral",
    text: `受け取りました: ${cmd.command} ${cmd.text}（実行者 ${cmd.userName}）`,
  });
}
