/**
 * **プロンプトの版管理と評価。**
 *
 * 【なぜ必要か】
 * プロンプトは**コードと同じくらい壊れやすい**のに、
 * **コードのように扱われていません**:
 *
 * - 「ちょっと直したら**前より悪くなった**」——**戻せません**
 * - 「誰がいつ変えたのか」——**残っていません**
 * - 「良くなったか」——**感覚で判断**しています
 *
 * ここでは 2 つを扱います:
 *
 * 1. **版管理**（{@link createPromptRegistry}）——いつ誰が何を変えたか
 * 2. **評価**（{@link runEvaluation}）——決まった質問集で点数を出す
 *
 * 【評価について現実的なこと】
 * **完璧な採点はできません。** 「良い答え」は場合によるからです。
 * ここでできるのは**明らかな失敗を見つける**こと——
 * 「金額が入っていない」「JSON が壊れている」「禁止語が出た」。
 *
 * **それでも十分に役に立ちます。** プロンプトを変えたときに
 * **10 問中 8 問通っていたのが 5 問になった**と分かれば、戻す判断ができます。
 *
 * （`index.ts` に同居しています）
 */

/** 1 つの版。 */
export interface PromptVersion {
  /** 版の番号（**1 から増えます**）。 */
  version: number;
  /** 中身。 */
  template: string;
  /** 誰が変えたか。**「不明」を許さない**ため必須です。 */
  author: string;
  /**
   * なぜ変えたか。
   *
   * **これが一番大事です。** 「金額の抽出が甘かったので、
   * 例を 2 つ足した」と書いてあれば、**戻すべきか判断できます**。
   * 「修正」だけだと、**何も分かりません**。
   */
  reason: string;
  /** いつ変えたか（ISO 8601）。 */
  at: string;
}

/** プロンプトの版を管理する器。 */
export interface PromptRegistry {
  /**
   * 新しい版を登録する。
   *
   * **中身が前と同じなら登録しません**（版だけ増えるのを防ぎます）。
   *
   * @returns 登録した版。同じ中身なら**前の版をそのまま**返します
   */
  register(input: { template: string; author: string; reason: string }): PromptVersion;

  /** いま使う版（**最新**）。 */
  current(): PromptVersion | undefined;

  /**
   * 指定した版を取り出す。
   *
   * **戻したいときに使います**——「3 版が良かった」なら、
   * その中身をそのまま登録し直してください
   * （**履歴は消さない**ので、戻した記録も残ります）。
   */
  get(version: number): PromptVersion | undefined;

  /** 全部の版（**古い順**）。 */
  history(): readonly PromptVersion[];
}

/**
 * プロンプトの版を管理する器を作る。
 *
 * 【保存先について】
 * **これはメモリ実装です。** 再起動すると消えます——
 * **本番では DB に入れてください**（`history()` の中身をそのまま保存できます）。
 *
 * **消えて困るのは「なぜ変えたか」**です。中身はコードにも残りますが、
 * **理由はここにしかありません**。
 *
 * @param initial 最初の版（任意）
 * @returns 版を管理する器
 */
export function createPromptRegistry(initial?: {
  template: string;
  author: string;
  reason: string;
}): PromptRegistry {
  const versions: PromptVersion[] = [];

  const register = (input: { template: string; author: string; reason: string }): PromptVersion => {
    const last = versions[versions.length - 1];
    // **同じ中身なら版を増やしません。** 増やすと
    // **「何回変えたか」が意味を失います**（実際は変わっていないため）。
    if (last !== undefined && last.template === input.template) return last;
    const next: PromptVersion = {
      version: versions.length + 1,
      template: input.template,
      author: input.author,
      reason: input.reason,
      at: new Date().toISOString(),
    };
    versions.push(next);
    return next;
  };

  if (initial !== undefined) register(initial);

  return {
    register,
    current: () => versions[versions.length - 1],
    get: (version) => versions.find((v) => v.version === version),
    history: () => versions,
  };
}

