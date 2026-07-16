import { ExampleView } from "../../../components/example-view";
import { readExampleSource, excerptSource } from "../../../lib/example-source";

export const metadata = { title: "ブループリント(業務プロセス)(使用例)" };

export default function Page() {
  return (
    <ExampleView
      title="ブループリント(業務プロセス)"
      intro="承認フローを状態と遷移で宣言的に定義します。Zoho CRM のブループリントに相当する仕組みです。"
      packages={["blueprint", "fsm", "workflow"]}
      code={excerptSource(readExampleSource("blueprint-workflow"), 70)}
      notes={["順序を飛ばせない(未申請から承認済みへは飛べない)。飛ばせると、承認していない経費が精算される", "遷移できるイベントだけをボタンに出す(できない操作のボタンを出さない)"]}
    />
  );
}
