/**
 * 汎用ステートマシン(純)。在庫/チケット/配送などの状態遷移を宣言的に定義する。
 * ジェネリクスで状態・イベントを型安全に扱える。
 * @packageDocumentation
 */

/** 遷移定義: 状態 → (イベント → 次状態)。 */
export type Transitions<S extends string, E extends string> = {
  readonly [state in S]?: { readonly [event in E]?: S };
};

/** ステートマシン定義。 */
export interface StateMachineDefinition<S extends string, E extends string> {
  /** 初期状態。 */
  initial: S;
  /** 遷移表。 */
  transitions: Transitions<S, E>;
  /** 終了状態(任意)。 */
  final?: readonly S[];
}

/** 遷移可能なイベントか。 */
export function can<S extends string, E extends string>(def: StateMachineDefinition<S, E>, state: S, event: E): boolean {
  return def.transitions[state]?.[event] !== undefined;
}

/** 遷移を適用して次状態を返す。不可なら null。 */
export function transition<S extends string, E extends string>(def: StateMachineDefinition<S, E>, state: S, event: E): S | null {
  return def.transitions[state]?.[event] ?? null;
}

/** ある状態から発火できるイベント一覧。 */
export function availableEvents<S extends string, E extends string>(def: StateMachineDefinition<S, E>, state: S): E[] {
  const map = def.transitions[state];
  return map ? (Object.keys(map) as E[]) : [];
}

/** 終了状態か。 */
export function isFinal<S extends string, E extends string>(def: StateMachineDefinition<S, E>, state: S): boolean {
  return def.final?.includes(state) ?? availableEvents(def, state).length === 0;
}

/** イベント列を順に適用し、各遷移結果を返す(不可遷移で停止)。 */
export interface RunResult<S extends string, E extends string> {
  state: S;
  applied: E[];
  rejected: E | null;
}
export function run<S extends string, E extends string>(def: StateMachineDefinition<S, E>, events: readonly E[], from?: S): RunResult<S, E> {
  let state = from ?? def.initial;
  const applied: E[] = [];
  for (const event of events) {
    const next = transition(def, state, event);
    if (next === null) return { state, applied, rejected: event };
    state = next;
    applied.push(event);
  }
  return { state, applied, rejected: null };
}

/** 可変インスタンス(現在状態を保持し send で遷移)。 */
export interface StateMachine<S extends string, E extends string> {
  readonly state: S;
  can(event: E): boolean;
  send(event: E): boolean;
  availableEvents(): E[];
  isFinal(): boolean;
}

/** 定義から可変インスタンスを作る。 */
export function createStateMachine<S extends string, E extends string>(def: StateMachineDefinition<S, E>, initial?: S): StateMachine<S, E> {
  let current: S = initial ?? def.initial;
  return {
    get state() { return current; },
    can: (event) => can(def, current, event),
    send: (event) => { const next = transition(def, current, event); if (next === null) return false; current = next; return true; },
    availableEvents: () => availableEvents(def, current),
    isFinal: () => isFinal(def, current),
  };
}
