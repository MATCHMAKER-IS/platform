/**
 * 組織デフォルトのテーマ設定(DB backed)。SystemSetting テーブルに保存する。
 * 管理者が「全社の初期テーマ」を選ぶと、まだ個人設定を持たない利用者にはこれが適用される。
 * 個人の選択(localStorage)があればそちらが優先される(SkinProvider 側)。
 * @packageDocumentation
 */
import { AppError, ErrorCode } from "@platform/core";
import { db } from "./services";
import { builtInThemes, parseTheme, validateTheme, type Theme } from "@platform/theme";

const KEY = "theme-default";
const CUSTOM_KEY = "theme-custom";
const HISTORY_KEY = "theme-history";

/** テーマ変更の履歴 1 件(誰がいつ何をしたか)。 */
export interface ThemeHistoryEntry {
  at: string;
  actor: string;
  action: "default-changed" | "custom-saved" | "custom-deleted" | "custom-imported";
  /** 対象のスキン id。 */
  target: string;
  /** 補足(テーマ名・モードなど)。 */
  note?: string;
}

const HISTORY_LIMIT = 200;

/** テーマの変更履歴を取得(新しい順)。DB 未接続なら空。 */
export async function getThemeHistory(limit = 50): Promise<ThemeHistoryEntry[]> {
  try {
    const row = await db.systemSetting.findUnique({ where: { key: HISTORY_KEY } });
    if (!row) return [];
    const list = (row.value as { entries?: ThemeHistoryEntry[] }).entries;
    if (!Array.isArray(list)) return [];
    return list.slice(-limit).reverse();
  } catch {
    return [];
  }
}

/** 変更履歴を 1 件追加する(上限を超えたら古いものから捨てる)。失敗しても呼び出し側は止めない。 */
async function recordHistory(entry: Omit<ThemeHistoryEntry, "at">): Promise<void> {
  const full: ThemeHistoryEntry = { ...entry, at: new Date().toISOString() };
  try {
    const row = await db.systemSetting.findUnique({ where: { key: HISTORY_KEY } });
    const current = Array.isArray((row?.value as { entries?: ThemeHistoryEntry[] })?.entries) ? (row!.value as { entries: ThemeHistoryEntry[] }).entries : [];
    const next = [...current, full].slice(-HISTORY_LIMIT);
    await db.systemSetting.upsert({
      where: { key: HISTORY_KEY },
      create: { key: HISTORY_KEY, value: { entries: next }, updatedBy: entry.actor },
      update: { value: { entries: next }, updatedBy: entry.actor },
    });
  } catch {
    // 履歴が残せなくても本処理は続行する
  }
}

export interface ThemeSetting {
  /** 組織デフォルトのスキン id。 */
  skinId: string;
  /** 既定の明暗モード("light" | "dark" | "system")。 */
  mode: "light" | "dark" | "system";
  updatedBy?: string | null;
  updatedAt?: string;
}

const DEFAULT_SETTING: ThemeSetting = { skinId: "default", mode: "system" };

/** 登録済みスキン id の一覧(標準 + 保存済みカスタム)。 */
async function validSkinIds(): Promise<string[]> {
  const custom = await getCustomThemes();
  return [...builtInThemes.map((t) => t.id), ...custom.map((t) => t.id)];
}

// ─────────────────────── カスタムテーマ(組織で共有・DB 保存) ───────────────────────

/**
 * 保存済みのカスタムテーマを取得する。DB 未接続・未保存なら空配列。
 * 壊れたレコードは黙って除外する(表示を止めない)。
 */
export async function getCustomThemes(): Promise<Theme[]> {
  try {
    const row = await db.systemSetting.findUnique({ where: { key: CUSTOM_KEY } });
    if (!row) return [];
    const list = (row.value as { themes?: unknown[] }).themes;
    if (!Array.isArray(list)) return [];
    return list.filter((t) => validateTheme(t).length === 0) as Theme[];
  } catch {
    return [];
  }
}

