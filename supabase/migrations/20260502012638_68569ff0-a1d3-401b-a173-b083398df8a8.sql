-- 1) Remove permissive policies; access flows through SECURITY DEFINER RPCs
DROP POLICY IF EXISTS "locks public" ON public.slot_locks;
DROP POLICY IF EXISTS "bookings public insert" ON public.bookings;

-- 2) has_role is an internal helper for other RLS policies; revoke direct exec
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

-- 3) Booking RPCs must remain callable by guests + signed-in users only (not service-role-only callers from outside)
REVOKE EXECUTE ON FUNCTION public.acquire_slot_lock(text, uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_slot_lock(text, uuid, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_booking(text, uuid, uuid, timestamptz, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.acquire_slot_lock(text, uuid, uuid, timestamptz, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_slot_lock(text, uuid, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_booking(text, uuid, uuid, timestamptz, text, text, text) TO anon, authenticated;