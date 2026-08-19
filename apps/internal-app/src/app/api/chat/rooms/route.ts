/**
 * ルーム API。
 * - GET: 現在ユーザーが所属するルームを未読数つきで返す（未読/新しい順）。
 * - POST: ルームを作成し、作成者を owner として登録する。ボディ `{ name, kind?, memberIds? }`。
 */
import { withApiObservability } from "../../../../server/instrument";
import { validate, z } from "@platform/validation";

/**
 * ルーム作成の入力。
 *
 * **`memberIds` を配列で強制する。** これまでは `{ memberIds?: string[] }`
 * と型注釈するだけで、実行時には何も確かめていなかった——文字列を渡すと
 * `"abc".length` が 3 になり、件数チェックがあれば素通りする穴
 * (掲示板の添付と同種。2026-08 に判明)。
 */
const CreateRoomInput = z.object({
  name: z.string().trim().min(1, "ルーム名が空です").max(100),
  kind: z.enum(["dm", "group"]).default("group"),
  memberIds: z.array(z.string()).optional(),
});
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { chatStore, roomRepo } from "../../../../server/chat";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "chat:read");

  const rooms = await roomRepo.roomsForUser(user!.email);
  const unread = await chatStore.unreadFor(user!.email, rooms.map((r) => r.id));
  const byId = new Map(unread.map((u) => [u.roomId, u]));
  const rows = rooms
    .map((room) => {
      const u = byId.get(room.id);
      return { roomId: room.id, name: room.name, kind: room.kind, unread: u?.unread ?? 0, lastAt: u?.lastAt };
    })
    .sort((a, b) => {
      const at = a.lastAt ?? "";
      const bt = b.lastAt ?? "";
      return at > bt ? -1 : at < bt ? 1 : 0;
    });
  return Response.json({ rooms: rows });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "chat:post");

  const parsed = validate(CreateRoomInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const body = parsed.value;

  const room = await roomRepo.create({ name: body.name, kind: body.kind, ownerId: user!.email, memberIds: body.memberIds });
  return Response.json(room, { status: 201 });
}

export const GET = withApiObservability("/api/chat/rooms", handleGET);
export const POST = withApiObservability("/api/chat/rooms", handlePOST);
