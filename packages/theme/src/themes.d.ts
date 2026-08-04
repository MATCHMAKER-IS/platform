/**
 * 組み込みスキンの定義。
 *
 * **補助テキスト(muted)の色は勝手に変えないこと。** 2026-07 の検査で、11 スキンのうち
 * 7 つが WCAG AA(4.5:1)を満たしておらず、最低は 2.83:1 だった(cute)。
 * 「薄いグレーで上品に見える」色は、**見えるが読めない**画面になる。
 * 現在は全スキンが背景・サーフェスの両方に対して AA を満たす値に調整してある。
 *
 * 変更したら `node --experimental-strip-types tools/smoke.mjs` で
 * 「findContrastIssues は空」が通ることを必ず確認する。
 */
/**
 * 標準テーマ(スキン)。性格の異なる 4 種を用意。アプリはこれをそのまま使うか、
 * registry.register() で独自テーマを追加して差し替える。
 * @packageDocumentation
 */
import type { Theme } from "./tokens";
/** 標準・中庸(青系・きっちりした業務向け)。 */
export declare const defaultTheme: Theme;
/** コーポレート(落ち着いた紺・グレー。信頼感重視・角丸控えめ)。 */
export declare const corporateTheme: Theme;
/** やわらか(温かみのあるベージュ・オレンジ。丸みと余白多め)。 */
export declare const softTheme: Theme;
/** ハイコントラスト(白黒・視認性最優先。アクセシビリティ向け)。 */
export declare const highContrastTheme: Theme;
/** かわいい(パステルピンク・丸め・やさしい)。 */
export declare const cuteTheme: Theme;
/** 暖色系(オレンジ・活気・親しみ)。 */
export declare const warmTheme: Theme;
/** シック(深いワイン・グレージュ・落ち着き)。 */
export declare const chicTheme: Theme;
/** モダン(鮮やかな青紫・シャープ・余白)。 */
export declare const modernTheme: Theme;
/** レトロ(くすんだ黄土・ティール・70年代風)。 */
export declare const retroTheme: Theme;
/** モノトーン(白黒グレー・無彩色・ミニマル)。 */
export declare const monochromeTheme: Theme;
/** クール(アイスブルー・シアン・涼しげ)。 */
export declare const coolTheme: Theme;
/**
 * ネイビーサイド(横の案内だけ濃紺)。
 *
 * 本文は白のまま、**横の案内だけを濃い色にする**型。
 * 本文と案内の境目がはっきりするので、画面の広い業務システムで迷いにくい。
 * 長時間見ても疲れにくいよう、本文側は明るいままにしてある。
 */
export declare const navySidebarTheme: Theme;
/**
 * フォレストサイド(横の案内が深緑)。
 *
 * 落ち着いた緑で、長時間の作業でも目に負担が少ない。
 * 製造・物流など、画面を開きっぱなしにする業務に向く。
 */
export declare const forestSidebarTheme: Theme;
/**
 * ワインサイド(横の案内が濃い赤紫)。
 *
 * 華やかで印象に残る配色。**社外の人が見る画面**や、
 * 複数のシステムを見分けたいときに使う(色で「どのシステムか」が分かる)。
 */
export declare const wineSidebarTheme: Theme;
/** 標準テーマの一覧(登録順)。 */
export declare const builtInThemes: Theme[];
//# sourceMappingURL=themes.d.ts.map