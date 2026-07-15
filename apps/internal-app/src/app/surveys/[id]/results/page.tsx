import * as React from "react";
import { ResultsClient } from "./results-client.js";
export const metadata = { title: "アンケート集計" };
export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResultsClient surveyId={id} />;
}
