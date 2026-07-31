// ffprobe-static は型定義を同梱しておらず、`@types/ffprobe-static` も無いため
// このパッケージで宣言する(`barcode/src/bwip-js.d.ts` と同じ作法)。
//
// トップレベルの import/export を書かないこと。書くとこのファイルが「モジュール」に
// なり、`declare module` が**既存モジュールの拡張**として扱われて宣言にならない。
//
// 実際に使う API(path)だけを宣言する。全部書くと本体の更新に追従できなくなる。
declare module "ffprobe-static" {
  /** 同梱された ffprobe バイナリの絶対パス。 */
  const ffprobe: { path: string };
  export default ffprobe;
}
