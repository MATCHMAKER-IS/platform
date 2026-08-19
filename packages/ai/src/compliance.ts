/**
 * **引いた資料に書いていないことを答えていないか**を見る（幻覚の検出）。
 *
 * 【なぜ必要か】
 * **RAG を入れた最大の目的は「嘘をつかせない」こと**です。
 * ところが、**引いた文書に書いていないことを答えても、誰も気づけません**——
 * 「規程にそう書いてあります」と言われ、**実際には書いていない**。
 * これが**最も起きやすく、最も困る失敗**です。
 *
 * 【何を見るか】
 * **数字と固有名詞だけ**です。文章の意味は見ません——
 * 意味の照合には別の AI 呼び出しが要り、**費用が倍**になります。
 *
 * **数字は特に大事です。** 「上限は 3 万円」と答えたのに
 * 資料には「2 万円」しか無い——**金額の取り違えは実害が出ます**。
 *
 * 【この検査の限界】
 * **言い換えは検出できません。** 資料が「三万円」で答えが「30,000 円」なら
 * 「資料に無い」と出ます——**誤検出です**。
 *
 * **見つかったら止めるのではなく、人に確認させて**ください。
 * 止めると、**正しい言い換えまで弾かれます**。
 *
 * @param answer AI の答え
 * @param sources 引いた資料の本文
 * @returns 資料に見つからなかった数字・語
 */
export function findUnsupportedClaims(
  answer: string,
  sources: readonly string[],
): { numbers: string[]; terms: string[] } {
  const haystack = sources.join("\n");

  // **数字を拾う。** 桁区切りのカンマは外して比べます
  // ——「30,000」と「30000」を別物にすると、**誤検出だらけ**になります。
  const normalize = (s: string): string => s.replace(/[,，]/g, "");
  const normalizedHay = normalize(haystack);

  const numbers = [...new Set(
    (answer.match(/\d[\d,，]*(?:\.\d+)?/g) ?? []).map(normalize),
  )].filter((n) => {
    // **1 桁の数字は無視する。** 「1 つ目」「2 番目」のような
    // **数え上げ**が引っかかり、**うるさくなるだけ**です。
    if (n.replace(/\D/g, "").length <= 1) return false;
    return !normalizedHay.includes(n);
  });

  // **固有名詞らしきもの**を拾う。**カタカナ語と英大文字の語**だけ。
  // 漢字の語は**日本語では区切りが曖昧**で、拾うと誤検出が増えます。
  const terms = [...new Set([
    ...(answer.match(/[ァ-ヴー]{3,}/g) ?? []),
    ...(answer.match(/\b[A-Z][A-Za-z]{2,}\b/g) ?? []),
  ])].filter((t) => !haystack.includes(t));

  return { numbers, terms };
}

/**
 * **AI に「自信がない」と言わせる**ための後始末。
 *
 * 【なぜ必要か】
 * **AI は分からないときも、それらしく答えます。**
 * 「就業規則には記載がありません」と言うべき場面で、
 * **もっともらしい嘘**を返す方が多いのです。
 *
 * 【どう使うか】
 * プロンプトに「**分からないときは『資料に記載がありません』と答えてください**」
 * と書いたうえで、この関数で**その言い回しが出たか**を見ます。
 *
 * **出たら、それは失敗ではありません**——**正しく「分からない」と言えた**
 * ということです。**そのまま利用者に見せて**ください。
 *
 * @param answer AI の答え
 * @returns 「分からない」と言っているなら true
 */
export function isDeclinedAnswer(answer: string): boolean {
  return /(記載がありません|見つかりませんでした|わかりません|分かりません|情報がありません|判断できません)/
    .test(answer);
}

