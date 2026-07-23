import { EquipmentDemo } from "./equipment-client";
import { AppDemoNote } from "../../../components/app-demo-note";
export const metadata = { title: "備品管理(デモ)" };
export default function Page() {
  return (
    <>
      <div style={{ maxWidth: 900, margin: "16px auto 0", padding: "0 16px" }}>
        <AppDemoNote source="apps/equipment-app" usedFor="備品の貸出と返却" />
      </div>
      <EquipmentDemo />
    </>
  );
}
