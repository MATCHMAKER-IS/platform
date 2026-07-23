/**
 * 標準テーマ(スキン)。性格の異なる 4 種を用意。アプリはこれをそのまま使うか、
 * registry.register() で独自テーマを追加して差し替える。
 * @packageDocumentation
 */
import type { Theme } from "./tokens";

/** 標準・中庸(青系・きっちりした業務向け)。 */
export const defaultTheme: Theme = {
  id: "default",
  name: "スタンダード",
  description: "青を基調とした標準的な業務テーマ。",
  shape: { fontFamily: "system-ui, sans-serif", radius: 8, spacing: 8, elevation: 1 },
  modes: {
    light: {
      bg: "#f7f8fa", fg: "#1a1a2e", muted: "#6b7280", surface: "#ffffff",
      border: "#e5e7eb", primary: "#2563eb", primaryFg: "#ffffff", accent: "#7c3aed",
      success: "#16a34a", warning: "#d97706", danger: "#dc2626",
    },
    dark: {
      bg: "#0f172a", fg: "#e2e8f0", muted: "#94a3b8", surface: "#1e293b",
      border: "#334155", primary: "#156bf4", primaryFg: "#ffffff", accent: "#a78bfa",
      success: "#22c55e", warning: "#f59e0b", danger: "#ef4444",
    },
  },
};

/** コーポレート(落ち着いた紺・グレー。信頼感重視・角丸控えめ)。 */
export const corporateTheme: Theme = {
  id: "corporate",
  name: "コーポレート",
  description: "紺とグレーで信頼感を出した、かっちりしたテーマ。",
  shape: { fontFamily: "'Segoe UI', system-ui, sans-serif", radius: 4, spacing: 8, elevation: 1 },
  modes: {
    light: {
      bg: "#ffffff", fg: "#1f2937", muted: "#6b7280", surface: "#f9fafb",
      border: "#d1d5db", primary: "#1e3a8a", primaryFg: "#ffffff", accent: "#0e7490",
      success: "#15803d", warning: "#b45309", danger: "#b91c1c",
    },
    dark: {
      bg: "#111827", fg: "#f3f4f6", muted: "#9ca3af", surface: "#1f2937",
      border: "#374151", primary: "#3b5bdb", primaryFg: "#ffffff", accent: "#22d3ee",
      success: "#22c55e", warning: "#eab308", danger: "#f87171",
    },
  },
};

/** やわらか(温かみのあるベージュ・オレンジ。丸みと余白多め)。 */
export const softTheme: Theme = {
  id: "soft",
  name: "やわらか",
  description: "ベージュと暖色で親しみやすく。角丸と余白を大きめに。",
  shape: { fontFamily: "'Hiragino Sans', 'Yu Gothic', system-ui, sans-serif", radius: 16, spacing: 10, elevation: 2 },
  modes: {
    light: {
      bg: "#faf6f0", fg: "#3f342b", muted: "#8b7d6b", surface: "#fffdfa",
      border: "#ece3d6", primary: "#c85014", primaryFg: "#ffffff", accent: "#d4a017",
      success: "#4d9e5a", warning: "#e08e0b", danger: "#d0553f",
    },
    dark: {
      bg: "#2a2320", fg: "#f0e8dd", muted: "#b3a493", surface: "#362e29",
      border: "#4a3f37", primary: "#f4813f", primaryFg: "#2a2320", accent: "#e6b422",
      success: "#6bbd77", warning: "#f0a830", danger: "#e57358",
    },
  },
};

/** ハイコントラスト(白黒・視認性最優先。アクセシビリティ向け)。 */
export const highContrastTheme: Theme = {
  id: "high-contrast",
  name: "ハイコントラスト",
  description: "白黒中心で視認性を最優先。アクセシビリティ重視。",
  shape: { fontFamily: "system-ui, sans-serif", radius: 2, spacing: 8, elevation: 0 },
  modes: {
    light: {
      bg: "#ffffff", fg: "#000000", muted: "#333333", surface: "#ffffff",
      border: "#000000", primary: "#0000cc", primaryFg: "#ffffff", accent: "#6600cc",
      success: "#006600", warning: "#994400", danger: "#cc0000",
    },
    dark: {
      bg: "#000000", fg: "#ffffff", muted: "#cccccc", surface: "#000000",
      border: "#ffffff", primary: "#66aaff", primaryFg: "#000000", accent: "#cc99ff",
      success: "#66ff66", warning: "#ffaa33", danger: "#ff6666",
    },
  },
};

