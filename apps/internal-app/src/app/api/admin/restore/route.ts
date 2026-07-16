/**
 * 管理: バックアップ復元/インポート(POST)。バンドルJSONを検証し、安全なデータセット(設定・取引先)を適用する。管理者のみ。
 * dryRun=true でプレビュー（適用せず件数のみ）。
 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { partnerStore, settingsStore, auditActions } from "../../../../server/platform-services";
import { parseBackupBundle, restorePlan, applyRestore, type Appliers } from "../../../../server/restore";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user || !user.roles.includes("admin")) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const body = (await req.json()) as { bundle?: unknown; dryRun?: boolean };
  const parsed = parseBackupBundle(typeof body.bundle === "string" ? body.bundle : JSON.stringify(body.bundle ?? {}));
  if (!parsed.ok || !parsed.bundle) return Response.json({ error: parsed.error ?? "バンドルが不正です" }, { status: 400 });

  const appliers: Appliers = {
    partners: async (records) => {
      let n = 0;
      for (const r of records as { code: string; name: string; kinds?: string[]; contact?: string; note?: string }[]) {
        if (!r.code || !r.name) continue;
        const kinds = (r.kinds ?? ["customer"]).filter((k): k is "customer" | "supplier" | "payee" => k === "customer" || k === "supplier" || k === "payee");
        await partnerStore.upsert({ code: r.code, name: r.name, kinds: kinds.length > 0 ? kinds : ["customer"], ...(r.contact ? { contact: r.contact } : {}), ...(r.note ? { note: r.note } : {}) });
        n += 1;
      }
      return n;
    },
    settings: async (records) => {
      const first = (records as Record<string, unknown>[])[0];
      if (first && typeof first.companyName === "string") { await settingsStore.update({ companyName: first.companyName }); return 1; }
      return 0;
    },
  };

  const dryRun = body.dryRun ?? false;
  const result = await applyRestore(parsed.bundle, appliers, { dryRun });
  if (!dryRun) await auditActions.record(user.email, "backup.restore", `applied:${result.applied.reduce((s, a) => s + a.count, 0)}`, {});
  return Response.json({ plan: restorePlan(parsed.bundle), result });
}

export const POST = withApiObservability("/api/admin/restore", handlePOST);
