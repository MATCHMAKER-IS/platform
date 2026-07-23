/**
 * PWA(ホーム画面に置けるアプリ)の設定。
 *
 * 社内システムを **Android / iOS のホーム画面から開けるようにする**ための層。
 * ネイティブアプリを作らずに、次が得られる:
 *   - ホーム画面のアイコンから起動(ブラウザの URL バーが消える)
 *   - オフラインでも最低限の画面が出る
 *   - プッシュ通知(Android は可・iOS は 16.4 以降でホーム画面追加が必要)
 *
 * 倉庫や現場で使う画面は、**電波が不安定**な場所で開かれる。
 * 「圏外になった瞬間に真っ白」を避けることが、実用上いちばん効く。
 * @packageDocumentation
 */

/** アイコン 1 件。 */
export interface ManifestIcon {
  src: string;
  /** "192x192" のような形。 */
  sizes: string;
  type?: string;
  /** `maskable` を含めると Android で角丸に切られても見栄えが崩れない。 */
  purpose?: "any" | "maskable" | "any maskable";
}

/** ホーム画面から直接開けるショートカット。 */
export interface ManifestShortcut {
  name: string;
  url: string;
  description?: string;
  icons?: ManifestIcon[];
}

/** manifest の入力。 */
export interface WebManifestInput {
  /** アプリ名(インストール時の確認に出る)。 */
  name: string;
  /** ホーム画面のアイコン下に出る短い名前(12 文字程度まで)。 */
  shortName: string;
  description?: string;
  /** 起動時に開く URL。 */
  startUrl?: string;
  /** アプリの範囲。ここから外れた URL はブラウザで開く。 */
  scope?: string;
  /**
   * 表示のしかた。
   * `standalone` … URL バーを消す(社内システムはこれ)
   * `browser`    … 通常のタブ
   */
  display?: "standalone" | "fullscreen" | "minimal-ui" | "browser";
  /** 起動画面とテーマの色。 */
  themeColor?: string;
  backgroundColor?: string;
  /** 画面の向きを固定する(現場の端末で回転させたくない場合)。 */
  orientation?: "portrait" | "landscape" | "any";
  icons?: ManifestIcon[];
  shortcuts?: ManifestShortcut[];
  lang?: string;
}

/** 出力する manifest(そのまま JSON にできる形)。 */
export interface WebManifest {
  name: string;
  short_name: string;
  description?: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  orientation?: string;
  lang: string;
  icons: ManifestIcon[];
  shortcuts?: { name: string; url: string; description?: string; icons?: ManifestIcon[] }[];
}

/** アイコンが足りない、などの警告。 */
export interface ManifestWarning {
  field: string;
  message: string;
}

/**
 * Web App Manifest を組み立てる。
 *
 * 手で JSON を書くと、**必須の項目やアイコンの抜け**でインストールできなくなる
 * (しかも「インストールできない」としか出ないため原因が分かりにくい)。
 *
 * @param input アプリ名・アイコンなど
 * @returns manifest.json に書ける形
 *
 * @example
 * ```ts
 * // app/manifest.json/route.ts
 * export function GET() {
 *   return Response.json(buildWebManifest({
 *     name: "社内システム", shortName: "社内", themeColor: "#1e40af",
 *     icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" },
 *             { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }],
 *   }));
 * }
 * ```
 */
export function buildWebManifest(input: WebManifestInput): WebManifest {
  return {
    name: input.name,
    short_name: input.shortName,
    ...(input.description ? { description: input.description } : {}),
    start_url: input.startUrl ?? "/",
    scope: input.scope ?? "/",
    display: input.display ?? "standalone",
    theme_color: input.themeColor ?? "#ffffff",
    background_color: input.backgroundColor ?? "#ffffff",
    ...(input.orientation ? { orientation: input.orientation } : {}),
    lang: input.lang ?? "ja",
    icons: input.icons ?? [],
    ...(input.shortcuts ? { shortcuts: input.shortcuts } : {}),
  };
}

/**
 * インストールできる条件を満たしているか調べる。
 *
 * ブラウザは「インストールできない」としか言わないため、**何が足りないか**をここで示す。
 *
 * @param manifest 組み立てた manifest
 * @returns 足りないものの一覧(空なら条件を満たす)
 */
export function checkInstallable(manifest: WebManifest): ManifestWarning[] {
  const warnings: ManifestWarning[] = [];

  if (manifest.name.trim() === "") warnings.push({ field: "name", message: "アプリ名が空です" });
  if (manifest.short_name.trim() === "") {
    warnings.push({ field: "short_name", message: "短い名前が空です(ホーム画面のアイコン下に出ます)" });
  } else if (manifest.short_name.length > 12) {
    warnings.push({ field: "short_name", message: `短い名前が長すぎます(${manifest.short_name.length} 文字)。ホーム画面で省略されます` });
  }

  const sizes = manifest.icons.map((i) => i.sizes);
  if (!sizes.includes("192x192")) warnings.push({ field: "icons", message: "192x192 のアイコンがありません(インストールに必要)" });
  if (!sizes.includes("512x512")) warnings.push({ field: "icons", message: "512x512 のアイコンがありません(起動画面に使われます)" });
  if (!manifest.icons.some((i) => i.purpose?.includes("maskable"))) {
    warnings.push({ field: "icons", message: "maskable のアイコンがありません(Android で角を切られたときに崩れます)" });
  }

  if (manifest.display === "browser") {
    warnings.push({ field: "display", message: "display が browser のため、インストールしても通常のタブで開きます" });
  }
  return warnings;
}

/**
 * インストールを促す案内文を、端末に合わせて返す。
 *
 * **iOS は「ホーム画面に追加」を手で選んでもらう必要がある**(インストールの確認が出ない)。
 * 同じ案内を出すと、iOS の利用者は何をすればよいか分からない。
 *
 * @param userAgent 端末の userAgent
 * @returns 案内文と、自動で促せるか
 */
export function installGuidance(userAgent: string): { platform: "ios" | "android" | "desktop"; canPrompt: boolean; steps: string[] } {
  const ua = userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua) || (/macintosh/.test(ua) && /mobile/.test(ua));

  if (isIos) {
    return {
      platform: "ios",
      // iOS はインストールの確認を出せないため、手順を案内するしかない
      canPrompt: false,
      steps: [
        "画面下の「共有」ボタンを押す",
        "「ホーム画面に追加」を選ぶ",
        "右上の「追加」を押す",
      ],
    };
  }
  if (/android/.test(ua)) {
    return {
      platform: "android",
      canPrompt: true,
      steps: ["「インストール」を押す", "ホーム画面のアイコンから開けます"],
    };
  }
  return {
    platform: "desktop",
    canPrompt: true,
    steps: ["アドレスバーのインストールボタンを押す"],
  };
}
