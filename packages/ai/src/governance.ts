/** AI が下した判断の記録。 */
export interface AiDecisionRecord {
  /** いつ（ISO 8601）。 */
  at: string;
  /** 何についての判断か（`expense:1234`）。 */
  subject: string;
  /** 何と判断したか（`却下` `要確認`）。 */
  verdict: string;
  /**
   * **なぜそう判断したか**（AI の説明）。
   *
   * **これが無いと使えません。** 「なぜ却下されたか」を
   * **説明できない判断は、労務・会計では通りません**——
   * 本人に理由を言えないためです。
   */
  reason: string;
  /** どのモデルか（**後から「あのモデルの判断」と辿るため**）。 */
  model: string;
  /** どのプロンプトの版か（`@link PromptVersion` の `version`）。 */
  promptVersion?: number;
  /** 判断のもとにした資料（**RAG が引いた文書の ID**）。 */
  sources?: readonly string[];
  /** 人が確認したか。**`false` のまま業務に使わないでください**。 */
  reviewed: boolean;
}

/**
 * **AI の判断を、後から説明できる形で残す。**
 *
 * 【なぜ必要か】
 * 「なぜこの経費が却下されたか」を**後から説明できない**と、
 * **労務・会計では使えません**——本人に理由を言えないからです。
 *
 * 「AI が判断しました」は説明になりません。
 * **どのモデルが、どの資料をもとに、何と言ったか**が要ります。
 *
 * 【必ず `reviewed` を使ってください】
 * **AI の判断をそのまま業務に反映しないでください。**
 * 人が確認して初めて `reviewed: true` にする——
 * **確認していない判断が混ざると、全部が信用できなくなります**。
 *
 * 【保存先について】
 * **これはメモリ実装です。** 再起動すると消えます——
 * **本番では DB に入れてください**（説明を求められるのは**数か月後**です）。
 *
 * @returns 判断を記録する器
 */
export function createDecisionLog(): {
  /** 判断を記録する。 */
  record(input: Omit<AiDecisionRecord, "at">): AiDecisionRecord;
  /** ある対象についての判断（**新しい順**）。 */
  forSubject(subject: string): readonly AiDecisionRecord[];
  /**
   * **人が確認していない判断**。
   *
   * **ここが溜まっていたら危険です**——
   * 確認されないまま業務に使われている可能性があります。
   */
  unreviewed(): readonly AiDecisionRecord[];
  /** 全部（**新しい順**）。 */
  all(): readonly AiDecisionRecord[];
} {
  const records: AiDecisionRecord[] = [];
  return {
    record(input) {
      const entry: AiDecisionRecord = { ...input, at: new Date().toISOString() };
      // **新しいものを先頭に。** 「直近の判断」を見ることが多いためです
      records.unshift(entry);
      return entry;
    },
    forSubject: (subject) => records.filter((r) => r.subject === subject),
    unreviewed: () => records.filter((r) => !r.reviewed),
    all: () => records,
  };
}

/**
 * **同じ質問の答えを使い回す。**
 *
 * 【なぜ必要か】
 * **100 人が同じことを聞きます。** 「経費の申請方法は？」を
 * 100 人が聞けば**100 回課金**され、**100 回待たされます**。
 *
 * 答えを取っておけば、**2 人目からは即座に返り、費用もかかりません**。
 *
 * 【使ってはいけない場面】
 * **答えが変わるもの**には使わないでください:
 *
 * - 「**今月の**経費の合計は？」——日々変わります
 * - 「**私の**残業時間は？」——人によって違います
 *
 * **人によって答えが変わるなら、鍵に利用者を含めて**ください
 * ——含めないと、**他人の答えが返ります**。これは事故です。
 *
 * 【いつまで取っておくか】
 * **業務の変化より短く**してください。就業規則の質問なら 1 日、
 * 数字を含む質問なら**そもそも使わない**方が安全です。
 *
 * @param options `ttlMs`（既定 1 時間）と `maxEntries`（既定 500）
 * @returns 答えを取っておく器
 */
