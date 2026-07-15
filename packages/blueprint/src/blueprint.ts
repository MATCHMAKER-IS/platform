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
