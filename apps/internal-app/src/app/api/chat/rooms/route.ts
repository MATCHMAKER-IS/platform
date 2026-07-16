/**
 * ルーム API。
 * - GET: 現在ユーザーが所属するルームを未読数つきで返す（未読/新しい順）。
 * - POST: ルームを作成し、作成者を owner として登録する。ボディ `{ name, kind?, memberIds? }`。
 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { chatStore, roomRepo } from "../../../../server/chat";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
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
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:post");

  const body = (await req.json()) as { name?: string; kind?: "dm" | "group"; memberIds?: string[] };
  const name = (body.name ?? "").trim();
  if (name.length === 0) return Response.json({ error: "ルーム名が空です" }, { status: 400 });

  const room = await roomRepo.create({ name, kind: body.kind ?? "group", ownerId: user!.email, memberIds: body.memberIds });
  return Response.json(room, { status: 201 });
}

export const GET = withApiObservability("/api/chat/rooms", handleGET);
export const POST = withApiObservability("/api/chat/rooms", handlePOST);
