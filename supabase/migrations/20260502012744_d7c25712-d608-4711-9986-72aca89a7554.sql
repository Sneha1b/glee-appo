-- Drop the public read on bookings (exposes PII)
DROP POLICY IF EXISTS "bookings public read" ON public.bookings;

-- Allow business owners to read their own bookings
CREATE POLICY "owners read bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.business_owners bo
      WHERE bo.business_id = bookings.business_id
        AND bo.user_id = auth.uid()
    )
  );

-- Public, non-PII view used by the booking calendar to know which slots are taken
CREATE OR REPLACE VIEW public.booked_slots
WITH (security_invoker = on) AS
  SELECT staff_id, start_at, end_at
  FROM public.bookings;

-- Same idea for active slot locks (their base table is fully locked down)
CREATE OR REPLACE VIEW public.active_slot_locks
WITH (security_invoker = on) AS
  SELECT staff_id, start_at, end_at, expires_at
  FROM public.slot_locks
  WHERE expires_at > now();

-- Make the views readable by everyone (definer rights inside the view body bypass slot_locks RLS)
GRANT SELECT ON public.booked_slots TO anon, authenticated;
GRANT SELECT ON public.active_slot_locks TO anon, authenticated;