import type { Catalogs } from "@platform/i18n";
/** 経費ドメインの文言(namespaced("expenses", ...) で結合)。 */
export const expensesCatalog: Catalogs = {
  ja: { title: "経費", monthly: "月次締め", approve: "承認", reject: "却下" },
  en: { title: "Expenses", monthly: "Monthly close", approve: "Approve", reject: "Reject" },
  zh: { title: "费用", monthly: "月度结算", approve: "批准", reject: "驳回" },
  ko: { title: "경비", monthly: "월별 마감", approve: "승인", reject: "반려" },
};