/** 評価の 1 問。 */
export interface EvaluationCase {
  /** 何を確かめる問題か（**失敗したときに表示されます**）。 */
  name: string;
  /** AI に送る入力。 */
  input: string;
  /**
   * 答えを確かめる。
   *
   * **問題があれば説明を返してください。** 通れば `undefined`。
   *
   * **「完璧な答え」を求めないでください。** 求めると、
   * **正しい答えまで失敗になり、評価が使えなくなります**——
   * 「金額が入っているか」「JSON として読めるか」程度で十分です。
   */
  check: (output: string) => string | undefined;
}

/** 評価の結果。 */
export interface EvaluationResult {
  /** 通った数。 */
  passed: number;
  /** 全体の数。 */
  total: number;
  /** 失敗した問題（**名前と理由**）。 */
  failures: { name: string; reason: string }[];
  /** かかった時間（ミリ秒）。 */
  elapsedMs: number;
}

/**
 * **決まった質問集で点数を出す。**
 *
 * 【いつ回すか】
 * **プロンプトを変えたとき**です。変える前と後で回して、
 * **点数が下がっていないか**を見ます。
 *
 * 【毎回同じ点にはなりません】
 * **AI は同じ質問でも違う答えを返します。** 10 問中 8 問が
 * 次は 7 問になることもあります——**1 問の差で騒がないでください**。
 * **3 問以上下がったら**、戻すか調べる価値があります。
 *
 * 【費用がかかります】
 * **問題数だけ課金されます。** 50 問の質問集を毎回回すと、
 * **プロンプトを直すたびに 50 回分**——**回す頻度を決めて**ください。
 *
 * @param cases 質問集
 * @param run 1 問を実行する
 * @returns 通った数と、失敗した問題
 */
export async function runEvaluation(
  cases: readonly EvaluationCase[],
  run: (input: string) => Promise<string>,
): Promise<EvaluationResult> {
  const startedAt = Date.now();
  const failures: { name: string; reason: string }[] = [];

  for (const c of cases) {
    let output: string;
    try {
      output = await run(c.input);
    } catch (e) {
      // **呼び出し自体が失敗しても続けます。** 1 問で止まると、
      // **残りの問題の結果が分かりません**——
      // 「どこまで壊れているか」を知るのが目的です。
      failures.push({
        name: c.name,
        reason: `呼び出しに失敗: ${e instanceof Error ? e.message : String(e)}`,
      });
      continue;
    }
    const problem = c.check(output);
    if (problem !== undefined) failures.push({ name: c.name, reason: problem });
  }

  return {
    passed: cases.length - failures.length,
    total: cases.length,
    failures,
    elapsedMs: Date.now() - startedAt,
  };
}

/**
 * 2 回の評価を比べる。
 *
 * **「良くなったか」を数で言える**ようにするためのものです。
 *
 * @param before 変える前
 * @param after 変えた後
 * @returns 差と、**新しく失敗するようになった問題**
 */
export function compareEvaluations(
  before: EvaluationResult,
  after: EvaluationResult,
): {
  delta: number;
  /** **前は通っていたのに失敗するようになった**問題。**ここが一番大事**です。 */
  regressions: string[];
  /** 前は失敗していたのに通るようになった問題。 */
  fixes: string[];
} {
  const beforeFailed = new Set(before.failures.map((f) => f.name));
  const afterFailed = new Set(after.failures.map((f) => f.name));
  return {
    delta: after.passed - before.passed,
    // **合計が同じでも、中身が入れ替わっていることがあります。**
    // 「8 問通ったまま」でも、**通る問題が変わっていたら**別物です。
    regressions: [...afterFailed].filter((n) => !beforeFailed.has(n)),
    fixes: [...beforeFailed].filter((n) => !afterFailed.has(n)),
  };
}
