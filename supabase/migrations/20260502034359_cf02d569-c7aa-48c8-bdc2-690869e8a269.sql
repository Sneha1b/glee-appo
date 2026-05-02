
CREATE OR REPLACE FUNCTION public.get_business_metrics(p_business_id uuid, p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_since timestamptz := now() - make_interval(days => coalesce(p_days, 30));
  v_top_services jsonb;
  v_busy_dow jsonb;
  v_busy_hour jsonb;
  v_funnel jsonb;
  v_total_locks integer := 0;
  v_confirmed integer := 0;
  v_abandoned integer := 0;
  v_avg_seconds numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.business_owners WHERE business_id = p_business_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'not_owner';
  END IF;

  -- Top services by confirmed bookings
  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_top_services
  FROM (
    SELECT s.name, count(*)::int AS bookings
    FROM public.bookings b
    JOIN public.services s ON s.id = b.service_id
    WHERE b.business_id = p_business_id
      AND b.status = 'confirmed'
      AND b.created_at >= v_since
    GROUP BY s.name
    ORDER BY bookings DESC
    LIMIT 8
  ) t;

  -- Busiest day of week (0=Sun..6=Sat) for booked appointments
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY (t.dow)::int), '[]'::jsonb) INTO v_busy_dow
  FROM (
    SELECT EXTRACT(DOW FROM b.start_at)::int AS dow, count(*)::int AS bookings
    FROM public.bookings b
    WHERE b.business_id = p_business_id
      AND b.status = 'confirmed'
      AND b.created_at >= v_since
    GROUP BY 1
  ) t;

  -- Busiest hour of day (0..23)
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY (t.hour)::int), '[]'::jsonb) INTO v_busy_hour
  FROM (
    SELECT EXTRACT(HOUR FROM b.start_at)::int AS hour, count(*)::int AS bookings
    FROM public.bookings b
    WHERE b.business_id = p_business_id
      AND b.status = 'confirmed'
      AND b.created_at >= v_since
    GROUP BY 1
  ) t;

  -- Funnel: total slot lock attempts vs confirmed bookings vs abandoned (expired locks with no resulting booking)
  SELECT count(*)::int INTO v_total_locks
  FROM public.slot_locks sl
  JOIN public.staff st ON st.id = sl.staff_id
  WHERE st.business_id = p_business_id AND sl.created_at >= v_since;

  SELECT count(*)::int INTO v_confirmed
  FROM public.bookings b
  WHERE b.business_id = p_business_id AND b.status = 'confirmed' AND b.created_at >= v_since;

  -- Abandoned: locks that expired in the past with no booking covering that slot
  SELECT count(*)::int INTO v_abandoned
  FROM public.slot_locks sl
  JOIN public.staff st ON st.id = sl.staff_id
  WHERE st.business_id = p_business_id
    AND sl.created_at >= v_since
    AND sl.expires_at <= now()
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.staff_id = sl.staff_id AND b.start_at = sl.start_at
    );

  -- Average time-to-complete a booking: lock.created_at -> booking.created_at for the same slot
  SELECT avg(EXTRACT(EPOCH FROM (b.created_at - sl.created_at))) INTO v_avg_seconds
  FROM public.bookings b
  JOIN public.staff st ON st.id = b.staff_id
  JOIN public.slot_locks sl ON sl.staff_id = b.staff_id AND sl.start_at = b.start_at
  WHERE st.business_id = p_business_id
    AND b.created_at >= v_since
    AND b.created_at >= sl.created_at;

  v_funnel := jsonb_build_object(
    'total_lock_attempts', v_total_locks,
    'confirmed_bookings', v_confirmed,
    'abandoned_attempts', v_abandoned,
    'avg_time_to_complete_seconds', coalesce(v_avg_seconds, 0)
  );

  RETURN jsonb_build_object(
    'window_days', p_days,
    'top_services', v_top_services,
    'busy_dow', v_busy_dow,
    'busy_hour', v_busy_hour,
    'funnel', v_funnel
  );
END $function$;

REVOKE EXECUTE ON FUNCTION public.get_business_metrics(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_business_metrics(uuid, integer) TO authenticated;
