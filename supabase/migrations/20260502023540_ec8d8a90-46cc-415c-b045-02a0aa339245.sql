
-- Business weekly hours (whole-store hours, separate from per-staff availabilities)
CREATE TABLE IF NOT EXISTS public.business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  open_minute integer NOT NULL CHECK (open_minute BETWEEN 0 AND 1440),
  close_minute integer NOT NULL CHECK (close_minute BETWEEN 0 AND 1440),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, weekday)
);

ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_hours public read" ON public.business_hours
  FOR SELECT USING (true);

CREATE POLICY "owners manage business_hours" ON public.business_hours
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.business_owners bo WHERE bo.business_id = business_hours.business_id AND bo.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.business_owners bo WHERE bo.business_id = business_hours.business_id AND bo.user_id = auth.uid()));

-- Business closure dates (single days or date ranges)
CREATE TABLE IF NOT EXISTS public.business_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  from_date date NOT NULL,
  to_date date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (to_date >= from_date)
);

ALTER TABLE public.business_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_closures public read" ON public.business_closures
  FOR SELECT USING (true);

CREATE POLICY "owners manage business_closures" ON public.business_closures
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.business_owners bo WHERE bo.business_id = business_closures.business_id AND bo.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.business_owners bo WHERE bo.business_id = business_closures.business_id AND bo.user_id = auth.uid()));

-- Allow a freshly-booked customer to fetch their booking summary on the pay/success page
CREATE OR REPLACE FUNCTION public.get_booking_public(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', b.id,
    'status', b.status,
    'start_at', b.start_at,
    'end_at', b.end_at,
    'customer_name', b.customer_name,
    'customer_email', b.customer_email,
    'customer_phone', b.customer_phone,
    'service', jsonb_build_object('id', s.id, 'name', s.name, 'duration_min', s.duration_min, 'price', s.price),
    'staff', jsonb_build_object('id', st.id, 'name', st.name),
    'business', jsonb_build_object(
      'id', bz.id, 'name', bz.name, 'phone', bz.phone,
      'address_line1', bz.address_line1, 'address_line2', bz.address_line2,
      'city', bz.city, 'region', bz.region, 'postal_code', bz.postal_code,
      'logo_url', bz.logo_url
    )
  ) INTO v
  FROM public.bookings b
  JOIN public.services s  ON s.id  = b.service_id
  JOIN public.staff st    ON st.id = b.staff_id
  JOIN public.businesses bz ON bz.id = b.business_id
  WHERE b.id = p_booking_id;
  RETURN v;
END $$;

GRANT EXECUTE ON FUNCTION public.get_booking_public(uuid) TO anon, authenticated;

-- Cancel future confirmed bookings that no longer fit business hours or land on a closure day
CREATE OR REPLACE FUNCTION public.cancel_out_of_hours_bookings(p_business_id uuid)
RETURNS TABLE(cancelled_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.business_owners WHERE business_id = p_business_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not_owner';
  END IF;

  RETURN QUERY
  WITH affected AS (
    SELECT b.id
    FROM public.bookings b
    WHERE b.business_id = p_business_id
      AND b.status = 'confirmed'
      AND b.start_at >= now()
      AND (
        -- on a closure date
        EXISTS (
          SELECT 1 FROM public.business_closures c
          WHERE c.business_id = p_business_id
            AND (b.start_at AT TIME ZONE 'UTC')::date BETWEEN c.from_date AND c.to_date
        )
        OR
        -- outside business hours (or no hours set for that weekday)
        NOT EXISTS (
          SELECT 1 FROM public.business_hours h
          WHERE h.business_id = p_business_id
            AND h.weekday = EXTRACT(DOW FROM b.start_at AT TIME ZONE 'UTC')::smallint
            AND h.open_minute  <= (EXTRACT(HOUR FROM b.start_at AT TIME ZONE 'UTC')*60 + EXTRACT(MINUTE FROM b.start_at AT TIME ZONE 'UTC'))::int
            AND h.close_minute >= (EXTRACT(HOUR FROM b.end_at   AT TIME ZONE 'UTC')*60 + EXTRACT(MINUTE FROM b.end_at   AT TIME ZONE 'UTC'))::int
        )
      )
  ),
  upd AS (
    UPDATE public.bookings SET status = 'cancelled'
    WHERE id IN (SELECT id FROM affected)
    RETURNING id
  )
  SELECT id FROM upd;
END $$;

GRANT EXECUTE ON FUNCTION public.cancel_out_of_hours_bookings(uuid) TO authenticated;
