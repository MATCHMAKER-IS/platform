-- 金額カラムを double precision → integer に変換する（円は最小単位で持つ）
--
-- 【なぜ必要か】
-- `Float`（PostgreSQL の double precision）は二進小数なので `0.1` を正確に表せません。
-- 明細を合計し、税を掛け、月次で足し込むと誤差が積もり、
-- **請求書の合計が 1 円合わない**という形で表に出ます。
--
-- 【なぜ `prisma db push` に任せないか】
-- `db push` は double precision → integer の変換を「データ損失の可能性あり」とみなし、
-- `--accept-data-loss` を要求します。**その状態で通すと、何がどう丸められたか記録が残りません。**
-- ここで明示的に `round()` して変換すれば、**丸め方をこちらが決められます**。
--
-- 【手順】
--   1. 事前確認（下の «STEP 1» を実行）… 小数を持つ行が 0 件であることを確かめる
--      ※ 忘れても STEP 2 の先頭で止まる（安全装置あり）。ただし
--        **どの行がいくら動くか**は STEP 1 でしか分からない
--   2. バックアップ  … pnpm run（`docs/ops/BACKUP_RESTORE.md`）
--   3. この SQL を実行 … psql -h localhost -U app -d app -f scripts/migrate-money-to-int.sql
--   4. `pnpm db push`   … schema と DB が一致しているので、ここは何も変更しないはず
--   5. `node tools/check-schema-types.mjs --set-limit`
--
-- 【対象外にしたもの】
--   - `StockMovementRow.unitCost` … 原価単価。**小数に意味がある**
--     （在庫評価は移動平均法で `value / qty` を繰り返すため、平均単価に必ず端数が出る。
--      `Int` にすると出庫のたびに丸めることになり、帳簿の在庫金額が実際とずれていく）
--
-- 【2026-08 に判断を変えたもの】
--   - `WageRow.hourlyWage` … **`Int` にしました**（以前は「小数に意味がありうる」として対象外）。
--     時給は**円単位で決まる**もので、端数のある時給を運用していません。
--     一方、毎月の計算で誤差が積み上がると**明細の内訳と合計が 1 円合わない**という
--     形で表に出ます（説明もできない問い合わせになる）。**入口（api/payroll/wage）も
--     `Number.isInteger` で絞ってあります**。
--     端数のある時給が必要になったら、**円未満をどう扱うかを決めてから** `Decimal` へ。

-- ═══════════════════════════ STEP 1: 事前確認 ═══════════════════════════
-- **これが 0 件でないなら、先に進まないこと。**
-- 0 件でなければ、丸めによって帳簿の数字が動きます。
-- どの行がいくら動くかを一覧にしてから、経理の合意を取ってください。

SELECT 'InvoiceRow.subtotal'   AS col, count(*) FROM "InvoiceRow"        WHERE subtotal   <> round(subtotal::numeric)
UNION ALL SELECT 'InvoiceRow.tax',        count(*) FROM "InvoiceRow"        WHERE tax        <> round(tax::numeric)
UNION ALL SELECT 'InvoiceRow.total',      count(*) FROM "InvoiceRow"        WHERE total      <> round(total::numeric)
UNION ALL SELECT 'InvoiceRow.paidAmount', count(*) FROM "InvoiceRow"        WHERE "paidAmount" <> round("paidAmount"::numeric)
UNION ALL SELECT 'QuoteRow.subtotal',     count(*) FROM "QuoteRow"          WHERE subtotal   <> round(subtotal::numeric)
UNION ALL SELECT 'QuoteRow.tax',          count(*) FROM "QuoteRow"          WHERE tax        <> round(tax::numeric)
UNION ALL SELECT 'QuoteRow.total',        count(*) FROM "QuoteRow"          WHERE total      <> round(total::numeric)
UNION ALL SELECT 'PurchaseOrderRow.subtotal', count(*) FROM "PurchaseOrderRow" WHERE subtotal <> round(subtotal::numeric)
UNION ALL SELECT 'PurchaseOrderRow.tax',      count(*) FROM "PurchaseOrderRow" WHERE tax      <> round(tax::numeric)
UNION ALL SELECT 'PurchaseOrderRow.total',    count(*) FROM "PurchaseOrderRow" WHERE total    <> round(total::numeric)
UNION ALL SELECT 'PurchasePaymentRow.amount', count(*) FROM "PurchasePaymentRow" WHERE amount <> round(amount::numeric)
UNION ALL SELECT 'AssetRow.cost',         count(*) FROM "AssetRow"          WHERE cost       <> round(cost::numeric)
UNION ALL SELECT 'AssetRow.proceeds',     count(*) FROM "AssetRow"          WHERE proceeds IS NOT NULL AND proceeds <> round(proceeds::numeric)
UNION ALL SELECT 'BudgetRow.amount',      count(*) FROM "BudgetRow"         WHERE amount     <> round(amount::numeric)
UNION ALL SELECT 'InvoiceReceiptRow.amount', count(*) FROM "InvoiceReceiptRow" WHERE amount   <> round(amount::numeric)
UNION ALL SELECT 'DocApprovalRow.amount',    count(*) FROM "DocApprovalRow"    WHERE amount   <> round(amount::numeric)
-- 2026-08 追加。**端数のある時給が登録されていないか**を先に見る。
-- 0 件でなければ、丸めると**その人の給与が変わります**——人事の合意なしに進めないこと。
UNION ALL SELECT 'WageRow.hourlyWage',       count(*) FROM "WageRow"           WHERE "hourlyWage" <> round("hourlyWage"::numeric)
;

