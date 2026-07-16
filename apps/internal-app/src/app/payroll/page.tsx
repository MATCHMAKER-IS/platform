import * as React from "react";
import { PayrollClient } from "./payroll-client";
export const metadata = { title: "給与" };
export default function PayrollPage() { return <PayrollClient canAdmin />; }
