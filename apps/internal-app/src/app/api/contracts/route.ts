/**
 * 契約 API。期限判定・アラート・更新は `@platform/contract` の担当。
 */
import { withApiObservability } from "../../../server/instrument.js";
import { currentUser } from "../../../server/authorize.js";
import { serverEnv } from "../../../server/env.js";
import { contractStore } from "../../../server/contract-repo.js";
import { contractAlerts, summarizeContracts, daysUntilEnd, noticeDeadline, canGiveNotice, renew } from "@platform/contract";
import { AppError } from "@platform/core";

function user(req: Request) {
  return currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
}

async function handleGET(req: Request): Promise<Response> {
  if (!user(req)) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const all = await contractStore.list();
  return Response.json({
    alerts: contractAlerts(all),
    summary: summarizeContracts(all),
    contracts: all
      .map((c) => ({
        ...c,
        daysLeft: daysUntilEnd(c),
        noticeDeadline: noticeDeadline(c),
        canGiveNotice: canGiveNotice(c),
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft),
  });
}

async function handlePOST(req: Request): Promise<Response> {
  const u = user(req);
  if (!u?.roles.includes("admin")) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const body = (await req.json()) as { id?: string; action?: "renew" | "terminate" };
  if (!body.id) return Response.json({ error: "id が必要です" }, { status: 400 });
  const cur = await contractStore.get(body.id);
  if (!cur) return Response.json({ error: "契約が見つかりません" }, { status: 404 });

  try {
    if (body.action === "renew") {
      const next = renew(cur);
      return Response.json({ contract: await contractStore.update(body.id, next) });
    }
    if (body.action === "terminate") {
      return Response.json({ contract: await contractStore.update(body.id, { status: "terminated" }) });
    }
    return Response.json({ error: "action は renew か terminate です" }, { status: 400 });
  } catch (e) {
    if (e instanceof AppError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

export const GET = withApiObservability("/api/contracts", handleGET);
export const POST = withApiObservability("/api/contracts", handlePOST);
