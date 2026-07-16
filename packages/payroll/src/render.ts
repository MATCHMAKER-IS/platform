/**
 * 給与明細の HTML 描画(純ロジック)。@platform/pdf の fromHtml に渡して PDF 化する。
 * @packageDocumentation
 */
import { type Payslip } from "./payslip.js";

/** 描画オプション。 */
export interface PayslipHtmlOptions {
  /** 従業員名。 */
  employeeName?: string;
  /** 対象期間(例 "2025年7月分")。 */
  period?: string;
  /** 会社名。 */
  companyName?: string;
}

function yen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * 給与明細を HTML に描画する(A4 想定)。
 *
 * **法定の記載事項**(支給額の内訳・控除の内訳・差引支給額)を満たす形にする。
 *
 * @param payslip 給与明細
 * @returns HTML 文字列
 */
export function renderPayslipHtml(payslip: Payslip, options: PayslipHtmlOptions = {}): string {
  const earnings: [string, number][] = [
    ["基本賃金", payslip.base],
    ["割増手当(時間外・深夜・休日)", payslip.premiums],
    ...payslip.allowances.map((a): [string, number] => [a.name, a.amount]),
  ];
  const earningRows = earnings.map(([n, v]) => `<tr><td>${esc(n)}</td><td class="num">${yen(v)}</td></tr>`).join("");
  const deductionRows = payslip.deductions.map((d) => `<tr><td>${esc(d.name)}</td><td class="num">${yen(d.amount)}</td></tr>`).join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
body{font-family:"Hiragino Sans","Noto Sans JP",sans-serif;color:#111;font-size:12px}
h1{font-size:18px;margin:0 0 4px}
.meta{color:#555;margin-bottom:20px}
.cols{display:flex;gap:24px}
.col{flex:1}
h2{font-size:13px;border-bottom:2px solid #333;padding-bottom:4px}
table{width:100%;border-collapse:collapse;margin-bottom:8px}
td{border-bottom:1px solid #ddd;padding:5px 6px}
.num{text-align:right}
.total{font-weight:bold;border-top:2px solid #333}
.net{font-size:16px;font-weight:bold;margin-top:16px;padding:10px;background:#f5f5f5;text-align:right}
</style></head><body>
<h1>給与明細書</h1>
<div class="meta">
  ${options.period ? `<div>${esc(options.period)}</div>` : ""}
  ${options.employeeName ? `<div>${esc(options.employeeName)} 様</div>` : ""}
  ${options.companyName ? `<div>${esc(options.companyName)}</div>` : ""}
</div>
<div class="cols">
  <div class="col">
    <h2>支給</h2>
    <table><tbody>${earningRows}<tr class="total"><td>総支給額</td><td class="num">${yen(payslip.grossPay)}</td></tr></tbody></table>
  </div>
  <div class="col">
    <h2>控除</h2>
    <table><tbody>${deductionRows || '<tr><td>―</td><td class="num">¥0</td></tr>'}<tr class="total"><td>控除合計</td><td class="num">${yen(payslip.totalDeductions)}</td></tr></tbody></table>
  </div>
</div>
<div class="net">差引支給額: ${yen(payslip.netPay)}</div>
</body></html>`;
}