-- ═══════════════════════════ STEP 2: 変換 ═══════════════════════════
-- **1 つのトランザクションで行う。** 途中で失敗したとき、
-- 一部だけ integer・一部だけ double precision という状態を残さないため。

BEGIN;

-- ── 安全装置 ─────────────────────────────────────────────
-- **このファイルをそのまま `psql -f` で流すと、STEP 1 の結果を
-- 誰も見ないまま STEP 2 が走る。** 「0 件であることを確かめてから」と
-- 手順書に書いても、**流す人は 1 コマンドで済ませたい**——実際そうなる。
--
-- **SQL 側で止める。** 端数のある行が 1 件でもあれば例外を投げ、
-- トランザクションごと巻き戻す(何も変わらない)。
--
-- **意図的に丸めたい場合**は、この DO ブロックを消してから流すこと
-- (「消す」という操作が、**判断した証拠**になる)。
DO $$
DECLARE
  fractional_rows integer;
BEGIN
  SELECT
    (SELECT count(*) FROM "InvoiceRow"        WHERE subtotal <> round(subtotal::numeric))
  + (SELECT count(*) FROM "InvoiceRow"        WHERE tax      <> round(tax::numeric))
  + (SELECT count(*) FROM "InvoiceRow"        WHERE total    <> round(total::numeric))
  + (SELECT count(*) FROM "QuoteRow"          WHERE total    <> round(total::numeric))
  + (SELECT count(*) FROM "PurchaseOrderRow"  WHERE total    <> round(total::numeric))
  + (SELECT count(*) FROM "PurchasePaymentRow" WHERE amount  <> round(amount::numeric))
  + (SELECT count(*) FROM "WageRow"           WHERE "hourlyWage" <> round("hourlyWage"::numeric))
  INTO fractional_rows;

  IF fractional_rows > 0 THEN
    RAISE EXCEPTION
      '端数のある行が % 件あります。丸めると帳簿の数字が動きます（STEP 1 で内訳を確認し、経理・人事の合意を取ってください）',
      fractional_rows;
  END IF;
END $$;
-- ────────────────────────────────────────────────────────

-- **`round()` は四捨五入。** 切り捨てにすると、
-- 端数のある入金が「1 円足りない」扱いになり、未収として残り続けます。
ALTER TABLE "InvoiceRow"
  ALTER COLUMN subtotal     TYPE integer USING round(subtotal::numeric),
  ALTER COLUMN tax          TYPE integer USING round(tax::numeric),
  ALTER COLUMN total        TYPE integer USING round(total::numeric),
  ALTER COLUMN "paidAmount" TYPE integer USING round("paidAmount"::numeric),
  ALTER COLUMN "paidAmount" SET DEFAULT 0;

ALTER TABLE "QuoteRow"
  ALTER COLUMN subtotal TYPE integer USING round(subtotal::numeric),
  ALTER COLUMN tax      TYPE integer USING round(tax::numeric),
  ALTER COLUMN total    TYPE integer USING round(total::numeric);

ALTER TABLE "PurchaseOrderRow"
  ALTER COLUMN subtotal TYPE integer USING round(subtotal::numeric),
  ALTER COLUMN tax      TYPE integer USING round(tax::numeric),
  ALTER COLUMN total    TYPE integer USING round(total::numeric);

ALTER TABLE "PurchasePaymentRow"
  ALTER COLUMN amount TYPE integer USING round(amount::numeric);

ALTER TABLE "AssetRow"
  ALTER COLUMN cost     TYPE integer USING round(cost::numeric),
  ALTER COLUMN proceeds TYPE integer USING round(proceeds::numeric);

ALTER TABLE "BudgetRow"
  ALTER COLUMN amount TYPE integer USING round(amount::numeric);

ALTER TABLE "InvoiceReceiptRow"
  ALTER COLUMN amount TYPE integer USING round(amount::numeric);

ALTER TABLE "DocApprovalRow"
  ALTER COLUMN amount TYPE integer USING round(amount::numeric);

-- 時給（2026-08 追加）。
-- **人の給与に直結するので、STEP 1 が 0 件であることを必ず確かめてから実行すること。**
ALTER TABLE "WageRow"
  ALTER COLUMN "hourlyWage" TYPE integer USING round("hourlyWage"::numeric);

COMMIT;

-- ═══════════════════════════ STEP 3: 事後確認 ═══════════════════════════
-- すべて `integer` になっていることを確かめる。

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name, column_name) IN (
    ('InvoiceRow','subtotal'), ('InvoiceRow','tax'), ('InvoiceRow','total'), ('InvoiceRow','paidAmount'),
    ('QuoteRow','subtotal'), ('QuoteRow','tax'), ('QuoteRow','total'),
    ('PurchaseOrderRow','subtotal'), ('PurchaseOrderRow','tax'), ('PurchaseOrderRow','total'),
    ('PurchasePaymentRow','amount'), ('AssetRow','cost'), ('AssetRow','proceeds'),
    ('BudgetRow','amount'), ('InvoiceReceiptRow','amount'), ('DocApprovalRow','amount'),
    ('WageRow','hourlyWage')
  )
ORDER BY table_name, column_name;

-- **`double precision` が 1 つでも残っていたら、schema と食い違っています。**
-- `pnpm db push` が次に走ったとき、そこだけ勝手に変換されます
-- （`--accept-data-loss` を求められるので、そこで気づけるはずです）。
