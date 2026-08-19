/**
 * ブループリント(純ロジック)。業務プロセスを状態と遷移で宣言的に定義し、
 * 遷移ごとの「条件・必須項目・アクション」を強制して、正しい手順でしか進めないようにする。
 * 素の状態遷移は @platform/fsm に委譲し、その上にガード/必須項目/アクションを重ねる。
 * (Zoho CRM のブループリントに相当)
 * @packageDocumentation
 */
import { type StateMachineDefinition, type Transitions, transition as fsmTransition, availableEvents } from "@platform/fsm";

/** 遷移(状態から状態へ進む 1 手）。record はプロセス対象のデータ。 */
export interface BlueprintTransition<S extends string, Rec extends Record<string, unknown>> {
  /** 遷移元の状態。 */
  from: S;
  /** 遷移先の状態。 */
  to: S;
  /** 遷移名(ボタン名など。例: "提出", "承認"）。状態内で一意。 */
  name: string;
  /** この遷移の前に埋まっている必要のある項目。 */
  requiredFields?: (keyof Rec)[];
  /** 遷移可能な条件(record を見て判定）。未指定なら常に可。 */
  condition?: (record: Rec) => boolean;
  /** 遷移成功時に実行するアクションの識別子(呼び出し側で実処理）。 */
  actions?: string[];
  /** 遷移に必要なロール(権限制御。呼び出し側で照合）。 */
  allowedRoles?: string[];
}

/** ブループリント定義。 */
export interface Blueprint<S extends string, Rec extends Record<string, unknown>> {
  /** 初期状態。 */
  initial: S;
  /** 全状態。 */
  states: readonly S[];
  /** 遷移一覧。 */
  transitions: BlueprintTransition<S, Rec>[];
  /** 終了状態(任意）。 */
  final?: readonly S[];
}

/** ブループリントから fsm の遷移表を導出する(遷移名をイベントとして扱う）。 */
/** {@link validateBlueprint} が見つけた問題。 */
export interface BlueprintProblem {
  /** `unreachable`(到達できない) / `dead-end`(出られない) / `unknown-state`(states に無い) */
  kind: "unreachable" | "dead-end" | "unknown-state";
  /** 対象の状態。 */
  state: string;
  /** 人が読む説明。 */
  message: string;
}

/**
 * 業務フローの定義そのものが正しいかを見る。
 *
 * **`@platform/fsm` の `validateMachine` では足りない。**
 * `toStateMachine` は `from` をキーにした表へ組み替えるので、
 * **`from` に一度も現れない状態がキーから消える**——`states` に書いたのに
 * どこからも遷移しない状態を見落とす。こちらは `states` を直接見る。
 *
 * 探すのは 3 つ:
 *
 * - **到達できない状態**(`unreachable`) … `states` にあるが `initial` から辿れない。
 *   状態を足したのに、そこへ行く遷移を作り忘れた形。
 * - **出られない状態**(`dead-end`) … 入れるが出る遷移が無く、`final` でもない。
 *   「承認待ち」で止まり、**業務が進まなくなる**。
 * - **`states` に無い状態**(`unknown-state`) … 遷移の `from` / `to` が定義外。
 *
 * **アプリの起動時かテストで一度呼ぶこと。** フローは書いた直後は正しくても、
 * 状態を足すときに崩れる。
 *
 * @param blueprint 業務フローの定義
 * @returns 見つかった問題(空なら妥当)
 *
 * @example
 * ```ts
 * const problems = validateBlueprint(EXPENSE_BLUEPRINT);
 * if (problems.length > 0) throw new Error(problems.map((p) => p.message).join(" / "));
 * ```
 */
export function validateBlueprint<S extends string, Rec extends Record<string, unknown>>(
  blueprint: Blueprint<S, Rec>,
): BlueprintProblem[] {
  const problems: BlueprintProblem[] = [];
  const known = new Set<string>(blueprint.states);
  const finals = new Set<string>(blueprint.final ?? []);

  // 遷移が定義外の状態を指していないか
  for (const t of blueprint.transitions) {
    for (const [role, st] of [["from", t.from], ["to", t.to]] as const) {
      if (!known.has(st)) {
        problems.push({
          kind: "unknown-state",
          state: st,
          message: `遷移「${t.name}」の ${role} が、states に無い状態 ${st} です`,
        });
      }
    }
  }

  // **初期状態から辿れるか**(幅優先で追う)
  const reachable = new Set<string>([blueprint.initial]);
  const queue: string[] = [blueprint.initial];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur === undefined) break;
    for (const t of blueprint.transitions) {
      if (t.from !== cur || reachable.has(t.to)) continue;
      reachable.add(t.to);
      queue.push(t.to);
    }
  }
  for (const st of blueprint.states) {
    if (!reachable.has(st)) {
      problems.push({
        kind: "unreachable",
        state: st,
        message: `${st} へ来る遷移がありません(初期状態 ${blueprint.initial} から辿れない)`,
      });
    }
  }

  // **出られない状態**(final でないのに出る遷移が無い)
  for (const st of blueprint.states) {
    if (finals.has(st)) continue;
    if (!blueprint.transitions.some((t) => t.from === st)) {
      problems.push({
        kind: "dead-end",
        state: st,
        message: `${st} から出る遷移がありません(final にも入っていないので、業務が止まります)`,
      });
    }
  }
  return problems;
}

