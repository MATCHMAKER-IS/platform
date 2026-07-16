import { ExampleView } from "../../../components/example-view.js";
import { readExampleSource, excerptSource } from "../../../lib/example-source.js";

export const metadata = { title: "給与明細PDF(使用例)" };

export default function Page() {
  return (
    <ExampleView
      title="給与明細PDF"
      intro="割増を計算して明細を組み立て、印刷用 HTML にします。"
      packages={["payroll", "report", "pdf"]}
      code={excerptSource(readExampleSource("payslip-pdf"), 70)}
      notes={["労基法の割増率: 時間外25%(月60時間超は50%)・深夜25%・休日35%。重複する場合は加算", "率を間違えると未払い賃金になり、遡って請求される", "法定の記載事項(支給の内訳・控除の内訳・差引支給額)を満たす形にする"]}
    />
  );
}
