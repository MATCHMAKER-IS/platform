import { ExampleView } from "../../../components/example-view.js";
import { readExampleSource, excerptSource } from "../../../lib/example-source.js";

export const metadata = { title: "チャットロジック(使用例)" };

export default function Page() {
  return (
    <ExampleView
      title="チャットロジック"
      intro="未読数・メンション・ピン留めを扱います。"
      packages={["chat"]}
      code={excerptSource(readExampleSource("chat-room"), 70)}
      notes={["自分の発言は未読に数えない(自分が書いたものを「未読」と言われても困る)", "既読のメンションは再通知しない(通知が信用されなくなる)", "ピンはルーム全体で共有、ブックマークは個人用(混同しやすい2つ)"]}
    />
  );
}
