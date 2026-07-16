/**
 * 給与明細の一括 PDF 生成(純オーケストレーション)。
 * 複数従業員の明細をまとめて PDF 化し、成否を収集する。renderer は注入。
 * 実運用では @platform/jobs の Worker で並列処理・失敗リトライを行う。
 * @packageDocumentation
 */
import { buildPayslip, renderPayslipHtml, type PayBreakdown, type PayslipItem } from "@platform/payroll";
import { createPdf, DEFAULT_INVOICE_PDF_OPTIONS, type PdfRenderer } from "@platform/pdf";

/** 一括生成の 1 名分の入力。 */
export interface PayslipJob {
  employeeId: string;
  employeeName: string;
  breakdown: PayBreakdown;
  allowances?: PayslipItem[];
  deductions?: PayslipItem[];
}

/** 1 名分の生成結果。 */
export interface PayslipOutput {
  employeeId: string;
  status: "generated" | "failed";
  pdf?: Uint8Array;
  error?: string;
}

/** 従業員ぶんの給与明細をまとめて PDF 化する。 */
export async function generatePayslipBatch(
  jobs: PayslipJob[],
  renderer: PdfRenderer,
  options: { period?: string; companyName?: string } = {},
): Promise<{ outputs: PayslipOutput[]; summary: { generated: number; failed: number } }> {
  const service = createPdf(renderer);
  const outputs: PayslipOutput[] = [];

  for (const job of jobs) {
    try {
      const payslip = buildPayslip(job.breakdown, { allowances: job.allowances, deductions: job.deductions });
      const html = renderPayslipHtml(payslip, { employeeName: job.employeeName, period: options.period, companyName: options.companyName });
      const result = await service.fromHtml(html, DEFAULT_INVOICE_PDF_OPTIONS);
      if (result.ok) outputs.push({ employeeId: job.employeeId, status: "generated", pdf: result.value });
      else outputs.push({ employeeId: job.employeeId, status: "failed", error: "PDF 生成に失敗しました" });
    } catch (e) {
      outputs.push({ employeeId: job.employeeId, status: "failed", error: e instanceof Error ? e.message : String(e) });
    }
  }

  return {
    outputs,
    summary: {
      generated: outputs.filter((o) => o.status === "generated").length,
      failed: outputs.filter((o) => o.status === "failed").length,
    },
  };
}
