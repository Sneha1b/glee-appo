DROP VIEW IF EXISTS public.booked_slots;
DROP VIEW IF EXISTS public.active_slot_locks;

CREATE OR REPLACE FUNCTION public.get_booked_slots(p_staff_ids uuid[], p_from timestamptz, p_to timestamptz)
RETURNS TABLE (staff_id uuid, start_at timestamptz, end_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT staff_id, start_at, end_at
  FROM public.bookings
  WHERE staff_id = ANY(p_staff_ids)
    AND start_at >= p_from
    AND start_at <  p_to;
$$;

CREATE OR REPLACE FUNCTION public.get_active_slot_locks(p_staff_ids uuid[], p_from timestamptz, p_to timestamptz)
RETURNS TABLE (staff_id uuid, start_at timestamptz, end_at timestamptz, expires_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT staff_id, start_at, end_at, expires_at
  FROM public.slot_locks
  WHERE staff_id = ANY(p_staff_ids)
    AND start_at >= p_from
    AND start_at <  p_to
    AND expires_at > now();
$$;

REVOKE EXECUTE ON FUNCTION public.get_booked_slots(uuid[], timestamptz, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_active_slot_locks(uuid[], timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(uuid[], timestamptz, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_slot_locks(uuid[], timestamptz, timestamptz) TO anon, authenticated;