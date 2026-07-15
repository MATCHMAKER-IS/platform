/**
 * 社内アプリの多言語対応。@platform/i18n を使い、アプリ固有の文言カタログと翻訳器を提供する。
 * @packageDocumentation
 */
import { createI18n, type Catalogs, type Locale, type Translator } from "@platform/i18n";

/** アプリ固有の文言（キー→各言語）。 */
export const appCatalogs: Catalogs = {
  ja: {
    "nav.dashboard": "ダッシュボード", "nav.mailbox": "受信箱", "nav.invoices": "請求", "nav.accounting": "会計", "nav.admin": "管理",
    "survey.title": "アンケート", "survey.respond": "回答する", "survey.results": "集計結果", "survey.submit": "送信", "survey.thanks": "ご回答ありがとうございました",
    "common.save": "保存", "common.cancel": "キャンセル", "common.total": "合計",
  },
  en: {
    "nav.dashboard": "Dashboard", "nav.mailbox": "Inbox", "nav.invoices": "Invoices", "nav.accounting": "Accounting", "nav.admin": "Admin",
    "survey.title": "Survey", "survey.respond": "Respond", "survey.results": "Results", "survey.submit": "Submit", "survey.thanks": "Thank you for your response",
    "common.save": "Save", "common.cancel": "Cancel", "common.total": "Total",
  },
  zh: {
    "nav.dashboard": "仪表板", "nav.mailbox": "收件箱", "nav.invoices": "发票", "nav.accounting": "会计", "nav.admin": "管理",
    "survey.title": "问卷", "survey.respond": "回答", "survey.results": "统计结果", "survey.submit": "提交", "survey.thanks": "感谢您的回答",
    "common.save": "保存", "common.cancel": "取消", "common.total": "合计",
  },
  ko: {
    "nav.dashboard": "대시보드", "nav.mailbox": "받은편지함", "nav.invoices": "청구", "nav.accounting": "회계", "nav.admin": "관리",
    "survey.title": "설문", "survey.respond": "응답", "survey.results": "집계 결과", "survey.submit": "제출", "survey.thanks": "응답해 주셔서 감사합니다",
    "common.save": "저장", "common.cancel": "취소", "common.total": "합계",
  },
};

/** 指定ロケールの翻訳器を作る（未知キーはキーをそのまま返す）。 */
export function appTranslator(locale: Locale): Translator {
  return createI18n({ catalogs: appCatalogs, locale, fallbackLocale: "ja" });
}
