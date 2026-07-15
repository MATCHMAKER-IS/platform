# @demos/payslip-pdf — 給与明細PDF出力（@platform/pdf × @platform/payroll）

`buildPayslip`（payroll）で明細を組み立て、`renderPayslipHtml` で HTML 描画、`createPdf(renderer).fromHtml` で PDF 化。
支給（基本・割増・手当）／控除／差引支給を A4 レイアウトで出力します。描画は純ロジック、PDF 変換だけ環境依存。

## 一括生成（batch.ts）
`generatePayslipBatch(jobs, renderer)` が従業員ぶんの給与明細をまとめて PDF 化し、成否を収集します（1 名の失敗が全体を止めない）。実運用では `@platform/jobs` の Worker で並列処理します。
