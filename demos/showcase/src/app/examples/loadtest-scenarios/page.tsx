import { ExampleView } from "../../../components/example-view";
import { readExampleSource, excerptSource } from "../../../lib/example-source";

export const metadata = { title: "負荷試験(使用例)" };

export default function Page() {
  return (
    <ExampleView
      title="負荷試験"
      intro="実際の利用パターンを再現して p95 を測ります。一気に負荷をかけず、徐々に増やしてどこで壊れるかを見ます。"
      packages={["loadtest"]}
      code={excerptSource(readExampleSource("loadtest-scenarios"), 70)}
      notes={["性能は平均ではなく p95 を見る。平均は外れ値に引きずられて実態を隠す", "重み付きでステップを選ぶ(一覧7割・詳細2割・更新1割)。均等に叩いても実態と合わない", "乱数を引数で受け取るので純関数(テストで結果を固定できる)"]}
    />
  );
}
