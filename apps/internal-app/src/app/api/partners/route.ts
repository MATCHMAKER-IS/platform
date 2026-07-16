/** 取引先: 一覧(GET・?kind=で絞込)・登録更新(POST)。partner:read / partner:write。 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser, requirePermission } from "../../../server/authorize";
import { serverEnv } from "../../../server/env";
import { partnerStore, auditActions } from "../../../server/platform-services";
import { normalizeKinds, type Partner, type PartnerKind } from "../../../server/partner-repo";

const KINDS: PartnerKind[] = ["customer", "supplier", "payee"];

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "partner:read");
  const kindParam = new URL(req.url).searchParams.get("kind");
  const kind = kindParam && (KINDS as string[]).includes(kindParam) ? (kindParam as PartnerKind) : undefined;
  return Response.json({ partners: await partnerStore.list(kind) });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "partner:write");
  const body = (await req.json()) as Partner;
  const kinds = normalizeKinds(body.kinds ?? []);
  if (!body.code || !body.name || kinds.length === 0) return Response.json({ error: "コード・名称・区分(1つ以上)が必要です" }, { status: 400 });
  const partner: Partner = { code: body.code, name: body.name, kinds };
  if (body.contact) partner.contact = body.contact;
  if (body.note) partner.note = body.note;
  const saved = await partnerStore.upsert(partner);
  await auditActions.record(user!.email, "partner.upsert", `partner:${saved.code}`, { after: { kinds: saved.kinds } });
  return Response.json(saved, { status: 201 });
}

export const GET = withApiObservability("/api/partners", handleGET);
export const POST = withApiObservability("/api/partners", handlePOST);
