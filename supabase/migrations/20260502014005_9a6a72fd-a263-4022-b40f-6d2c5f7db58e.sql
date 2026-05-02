-- 1. Drop staff.email (publicly readable PII)
ALTER TABLE public.staff DROP COLUMN IF EXISTS email;

-- 2. Lock down business_owners INSERT — remove open self-insert
DROP POLICY IF EXISTS "owner inserts own link" ON public.business_owners;

-- Replace with secure function: creates business + ownership atomically
CREATE OR REPLACE FUNCTION public.create_business_with_owner(
  p_name text,
  p_category text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_address_line1 text DEFAULT NULL,
  p_address_line2 text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_banner_url text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_business_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  -- One business per owner (prevents hijack and noise)
  IF EXISTS (SELECT 1 FROM public.business_owners WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'already_owns_business';
  END IF;
  INSERT INTO public.businesses(name, category, phone, description, address_line1, address_line2, city, region, postal_code, country, logo_url, banner_url)
  VALUES (p_name, p_category, p_phone, p_description, p_address_line1, p_address_line2, p_city, p_region, p_postal_code, p_country, p_logo_url, p_banner_url)
  RETURNING id INTO v_business_id;
  INSERT INTO public.business_owners(user_id, business_id) VALUES (v_uid, v_business_id);
  RETURN v_business_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.create_business_with_owner(text,text,text,text,text,text,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_business_with_owner(text,text,text,text,text,text,text,text,text,text,text,text) TO authenticated;

-- 3. Lock down user_roles self-insert
DROP POLICY IF EXISTS "users insert own roles" ON public.user_roles;

CREATE OR REPLACE FUNCTION public.assign_my_role(p_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_role NOT IN ('customer','provider') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  -- Allow only if user has no role yet, OR is re-asserting same role (idempotent)
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid) THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = p_role) THEN
      RAISE EXCEPTION 'role_already_assigned';
    END IF;
    RETURN;
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (v_uid, p_role);
END $$;

REVOKE EXECUTE ON FUNCTION public.assign_my_role(app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_my_role(app_role) TO authenticated;

-- Tighten existing definer functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;

-- 4. Invoices table
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  business_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  staff_id uuid,
  service_id uuid,
  service_name text NOT NULL,
  staff_name text,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  amount numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'issued',
  appointment_at timestamptz NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '18 months'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invoices_business_idx ON public.invoices(business_id, issued_at DESC);
CREATE INDEX invoices_booking_idx  ON public.invoices(booking_id);
CREATE INDEX invoices_expiry_idx   ON public.invoices(expires_at);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.business_owners bo
                 WHERE bo.business_id = invoices.business_id AND bo.user_id = auth.uid()));

CREATE POLICY "customers read own invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (lower(customer_email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

-- Inserts only via SECURITY DEFINER function (called by edge function or confirm flow)
CREATE OR REPLACE FUNCTION public.create_invoice_for_booking(p_booking_id uuid)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b public.bookings;
  v_s public.services;
  v_st public.staff;
  v_inv public.invoices;
  v_num text;
BEGIN
  SELECT * INTO v_b FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking_not_found'; END IF;
  SELECT * INTO v_s FROM public.services WHERE id = v_b.service_id;
  SELECT * INTO v_st FROM public.staff WHERE id = v_b.staff_id;
  -- Idempotent
  SELECT * INTO v_inv FROM public.invoices WHERE booking_id = p_booking_id LIMIT 1;
  IF FOUND THEN RETURN v_inv; END IF;
  v_num := 'INV-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(p_booking_id::text,'-',''),1,6));
  INSERT INTO public.invoices(
    invoice_number, business_id, booking_id, staff_id, service_id,
    service_name, staff_name, customer_name, customer_email, customer_phone,
    amount, tax, total, appointment_at
  ) VALUES (
    v_num, v_b.business_id, v_b.id, v_b.staff_id, v_b.service_id,
    coalesce(v_s.name,'Service'), v_st.name, v_b.customer_name, v_b.customer_email, v_b.customer_phone,
    coalesce(v_s.price,0), 0, coalesce(v_s.price,0), v_b.start_at
  ) RETURNING * INTO v_inv;
  RETURN v_inv;
END $$;

REVOKE EXECUTE ON FUNCTION public.create_invoice_for_booking(uuid) FROM PUBLIC, anon, authenticated;
-- Only service role (edge functions) calls this

-- 5. Retention cleanup function (scheduled job will run this)
CREATE OR REPLACE FUNCTION public.cleanup_expired_invoices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  DELETE FROM public.invoices WHERE expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_invoices() FROM PUBLIC, anon, authenticated;

-- 6. Schedule daily cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-invoices') THEN
    PERFORM cron.schedule('cleanup-expired-invoices', '0 3 * * *', $cron$SELECT public.cleanup_expired_invoices();$cron$);
  END IF;
END $$;