import * as React from "react";
import { ReviewWidget } from "../../components/ReviewWidget.js";
import { siteEnv } from "../../server/env.js";
export const metadata = { title: "お客様の声" };
/** 公開: お客様の声（社内アプリの公開レビューAPIを参照）。apiBase は env INTERNAL_API_BASE。 */
export default function PublicReviewsPage() {
  const apiBase = siteEnv.INTERNAL_API_BASE;
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-bold">お客様の声</h1>
      <ReviewWidget subjectType="product" subjectId="main" apiBase={apiBase} />
    </main>
  );
}
