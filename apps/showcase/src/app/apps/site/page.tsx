import { SiteDemo } from "./site-client";
import { AppDemoNote } from "../../../components/app-demo-note";
export const metadata = { title: "公開サイト(デモ)" };
export default function Page() {
  return (
    <>
      <div style={{ maxWidth: 900, margin: "16px auto 0", padding: "0 16px" }}>
        <AppDemoNote source="apps/public-site" usedFor="社外向けの公開サイト" />
      </div>
      <SiteDemo />
    </>
  );
}