export function toStateMachine<S extends string, Rec extends Record<string, unknown>>(
  blueprint: Blueprint<S, Rec>,
): StateMachineDefinition<S, string> {
  const transitions: Record<string, Record<string, S>> = {};
  for (const t of blueprint.transitions) {
    (transitions[t.from] ??= {})[t.name] = t.to;
  }
  return { initial: blueprint.initial, transitions: transitions as Transitions<S, string>, final: blueprint.final };
}

/** 項目が埋まっているか(undefined/null/空文字/空配列は未入力）。 */
function isFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** 遷移に不足している必須項目を返す。 */
export function missingRequiredFields<S extends string, Rec extends Record<string, unknown>>(
  t: BlueprintTransition<S, Rec>,
  record: Rec,
): (keyof Rec)[] {
  return (t.requiredFields ?? []).filter((f) => !isFilled(record[f]));
}

/** ある状態から今すぐ実行できる遷移(条件を満たすもの）。必須項目は満たさなくても候補には含む。 */
export function availableTransitions<S extends string, Rec extends Record<string, unknown>>(
  blueprint: Blueprint<S, Rec>,
  state: S,
  record: Rec,
): BlueprintTransition<S, Rec>[] {
  return blueprint.transitions.filter((t) => t.from === state && (t.condition ? t.condition(record) : true));
}

/** 遷移評価の結果。 */
export interface TransitionResult<S extends string> {
  ok: boolean;
  /** 遷移できない理由(状態不正・条件不成立・必須項目不足）。 */
  errors: string[];
  /** 遷移先(ok のときのみ）。 */
  nextState?: S;
  /** 実行すべきアクション。 */
  actions: string[];
}

/**
 * 指定した遷移が可能か検証する。状態・条件・必須項目・(任意で)ロールをすべて満たす必要がある。
 */
export function evaluateTransition<S extends string, Rec extends Record<string, unknown>>(
  blueprint: Blueprint<S, Rec>,
  state: S,
  transitionName: string,
  record: Rec,
  roles?: string[],
): TransitionResult<S> {
  const errors: string[] = [];
  const t = blueprint.transitions.find((x) => x.from === state && x.name === transitionName);
  if (!t) {
    return { ok: false, errors: [`状態「${state}」から遷移「${transitionName}」は定義されていません`], actions: [] };
  }
  if (t.condition && !t.condition(record)) errors.push("遷移の条件を満たしていません");
  const missing = missingRequiredFields(t, record);
  if (missing.length > 0) errors.push(`必須項目が未入力です: ${missing.map(String).join(", ")}`);
  if (t.allowedRoles && (!roles || !roles.some((r) => t.allowedRoles!.includes(r)))) {
    errors.push("この操作を行う権限がありません");
  }
  const nextState = fsmTransition(toStateMachine(blueprint), state, transitionName) ?? undefined;
  return { ok: errors.length === 0, errors, nextState: errors.length === 0 ? (nextState as S) : undefined, actions: errors.length === 0 ? (t.actions ?? []) : [] };
}

/**
 * 遷移を適用して新しい record（状態を更新）とアクションを返す。
 * @param stateField record 内で状態を保持するキー(既定 "state"）。
 */
export function applyTransition<S extends string, Rec extends Record<string, unknown>>(
  blueprint: Blueprint<S, Rec>,
  record: Rec,
  transitionName: string,
  options: { stateField?: keyof Rec; roles?: string[] } = {},
): { ok: boolean; record: Rec; errors: string[]; actions: string[] } {
  const stateField = (options.stateField ?? "state") as keyof Rec;
  const state = record[stateField] as S;
  const result = evaluateTransition(blueprint, state, transitionName, record, options.roles);
  if (!result.ok || result.nextState === undefined) {
    return { ok: false, record, errors: result.errors, actions: [] };
  }
  return { ok: true, record: { ...record, [stateField]: result.nextState }, errors: [], actions: result.actions };
}

/** 状態が終了状態か。 */
export function isFinalState<S extends string, Rec extends Record<string, unknown>>(blueprint: Blueprint<S, Rec>, state: S): boolean {
  return (blueprint.final ?? []).includes(state);
}

/** ある状態から出ている遷移名の一覧(fsm 経由）。 */
export function transitionNames<S extends string, Rec extends Record<string, unknown>>(blueprint: Blueprint<S, Rec>, state: S): string[] {
  return availableEvents(toStateMachine(blueprint), state);
}
