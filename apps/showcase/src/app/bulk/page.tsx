"use client";

/**
 * 一括操作と取り消しの見本。
 *
 * **100 人規模では、承認者の負担が最初に限界**を迎えます。
 * 一括で押せるようにしつつ、**押し間違いを戻せる**形を示します。
 */
import * as React from "react";

import { UsesPackages } from "../../components/uses-packages";
import { BulkDemo } from "./bulk-demo";

export default function Page(): React.JSX.Element {
  return (
    <main style={{ padding: "2rem", maxWidth: "56rem", margin: "0 auto" }}>
      <h1>一括操作と取り消し</h1>

      <p>
        <strong>100 人規模では、承認者の負担が最初に限界を迎えます。</strong>
        月末に 100 件の申請を 1 件ずつ押すのは現実的でありません。
      </p>
      <p>
        <strong>ただし一括は事故が大きい</strong>ので、
        <strong>取り消しと必ず組</strong>にしてください。
        「本当に実行しますか？」の確認だけでは足りません
        —— <strong>人は確認を読まずに押します</strong>。
      </p>

      <h2>試してみてください</h2>
      <ul>
        <li>全選択して却下すると、<strong>4 件目だけわざと失敗</strong>します（一部失敗の見え方）</li>
        <li>失敗した理由が<strong>件ごとに出る</strong>ことを確かめてください</li>
        <li><strong>取り消し</strong>を押すと元に戻ります（<strong>5 分以内</strong>）</li>
        <li>取り消しを<strong>2 回押しても、二度は戻りません</strong></li>
      </ul>

      <BulkDemo />

      <h2>設計の判断</h2>
      <dl>
        <dt><strong>途中で止めない</strong></dt>
        <dd>止めると「どこまで進んだか」を人が調べることになります。</dd>

        <dt><strong>取り消しは 5 分</strong></dt>
        <dd>
          いつまでも戻せるのは危険です——その間に別の人が変更していれば、
          <strong>後から入った変更を壊します</strong>。
        </dd>

        <dt><strong>件数を確認文に必ず出す</strong></dt>
        <dd><strong>100 件を 1 件と間違えたときに気づけます</strong>。</dd>

        <dt><strong>戻せないことも必ず伝える</strong></dt>
        <dd>「戻せると思っていた」が一番困ります。</dd>
      </dl>

      <UsesPackages packages={["@platform/ui"]} />
    </main>
  );
}
