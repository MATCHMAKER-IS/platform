/** 初期セットアップ状態(GET)。管理者が居るか等を返す。認証不要（初回導入時に使う）。 */
import { withApiObservability } from "../../../../server/instrument";
import { userStore, settingsStore } from "../../../../server/platform-services";
import { setupState } from "../../../../server/setup";

async function handleGET(_req: Request): Promise<Response> {
  const users = await userStore.list();
  const settings = await settingsStore.get();
  const adminCount = users.filter((u) => u.roles.includes("admin")).length;
  const state = setupState({ userCount: users.length, adminCount, companyNameSet: !!settings.companyName && settings.companyName !== "" });
  return Response.json(state);
}

export const GET = withApiObservability("/api/setup/status", handleGET);
