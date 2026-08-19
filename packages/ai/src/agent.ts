/** 計画の 1 手順。 */
export interface AgentStep {
  /** 何番目か（1 から）。 */
  order: number;
  /** 呼ぶ道具。 */
  tool: string;
  /** 渡す引数。 */
  input: Record<string, unknown>;
  /** なぜこの手順が要るか（**AI の説明**）。 */
  reason: string;
  /**
   * **人の承認が要るか。**
   *
   * **削除・送金・送信は必ず `true` に**してください——
   * `createApprovalQueue` に流して、**人が押してから**実行します。
   */
  requiresApproval: boolean;
}

/**
 * **AI が立てた計画を確かめる。**
 *
 * 【なぜ必要か】
 * AI に「経費を精査して」と頼むと、**複数の手順**を立てます。
 * そのまま流すと、**途中で危ないことをします**——
 * 「まず全件を削除して、作り直します」と本気で計画してきます。
 *
 * **走らせる前に、計画そのものを見る**必要があります。
 *
 * 【何を見るか】
 * | 見るもの | なぜ |
 * |---|---|
 * | **知らない道具** | 実行できず、**途中で止まります** |
 * | **手順が多すぎる** | **暴走の兆候**。1 つの依頼で 20 手順は異常 |
 * | **承認が要る手順** | **人に回すため**に数えます |
 * | **同じ道具の繰り返し** | **ループに入っている**疑い |
 *
 * 【計画を信用しないでください】
 * **AI は「できるつもり」で計画を立てます。**
 * 実際には引数が足りない、対象が存在しない——**走らせて初めて分かります**。
 * **1 手順ずつ確かめながら**進めてください。
 *
 * @param steps AI が立てた計画
 * @param availableTools 実際に使える道具の名前
 * @param options `maxSteps`（既定 10）
 * @returns 問題の一覧。**空なら「明らかな問題は無い」だけ**
 */
export function validateAgentPlan(
  steps: readonly AgentStep[],
  availableTools: readonly string[],
  options: { maxSteps?: number } = {},
): {
  problems: string[];
  /** 人の承認が要る手順の数（**多いなら、そもそも AI 向きでない仕事**です）。 */
  approvalCount: number;
} {
  const problems: string[] = [];
  const maxSteps = options.maxSteps ?? 10;

  if (steps.length === 0) {
    problems.push("手順がありません（AI が計画を立てられませんでした）");
  }
  if (steps.length > maxSteps) {
    // **手順が多すぎるのは暴走の兆候。** 1 つの依頼で 20 手順は異常です
    problems.push(`手順が多すぎます（${steps.length} / 上限 ${maxSteps}）`);
  }

  const known = new Set(availableTools);
  const counts = new Map<string, number>();
  for (const step of steps) {
    if (!known.has(step.tool)) {
      // **知らない道具は実行できません。** 途中で止まると、
      // **どこまで進んだか分からない**まま残ります。
      problems.push(`知らない道具です: ${step.tool}（手順 ${step.order}）`);
    }
    if (step.reason.trim() === "") {
      // **理由が無い手順は承認できません。** 人が判断できないためです
      problems.push(`理由が書かれていません（手順 ${step.order}）`);
    }
    counts.set(step.tool, (counts.get(step.tool) ?? 0) + 1);
  }

  for (const [tool, count] of counts) {
    // **同じ道具を繰り返すのはループの疑い。**
    // 「検索して見つからない → もう一度検索」を延々と続けます
    if (count >= 4) problems.push(`同じ道具を ${count} 回呼んでいます: ${tool}（ループの疑い）`);
  }

  return {
    problems,
    approvalCount: steps.filter((s) => s.requiresApproval).length,
  };
}

/**
 * **計画を 1 手順ずつ進める。**
 *
 * 【なぜ一気に流さないか】
 * **AI の計画は「できるつもり」で立っています。**
 * 3 手順目で対象が見つからなくても、**4 手順目以降は気にせず進みます**——
 * **間違った前提のまま最後まで走り、結果だけがおかしくなります**。
 *
 * **1 手順ずつ確かめれば、止まった場所が分かります。**
 *
 * 【承認が要る手順で止まります】
 * `requiresApproval` の手順に来たら、**そこで止めて返します**。
 * 人が押したら、**続きから**再開してください。
 *
 * @param steps 計画
 * @param execute 1 手順を実行する
 * @returns 進んだところまでの結果
 */
export async function runAgentPlan(
  steps: readonly AgentStep[],
  execute: (step: AgentStep) => Promise<{ ok: boolean; output?: unknown; error?: string }>,
): Promise<{
  completed: number;
  results: { step: AgentStep; ok: boolean; output?: unknown; error?: string }[];
  /** 止まった理由。**最後まで進んだら `undefined`**。 */
  stoppedBy?: "approval" | "error";
  /** 承認待ちで止まった手順。 */
  pendingStep?: AgentStep;
}> {
  const results: { step: AgentStep; ok: boolean; output?: unknown; error?: string }[] = [];

  for (const step of steps) {
    if (step.requiresApproval) {
      // **人が押すまで進めません。** ここで返して、
      // 承認後に**残りの手順**をもう一度渡してください。
      return { completed: results.length, results, stoppedBy: "approval", pendingStep: step };
    }
    const r = await execute(step);
    results.push({ step, ...r });
    if (!r.ok) {
      // **失敗したら止めます。** 続けると、
      // **間違った前提のまま最後まで走ります**。
      return { completed: results.length, results, stoppedBy: "error" };
    }
  }

  return { completed: results.length, results };
}
