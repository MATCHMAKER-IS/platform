import { ExampleView } from "../../../components/example-view";
import { readExampleSource, excerptSource } from "../../../lib/example-source";

export const metadata = { title: "会計連携(freee)(使用例)" };

export default function Page() {
  return (
    <ExampleView
      title="会計連携(freee)"
      intro="仕訳を freee へ同期します。送信が途中で失敗して再実行しても、冪等キーで二重登録を防ぎます。"
      packages={["accounting", "freee"]}
      code={excerptSource(readExampleSource("accounting-sync"), 70)}
      notes={["冪等キー(日付+摘要+金額)で送信済みを判定する。バッチが再実行されても重複しない", "送る前に未登録の勘定科目を検出する。送ってからエラーになると、どこまで登録されたか分からなくなる", "並列にしない。レート制限と、失敗時にどこまで送ったかを確実に把握するため(速さより確実さ)"]}
    />
  );
}