/** かわいい(パステルピンク・丸め・やさしい)。 */
export const cuteTheme: Theme = {
  id: "cute",
  name: "かわいい",
  description: "パステルピンクと丸みで、やわらかく親しみやすい雰囲気。",
  shape: { fontFamily: "'Rounded Mplus 1c', 'Hiragino Maru Gothic ProN', system-ui, sans-serif", radius: 20, spacing: 10, elevation: 2 },
  modes: {
    light: {
      bg: "#fff5f8", fg: "#5a3d4a", muted: "#b08a99", surface: "#ffffff",
      border: "#ffd9e6", primary: "#ff7eb6", primaryFg: "#4a1f33", accent: "#c88eff",
      success: "#5cc98f", warning: "#ffab5e", danger: "#ff6f91",
    },
    dark: {
      bg: "#2e2028", fg: "#f5dce6", muted: "#c39aac", surface: "#3a2833",
      border: "#5a3a48", primary: "#ff9ec7", primaryFg: "#2e2028", accent: "#d3a4ff",
      success: "#7ad6a4", warning: "#ffc078", danger: "#ff8fa8",
    },
  },
};

/** 暖色系(オレンジ・活気・親しみ)。 */
export const warmTheme: Theme = {
  id: "warm",
  name: "暖色（オレンジ）",
  description: "オレンジを主役にした、活気と温かみのあるテーマ。",
  shape: { fontFamily: "system-ui, sans-serif", radius: 10, spacing: 8, elevation: 1 },
  modes: {
    light: {
      bg: "#fff8f2", fg: "#3d2b1f", muted: "#9c7c66", surface: "#ffffff",
      border: "#f5ddc8", primary: "#c25405", primaryFg: "#ffffff", accent: "#e11d48",
      success: "#65a30d", warning: "#ca8a04", danger: "#dc2626",
    },
    dark: {
      bg: "#291d14", fg: "#f5e6d8", muted: "#bfa088", surface: "#362619",
      border: "#4d3826", primary: "#fb923c", primaryFg: "#291d14", accent: "#fb7185",
      success: "#a3e635", warning: "#facc15", danger: "#f87171",
    },
  },
};

/** シック(深いワイン・グレージュ・落ち着き)。 */
export const chicTheme: Theme = {
  id: "chic",
  name: "シック",
  description: "深いワインカラーとグレージュで、落ち着いた上品さ。",
  shape: { fontFamily: "'Playfair Display', 'Noto Serif JP', serif", headingFontFamily: "'Playfair Display', 'Noto Serif JP', serif", radius: 6, spacing: 9, elevation: 1 },
  modes: {
    light: {
      bg: "#f5f1ee", fg: "#3a2e2e", muted: "#8a7a75", surface: "#fdfaf8",
      border: "#e0d5cf", primary: "#7b2d3f", primaryFg: "#ffffff", accent: "#a68a64",
      success: "#5a7a52", warning: "#b0812f", danger: "#a3423c",
    },
    dark: {
      bg: "#221b1b", fg: "#ece0da", muted: "#a89890", surface: "#2e2424",
      border: "#443636", primary: "#a84a5e", primaryFg: "#ffffff", accent: "#c4a878",
      success: "#7d9e73", warning: "#cba05a", danger: "#c6675f",
    },
  },
};

/** モダン(鮮やかな青紫・シャープ・余白)。 */
export const modernTheme: Theme = {
  id: "modern",
  name: "モダン",
  description: "鮮やかな青紫とシャープな輪郭。余白を活かした今風のデザイン。",
  shape: { fontFamily: "'Inter', 'Noto Sans JP', system-ui, sans-serif", radius: 12, spacing: 10, elevation: 2 },
  modes: {
    light: {
      bg: "#fafafe", fg: "#18181b", muted: "#71717a", surface: "#ffffff",
      border: "#e4e4e7", primary: "#5b5df1", primaryFg: "#ffffff", accent: "#06b6d4",
      success: "#10b981", warning: "#f59e0b", danger: "#ef4444",
    },
    dark: {
      bg: "#0a0a0f", fg: "#fafafa", muted: "#a1a1aa", surface: "#18181f",
      border: "#27272f", primary: "#818cf8", primaryFg: "#0a0a0f", accent: "#22d3ee",
      success: "#34d399", warning: "#fbbf24", danger: "#f87171",
    },
  },
};

