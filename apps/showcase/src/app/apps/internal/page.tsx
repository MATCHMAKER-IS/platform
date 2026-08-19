import { InternalAppDemo } from "./internal-client";
import { AppDemoNote } from "../../../components/app-demo-note";
export const metadata = { title: "社内アプリ(デモ)" };
export default function Page() {
  return (
    <>
      <div style={{ maxWidth: 900, margin: "16px auto 0", padding: "0 16px" }}>
        <AppDemoNote source="apps/internal-app" usedFor="経費・勤怠・請求などの社内業務" />
      </div>
      <InternalAppDemo />
    </>
  );
}
