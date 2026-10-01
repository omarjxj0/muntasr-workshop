-- ============================================================
-- Migration 021: Fix corrupted financial records
-- Reverts values accidentally multiplied x1000 by the old
-- handleFinancialBlur() shortcut behavior.
--
-- Any value >= 1,000,000 IQD that is divisible by 1000 is
-- assumed mistakenly multiplied and is divided back by 1000.
-- Run ONCE after deploying the code fix.
-- ============================================================

-- 1. Expenses
UPDATE expenses
SET    amount = amount / 1000
WHERE  amount >= 1000000
  AND  (amount::bigint % 1000) = 0;

-- 2. ECU purchase_price
UPDATE ecus
SET    purchase_price = purchase_price / 1000
WHERE  purchase_price >= 1000000
  AND  (purchase_price::bigint % 1000) = 0;

-- 3. ECU selling_price
UPDATE ecus
SET    selling_price = selling_price / 1000
WHERE  selling_price >= 1000000
  AND  (selling_price::bigint % 1000) = 0;

-- 4. Visit labor costs
UPDATE visits
SET    labor_cost = labor_cost / 1000
WHERE  labor_cost  >= 1000000
  AND  (labor_cost::bigint % 1000) = 0;

-- 5. Daily wages
UPDATE daily_wages
SET    amount = amount / 1000
WHERE  amount >= 1000000
  AND  (amount::bigint % 1000) = 0;

-- 6. Manual transactions only (Other type)
UPDATE transactions
SET    amount = amount / 1000
WHERE  amount >= 1000000
  AND  reference_type = 'Other'
  AND  (amount::bigint % 1000) = 0;

-- 7. Quick inspection fees
UPDATE quick_inspections
SET    inspection_fee = inspection_fee / 1000
WHERE  inspection_fee >= 1000000
  AND  (inspection_fee::bigint % 1000) = 0;

-- 8. Used parts selling_price_at_time
UPDATE used_parts
SET    selling_price_at_time = selling_price_at_time / 1000
WHERE  selling_price_at_time >= 1000000
  AND  (selling_price_at_time::bigint % 1000) = 0;
