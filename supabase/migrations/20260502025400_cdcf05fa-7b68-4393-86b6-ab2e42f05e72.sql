-- Harden booking correctness: overlap + past-time checks inside SECURITY DEFINER RPCs.
-- Lock acquisition must reject past slots and overlapping bookings (not just exact-start collisions).
CREATE OR REPLACE FUNCTION public.acquire_slot_lock(
  p_holder text, p_staff uuid, p_service uuid,
  p_start timestamptz, p_end timestamptz
) RETURNS public.slot_locks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lock public.slot_locks;
BEGIN
  IF p_start <= now() THEN
    RAISE EXCEPTION 'slot_in_past' USING ERRCODE = 'P0001';
  END IF;
  IF p_end <= p_start THEN
    RAISE EXCEPTION 'invalid_range' USING ERRCODE = 'P0001';
  END IF;

  -- Reject if any confirmed booking overlaps [p_start, p_end) for this staff
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE staff_id = p_staff
      AND status = 'confirmed'
      AND start_at < p_end
      AND end_at   > p_start
  ) THEN
    RAISE EXCEPTION 'already_booked' USING ERRCODE = 'P0001';
  END IF;

  -- Reject if an active lock held by someone else overlaps
  IF EXISTS (
    SELECT 1 FROM public.slot_locks
    WHERE staff_id = p_staff
      AND expires_at > now()
      AND holder_session_id <> p_holder
      AND start_at < p_end
      AND end_at   > p_start
  ) THEN
    RAISE EXCEPTION 'slot_locked' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.slot_locks
   WHERE staff_id = p_staff AND start_at = p_start AND expires_at <= now();

  INSERT INTO public.slot_locks (holder_session_id, staff_id, service_id, start_at, end_at, expires_at)
  VALUES (p_holder, p_staff, p_service, p_start, p_end, now() + interval '60 seconds')
  ON CONFLICT (staff_id, start_at) DO UPDATE
    SET holder_session_id = EXCLUDED.holder_session_id,
        service_id = EXCLUDED.service_id,
        end_at = EXCLUDED.end_at,
        created_at = now(),
        expires_at = now() + interval '60 seconds'
    WHERE public.slot_locks.holder_session_id = p_holder
       OR public.slot_locks.expires_at <= now()
  RETURNING * INTO v_lock;

  IF v_lock.id IS NULL THEN
    RAISE EXCEPTION 'slot_locked' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_lock;
END $$;

-- confirm_booking: re-validate lock + overlap atomically inside the transaction.
CREATE OR REPLACE FUNCTION public.confirm_booking(
  p_holder text, p_service uuid, p_staff uuid,
  p_start timestamptz, p_name text, p_email text, p_phone text
) RETURNS public.bookings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lock public.slot_locks;
  v_service public.services;
  v_booking public.bookings;
BEGIN
  -- Lock the row to serialize concurrent confirms for same slot
  SELECT * INTO v_lock FROM public.slot_locks
   WHERE staff_id = p_staff
     AND start_at = p_start
     AND holder_session_id = p_holder
     AND expires_at > now()
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lock_invalid' USING ERRCODE = 'P0001';
  END IF;

  IF v_lock.start_at <= now() THEN
    RAISE EXCEPTION 'slot_in_past' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_service FROM public.services WHERE id = p_service;
  IF NOT FOUND THEN RAISE EXCEPTION 'service_not_found'; END IF;

  -- Final overlap re-check inside the transaction
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE staff_id = p_staff
      AND status = 'confirmed'
      AND start_at < v_lock.end_at
      AND end_at   > v_lock.start_at
  ) THEN
    RAISE EXCEPTION 'already_booked' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.bookings (business_id, service_id, staff_id, customer_name, customer_email, customer_phone, start_at, end_at)
  VALUES (v_service.business_id, p_service, p_staff, p_name, p_email, p_phone, v_lock.start_at, v_lock.end_at)
  RETURNING * INTO v_booking;

  DELETE FROM public.slot_locks WHERE id = v_lock.id;
  RETURN v_booking;
END $$;