/** レトロ(くすんだ黄土・ティール・70年代風)。 */
export const retroTheme: Theme = {
  id: "retro",
  name: "レトロ",
  description: "くすんだ黄土色とティールで、70年代を思わせる懐かしい配色。",
  shape: { fontFamily: "'Courier New', 'Roboto Mono', monospace", headingFontFamily: "'Georgia', serif", radius: 4, spacing: 8, elevation: 1 },
  modes: {
    light: {
      bg: "#f3ead8", fg: "#3e352a", muted: "#8a7a5f", surface: "#faf3e3",
      border: "#d9c9a8", primary: "#a85a29", primaryFg: "#faf3e3", accent: "#2f7c78",
      success: "#6b8e23", warning: "#c99a2e", danger: "#b23a2e",
    },
    dark: {
      bg: "#2a2519", fg: "#e8dcc0", muted: "#b0a080", surface: "#352f20",
      border: "#4a4230", primary: "#d98545", primaryFg: "#2a2519", accent: "#4ca6a0",
      success: "#8faa3f", warning: "#dbb554", danger: "#cd5a4a",
    },
  },
};

/** モノトーン(白黒グレー・無彩色・ミニマル)。 */
export const monochromeTheme: Theme = {
  id: "monochrome",
  name: "モノトーン",
  description: "無彩色でまとめた、ミニマルで洗練された印象。",
  shape: { fontFamily: "'Helvetica Neue', 'Noto Sans JP', system-ui, sans-serif", radius: 6, spacing: 8, elevation: 1 },
  modes: {
    light: {
      bg: "#f5f5f5", fg: "#1a1a1a", muted: "#767676", surface: "#ffffff",
      border: "#d4d4d4", primary: "#2b2b2b", primaryFg: "#ffffff", accent: "#585858",
      success: "#4a4a4a", warning: "#6e6e6e", danger: "#1a1a1a",
    },
    dark: {
      bg: "#141414", fg: "#ededed", muted: "#9a9a9a", surface: "#1f1f1f",
      border: "#363636", primary: "#e0e0e0", primaryFg: "#141414", accent: "#a8a8a8",
      success: "#c4c4c4", warning: "#9a9a9a", danger: "#ededed",
    },
  },
};

/** クール(アイスブルー・シアン・涼しげ)。 */
export const coolTheme: Theme = {
  id: "cool",
  name: "クール",
  description: "アイスブルーとシアンで、涼しげでスタイリッシュな印象。",
  shape: { fontFamily: "'SF Pro Display', 'Noto Sans JP', system-ui, sans-serif", radius: 10, spacing: 8, elevation: 2 },
  modes: {
    light: {
      bg: "#f0f7fa", fg: "#152a33", muted: "#5e7a85", surface: "#ffffff",
      border: "#cfe3ea", primary: "#077e9c", primaryFg: "#ffffff", accent: "#2563eb",
      success: "#0d9488", warning: "#0284c7", danger: "#e11d48",
    },
    dark: {
      bg: "#0a1a20", fg: "#d5e8ef", muted: "#7fa0ac", surface: "#12262e",
      border: "#20404a", primary: "#22d3ee", primaryFg: "#0a1a20", accent: "#60a5fa",
      success: "#2dd4bf", warning: "#38bdf8", danger: "#fb7185",
    },
  },
};


/**
 * ネイビーサイド(横の案内だけ濃紺)。
 *
 * 本文は白のまま、**横の案内だけを濃い色にする**型。
 * 本文と案内の境目がはっきりするので、画面の広い業務システムで迷いにくい。
 * 長時間見ても疲れにくいよう、本文側は明るいままにしてある。
 */
