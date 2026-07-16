/**
 * アンケート結果の CSV 出力。設問ごとの集計を表形式にする。@platform/csv を利用。
 * @packageDocumentation
 */
import { toCsv } from "@platform/csv";
import { type Survey, type SurveyResult } from "./survey-repo";

/** 集計結果を CSV（BOM 付き・日本語見出し）にする。設問・選択肢/指標・値の3列。 */
export function surveyResultsCsv(survey: Survey, result: SurveyResult): string {
  const rows: { question: string; item: string; value: string }[] = [];
  rows.push({ question: "アンケート", item: survey.title, value: `回答数 ${result.total}` });
  for (const q of result.questions) {
    if (q.options) {
      for (const o of q.options) rows.push({ question: q.text, item: o.label, value: String(o.count) });
    } else if (q.type === "rating") {
      rows.push({ question: q.text, item: "平均", value: (q.average ?? 0).toFixed(2) });
      (q.distribution ?? []).forEach((c, i) => rows.push({ question: q.text, item: `★${i + 1}`, value: String(c) }));
    } else {
      for (const t of q.texts ?? []) rows.push({ question: q.text, item: "自由記述", value: t });
    }
  }
  return toCsv(rows, { bom: true, columns: [{ key: "question", header: "設問" }, { key: "item", header: "項目" }, { key: "value", header: "値" }] });
}