/**
 * **2 つのやり方を同じ入力で比べる**（A/B 比較）。
 *
 * 【評価（eval）との違い】
 * 評価は**決まった質問集**で点数を出します。こちらは**本番の実データ**で
 * 2 つを走らせて比べます——**実際に来る質問は、想定と違う**からです。
 *
 * 【費用が倍になります】
 * **両方を走らせるので、そのぶん課金されます。**
 * **全部の質問で比べないでください**——`sampleRate` で
 * **一部だけ**（1 割など）にするのが現実的です。
 *
 * 【どちらを利用者に見せるか】
 * **A（いまのやり方）を見せてください。** B は記録するだけです——
 * **試している方を見せると、利用者が実験台**になります。
 *
 * @param options `sampleRate`（0〜1。既定 0.1 = 1 割）
 * @returns 比較を回す器
 */
export function createAbComparison(options: { sampleRate?: number } = {}): {
  /**
   * 比べる。**返すのは常に A の結果**です。
   *
   * B は記録するだけ——**試している方を利用者に見せません**。
   */
  run<T>(
    input: string,
    a: () => Promise<T>,
    b: () => Promise<T>,
  ): Promise<T>;
  /** 比べた記録。 */
  samples(): readonly { input: string; a: unknown; b: unknown; at: string }[];
} {
  const sampleRate = Math.min(1, Math.max(0, options.sampleRate ?? 0.1));
  const records: { input: string; a: unknown; b: unknown; at: string }[] = [];

  return {
    async run(input, a, b) {
      const resultA = await a();
      // **一部だけ比べる。** 全部で比べると**費用が倍**になります
      if (Math.random() < sampleRate) {
        try {
          const resultB = await b();
          records.push({ input, a: resultA, b: resultB, at: new Date().toISOString() });
        } catch {
          // **B が失敗しても A には影響させない。**
          // 試している方の失敗で**本番が止まっては本末転倒**です。
        }
      }
      return resultA;
    },
    samples: () => records,
  };
}

/**
 * **AI に送ってはいけない文書か**を見る。
 *
 * 【なぜ必要か】
 * **給与表が RAG に入ってしまう事故は、起きたら取り返しがつきません。**
 * 一度ベクトル化して索引に入れると、**誰かの質問で引かれます**——
 * 「山田さんの評価は」と聞かれて答えてしまう、という形で表に出ます。
 *
 * **入れる前に弾く**しかありません。**入れてから消しても、
 * その間に引かれた分は取り返せません**。
 *
 * 【何で判断するか】
 * **文書側の印**（分類・タグ・パス）です。
 * **中身から推測しません**——推測は外れるからです。
 *
 * **迷ったら弾いてください。** 「入れて良かったのに弾かれた」は
 * 後から直せますが、**逆は直せません**。
 *
 * @param doc 文書の情報
 * @param policy 弾く条件
 * @returns 弾く理由。**送ってよければ `undefined`**
 */
export function checkAiExclusion(
  doc: {
    /** 保存先のパス（`/hr/salary/2026.xlsx`）。 */
    path?: string;
    /** 分類（`人事` `経理`）。 */
    category?: string;
    /** 付いている印（`confidential` `no-ai`）。 */
    tags?: readonly string[];
  },
  policy: {
    /** 弾くパスの一部（`/hr/` `/salary/`）。 */
    excludePaths?: readonly string[];
    /** 弾く分類。 */
    excludeCategories?: readonly string[];
    /** 弾く印（**既定で `no-ai` と `confidential` を弾きます**）。 */
    excludeTags?: readonly string[];
  } = {},
): string | undefined {
  // **既定で弾く印を持っておく。** 設定を書き忘れても、
  // **`no-ai` と書いた文書は守られます**。
  const tags = policy.excludeTags ?? ["no-ai", "confidential", "社外秘"];
  const hit = (doc.tags ?? []).find((t) => tags.includes(t));
  if (hit !== undefined) return `印が付いています: ${hit}`;

  const path = doc.path ?? "";
  const badPath = (policy.excludePaths ?? []).find((p) => path.includes(p));
  if (badPath !== undefined) return `送らない場所の文書です: ${badPath}`;

  const category = doc.category ?? "";
  if ((policy.excludeCategories ?? []).includes(category)) {
    return `送らない分類です: ${category}`;
  }
  return undefined;
}

