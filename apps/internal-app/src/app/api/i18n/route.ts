// public-api: 翻訳カタログの配信。秘密情報を含まない
/** i18n: 指定ロケールの文言を返す(GET)。?locale=ja|en|zh|ko。 */
import { withApiObservability } from "../../../server/instrument";
import { appCatalogs } from "../../../server/i18n";
import { LOCALES, LOCALE_LABELS, type Locale } from "@platform/i18n";

async function handleGET(req: Request): Promise<Response> {
  const raw = new URL(req.url).searchParams.get("locale") ?? "ja";
  const locale = (LOCALES as readonly string[]).includes(raw) ? (raw as Locale) : "ja";
  return Response.json({ locale, locales: LOCALES.map((l) => ({ code: l, label: LOCALE_LABELS[l] })), messages: appCatalogs[locale] ?? appCatalogs.ja ?? {} });
}

export const GET = withApiObservability("/api/i18n", handleGET);