export function createAiResponseCache(options: {
  ttlMs?: number;
  maxEntries?: number;
} = {}): {
  /** 鍵を作る（**人によって答えが変わるなら `user` を渡す**）。 */
  keyOf(input: { prompt: string; model: string; user?: string }): string;
  /** 取り出す。**無ければ `undefined`**。 */
  get(key: string): string | undefined;
  /** 入れる。 */
  set(key: string, value: string): void;
  /** いま入っている数。 */
  size(): number;
  /** 当たった / 外れた回数（**効いているかの確認用**）。 */
  stats(): { hits: number; misses: number };
} {
  const ttlMs = options.ttlMs ?? 60 * 60 * 1000;
  const maxEntries = options.maxEntries ?? 500;
  const store = new Map<string, { value: string; expiresAt: number }>();
  let hits = 0;
  let misses = 0;

  return {
    keyOf({ prompt, model, user }) {
      // **空白の揺れを吸収する。** 「経費の申請方法は？」と
      // 「経費の申請方法は？ 」を別物にすると、**当たらなくなります**。
      const normalized = prompt.trim().replace(/\s+/g, " ");
      // **利用者を鍵に含めるかは呼び出し側の判断。**
      // 含めないと**他人の答えが返ります**——数字を含む質問では必ず含めてください。
      return `${model}\u0000${user ?? ""}\u0000${normalized}`;
    },

    get(key) {
      const entry = store.get(key);
      if (entry === undefined) { misses += 1; return undefined; }
      if (entry.expiresAt <= Date.now()) {
        // **期限切れは消してから外れとして返す。**
        // 残すと、**古い答えが「入っている」ように見えます**。
        store.delete(key);
        misses += 1;
        return undefined;
      }
      hits += 1;
      return entry.value;
    },

    set(key, value) {
      // **上限を超えたら古いものから消す。** 消さないと
      // **メモリが増え続け、いつか落ちます**。
      if (store.size >= maxEntries) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },

    size: () => store.size,
    stats: () => ({ hits, misses }),
  };
}

/**
 * **人ごと・部署ごとに費用の上限を持つ。**
 *
 * 【なぜ必要か】
 * 全体の上限だけだと、**1 人が暴走すると全員が止まります**。
 * 誤って繰り返し処理を仕掛けた人がいたとき、
 * **その人だけ止める**必要があります。
 *
 * 【月単位で数えます】
 * **日単位だと厳しすぎ、年単位だと気づくのが遅すぎます。**
 * 予算も月で組むことが多いので、月に合わせてあります。
 *
 * 【止めるだけでなく知らせてください】
 * **上限に当たってから気づくのでは遅い**です。
 * `usageRatio` が **0.8 を超えたら知らせる**などの仕組みにしてください
 * ——「今月はもう使えません」と当日に言われても困ります。
 *
 * @param limits `{ "yamada": 5000, "営業部": 50000 }` のような対応表（円）
 * @param options `defaultLimitJpy`（表に無い人の上限。**既定は 1,000 円**）
 * @returns 上限を見張る器
 */
export function createSpendingLimiter(
  limits: Readonly<Record<string, number>>,
  options: { defaultLimitJpy?: number } = {},
): {
  /** 使ってよいか。**超えるなら理由が返ります**。 */
  check(key: string, addJpy: number): { allowed: boolean; reason?: string };
  /** 使った分を記録する。 */
  add(key: string, costJpy: number): void;
  /** 今月いくら使ったか。 */
  used(key: string): number;
  /** 上限に対する割合（**0.8 を超えたら知らせてください**）。 */
  usageRatio(key: string): number;
  /** 月が変わったので数え直す。**月初に呼んでください**。 */
  resetMonth(): void;
} {
  const defaultLimit = options.defaultLimitJpy ?? 1000;
  const used = new Map<string, number>();
  const limitOf = (key: string): number => limits[key] ?? defaultLimit;

  return {
    check(key, addJpy) {
      const current = used.get(key) ?? 0;
      const limit = limitOf(key);
      if (current + addJpy > limit) {
        return {
          allowed: false,
          reason: `今月の上限を超えます（${key}: 使用 ${Math.round(current)} 円 + ${Math.round(addJpy)} 円 / 上限 ${limit} 円）`,
        };
      }
      return { allowed: true };
    },

    add(key, costJpy) {
      used.set(key, (used.get(key) ?? 0) + costJpy);
    },

    used: (key) => used.get(key) ?? 0,

    usageRatio(key) {
      const limit = limitOf(key);
      // **上限が 0 なら 1（使い切り）として返す。**
      // 0 で割ると `Infinity` になり、**判定が壊れます**。
      if (limit <= 0) return 1;
      return (used.get(key) ?? 0) / limit;
    },

    resetMonth() {
      used.clear();
    },
  };
}