export const navySidebarTheme: Theme = {
  id: "navy-sidebar",
  name: "ネイビーサイド",
  description: "本文は明るく、横の案内だけ濃紺。境目がはっきりして迷いにくい。",
  shape: { fontFamily: "system-ui, sans-serif", radius: 8, spacing: 8, elevation: 1 },
  modes: {
    light: {
      bg: "#f6f8fb", fg: "#16233a", muted: "#556377", surface: "#ffffff", border: "#e2e8f0",
      primary: "#1d4ed8", primaryFg: "#ffffff", accent: "#7c3aed",
      success: "#16a34a", warning: "#d97706", danger: "#dc2626",
      sidebarBg: "#1e293b", sidebarFg: "#e2e8f0",
      sidebarActiveBg: "#334155", sidebarActiveFg: "#ffffff",
    },
    dark: {
      bg: "#0f172a", fg: "#e2e8f0", muted: "#94a3b8", surface: "#1e293b", border: "#334155",
      primary: "#1d4ed8", primaryFg: "#ffffff", accent: "#a78bfa",
      success: "#22c55e", warning: "#f59e0b", danger: "#ef4444",
      sidebarBg: "#020617", sidebarFg: "#cbd5e1",
      sidebarActiveBg: "#1e293b", sidebarActiveFg: "#ffffff",
    },
  },
};

/**
 * フォレストサイド(横の案内が深緑)。
 *
 * 落ち着いた緑で、長時間の作業でも目に負担が少ない。
 * 製造・物流など、画面を開きっぱなしにする業務に向く。
 */
export const forestSidebarTheme: Theme = {
  id: "forest-sidebar",
  name: "フォレストサイド",
  description: "横の案内が深緑。落ち着いた配色で、開きっぱなしの業務に向く。",
  shape: { fontFamily: "system-ui, sans-serif", radius: 8, spacing: 8, elevation: 1 },
  modes: {
    light: {
      bg: "#f5f8f5", fg: "#1c2b22", muted: "#5f7367", surface: "#ffffff", border: "#dde7e0",
      primary: "#15803d", primaryFg: "#ffffff", accent: "#0d9488",
      success: "#16a34a", warning: "#ca8a04", danger: "#dc2626",
      sidebarBg: "#1f3a2e", sidebarFg: "#d7e6dc",
      sidebarActiveBg: "#2f5545", sidebarActiveFg: "#ffffff",
    },
    dark: {
      bg: "#0d1a14", fg: "#d7e6dc", muted: "#84a396", surface: "#152620", border: "#264034",
      primary: "#4ade80", primaryFg: "#0d1a14", accent: "#2dd4bf",
      success: "#4ade80", warning: "#facc15", danger: "#f87171",
      sidebarBg: "#08110d", sidebarFg: "#b8d1c3",
      sidebarActiveBg: "#1f3a2e", sidebarActiveFg: "#ffffff",
    },
  },
};

/**
 * ワインサイド(横の案内が濃い赤紫)。
 *
 * 華やかで印象に残る配色。**社外の人が見る画面**や、
 * 複数のシステムを見分けたいときに使う(色で「どのシステムか」が分かる)。
 */
export const wineSidebarTheme: Theme = {
  id: "wine-sidebar",
  name: "ワインサイド",
  description: "横の案内が濃い赤紫。印象に残るので、システムの見分けに使える。",
  shape: { fontFamily: "'Noto Sans JP', system-ui, sans-serif", radius: 10, spacing: 8, elevation: 2 },
  modes: {
    light: {
      bg: "#faf6f8", fg: "#2b1a22", muted: "#7a6470", surface: "#ffffff", border: "#ecdfe5",
      primary: "#9d174d", primaryFg: "#ffffff", accent: "#7c3aed",
      success: "#16a34a", warning: "#d97706", danger: "#be123c",
      sidebarBg: "#4c1d3d", sidebarFg: "#f3e0ea",
      sidebarActiveBg: "#6b2a56", sidebarActiveFg: "#ffffff",
    },
    dark: {
      bg: "#1a0f16", fg: "#f0dde6", muted: "#a68296", surface: "#251621", border: "#3d2433",
      primary: "#f472b6", primaryFg: "#1a0f16", accent: "#c084fc",
      success: "#4ade80", warning: "#fbbf24", danger: "#fb7185",
      sidebarBg: "#0f0810", sidebarFg: "#e3cbd8",
      sidebarActiveBg: "#3a1730", sidebarActiveFg: "#ffffff",
    },
  },
};

/** 標準テーマの一覧(登録順)。 */
export const builtInThemes: Theme[] = [
  defaultTheme, corporateTheme, softTheme, highContrastTheme,
  cuteTheme, warmTheme, chicTheme, modernTheme, retroTheme, monochromeTheme, coolTheme,
  navySidebarTheme, forestSidebarTheme, wineSidebarTheme,
];
