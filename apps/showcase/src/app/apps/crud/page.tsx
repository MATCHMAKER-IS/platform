import { CrudDemo } from "./crud-client";
import { AppDemoNote } from "../../../components/app-demo-note";
export const metadata = { title: "CRUDテンプレート(デモ)" };
export default function Page() {
  return (
    <>
      <div style={{ maxWidth: 900, margin: "16px auto 0", padding: "0 16px" }}>
        <AppDemoNote source="apps/crud-template" usedFor="新しいアプリの出発点" />
      </div>
      <CrudDemo />
    </>
  );
}
