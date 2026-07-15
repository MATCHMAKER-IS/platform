/**
 * `@platform/flags` — フィーチャーフラグ(依存ゼロ)。
 *
 * kill switch(即時オフ)・段階リリース(割合ロールアウト)・ターゲティング(許可/拒否/属性)・
 * A/B バリアントに対応。評価は決定的(同じキーは常に同じ結果)なので、ユーザ単位で一貫した体験になる。
 * ルールの取得元(env/設定ファイル/リモート設定サービス)は Provider で差し替え可能。
 * @packageDocumentation
 */

/** 評価コンテキスト(誰に対する評価か)。 */
export interface FlagContext {
  /** 安定した識別子(userId 等)。割合ロールアウトのバケット決定に使う。 */
  key?: string;
  /** ターゲティングに使う属性(role, email, plan 等)。 */
  attributes?: Record<string, unknown>;
}

/** フラグのルール定義。boolean なら単純な on/off。 */
export type FlagRule =
  | boolean
  | {
      /** 全体スイッチ。false なら誰にもオフ(kill switch)。既定 true。 */
      enabled?: boolean;
      /** 割合ロールアウト(0-100)。key のハッシュで判定。既定 100。 */
      rolloutPercent?: number;
      /** 常に有効にする対象(属性の完全一致。例: `{ role: "admin" }`)。 */
      allow?: Record<string, unknown>[];
      /** 常に無効にする対象(allow より優先)。 */
      deny?: Record<string, unknown>[];
      /** A/B バリアント(重み付き)。指定時は {@link Flags.variant} で選択。 */
      variants?: { name: string; weight: number }[];
    };

/** フラグ定義の集合(名前 → ルール)。 */
export type FlagDefinitions = Record<string, FlagRule>;

/** ルール取得元。 */
export interface FlagProvider {
  /** 全フラグ定義を取得(同期・非同期どちらも)。 */
  getAll(): Promise<FlagDefinitions> | FlagDefinitions;
}

/** アプリが使うフラグ評価口。 */
export interface Flags {
  /** フラグが有効か。未定義フラグは false(安全側)。 */
  isEnabled(name: string, context?: FlagContext): Promise<boolean>;
  /** バリアントを選ぶ(variants 未定義なら null)。 */
  variant(name: string, context?: FlagContext): Promise<string | null>;
}

/** FNV-1a による安定ハッシュ → 0..99 のバケット。 */
export function bucketOf(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100;
}

/** 属性がターゲット条件(完全一致)を満たすか。 */
function matches(attributes: Record<string, unknown> | undefined, target: Record<string, unknown>): boolean {
  if (!attributes) return false;
  return Object.entries(target).every(([k, v]) => attributes[k] === v);
}

/** 1 ルールを決定的に評価する(純関数・テストしやすい)。 */
export function evaluateFlag(rule: FlagRule, context: FlagContext = {}, flagName = ""): boolean {
  if (typeof rule === "boolean") return rule;
  if (rule.enabled === false) return false; // kill switch
  // deny が最優先
  if (rule.deny?.some((t) => matches(context.attributes, t))) return false;
  // allow は割合を無視して有効化
  if (rule.allow?.some((t) => matches(context.attributes, t))) return true;
  // 割合ロールアウト
  const pct = rule.rolloutPercent ?? 100;
  if (pct >= 100) return true;
  if (pct <= 0) return false;
  const bucket = bucketOf(`${flagName}:${context.key ?? ""}`);
  return bucket < pct;
}

/** バリアントを決定的に選ぶ(重み付き)。 */
export function selectVariant(rule: FlagRule, context: FlagContext = {}, flagName = ""): string | null {
  if (typeof rule === "boolean" || !rule.variants || rule.variants.length === 0) return null;
  const total = rule.variants.reduce((s, v) => s + v.weight, 0);
  if (total <= 0) return null;
  const bucket = bucketOf(`${flagName}:variant:${context.key ?? ""}`) / 100; // 0..1
  let acc = 0;
  for (const v of rule.variants) {
    acc += v.weight / total;
    if (bucket < acc) return v.name;
  }
  return rule.variants[rule.variants.length - 1]!.name;
}

/** Provider を注入して Flags を作る。 */
export function createFlags(provider: FlagProvider): Flags {
  return {
    async isEnabled(name, context) {
      const defs = await provider.getAll();
      const rule = defs[name];
      if (rule === undefined) return false; // 未定義は無効(安全側)
      return evaluateFlag(rule, context, name);
    },
    async variant(name, context) {
      const defs = await provider.getAll();
      const rule = defs[name];
      if (rule === undefined) return null;
      return selectVariant(rule, context, name);
    },
  };
}

/** 静的な定義から Provider を作る(env/設定ファイル向け)。 */
export function createStaticProvider(definitions: FlagDefinitions): FlagProvider {
  return { getAll: () => definitions };
}

/** 非同期フェッチャから Provider を作る(リモート設定サービス向け)。 */
export function createRemoteProvider(fetcher: () => Promise<FlagDefinitions>): FlagProvider {
  return { getAll: fetcher };
}