/**
 * **利用者に見せる説明を作る。**
 *
 * 【なぜ必要か】
 * **「これは AI が作った」と分からないまま渡すと、
 * 利用者は人が確認したものだと思います。**
 * 間違っていたときに「聞いていない」となります。
 *
 * EU AI 法をはじめ、**AI の関与を明示する**流れは強まっています——
 * 社内でも、**規程に書く前に付けておく**方が後で楽です。
 *
 * 【元にした資料も出してください】
 * 「規程の第 12 条をもとに答えました」と分かれば、
 * **利用者が自分で確かめられます**——**確かめられることが信頼**です。
 *
 * @param input 何をもとに、どう作ったか
 * @returns 画面に出す説明
 */
export function buildAiDisclosure(input: {
  /** 使ったモデル。 */
  model: string;
  /** 元にした資料の名前。 */
  sources?: readonly string[];
  /** 人が確認したか。 */
  reviewed?: boolean;
}): string {
  const lines = ["この回答は AI が生成しました。"];

  if (input.reviewed === true) {
    lines.push("**人が内容を確認しています。**");
  } else {
    // **確認していないことを隠さない。** 隠すと、
    // **利用者は確認済みだと思って使います**。
    lines.push("**人はまだ確認していません。** 重要な判断に使う前に確かめてください。");
  }

  if (input.sources !== undefined && input.sources.length > 0) {
    lines.push(`元にした資料: ${input.sources.join(" / ")}`);
  } else {
    // **資料が無いことも書く。** 「どこにも書いていないことを
    // AI が組み立てた」と分かるためです。
    lines.push("**元にした社内資料はありません**（AI の知識だけで答えています）。");
  }

  lines.push(`（${input.model}）`);
  return lines.join("\n");
}

/**
 * **やり取りをいつまで残すか**を決める。
 *
 * 【なぜ必要か】
 * **AI とのやり取りには個人情報が混ざります**——
 * 「山田さんの評価を要約して」という質問そのものが個人情報です。
 *
 * **無期限に持つのは危険**です。漏れたときの被害が
 * **持っている期間に比例**して大きくなります。
 *
 * 【期間の目安】
 * | 何 | 目安 | 理由 |
 * |---|---|---|
 * | 質問と答え | **90 日** | 問い合わせ対応に必要な期間 |
 * | 使用量の記録 | **3 年** | 費用の分析。**中身は含めない** |
 * | 判断の記録 | **7 年** | 説明を求められる期間（会計に準じる） |
 *
 * **中身と使用量を分けて持ってください。** 中身は短く、
 * **数字だけは長く**——そうすれば、費用の分析はできて、
 * **個人情報は早く消せます**。
 *
 * @param records 記録（`at` を持つもの）
 * @param retentionDays 残す日数
 * @param now いまの時刻（試験用）
 * @returns 消してよいものと、残すもの
 */
export function partitionByRetention<T extends { at: string }>(
  records: readonly T[],
  retentionDays: number,
  now: Date = new Date(),
): { keep: T[]; expired: T[] } {
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  const keep: T[] = [];
  const expired: T[] = [];
  for (const r of records) {
    const at = Date.parse(r.at);
    // **日付が読めないものは残す。** 消す方に倒すと、
    // **壊れた記録が黙って消えます**——消えたことにも気づけません。
    if (Number.isNaN(at) || at >= cutoff) keep.push(r);
    else expired.push(r);
  }
  return { keep, expired };
}

