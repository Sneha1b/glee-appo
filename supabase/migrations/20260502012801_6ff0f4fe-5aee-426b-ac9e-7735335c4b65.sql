-- Recreate views as SECURITY DEFINER (default) so they bypass the underlying
-- restrictive RLS — they only expose timing columns, never PII.
DROP VIEW IF EXISTS public.booked_slots;
DROP VIEW IF EXISTS public.active_slot_locks;

CREATE VIEW public.booked_slots AS
  SELECT staff_id, start_at, end_at FROM public.bookings;

CREATE VIEW public.active_slot_locks AS
  SELECT staff_id, start_at, end_at, expires_at
  FROM public.slot_locks
  WHERE expires_at > now();

GRANT SELECT ON public.booked_slots TO anon, authenticated;
GRANT SELECT ON public.active_slot_locks TO anon, authenticated;