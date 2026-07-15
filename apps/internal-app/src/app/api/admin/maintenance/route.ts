/**
 * メンテナンス切り替え管理 API(管理者のみ)。
 * GET  … 現在のメンテナンス状態を返す。
 * POST … 状態を更新する(enabled / window / estimatedRecovery / message)。
 * 変更は監査ログに残す。設定は DB に永続化され、middleware が TTL キャッシュ越しに反映する。
 */
import { NextResponse, type NextRequest } from "next/server";
import { withApiObservability } from "../../../../server/instrument.js";
import { errorResponse } from "../../../../server/api-error.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { createDbMaintenanceStore } from "../../../../server/maintenance-store.js";
import { db } from "../../../../server/services.js";
import type { MaintenanceState } from "@platform/status-page";
import { serverEnv } from "../../../../server/env.js";

const store = createDbMaintenanceStore();
const sessionSecret = () => serverEnv.SESSION_SECRET;

async function handleGET(req: NextRequest): Promise<Response> {
  try {
    requirePermission(currentUser(req.cookies.get("session")?.value, sessionSecret()), "system:maintenance");
    return NextResponse.json(await store.get());
  } catch (e) {
    return errorResponse(e);
  }
}

async function handlePOST(req: NextRequest): Promise<Response> {
  try {
    const user = requirePermission(currentUser(req.cookies.get("session")?.value, sessionSecret()), "system:maintenance");
    const body = (await req.json()) as Partial<MaintenanceState>;
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: { code: "VALIDATION", message: "enabled は真偽値で指定してください" } }, { status: 400 });
    }
    const next: MaintenanceState = {
      enabled: body.enabled,
      ...(body.window ? { window: body.window } : {}),
      ...(body.estimatedRecovery ? { estimatedRecovery: body.estimatedRecovery } : {}),
      ...(body.message ? { message: body.message } : {}),
      updatedBy: user.email,
    };
    await store.set(next);
    await db.auditLog.create({
      data: {
        actor: user.email,
        action: body.enabled ? "maintenance.enabled" : "maintenance.disabled",
        target: "system",
        metadata: next as unknown as object,
      },
    });
    return NextResponse.json(await store.get());
  } catch (e) {
    return errorResponse(e);
  }
}

export const GET = withApiObservability("/api/admin/maintenance", handleGET);
export const POST = withApiObservability("/api/admin/maintenance", handlePOST);