/**
 * **同時に走る数を絞る。**
 *
 * 【なぜ必要か】
 * **100 人が同時に使うと、提供者のレート制限に当たります**。
 * 当たると**全員がエラー**になり、「AI が壊れた」と見えます。
 *
 * 順番に流せば、**待たされはしますが全員通ります**。
 * **待つ方が、全員が失敗するよりましです**。
 *
 * 【待ち行列が伸びたら知らせてください】
 * **`pending()` が増え続けるなら、そもそも処理が追いついていません**——
 * 同時数を増やすか、**使い方を見直す**必要があります。
 * **黙って待たせ続けると、利用者は諦めます**。
 *
 * @param concurrency 同時に走らせる数（**提供者の上限より少なく**）
 * @returns 順番に流す器
 */
export function createConcurrencyLimiter(concurrency: number): {
  /** 順番が来たら実行する。 */
  run<T>(task: () => Promise<T>): Promise<T>;
  /** いま走っている数。 */
  active(): number;
  /** 待っている数（**増え続けるなら追いついていません**）。 */
  pending(): number;
} {
  const max = Math.max(1, concurrency);
  let running = 0;
  const queue: (() => void)[] = [];

  const next = (): void => {
    if (running >= max) return;
    const task = queue.shift();
    if (task === undefined) return;
    running += 1;
    task();
  };

  return {
    run(task) {
      return new Promise((resolve, reject) => {
        queue.push(() => {
          task()
            .then(resolve, reject)
            .finally(() => {
              // **必ず減らす。** 失敗しても減らさないと、
              // **枠が埋まったまま全部止まります**。
              running -= 1;
              next();
            });
        });
        next();
      });
    },
    active: () => running,
    pending: () => queue.length,
  };
}

/**
 * **埋め込みモデルを変えるときの段取り。**
 *
 * 【なぜ必要か】
 * **モデルを変えると、過去のベクトルと互換性がなくなります。**
 * 古いベクトルと新しい質問を比べても、**意味のない数字**が出るだけです。
 *
 * **全件を作り直す必要があり、その間は検索が壊れます**——
 * 1 万件あれば数時間かかります。
 *
 * 【どう進めるか】
 * **一気に入れ替えないでください。**
 *
 * 1. 新しいモデルで**別の索引**を作る（古い方は残す）
 * 2. **両方を検索して**、結果を比べる
 * 3. 新しい方が良ければ**切り替える**
 * 4. しばらくしてから古い方を消す
 *
 * **この関数は「いまどの版か」「作り直しがどこまで進んだか」**を持ちます。
 *
 * @param currentModel いま使っているモデル
 * @returns 移行を管理する器
 */
export function createEmbeddingMigration(currentModel: string): {
  /** いまのモデル。 */
  current(): string;
  /** 移行を始める。 */
  start(nextModel: string, totalDocuments: number): void;
  /** 進んだ分を記録する。 */
  progress(done: number): void;
  /** いまの状態。 */
  status(): {
    migrating: boolean;
    from: string;
    to?: string;
    done: number;
    total: number;
    /** 割合（0〜1）。 */
    ratio: number;
  };
  /**
   * 切り替える。
   *
   * **全件が終わってからにしてください。** 途中で切り替えると、
   * **作り直していない文書が検索に出なくなります**
   * ——「あるはずの規程が出ない」という形で現れます。
   */
  complete(): { ok: boolean; reason?: string };
} {
  let from = currentModel;
  let to: string | undefined;
  let done = 0;
  let total = 0;

  return {
    current: () => from,

    start(nextModel, totalDocuments) {
      to = nextModel;
      total = totalDocuments;
      done = 0;
    },

    progress(count) {
      done = Math.min(count, total);
    },

    status: () => ({
      migrating: to !== undefined,
      from,
      to,
      done,
      total,
      // **0 件のときは 1（終わっている）とする。**
      // 0 で割ると `NaN` になり、**進捗の表示が壊れます**。
      ratio: total === 0 ? 1 : done / total,
    }),

    complete() {
      if (to === undefined) return { ok: false, reason: "移行を始めていません" };
      if (done < total) {
        return {
          ok: false,
          // **途中で切り替えさせない。** 切り替えると
          // **作り直していない文書が検索に出なくなります**。
          reason: `まだ終わっていません（${done}/${total}）`,
        };
      }
      from = to;
      to = undefined;
      done = 0;
      total = 0;
      return { ok: true };
    },
  };
}

