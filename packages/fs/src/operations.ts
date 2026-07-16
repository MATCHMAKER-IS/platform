/**
 * ファイル・フォルダ操作(非同期)。`node:fs/promises` を土台に、存在確認・ディレクトリ確保・
 * JSON 読み書き・アトミック書き込み・再帰コピー/削除・走査・容量集計などを提供する。
 * @packageDocumentation
 */
import * as fsp from "node:fs/promises";
import * as nodePath from "node:path";

/**
 * パスが存在するかを判定する。
 *
 * **存在確認と操作の間に状態が変わりうる**(TOCTOU)。
 * 「あれば読む」なら、確認せずに読んでエラーを捕まえる方が確実。
 *
 * @param p パス
 * @returns 存在すれば true
 */
export async function pathExists(p: string): Promise<boolean> {
  try { await fsp.stat(p); return true; } catch { return false; }
}

/**
 * ディレクトリを確保する。
 *
 * **既にあってもエラーにしない**(冪等)。何度呼んでもよい。
 *
 * @param dir ディレクトリのパス
 * @returns なし
 */
export async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

/**
 * テキストファイルを読む。
 *
 * @param p パス
 * @param encoding 文字コード(既定 utf8)
 * @returns 中身
 * @throws ファイルが無い・読めない場合(Node の例外がそのまま出る)
 */
export async function readText(p: string): Promise<string> {
  return fsp.readFile(p, "utf8");
}

/**
 * テキストファイルを書く。
 *
 * **親ディレクトリは自動で作る**(いちいち mkdir しなくてよい)。
 *
 * @param p パス
 * @param content 中身
 * @returns なし
 */
export async function writeText(p: string, content: string): Promise<void> {
  await ensureDir(nodePath.dirname(p));
  await fsp.writeFile(p, content, "utf8");
}

/**
 * JSON ファイルを読む。
 *
 * @param p パス
 * @returns パースした値
 * @throws ファイルが無い、または JSON として不正な場合
 */
export async function readJson<T = unknown>(p: string): Promise<T> {
  return JSON.parse(await readText(p)) as T;
}

/**
 * JSON ファイルを書く。
 *
 * **既定は 2 スペース整形**(Git の差分が読めるように。1 行 JSON だと差分が全行になる)。
 *
 * @param p パス
 * @param value 書き込む値
 * @param indent インデント(既定 2)
 * @returns なし
 */
export async function writeJson(p: string, data: unknown, options: { pretty?: boolean } = {}): Promise<void> {
  const text = JSON.stringify(data, null, options.pretty === false ? undefined : 2);
  await writeText(p, text);
}

/**
 * アトミックに書き込む(一時ファイルへ書いて rename)。
 *
 * **書き込み途中でプロセスが落ちても、ファイルが壊れない**。
 * 直接書くと、中途半端な内容のファイルが残る(設定ファイルなら起動不能になる)。
 *
 * @param p パス
 * @param content 中身
 * @returns なし
 */
export async function writeFileAtomic(p: string, data: string | Uint8Array): Promise<void> {
  await ensureDir(nodePath.dirname(p));
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, data);
  await fsp.rename(tmp, p);
}

/**
 * パスを削除する(ファイル・ディレクトリ問わず)。
 *
 * **存在しなくてもエラーにしない**(冪等)。
 *
 * @param p パス
 * @returns なし
 */
export async function remove(p: string): Promise<void> {
  await fsp.rm(p, { recursive: true, force: true });
}

/**
 * ディレクトリの中身を空にする(**ディレクトリ自体は残す**)。
 *
 * @param dir ディレクトリのパス
 * @returns なし
 */
export async function emptyDir(dir: string): Promise<void> {
  await ensureDir(dir);
  for (const entry of await fsp.readdir(dir)) await remove(nodePath.join(dir, entry));
}

/**
 * ファイルをコピーする。
 *
 * @param src コピー元
 * @param dest コピー先(**親ディレクトリは自動で作る**)
 * @returns なし
 */
export async function copyFile(src: string, dest: string): Promise<void> {
  await ensureDir(nodePath.dirname(dest));
  await fsp.copyFile(src, dest);
}

/**
 * ディレクトリを再帰的にコピーする。
 *
 * @param src コピー元
 * @param dest コピー先
 * @returns なし
 */
export async function copyDir(src: string, dest: string): Promise<void> {
  await fsp.cp(src, dest, { recursive: true });
}

/**
 * パスを移動・リネームする。
 *
 * **ドライブをまたぐ場合は rename が失敗する**ので、コピー + 削除に切り替える
 * (呼び出し側は意識しなくてよい)。
 *
 * @param src 移動元
 * @param dest 移動先
 * @returns なし
 */
export async function move(src: string, dest: string): Promise<void> {
  await ensureDir(nodePath.dirname(dest));
  try {
    await fsp.rename(src, dest);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EXDEV") {
      await fsp.cp(src, dest, { recursive: true });
      await remove(src);
    } else throw e;
  }
}

/**
 * ディレクトリ直下のエントリ名を返す。
 *
 * @param dir ディレクトリのパス
 * @returns エントリ名の配列。**存在しなければ空配列**(例外にしない)
 */
export async function listDir(dir: string): Promise<string[]> {
  try { return await fsp.readdir(dir); } catch { return []; }
}

/** {@link walk} のオプション。 */
export interface WalkOptions {
  /** ディレクトリ自身も列挙する(既定 false=ファイルのみ)。 */
  includeDirs?: boolean;
  /** 各パスを含めるか判定(false で除外・ディレクトリを false にすると配下も辿らない)。 */
  filter?: (path: string, isDir: boolean) => boolean;
  /** 最大深さ(既定 Infinity)。 */
  maxDepth?: number;
}

/**
 * ディレクトリを再帰的に走査してパスを返す。
 *
 * **大きなディレクトリでは時間もメモリも食う**(全パスを配列に持つ)。
 * `node_modules` などを除外する `exclude` を渡すこと。
 *
 * @param dir ディレクトリのパス
 * @param options.exclude 除外するディレクトリ名
 * @returns ファイルのパスの配列
 */
export async function walk(root: string, options: WalkOptions = {}): Promise<string[]> {
  const { includeDirs = false, filter, maxDepth = Infinity } = options;
  const out: string[] = [];
  async function recurse(dir: string, depth: number): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = nodePath.join(dir, entry.name);
      const isDir = entry.isDirectory();
      if (filter && !filter(full, isDir)) continue;
      if (isDir) {
        if (includeDirs) out.push(full);
        if (depth < maxDepth) await recurse(full, depth + 1);
      } else {
        out.push(full);
      }
    }
  }
  await recurse(root, 1);
  return out;
}

/**
 * ディレクトリ配下の総容量を集計する。
 *
 * @param dir ディレクトリのパス
 * @returns 合計バイト数
 */
export async function dirSize(dir: string): Promise<number> {
  let total = 0;
  for (const file of await walk(dir)) {
    try { total += (await fsp.stat(file)).size; } catch { /* ignore */ }
  }
  return total;
}
