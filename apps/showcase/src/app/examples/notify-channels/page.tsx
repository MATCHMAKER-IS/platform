import { ExampleView } from "../../../components/example-view";
import { readExampleSource, excerptSource } from "../../../lib/example-source";

export const metadata = { title: "通知の使い分け(使用例)" };

export default function Page() {
  return (
    <ExampleView
      title="通知の使い分け"
      intro="メール・Slack・LINE・SMS を1つの API で扱います。チャネルを差し替えても、呼び出し側は変わりません。"
      packages={["notify"]}
      code={excerptSource(readExampleSource("notify-channels"), 70)}
      notes={["1つのチャネルが落ちても他は送る(例外を握って結果に入れる)。メールが失敗したから Slack にも送らない、では困る", "同じ通知を何度も送らない(重複抑制)。利用者に同じ通知が5回届くと信頼を失う", "深夜は送らない(静音時間)。深夜に通知を送ると、利用者は通知そのものを切ってしまう"]}
    />
  );
}