/**
 * **社内文書の鮮度を見る。**
 *
 * 【なぜ必要か】
 * **RAG の元文書が古くなっても気づけません。**
 * 就業規則が改訂されたのに、**古い版で答え続ける**——
 * 「AI がそう言った」と信じた人が、**間違った手続きをします**。
 *
 * 【何を見るか】
 * **最後に更新してからの日数**だけです。中身が正しいかは分かりません
 * ——**「見直す時期が来た」と知らせる**のが役割です。
 *
 * 【期限は文書によって違います】
 * 就業規則は年 1 回、価格表は月 1 回、議事録は**そもそも古くて当たり前**。
 * **一律の期限にしないでください**——**鳴り続けるアラートは無視されます**。
 *
 * @param documents 文書（`id` / `updatedAt` / `maxAgeDays`）
 * @param now いまの時刻（試験用）
 * @returns 見直す時期が来た文書
 */
export function findStaleKnowledge(
  documents: readonly { id: string; title?: string; updatedAt: Date; maxAgeDays: number }[],
  now: Date = new Date(),
): { id: string; title?: string; ageDays: number; maxAgeDays: number }[] {
  const dayMs = 24 * 60 * 60 * 1000;
  return documents
    .map((d) => ({
      id: d.id,
      title: d.title,
      ageDays: Math.floor((now.getTime() - d.updatedAt.getTime()) / dayMs),
      maxAgeDays: d.maxAgeDays,
    }))
    .filter((d) => d.ageDays > d.maxAgeDays)
    // **古い順に返す。** 一番放置されているものから見直せます
    .sort((a, b) => b.ageDays - a.ageDays);
}

/**
 * **AI が何をしたかの記録**（道具の実行）。
 *
 * 【なぜ必要か】
 * 道具を渡すと、**AI が勝手に動きます**。
 * 「なぜこのデータが変わったか」を追えないと、
 * **おかしくなったときに原因が分かりません**。
 *
 * **`@platform/audit`（監査ログ）との違い**:
 * あちらは**人がした操作**を残します。ここは**AI が呼んだ道具**——
 * **「山田さんの指示で AI が経費を検索した」**という繋がりを残すためのものです。
 *
 * 【必ず「誰の指示か」を入れてください】
 * AI 自身は責任を負いません。**指示した人が誰か**が分からないと、
 * **記録があっても追及できません**。
 *
 * @returns 実行を記録する器
 */
export function createToolCallLog(): {
  /** 実行を記録する。 */
  record(input: {
    /** **誰の指示か**（必須）。 */
    actor: string;
    /** 呼んだ道具。 */
    tool: string;
    /** 渡した引数（**伏せ字を通してから**入れてください）。 */
    input: Record<string, unknown>;
    /** 成功したか。 */
    ok: boolean;
    /** かかった時間（ミリ秒）。 */
    latencyMs: number;
    /** 失敗したときの理由。 */
    error?: string;
  }): void;
  /** ある人の実行（**新しい順**）。 */
  forActor(actor: string): readonly {
    at: string; actor: string; tool: string; input: Record<string, unknown>;
    ok: boolean; latencyMs: number; error?: string;
  }[];
  /**
   * 道具ごとの集計。
   *
   * **失敗が多い道具は、説明が悪いか、AI に向いていません**——
   * どちらかを直す手がかりになります。
   */
  byTool(): Record<string, { calls: number; failures: number }>;
  /** 全部（**新しい順**）。 */
  all(): readonly {
    at: string; actor: string; tool: string; input: Record<string, unknown>;
    ok: boolean; latencyMs: number; error?: string;
  }[];
} {
  const records: {
    at: string; actor: string; tool: string; input: Record<string, unknown>;
    ok: boolean; latencyMs: number; error?: string;
  }[] = [];

  return {
    record(input) {
      records.unshift({ ...input, at: new Date().toISOString() });
    },
    forActor: (actor) => records.filter((r) => r.actor === actor),
    byTool() {
      const out: Record<string, { calls: number; failures: number }> = {};
      for (const r of records) {
        const e = (out[r.tool] ??= { calls: 0, failures: 0 });
        e.calls += 1;
        if (!r.ok) e.failures += 1;
      }
      return out;
    },
    all: () => records,
  };
}
