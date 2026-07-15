/**
 * メールアドレス → ロール割当(ディレクトリ)。
 * 実運用では Zoho People の役職や社内 DB から解決する。ここでは環境変数 + 既定。
 * @packageDocumentation
 */

/** ROLE_MAP 環境変数("a@x.jp=admin;b@x.jp=finance,manager")をパースする。 */
function parseRoleMap(raw: string | undefined): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  if (!raw) return map;
  for (const entry of raw.split(";")) {
    const [email, roles] = entry.split("=");
    if (email && roles) map[email.trim().toLowerCase()] = roles.split(",").map((r) => r.trim()).filter(Boolean);
  }
  return map;
}

/** メールアドレスからロールを解決する。未登録は既定 ["employee"]。 */
export function resolveRoles(email: string, env: Record<string, string | undefined> = process.env): string[] {
  const map = parseRoleMap(env.ROLE_MAP);
  const found = map[email.toLowerCase()];
  if (found && found.length > 0) return found;
  const defaults = (env.DEFAULT_ROLES ?? "employee").split(",").map((r) => r.trim()).filter(Boolean);
  return defaults.length > 0 ? defaults : ["employee"];
}
