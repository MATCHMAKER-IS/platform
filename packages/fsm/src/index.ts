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

/**
 * そのイベントで遷移できるかを判定する。
 *
 * @param def 状態機械の定義
 * @param state 現在の状態
 * @param event イベント
 * @returns 遷移できれば true
 */
/** {@link validateMachine} が見つけた問題。 */
export interface MachineProblem {
  /** `unreachable`(到達できない) / `dead-end`(出られない) / `unknown-target`(遷移先が無い) */
  kind: "unreachable" | "dead-end" | "unknown-target";
  /** 対象の状態。 */
  state: string;
  /** 人が読む説明。 */
  message: string;
}

/**
 * 遷移表そのものの誤りを探す。
 *
 * **型では防げない。** 遷移表は文字列のマップなので、書き間違えても
 * TypeScript は通る。実際に業務が止まってから気づくことになる。
 *
 * 探すのは 3 つ:
 *
 * - **到達できない状態**(`unreachable`) … 定義したのにどこからも来ない。
 *   「キャンセル済み」を作ったのに、キャンセルできる画面が無い状態。
 * - **出られない状態**(`dead-end`) … 入れるが出る道が無く、`final` でもない。
 *   「承認待ち」で止まり、**業務が進まなくなる**。最も見つけにくい。
 * - **遷移先が定義に無い**(`unknown-target`) … 実行時に未定義の状態になる。
 *
 * **アプリの起動時か、テストで一度呼ぶこと。** 遷移表は書いた直後は正しくても、
 * 状態を足すときに崩れる(新しい状態への道を作り忘れる)。
 *
 * @param def 遷移の定義
 * @returns 見つかった問題(空なら妥当)
 *
 * @example
 * ```ts
 * const problems = validateMachine(def);
 * if (problems.length > 0) throw new Error(problems.map((p) => p.message).join(" / "));
 * ```
 */
export function validateMachine<S extends string, E extends string>(
  def: StateMachineDefinition<S, E>,
): MachineProblem[] {
  const problems: MachineProblem[] = [];
  const states = Object.keys(def.transitions) as S[];
  const finals = new Set<string>(def.final ?? []);

  // 遷移先が定義に無い
  const known = new Set<string>(states);
  const reachable = new Set<string>([def.initial]);
  for (const from of states) {
    for (const [event, to] of Object.entries(def.transitions[from] ?? {})) {
      if (typeof to !== "string") continue;
      if (!known.has(to)) {
        problems.push({
          kind: "unknown-target",
          state: to,
          message: `${from} の ${event} が、定義に無い状態 ${to} へ遷移します`,
        });
      }
    }
  }

  // **初期状態から辿れるか**(幅優先で追う)
  const queue = [def.initial as string];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur === undefined) break;
    for (const to of Object.values(def.transitions[cur as S] ?? {})) {
      if (typeof to !== "string" || reachable.has(to)) continue;
      reachable.add(to);
      queue.push(to);
    }
  }
  for (const st of states) {
    if (!reachable.has(st)) {
      problems.push({
        kind: "unreachable",
        state: st,
        message: `${st} へ来る道がありません(初期状態 ${def.initial} から辿れない)`,
      });
    }
  }

  // **出られない状態**(final でないのに遷移先が無い)
  for (const st of states) {
    if (finals.has(st)) continue;
    const outs = Object.keys(def.transitions[st] ?? {});
    if (outs.length === 0) {
      problems.push({
        kind: "dead-end",
        state: st,
        message: `${st} から出る道がありません(final にも入っていないので、業務が止まります)`,
      });
    }
  }
  return problems;
}

/**
 * その出来事を**その状態から起こせるか**を確かめる。
 *
 * **ボタンの出し分けに使ってください**——押しても何も起きないボタンは、
 * **利用者を迷わせます**（「なぜ押せないのか」が分かりません）。
 *
 * **これだけで守らないこと。** 画面で隠しても、**API を直接叩かれれば通ります**
 * ——{@link run} は定義に無い遷移を無視するので、**そちらが本当の守り**です。
 *
 * @param def 状態と遷移の定義
 * @param state 今の状態
 * @param event 起こしたい出来事
 * @returns 起こせるなら true
 */
export function can<S extends string, E extends string>(def: StateMachineDefinition<S, E>, state: S, event: E): boolean {
  return def.transitions[state]?.[event] !== undefined;
}

/**
 * 遷移を適用して次の状態を返す。
 *
 * **不正な遷移は null**(例外を投げない)。呼び出し側で「なぜできないか」を
 * 判断して、利用者に伝える。
 *
 * @param def 状態機械の定義
 * @param state 現在の状態
 * @param event イベント
 * @returns 次の状態。**遷移できなければ null**
 */
export function transition<S extends string, E extends string>(def: StateMachineDefinition<S, E>, state: S, event: E): S | null {
  return def.transitions[state]?.[event] ?? null;
}

/**
 * その状態から発火できるイベントを返す。
 *
 * **画面のボタンを出し分ける**のに使う(できない操作のボタンを出さない)。
 *
 * @param def 状態機械の定義
 * @param state 現在の状態
 * @returns 発火できるイベント
 */
export function availableEvents<S extends string, E extends string>(def: StateMachineDefinition<S, E>, state: S): E[] {
  const map = def.transitions[state];
  return map ? (Object.keys(map) as E[]) : [];
}

/**
 * 終了状態かを判定する。
 *
 * @param def 状態機械の定義
 * @param state 状態
 * @returns 終了状態なら true(**ここから先には進めない**)
 */
export function isFinal<S extends string, E extends string>(def: StateMachineDefinition<S, E>, state: S): boolean {
  return def.final?.includes(state) ?? availableEvents(def, state).length === 0;
}

/** イベント列を順に適用し、各遷移結果を返す(不可遷移で停止)。 */
export interface RunResult<S extends string, E extends string> {
  state: S;
  applied: E[];
  rejected: E | null;
}
/**
 * 出来事を**順に適用**して、行き着く状態を求める。
 *
 * **許した遷移しか起きません。** 定義に無い出来事は**無視**され、
 * 適用できたものだけが `applied` に入ります
 * ——「**差し戻し済みなのに承認された**」といった状態を防ぎます。
 *
 * **途中で止まっても、そこまでの状態が返ります。** 何件目で止まったかは
 * `applied` の長さで分かるので、**どの出来事が弾かれたか**を追えます。
 *
 * @param def 状態と遷移の定義
 * @param events 適用する出来事の並び（**順序に意味があります**）
 * @param from 開始する状態（省略時は定義の `initial`）
 * @returns 行き着いた状態と、実際に適用できた出来事の並び
 */
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
  /**
   * その出来事を**今の状態から起こせるか**。
   *
   * **ボタンの出し分けに使ってください**——押しても何も起きないボタンは、
   * **利用者を迷わせます**（「なぜ押せないのか」が分かりません）。
   *
   * @param event 起こしたい出来事
   * @returns 起こせるなら true
   */
  can(event: E): boolean;
  send(event: E): boolean;
  availableEvents(): E[];
  isFinal(): boolean;
}

/**
 * 定義から可変インスタンスを作る。
 *
 * **純関数版({@link transition})と違い状態を持つ**。使い捨ての処理では
 * こちらが簡潔だが、状態の共有には注意すること。
 *
 * @param def 状態機械の定義
 * @param initial 初期状態(省略時は定義の初期状態)
 * @returns インスタンス(`send` で遷移)
 */
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
