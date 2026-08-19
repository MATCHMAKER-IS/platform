import { ExampleView } from "../../../components/example-view";
import { readExampleSource, excerptSource } from "../../../lib/example-source";

export const metadata = { title: "キャスト紹介サイト(使用例)" };

export default function Page() {
  return (
    <ExampleView
      title="キャスト紹介サイト"
      intro="評価の重み付け・タグ検索・プロフィールの充実度を扱います。"
      packages={["cast", "seo", "social"]}
      code={excerptSource(readExampleSource("cast-site"), 70)}
      notes={["1件だけ5点の人を1位にしない(ベイズ平均)。評価が高いのか、たまたま1件が良かっただけかを区別する", "退店した人が公開サイトに残らないよう、一覧の前に必ず絞る"]}
    />
  );
}
