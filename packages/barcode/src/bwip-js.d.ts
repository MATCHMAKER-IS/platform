// Ambient type shim for bwip-js, which ships no bundled type declarations.
// Kept in a non-module .d.ts (no top-level import/export) so this DECLARES a
// new ambient module instead of augmenting an existing one. Only the API this
// package actually uses (toSVG) is declared.
declare module "bwip-js" {
  interface ToSVGOptions {
    bcid: string;
    text: string;
    [key: string]: unknown;
  }
  const bwipjs: { toSVG(options: ToSVGOptions): string };
  export default bwipjs;
}
