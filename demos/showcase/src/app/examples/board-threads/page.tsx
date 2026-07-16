import { ExampleView } from "../../../components/example-view";
import { readExampleSource, excerptSource } from "../../../lib/example-source";

export const metadata = { title: "掲示板ロジック(使用例)" };

export default function Page() {
  return (
    <ExampleView
      title="掲示板ロジック"
      intro="スレッドの並べ替え・未読・メンションを扱います。画面は別途、このロジックを使って組み立てます。"
      packages={["board"]}
      code={excerptSource(readExampleSource("board-threads"), 70)}
      notes={["ピン留めは常に上に出す(重要なお知らせが流れないように)", "未読は最終既読より後の投稿。自分の投稿は未読に数えない"]}
    />
  );
}
