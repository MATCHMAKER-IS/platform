/**
 * 現在の環境変数の状態を返す(障害調査用)。「今どの設定で動いているか」を管理画面で見るため。
 * 秘密値は必ずマスクし、値そのものは決して返さない(設定の有無だけ分かる)。管理者のみ。
 * DB のシステム設定は /api/admin/settings、こちらは起動時に読んだ環境変数。
 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv, featureEnv, env } from "../../../../server/env";
import { maskSecrets, isSecretName } from "@platform/env";

/** 設定 1 件の表示用データ。 */
interface EnvRow {
  name: string;
  /** 値(秘密値は "***"、未設定は空)。 */
  value: string;
  /** 設定されているか(秘密値でも有無は分かる)。 */
  isSet: boolean;
  /** 秘密値か。 */
  secret: boolean;
  /** 区分。 */
  group: "基本" | "秘密" | "機能";
}

function toRows(values: Record<string, unknown>, group: EnvRow["group"]): EnvRow[] {
  const masked = maskSecrets(values);
  return Object.entries(values).map(([name, raw]) => ({
    name,
    value: masked[name] ?? "",
    isSet: raw !== undefined && raw !== null && String(raw) !== "" && String(raw) !== "false" && String(raw) !== "0",
    secret: isSecretName(name),
    group,
  }));
}

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  try {
    requirePermission(user, "admin");
  } catch {
    return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  const rows: EnvRow[] = [
    ...toRows(env as Record<string, unknown>, "基本"),
    ...toRows(serverEnv as unknown as Record<string, unknown>, "秘密"),
    ...toRows(featureEnv as unknown as Record<string, unknown>, "機能"),
  ];
  // 同名(DATABASE_URL など複数の区分に現れるもの)は先勝ちで 1 件に
  const seen = new Set<string>();
  const unique = rows.filter((r) => (seen.has(r.name) ? false : (seen.add(r.name), true)));

  return Response.json({
    env: unique.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name)),
    runtime: { nodeEnv: (env as { NODE_ENV?: string }).NODE_ENV ?? "unknown", nodeVersion: process.version },
  });
}

export const GET = withApiObservability("/api/admin/env", handleGET);
