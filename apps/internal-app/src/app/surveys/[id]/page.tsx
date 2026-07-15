import * as React from "react";
import { RespondClient } from "./respond-client.js";
export const metadata = { title: "アンケート回答" };
export default async function RespondPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RespondClient surveyId={id} />;
}
