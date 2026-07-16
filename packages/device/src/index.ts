/**
 * `@platform/device` — 端末・ブラウザ・OS・ネットワーク等のクライアント情報取得。
 *
 * UA 解析は ua-parser-js をラップ(サーバでは User-Agent 文字列、ブラウザでは
 * navigator を入力にできる)。ブラウザでは画面・ネットワーク・ロケール・各種設定・
 * 機能サポート状況もまとめて取得する。
 *
 * @packageDocumentation
 */
import { UAParser } from "ua-parser-js";
import { ok, err, AppError, ErrorCode, type Result } from "@platform/core";

/** 端末種別。 */
export type DeviceType = "mobile" | "tablet" | "desktop";

/** UA 解析結果(サーバ・クライアント共通)。 */
export interface UserAgentInfo {
  browser: { name?: string; version?: string };
  engine: { name?: string; version?: string };
  os: { name?: string; version?: string };
  device: { type: DeviceType; vendor?: string; model?: string };
  cpu: { architecture?: string };
}

/**
 * User-Agent 文字列を解析する(サーバ側でも使える)。
 * @param ua User-Agent 文字列(例: `req.headers.get("user-agent")`)
 *
 * @example
 * ```ts
 * const ua = parseUserAgent(request.headers.get("user-agent") ?? "");
 * console.log(ua.browser.name, ua.os.name, ua.device.type);
 * ```
 * @returns ブラウザ・OS・端末種別。**UA は偽装できる**ので、機能の有無は UA ではなく実際の API で判定すること
 */
export function parseUserAgent(ua: string): UserAgentInfo {
  const r = new UAParser(ua).getResult();
  return {
    browser: { name: r.browser.name, version: r.browser.version },
    engine: { name: r.engine.name, version: r.engine.version },
    os: { name: r.os.name, version: r.os.version },
    device: { type: (r.device.type as DeviceType) ?? "desktop", vendor: r.device.vendor, model: r.device.model },
    cpu: { architecture: r.cpu.architecture },
  };
}

/** ブラウザで取得できるクライアント情報一式。 */
export interface ClientInfo extends UserAgentInfo {
  hardware: { cores?: number; memoryGB?: number; maxTouchPoints: number };
  screen: { width: number; height: number; pixelRatio: number; colorDepth: number; orientation?: string };
  viewport: { width: number; height: number };
  network: { online: boolean; effectiveType?: string; downlinkMbps?: number; rttMs?: number; saveData?: boolean };
  locale: { language: string; languages: string[]; timezone: string };
  preferences: { colorScheme: "dark" | "light"; reducedMotion: boolean };
  capabilities: { touch: boolean; cookiesEnabled: boolean; standalone: boolean };
}

/**
 * ブラウザで利用可能なクライアント情報を収集する。
 * @remarks ブラウザ(window あり)でのみ動作する。SSR では呼ばない。
 * @returns クライアントの情報。**SSR では undefined**
 */
export function getClientInfo(): ClientInfo {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
  };
  const ua = parseUserAgent(nav.userAgent);
  const conn = nav.connection;
  const media = (q: string) => (typeof matchMedia === "function" ? matchMedia(q).matches : false);

  return {
    ...ua,
    hardware: {
      cores: nav.hardwareConcurrency,
      memoryGB: nav.deviceMemory,
      maxTouchPoints: nav.maxTouchPoints ?? 0,
    },
    screen: {
      width: screen.width,
      height: screen.height,
      pixelRatio: window.devicePixelRatio,
      colorDepth: screen.colorDepth,
      orientation: screen.orientation?.type,
    },
    viewport: { width: window.innerWidth, height: window.innerHeight },
    network: {
      online: nav.onLine,
      effectiveType: conn?.effectiveType,
      downlinkMbps: conn?.downlink,
      rttMs: conn?.rtt,
      saveData: conn?.saveData,
    },
    locale: {
      language: nav.language,
      languages: [...(nav.languages ?? [])],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    preferences: {
      colorScheme: media("(prefers-color-scheme: dark)") ? "dark" : "light",
      reducedMotion: media("(prefers-reduced-motion: reduce)"),
    },
    capabilities: {
      touch: (nav.maxTouchPoints ?? 0) > 0 || "ontouchstart" in window,
      cookiesEnabled: nav.cookieEnabled,
      standalone: media("(display-mode: standalone)"),
    },
  };
}

/** 位置情報(要ユーザー許可)。 */
export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}

/**
 * 位置情報を取得する(ユーザーの許可ダイアログが出る)。
 * @returns 許可・取得できれば `ok`、拒否・失敗・非対応は `err`
 */
export function requestGeolocation(): Promise<Result<GeoPosition>> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(err(new AppError(ErrorCode.INTERNAL, "この環境では位置情報を取得できません")));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(ok({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracyMeters: pos.coords.accuracy })),
      (e) => resolve(err(new AppError(ErrorCode.FORBIDDEN, e.code === e.PERMISSION_DENIED ? "位置情報の利用が許可されていません" : "位置情報を取得できませんでした"))),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  });
}
