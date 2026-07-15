import * as React from "react";
import { InvoicesClient } from "./invoices-client.js";

export const metadata = { title: "請求書" };

export default function InvoicesPage() {
  return <InvoicesClient />;
}
