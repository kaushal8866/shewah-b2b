-- Task #74 — Atomic plpgsql functions backing the guided cancellation
-- and Ready-to-Ship offer-accept flows. Each function performs all of
-- its writes in a single transaction so a mid-step failure cannot leave
-- partial lifecycle state (split float ownership, orphan listings, etc).
--
-- Idempotent: each function is dropped and recreated.

-- ---------------------------------------------------------------- reassign
DROP FUNCTION IF EXISTS reassign_mfg_order_for_cancel(uuid, uuid, text);
CREATE FUNCTION reassign_mfg_order_for_cancel(
  p_order_id        uuid,
  p_new_partner_id  uuid,
  p_reason          text
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  tx           record;
  v_target_id  uuid;
  v_mat_type   text;
  v_unit       text;
BEGIN
  IF p_order_id IS NULL OR p_new_partner_id IS NULL THEN
    RAISE EXCEPTION 'order_id and new_partner_id are required';
  END IF;

  FOR tx IN
    SELECT id, float_id
      FROM material_transactions
     WHERE manufacturing_order_id = p_order_id
       AND transaction_type       = 'consumption'
       AND lifecycle              = 'pending'
       AND float_id IS NOT NULL
  LOOP
    SELECT material_type, COALESCE(unit, 'grams')
      INTO v_mat_type, v_unit
      FROM material_float
     WHERE id = tx.float_id;

    IF v_mat_type IS NULL THEN CONTINUE; END IF;

    SELECT id INTO v_target_id
      FROM material_float
     WHERE manufacturing_partner_id = p_new_partner_id
       AND material_type            = v_mat_type
     LIMIT 1;

    IF v_target_id IS NULL THEN
      INSERT INTO material_float (
        manufacturing_partner_id, material_type, unit,
        total_deposited, total_consumed
      ) VALUES (
        p_new_partner_id, v_mat_type, v_unit, 0, 0
      ) RETURNING id INTO v_target_id;
    END IF;

    UPDATE material_transactions
       SET float_id                  = v_target_id,
           manufacturing_partner_id  = p_new_partner_id,
           notes = COALESCE(NULLIF(notes, ''), '') ||
                   CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE ' | ' END ||
                   'Reassigned: ' || COALESCE(p_reason, 'no reason given')
     WHERE id = tx.id;
  END LOOP;

  UPDATE manufacturing_orders
     SET manufacturing_partner_id = p_new_partner_id
   WHERE id = p_order_id;
END;
$$;

-- ----------------------------------------------------- receive after cancel
DROP FUNCTION IF EXISTS receive_mfg_order_after_cancel(
  uuid, numeric, numeric, numeric, jsonb, text[], numeric, text, uuid
);
CREATE FUNCTION receive_mfg_order_after_cancel(
  p_order_id         uuid,
  p_actual_pure      numeric,
  p_karat_factor     numeric,
  p_actual_diamond   numeric,
  p_diamond_specs    jsonb,
  p_photos           text[],
  p_list_price       numeric,
  p_receive_notes    text,
  p_product_id       uuid
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_actual_gross  numeric;
  v_karat         int;
  v_total_cost    numeric;
  v_customer_ord  uuid;
  v_rts_id        uuid;
BEGIN
  IF p_actual_pure IS NULL OR p_actual_pure <= 0 THEN
    RAISE EXCEPTION 'actual_pure_24kt_g must be > 0';
  END IF;
  IF p_karat_factor IS NULL OR p_karat_factor <= 0 THEN
    RAISE EXCEPTION 'karat_factor must be > 0';
  END IF;
  IF p_list_price IS NULL OR p_list_price <= 0 THEN
    RAISE EXCEPTION 'list_price must be > 0';
  END IF;

  v_actual_gross := p_actual_pure / p_karat_factor;

  SELECT gold_karat, total_manufacturing_cost, customer_order_id
    INTO v_karat, v_total_cost, v_customer_ord
    FROM manufacturing_orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF v_karat IS NULL THEN v_karat := 22; END IF;

  -- Settle every pending consumption row to the actual gross weight; any
  -- leftover (required - actual) stays in the karigar's float as available
  -- material — no extra refund row needed.
  UPDATE material_transactions
     SET quantity  = v_actual_gross,
         lifecycle = 'final',
         notes = 'Settled on receive-after-cancel: actual ' ||
                 to_char(v_actual_gross, 'FM999990.0000') || 'g (' ||
                 to_char(p_actual_pure,  'FM999990.0000') || 'g 24kt-pure)'
   WHERE manufacturing_order_id = p_order_id
     AND transaction_type       = 'consumption'
     AND lifecycle              = 'pending';

  UPDATE manufacturing_orders
     SET status              = 'received_after_cancel',
         gold_weight_actual  = v_actual_gross,
         diamond_weight      = COALESCE(NULLIF(p_actual_diamond, 0), diamond_weight),
         completed_date      = CURRENT_DATE
   WHERE id = p_order_id;

  INSERT INTO ready_to_ship_items (
    product_id, source_mfg_order_id, source_order_id,
    karat, gross_weight, pure_24kt_weight,
    diamond_specs, photos, list_price, original_cogs,
    status, internal_notes
  ) VALUES (
    p_product_id, p_order_id, v_customer_ord,
    v_karat, v_actual_gross, p_actual_pure,
    COALESCE(p_diamond_specs, '{}'::jsonb),
    COALESCE(p_photos, ARRAY[]::text[]),
    p_list_price, v_total_cost,
    'available', NULLIF(p_receive_notes, '')
  ) RETURNING id INTO v_rts_id;

  RETURN v_rts_id;
END;
$$;

-- ---------------------------------------------- accept ready-to-ship offer
DROP FUNCTION IF EXISTS accept_ready_to_ship_offer(uuid, uuid, uuid);
CREATE FUNCTION accept_ready_to_ship_offer(
  p_item_id     uuid,
  p_offer_id    uuid,
  p_decided_by  uuid
) RETURNS TABLE (order_id uuid, order_number text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_item        record;
  v_offer       record;
  v_year        int := EXTRACT(YEAR FROM now())::int;
  v_seq         int := 1;
  v_num         text;
  v_attempt     int := 0;
  v_order_id    uuid;
  v_last_num    text;
BEGIN
  -- Lock the item so two parallel accepts cannot both succeed.
  SELECT id, product_id, status, list_price, karat, gross_weight, pure_24kt_weight
    INTO v_item
    FROM ready_to_ship_items
   WHERE id = p_item_id
   FOR UPDATE;
  IF v_item.id IS NULL  THEN RAISE EXCEPTION 'Ready-to-Ship item not found'; END IF;
  IF v_item.status <> 'available' THEN
    RAISE EXCEPTION 'Item is %, cannot accept offers', v_item.status;
  END IF;

  SELECT id, partner_id, offer_price, status
    INTO v_offer
    FROM ready_to_ship_offers
   WHERE id = p_offer_id AND item_id = p_item_id
   FOR UPDATE;
  IF v_offer.id IS NULL THEN RAISE EXCEPTION 'Offer not found'; END IF;
  IF v_offer.status NOT IN ('pending','countered') THEN
    RAISE EXCEPTION 'Offer is already %', v_offer.status;
  END IF;

  -- Reserve a unique order number, retrying on collision.
  SELECT order_number INTO v_last_num
    FROM orders
   WHERE order_number ILIKE 'SH-ORD-' || v_year || '-%'
   ORDER BY order_number DESC
   LIMIT 1;
  IF v_last_num IS NOT NULL THEN
    v_seq := COALESCE(NULLIF(regexp_replace(v_last_num, '.*-', ''), '')::int, 0) + 1;
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    v_num := 'SH-ORD-' || v_year || '-' || lpad(v_seq::text, 3, '0');
    BEGIN
      INSERT INTO orders (
        order_number, partner_id, product_id, type, model, quantity,
        trade_price, total_amount, advance_paid, balance_due, status,
        order_date, expected_delivery,
        selected_karat, gold_karat, gross_weight_at_karat, gold_pure_24kt_g,
        internal_notes
      ) VALUES (
        v_num, v_offer.partner_id, v_item.product_id, 'catalog', 'wholesale', 1,
        v_offer.offer_price, v_offer.offer_price, 0, v_offer.offer_price, 'production',
        CURRENT_DATE, CURRENT_DATE + 7,
        v_item.karat, v_item.karat, v_item.gross_weight, v_item.pure_24kt_weight,
        'Created from accepted Ready-to-Ship offer (item ' || v_item.id || ')'
      ) RETURNING id INTO v_order_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_seq := v_seq + 1;
      IF v_attempt >= 6 THEN RAISE; END IF;
    END;
  END LOOP;

  UPDATE ready_to_ship_offers
     SET status             = 'accepted',
         decided_at         = now(),
         decided_by         = p_decided_by,
         resulting_order_id = v_order_id
   WHERE id = v_offer.id;

  UPDATE ready_to_ship_offers
     SET status     = 'rejected',
         decided_at = now(),
         decided_by = p_decided_by
   WHERE item_id = p_item_id
     AND status  = 'pending'
     AND id     <> v_offer.id;

  UPDATE ready_to_ship_items
     SET status              = 'sold',
         sold_to_partner_id  = v_offer.partner_id,
         sold_order_id       = v_order_id,
         sold_at             = now()
   WHERE id = p_item_id;

  RETURN QUERY SELECT v_order_id, v_num;
END;
$$;