/**
 * **AI がやりたいことを、人が押すまで待たせる**（Human-in-the-loop）。
 *
 * 【なぜ必要か】
 * いまは**道具を渡すか渡さないかの二択**です。
 * 「経費を検索する」は渡せても、「経費を却下する」は渡せません——
 * **間違えたときに取り返しがつかない**からです。
 *
 * **中間が要ります**: AI は「却下したい」と**提案するだけ**。
 * **人が押して初めて実行**される。
 *
 * これがあれば、**危ない道具も安全に増やせます**。
 *
 * 【期限を必ず入れてください】
 * **押されないまま溜まります。** 「誰も見ていない提案」が
 * 100 件溜まると、**本当に必要なものが埋もれます**——
 * 期限を過ぎたものは**自動で流して**ください。
 *
 * @param options `expiresInMs`（既定 24 時間）
 * @returns 提案を管理する器
 */
export function createApprovalQueue(options: { expiresInMs?: number } = {}): {
  /** AI の提案を積む。 */
  propose(input: {
    /** 誰の指示で AI が動いたか。 */
    actor: string;
    /** 何をしたいか（`expense:1234 を却下`）。 */
    action: string;
    /** **なぜそうしたいか**（AI の説明）。**無いと人は判断できません**。 */
    reason: string;
    /** 実行するときに使う値。 */
    payload: Record<string, unknown>;
  }): string;
  /** 待っている提案（**期限切れを除く**）。 */
  pending(now?: Date): readonly {
    id: string; actor: string; action: string; reason: string;
    payload: Record<string, unknown>; at: string; expiresAt: string;
  }[];
  /**
   * 人が承認して実行する。
   *
   * **承認した人を必ず記録します**——
   * 「AI が勝手にやった」で終わらせないためです。
   */
  approve(id: string, approver: string): {
    ok: boolean;
    reason?: string;
    payload?: Record<string, unknown>;
  };
  /** 却下する。 */
  reject(id: string, approver: string): boolean;
  /** 期限切れを片付ける。**定期的に呼んでください**。 */
  sweepExpired(now?: Date): number;
} {
  const expiresInMs = options.expiresInMs ?? 24 * 60 * 60 * 1000;
  const items = new Map<string, {
    id: string; actor: string; action: string; reason: string;
    payload: Record<string, unknown>; at: string; expiresAt: string;
    decidedBy?: string; decision?: "approved" | "rejected";
  }>();
  let seq = 0;

  const isPending = (
    v: { decision?: string; expiresAt: string },
    now: Date,
  ): boolean => v.decision === undefined && Date.parse(v.expiresAt) > now.getTime();

  return {
    propose(input) {
      seq += 1;
      const id = `ap-${seq}`;
      const now = Date.now();
      items.set(id, {
        id, ...input,
        at: new Date(now).toISOString(),
        expiresAt: new Date(now + expiresInMs).toISOString(),
      });
      return id;
    },

    pending: (now = new Date()) =>
      [...items.values()].filter((v) => isPending(v, now)),

    approve(id, approver) {
      const item = items.get(id);
      if (item === undefined) return { ok: false, reason: "提案が見つかりません" };
      // **一度決めたものを二度実行させない。**
      // 連打で**二重に実行される**のを防ぎます。
      if (item.decision !== undefined) {
        return { ok: false, reason: `すでに${item.decision === "approved" ? "承認" : "却下"}されています` };
      }
      if (Date.parse(item.expiresAt) <= Date.now()) {
        // **期限切れは実行させない。** 古い判断のまま実行すると、
        // **状況が変わっているのに動きます**。
        return { ok: false, reason: "期限が切れています。もう一度 AI に聞き直してください" };
      }
      item.decision = "approved";
      item.decidedBy = approver;
      return { ok: true, payload: item.payload };
    },

    reject(id, approver) {
      const item = items.get(id);
      if (item === undefined || item.decision !== undefined) return false;
      item.decision = "rejected";
      item.decidedBy = approver;
      return true;
    },

    sweepExpired(now = new Date()) {
      let removed = 0;
      for (const [id, v] of items) {
        if (v.decision === undefined && Date.parse(v.expiresAt) <= now.getTime()) {
          items.delete(id);
          removed += 1;
        }
      }
      return removed;
    },
  };
}