/**
 * カスタムテーマを追加・更新する(同 id は上書き)。不正な形式は VALIDATION エラー。
 * 標準スキンと同じ id は使えない(取り違え防止)。
 */
export async function saveCustomTheme(theme: unknown, actor?: string | null): Promise<Theme> {
  const parsed = parseTheme(theme);
  if (builtInThemes.some((t) => t.id === parsed.id)) {
    throw new AppError(ErrorCode.VALIDATION, `標準スキンと同じ id は使えません: ${parsed.id}`);
  }
  const current = await getCustomThemes();
  const existed = current.some((t) => t.id === parsed.id);
  const next = [...current.filter((t) => t.id !== parsed.id), parsed];
  await writeCustomThemes(next, actor);
  await recordHistory({ actor: actor ?? "system", action: "custom-saved", target: parsed.id, note: `${existed ? "更新" : "作成"}: ${parsed.name}` });
  return parsed;
}

/** カスタムテーマを削除する。組織デフォルトに使われていた場合は既定へ戻す。 */
export async function deleteCustomTheme(id: string, actor?: string | null): Promise<boolean> {
  const current = await getCustomThemes();
  const next = current.filter((t) => t.id !== id);
  if (next.length === current.length) return false;
  await writeCustomThemes(next, actor);
  await recordHistory({ actor: actor ?? "system", action: "custom-deleted", target: id });
  // 削除したスキンが組織デフォルトなら既定に戻す
  const setting = await getThemeSetting();
  if (setting.skinId === id) await setThemeSetting({ ...setting, skinId: DEFAULT_SETTING.skinId, updatedBy: actor ?? null });
  return true;
}

async function writeCustomThemes(themes: Theme[], actor?: string | null): Promise<void> {
  const value = { themes, updatedBy: actor ?? null, updatedAt: new Date().toISOString() };
  try {
    await db.systemSetting.upsert({
      where: { key: CUSTOM_KEY },
      create: { key: CUSTOM_KEY, value, updatedBy: actor ?? null },
      update: { value, updatedBy: actor ?? null },
    });
  } catch {
    // DB 未接続でも呼び出し側を止めない
  }
}

/** 組織デフォルトのテーマ設定を取得(DB 未接続・未設定なら既定)。 */
export async function getThemeSetting(): Promise<ThemeSetting> {
  try {
    const row = await db.systemSetting.findUnique({ where: { key: KEY } });
    if (!row) return DEFAULT_SETTING;
    const value = row.value as ThemeSetting;
    // 保存済みスキンが登録から消えていたら既定にフォールバック
    if (!(await validSkinIds()).includes(value.skinId)) return { ...value, skinId: DEFAULT_SETTING.skinId };
    return { ...DEFAULT_SETTING, ...value };
  } catch {
    return DEFAULT_SETTING;
  }
}

/** 組織デフォルトのテーマ設定を保存(管理者のみ)。未知スキンは既定に矯正。 */
export async function setThemeSetting(setting: ThemeSetting): Promise<ThemeSetting> {
  const skinId = (await validSkinIds()).includes(setting.skinId) ? setting.skinId : DEFAULT_SETTING.skinId;
  const value: ThemeSetting = { skinId, mode: setting.mode, updatedBy: setting.updatedBy ?? null, updatedAt: new Date().toISOString() };
  try {
    await db.systemSetting.upsert({
      where: { key: KEY },
      create: { key: KEY, value, updatedBy: value.updatedBy ?? null },
      update: { value, updatedBy: value.updatedBy ?? null },
    });
  } catch {
    // DB 未接続でも呼び出し側を止めない(検証・オフライン)
  }
  await recordHistory({ actor: value.updatedBy ?? "system", action: "default-changed", target: skinId, note: `モード: ${setting.mode}` });
  return value;
}
