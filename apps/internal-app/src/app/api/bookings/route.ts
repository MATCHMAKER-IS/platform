/** 予約(GET=空き枠/自分の予約, POST=予約, DELETE=取消)。ログインユーザーのみ。 */
import { withApiObservability } from "../../../server/instrument.js";
import { currentUser } from "../../../server/authorize.js";
import { serverEnv } from "../../../server/env.js";
import { listResources, getSlots, listMyBookings, createBooking, cancelBooking } from "../../../server/booking-service.js";
import { AppError, httpStatusFor, toErrorEnvelope } from "@platform/core";

function me(req: Request): string | null {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  return (user as { email?: string } | null)?.email ?? null;
}

async function handleGET(req: Request): Promise<Response> {
  const userId = me(req);
  if (!userId) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const params = new URL(req.url).searchParams;

  if (params.get("mine") === "1") return Response.json({ bookings: listMyBookings(userId) });

  const resourceId = params.get("resourceId");
  const date = params.get("date");
  if (resourceId && date) {
    try {
      return Response.json({ slots: getSlots(resourceId, date) });
    } catch (e) {
      return Response.json(toErrorEnvelope(e), { status: e instanceof AppError ? httpStatusFor(e) : 500 });
    }
  }
  return Response.json({ resources: listResources() });
}

async function handlePOST(req: Request): Promise<Response> {
  const userId = me(req);
  if (!userId) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const body = (await req.json()) as { resourceId?: string; title?: string; start?: string; end?: string };
  if (!body.resourceId || !body.start || !body.end) return Response.json({ error: "resourceId / start / end が必要です" }, { status: 400 });
  try {
    const booking = createBooking({ resourceId: body.resourceId, userId, title: body.title ?? "", start: body.start, end: body.end });
    return Response.json({ ok: true, booking });
  } catch (e) {
    return Response.json(toErrorEnvelope(e), { status: e instanceof AppError ? httpStatusFor(e) : 500 });
  }
}

async function handleDELETE(req: Request): Promise<Response> {
  const userId = me(req);
  if (!userId) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id が必要です" }, { status: 400 });
  try {
    return Response.json({ ok: true, booking: cancelBooking(id, userId) });
  } catch (e) {
    return Response.json(toErrorEnvelope(e), { status: e instanceof AppError ? httpStatusFor(e) : 500 });
  }
}

export const GET = withApiObservability("/api/bookings", handleGET);
export const POST = withApiObservability("/api/bookings", handlePOST);
export const DELETE = withApiObservability("/api/bookings", handleDELETE);
